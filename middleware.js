import { NextResponse } from 'next/server';

const GHOST_HOST = 'blog-conseils-strategie-croissance.ghost.io';
const SQUARESPACE_HOST = 'bamboo-celery-eayp.squarespace.com';
const BLOG_PATH = '/blog-conseils-strategie-croissance';
const PUBLIC_HOST = 'keepgrowing.fr';
const PUBLIC_BASE = `https://${PUBLIC_HOST}${BLOG_PATH}`;

// Keep Growing brand logo for OG sharing when Ghost has no custom image
const KG_OG_FALLBACK = 'https://static1.squarespace.com/static/671e09206ef0e92e89d66701/t/69530af543467e5d367d1359/1732363625778/logo-keepgrowing-fond-blanc.jpg?format=1500w';

// Search Atlas / OTTO dynamic optimization pixel — injected into Ghost responses
// so OTTO can apply on-page recommendations (title, meta description, keywords, canonical, schema)
// to the proxied blog pages. Without this, OTTO sees /blog-*/ as un-instrumented.
// OTTO pixel — points to the apex project f529dd29 (the old www project a1e21b39
// was deleted by Search Atlas when the apex project was created; its UUID now 404s).
const OTTO_PIXEL = '<script nowprocket nitro-exclude type="text/javascript" id="sa-dynamic-optimization" data-uuid="f529dd29-66a6-4e99-9cf0-82f39657eb89" src="data:text/javascript;base64,dmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoInNjcmlwdCIpO3NjcmlwdC5zZXRBdHRyaWJ1dGUoIm5vd3Byb2NrZXQiLCAiIik7c2NyaXB0LnNldEF0dHJpYnV0ZSgibml0cm8tZXhjbHVkZSIsICIiKTtzY3JpcHQuc3JjID0gImh0dHBzOi8vZGFzaGJvYXJkLnNlYXJjaGF0bGFzLmNvbS9zY3JpcHRzL2R5bmFtaWNfb3B0aW1pemF0aW9uLmpzIjtzY3JpcHQuZGF0YXNldC51dWlkID0gImY1MjlkZDI5LTY2YTYtNGU5OS05Y2YwLTgyZjM5NjU3ZWI4OSI7c2NyaXB0LmlkID0gInNhLWR5bmFtaWMtb3B0aW1pemF0aW9uLWxvYWRlciI7ZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpOw=="></script>';

// SEO display limits (Google SERP truncates beyond these)
const OG_TITLE_MAX = 70;
const OG_DESC_MAX = 160;

function smartTruncate(str, max) {
  if (str.length <= max) return str;
  return str.substr(0, max - 1).replace(/\s+\S*$/, '').replace(/[\s\p{P}]+$/u, '') + '…';
}

// Decode common HTML entities in visible HTML outside of <script> and <style>
// blocks. Ghost outputs apostrophes as `&#x27;` in titles, excerpts, alt
// attributes and button labels. Browsers decode them transparently but some
// LLM crawlers and SEO scrapers see the raw entities, hurting extraction.
// Keep entities inside <script> (e.g. JSON-LD has its own decoder) and
// <style> blocks untouched.
function decodeApostropheEntities(html) {
  return html.replace(
    /(<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)|(&#x27;|&#39;|&apos;)/gi,
    (match, skip, entity) => skip || "'"
  );
}

function rewriteBody(text) {
  return decodeApostropheEntities(
    text
      .replace(/https?:\/\/blog-conseils-strategie-croissance\.ghost\.io/g, PUBLIC_BASE)
      .replace(/blog-conseils-strategie-croissance\.ghost\.io/g, `${PUBLIC_HOST}${BLOG_PATH}`)
      // Dead Calendly CTAs: calendly.com/keep-growing(+variants) returns 404
      // since the account was closed (audit 114515 "Has External Broken
      // Links" — 7 articles). KG now books via lemcal — route directly to
      // David's live booking page (validated 200).
      .replace(/https?:\/\/calendly\.com\/keep-growing[^"'\s<)]*/g, 'https://app.lemcal.com/@david-zaoui/45')
  );
}

// Near-duplicate article pairs (audit 114515 "Non Unique Content", 10 pairs).
// SEO consolidation without deleting content: the weaker page declares the
// stronger one as canonical. Keys/values are ghostPath (post-BLOG_PATH).
const DUPLICATE_CANONICALS = {
  '/esprit-d-equipe-collaboration-solidarite/': '/le-leadership-de-lequipe-commerciale-facteur-humain-au/',
  '/conversations-executives-seduire-grands-comptes/': '/executive-conversation-pitch-dirigeant/',
  '/la-peur-de-closer-comment-surmonter-crainte-conclure-vente/': '/peur-de-conclure-crainte-de-vendre/',
  '/cle-de-la-reussite-en-vente-surmonter-peur-du-rejet/': '/cle-reussite-vente-techniques-strategies/',
  '/monter-reseau-partenaires-performant/': '/strategie-reseau-partenaires-b2b/',
  '/quelles-sont-les-composantes-dune-bonne-formation-a-la/': '/formation-vente-competences-commerciales/',
  '/lagenda-du-dirigeant-de-startup-naviguer-entre-le-les/': '/maitriser-leadership-startup/',
  '/mesurer-lefficacite-du-funnel-de-vente-a-travers-des-kpis/': '/indicateurs-cles-vente-kpis-strategie-commerciale/',
  '/boostez-votre-equipe-commerciale-avec-des-rituels-danimation/': '/efficacite-commerciale-cohesion-equipes/',
  '/optimiser-force-commerciale-performance-durable/': '/pme-eti-la-transformation-digitale-de-votre-force/',
};

// Decode HTML entities INSIDE JSON-LD <script> blocks + clean schema bugs:
// - Ghost emits "d&#x27;une" inside Article schema → decode entities
// - Squarespace emits Product schema with relative URLs "/contact" → make absolute
// - Squarespace emits "review": null / "aggregateRating": null → strip nulls
// - Trim whitespace/newlines around string values (Squarespace + Ghost both add them)
function decodeJsonLdEntities(html) {
  return html.replace(
    /(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (match, openTag, json, closeTag) => {
      let decoded = json
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x2013;/gi, '–')
        .replace(/&#x2014;/gi, '—')
        .replace(/&#x2026;/gi, '…')
        .replace(/&#xa0;/gi, ' ')
        .replace(/&#160;/g, ' ')
        // Escape raw newlines/tabs that appear INSIDE JSON string values.
        // Squarespace's apex Organization schema emits multi-line addresses like
        //   "address": "94 Rue de la Victoire
        //   Paris, IDF, 75009
        //   France"
        // which is invalid JSON — JSON.parse rejects it and our schema cleanup
        // (cleanSchemaObject) never runs. Walk character-by-character and swap
        // raw \n/\r/\t inside strings for a single space.
        .replace(/"((?:[^"\\]|\\.)*)"/g, (m, body) => {
          const escaped = body.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
          return `"${escaped}"`;
        });

      // Attempt JSON parse + structural cleanup (relative URL + null fields)
      try {
        const parsed = JSON.parse(decoded);
        const cleaned = cleanSchemaObject(parsed);
        decoded = JSON.stringify(cleaned);
      } catch {
        // If parse fails (e.g. multiple objects on one line, malformed), return decoded-only
      }

      return `${openTag}${decoded}${closeTag}`;
    }
  );
}

// Authentic client reviews (extracted from Recommandations clients + Témoignages Pulse-FR docx).
// Used to enrich Product/Service schemas where Squarespace emits null review/aggregateRating.
// IMPORTANT: jobTitle = function (CEO, VP, etc.), worksFor.name = company. Previous version
// used jobTitle for company name which violates schema.org semantics → Google flagged invalid.
const CLIENT_REVIEWS = [
  { name: 'Laurent Bouchoucha', jobTitle: 'VP Business Development & Solutions', company: 'Alcatel', body: "La majorité des formations se limitent à des 'one shots' sans réel suivi. Keep Growing propose un accompagnement dans la durée qui fait toute la différence. Cette continuité permet un véritable ancrage des apprentissages et une mise en application concrète des conseils reçus. Les recommandations sont simples, pertinentes, immédiatement applicables, adaptées à nos contraintes du quotidien. L'expertise de David Zaoui, nourrie par son expérience produit et ventes en start-up, scale-up et grands groupes, apporte un regard global et percutant. Keep Growing, c'est un vrai partenaire de croissance — pour les individus comme pour l'organisation.", date: '2025-09-12' },
  { name: 'Valentin Lecomte', jobTitle: 'CEO', company: 'Kuantom', body: "L'accompagnement avec Keep Growing a permis un changement de posture essentiel, propulsant nos ventes et renforçant notre équipe, grâce à une approche qui allie focus, engagement et humanité. David a su comprendre nos enjeux spécifiques et nous proposer des outils opérationnels immédiatement applicables. En quelques mois, notre dynamique commerciale a changé : meilleure cohésion d'équipe, pipeline structuré, conversations stratégiques avec nos prospects clés. Un vrai partenaire de croissance pour une scale-up qui veut professionnaliser sa fonction commerciale.", date: '2025-04-22' },
  { name: 'Manon Chevalier', jobTitle: 'Directrice Commerciale', company: 'Kapptivate', body: "Grâce à l'expertise et au soutien de David de Keep Growing, nous avons transformé notre approche commerciale en une machine bien huilée, rendant l'ambition non seulement réalisable mais sereinement gérable, étape par étape. David apporte une méthodologie claire, un cadre structurant, et surtout une capacité unique à challenger nos certitudes avec bienveillance. Les rituels qu'il nous a aidés à mettre en place ont créé un alignement total au sein de l'équipe commerciale. Aujourd'hui nous avançons avec sérénité sur des objectifs ambitieux.", date: '2025-07-08' },
  { name: 'Alexis Kaplan', jobTitle: 'Co-fondateur', company: 'Kuantom', body: "David est la personne que vous voulez à vos côtés pour vous accompagner à 360 dans votre développement commercial. Sans compter son super réseau et les belles opportunités qu'il nous a apportées, David nous a grandement aidé à restructurer le pôle business chez Kuantom : de la mécanique commerciale à la stratégie d'implantation marché, il nous a fait gagner un temps précieux et beaucoup d'argent dans notre phase de scale marché. Je suis ravi d'être accompagné au quotidien par lui et son équipe d'experts. Je le recommande vivement !", date: '2025-03-15' },
  { name: 'Sébastien Lecocq', jobTitle: 'CEO', company: 'Arkhos', body: "David Zaoui est un professionnel exceptionnel doté d'une large gamme de compétences et d'expérience. J'ai le plaisir de travailler avec David et je peux dire en toute confiance qu'il est une personne fiable, brillante et compétente. David est un véritable leader, capable de penser stratégiquement et d'accompagner des organisations avec talents. Je recommande vivement David pour toute opportunité professionnelle et je suis convaincu qu'il sera un atout pour votre équipe.", date: '2024-11-20' },
  { name: 'François de Pimodan', jobTitle: 'Chief Sales Officer (CSO)', company: 'Bleckwen', body: "David est un excellent Business Partner que ce soit pour accompagner la structuration d'une équipe commerciale ou le développement personnel et la gestion de carrière. Son approche combine pragmatisme business et écoute humaine. Nous avons travaillé ensemble sur la mise en place de notre direction commerciale chez Bleckwen, et David a apporté la vision externe dont nous avions besoin pour passer un cap : structuration des processus, montée en compétences de l'équipe, alignement stratégique. Un accompagnement qui fait vraiment la différence pour une scale-up tech.", date: '2024-12-05' },
  { name: 'Philippe Cros', jobTitle: 'Directeur de Région, Grand Est', company: 'Alcatel', body: "2024 : on fait le chiffre (+5% YoY growth), mais dans la douleur. Une équipe absente (1/3 des effectifs), déstructurée, peu alignée. 2025 : bon 1er trimestre qui laisse entrevoir la réalisation de l'objectif, avec une équipe complète (recrutements validés), le bon profil au bon poste, une feuille de route claire et documentée, One Team en mode Guerrier. Keep Growing à travers David a pleinement contribué à cette transformation. David a su Écouter, Comprendre, Questionner, Statuer, Conseiller et Monitorer. Merci Keep Growing.", date: '2025-05-18' },
  { name: 'Philippe Bletterie', jobTitle: 'SVP, Global Marketing & Communication', company: 'Alcatel', body: "J'ai eu la chance de bénéficier de l'accompagnement de David dans le cadre du programme Teach You — Management et Leadership Commercial. La combinaison d'un accompagnement collectif inspirant et d'un accompagnement individuel profondément pertinent fait la différence. David prend le temps de comprendre les enjeux spécifiques de chacun, avec une écoute bienveillante mais toujours exigeante. Il apporte des conseils concrets, des outils puissants, et une capacité rare à faire émerger des prises de conscience stratégiques. Un véritable accompagnement de transformation personnelle et professionnelle, profondément humain.", date: '2025-08-03' },
  { name: 'Yoann Cohen', jobTitle: 'Senior Account Executive', company: 'Alcatel', body: "Commencer dans le management n'est pas une tâche facile, surtout dans des organisations complexes. David et plus largement Keep Growing m'ont permis par leur accompagnement de prendre mes repères et du recul au quotidien. Au travers de leur enseignement théorique sur le rôle du manager mais également de leurs conseils autour du rôle du leader, David a su me guider et m'accompagner avec bienveillance, me permettant ainsi de grandir plus rapidement dans mon nouveau rôle. Une expérience qui transforme la posture de management.", date: '2025-06-25' },
  { name: 'Alexandre Grais', jobTitle: 'Co-fondateur', company: 'Kapptivate', body: "L'accompagnement avec Keep Growing a transformé ma vision et ma structure commerciale, me permettant de prendre du recul sur le quotidien et d'adopter une approche stratégique fluide, efficace et profondément humaine pour mon entreprise. David m'aide à incarner un leadership cohérent et serein, qui rejaillit sur toute l'organisation. Je recommande sans réserve à tout fondateur qui veut professionnaliser son approche commerciale tout en gardant son ADN entrepreneurial.", date: '2025-02-10' },
  { name: 'David Chauvin', jobTitle: 'Fondateur', company: 'IKAKENE', body: "Grâce à l'accompagnement personnalisé et au mentoring expert de Keep Growing, je me suis libéré des barrières professionnelles accumulées au fil des ans, découvrant et valorisant mes véritables talents pour entamer un nouveau chapitre de ma carrière avec confiance et équilibre. David a cette capacité rare de combiner exigence et bienveillance pour faire émerger ce qu'il y a de meilleur en chacun. Un partenaire de transformation pour qui veut redéfinir sa trajectoire professionnelle avec lucidité.", date: '2024-10-08' },
  { name: 'Fabien Rainon', jobTitle: 'Président', company: 'Caravelle Finance', body: "J'ai pu apprécier les valeurs et les compétences qui animent l'action et les expertises de David auprès de mes clients. L'appui proposé et les moyens qui l'accompagnent sont pour les entrepreneurs une vraie source de bénéfices. David a cette qualité rare de savoir s'adapter à chaque dirigeant, à chaque contexte, en gardant toujours une approche structurée et orientée résultats. Je recommande Keep Growing à tous les entrepreneurs qui veulent franchir un cap sur leur développement commercial.", date: '2025-01-14' },
];

// Build a Review array + AggregateRating block for schemas missing them.
// Schema.org compliant: jobTitle = function, worksFor.name = company (Organization).
function buildReviewBlock() {
  const reviews = CLIENT_REVIEWS.map(r => ({
    '@type': 'Review',
    'reviewRating': { '@type': 'Rating', 'ratingValue': '5', 'bestRating': '5' },
    'author': {
      '@type': 'Person',
      'name': r.name,
      ...(r.jobTitle ? { 'jobTitle': r.jobTitle } : {}),
      ...(r.company ? { 'worksFor': { '@type': 'Organization', 'name': r.company } } : {}),
    },
    'reviewBody': r.body,
    'datePublished': r.date,
  }));
  const aggregate = {
    '@type': 'AggregateRating',
    'ratingValue': '5',
    'reviewCount': String(CLIENT_REVIEWS.length),
    'bestRating': '5',
    'worstRating': '1',
  };
  return { reviews, aggregate };
}

// VideoObject ItemList for /videos-dirigeants-commercial/ — closes the audit
// gap "Pas de VideoObject schema" (audit v1 §8 / v2). Top 6 long-form videos
// from the Keep Growing channel (real data: youtube-audit-2026-05-17, titles
// post emoji-cleanup). Lets Google/Bing/LLMs surface the videos as structured
// entities tied to the brand.
const VIDEOS_PAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  'name': 'Vidéos Keep Growing — Dirigeants & Commerciaux B2B',
  'itemListElement': [
    { '@type': 'VideoObject', 'position': 1, 'name': "KPIs : L'art de piloter votre entreprise avec les bons indicateurs", 'description': "Les KPIs essentiels par département pour piloter sans se noyer dans la surinformation.", 'thumbnailUrl': 'https://i.ytimg.com/vi/OstjD0_70-I/hqdefault.jpg', 'uploadDate': '2025-02-05', 'duration': 'PT1M28S', 'embedUrl': 'https://www.youtube.com/embed/OstjD0_70-I', 'url': 'https://www.youtube.com/watch?v=OstjD0_70-I', 'publisher': { '@type': 'Organization', 'name': 'Keep Growing', 'url': 'https://keepgrowing.fr' } },
    { '@type': 'VideoObject', 'position': 2, 'name': "L'expérience client, ce n'est pas un copier-coller", 'description': "Avant d'améliorer l'expérience client, poser LA vraie question : quelles sont les valeurs et la culture de l'entreprise ?", 'thumbnailUrl': 'https://i.ytimg.com/vi/iQumL_QDfB0/hqdefault.jpg', 'uploadDate': '2025-02-19', 'duration': 'PT1M22S', 'embedUrl': 'https://www.youtube.com/embed/iQumL_QDfB0', 'url': 'https://www.youtube.com/watch?v=iQumL_QDfB0', 'publisher': { '@type': 'Organization', 'name': 'Keep Growing', 'url': 'https://keepgrowing.fr' } },
    { '@type': 'VideoObject', 'position': 3, 'name': 'Keep Growing : un Business Partner pour votre croissance', 'description': "David Zaoui et Jean-Baptiste Lendrin, co-fondateurs de Keep Growing, présentent le métier de Business Partner commercial.", 'thumbnailUrl': 'https://i.ytimg.com/vi/MKSBI0KdhKM/hqdefault.jpg', 'uploadDate': '2023-01-18', 'duration': 'PT2M34S', 'embedUrl': 'https://www.youtube.com/embed/MKSBI0KdhKM', 'url': 'https://www.youtube.com/watch?v=MKSBI0KdhKM', 'publisher': { '@type': 'Organization', 'name': 'Keep Growing', 'url': 'https://keepgrowing.fr' } },
    { '@type': 'VideoObject', 'position': 4, 'name': 'Valeur perçue : le vrai levier de différenciation en B2B', 'description': "Chez les grands comptes, prix + fonctionnalités ne suffisent pas : la valeur perçue fait la différence.", 'thumbnailUrl': 'https://i.ytimg.com/vi/UWBWcZYvGoc/hqdefault.jpg', 'uploadDate': '2025-03-19', 'duration': 'PT1M10S', 'embedUrl': 'https://www.youtube.com/embed/UWBWcZYvGoc', 'url': 'https://www.youtube.com/watch?v=UWBWcZYvGoc', 'publisher': { '@type': 'Organization', 'name': 'Keep Growing', 'url': 'https://keepgrowing.fr' } },
    { '@type': 'VideoObject', 'position': 5, 'name': 'Recrutement & onboarding : un enjeu stratégique à double risque', 'description': "Recruter un commercial est une gestion du risque à deux niveaux : le choix du profil et la réussite de son intégration.", 'thumbnailUrl': 'https://i.ytimg.com/vi/PXM34yXxTuo/hqdefault.jpg', 'uploadDate': '2025-04-02', 'duration': 'PT1M28S', 'embedUrl': 'https://www.youtube.com/embed/PXM34yXxTuo', 'url': 'https://www.youtube.com/watch?v=PXM34yXxTuo', 'publisher': { '@type': 'Organization', 'name': 'Keep Growing', 'url': 'https://keepgrowing.fr' } },
    { '@type': 'VideoObject', 'position': 6, 'name': 'Interview de François de Pimodan — témoignage client Keep Growing', 'description': "L'impact d'un accompagnement global sur la structuration commerciale, raconté par un dirigeant accompagné.", 'thumbnailUrl': 'https://i.ytimg.com/vi/Pv82Erdy3kk/hqdefault.jpg', 'uploadDate': '2023-11-08', 'duration': 'PT5M16S', 'embedUrl': 'https://www.youtube.com/embed/Pv82Erdy3kk', 'url': 'https://www.youtube.com/watch?v=Pv82Erdy3kk', 'publisher': { '@type': 'Organization', 'name': 'Keep Growing', 'url': 'https://keepgrowing.fr' } }
  ]
};

// Canonical Keep Growing address (Squarespace business profile still emits the
// old siège "94 Rue de la Victoire 75009"). We override at the JSON-LD layer
// so structured data matches GBP + footer.
// Phone is intentionally STRIPPED — David's GBP number is a personal mobile
// that should not be exposed in public schemas.
const CORRECT_ADDRESS = {
  '@type': 'PostalAddress',
  'streetAddress': '60 rue François 1er',
  'addressLocality': 'Paris',
  'postalCode': '75008',
  'addressCountry': 'FR',
};

// =====================================================================
// LLM Visibility Phase 1 — FAQPage JSON-LD for top 3 service pages.
// ChatGPT, Gemini and Perplexity extract FAQPage schemas natively as
// citable Q&A blocks. Content sourced from /frequent-asked-questions/
// and the live page copy — every answer is grounded in the actual
// Keep Growing offering (no invented facts).
// =====================================================================

const FAQ_PULSE_AUDIT = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': "Qu'est-ce que Pulse 360° exactement ?",
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Pulse 360° est un diagnostic commercial complet qui analyse votre organisation selon 4 dimensions (vision, talents, process, environnement). Contrairement à un audit classique qui prend 3 mois, Pulse délivre un diagnostic actionnable en 4 semaines, avec un séminaire d'alignement inclus.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Combien de temps dure un diagnostic Pulse ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "4 semaines pour les équipes jusqu'à 50 commerciaux. 4 à 6 semaines pour les ETI multi-sites. La charge est limitée pour vos équipes : questionnaire de 15-20 min en autonomie, entretiens de 45-60 min pour les personnes sélectionnées, 2h de cadrage + ½ journée de séminaire pour la Direction.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Que révèle Pulse que je ne vois pas déjà ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Vous voyez les symptômes : pipeline faible, turnover, objectifs non atteints. Pulse révèle les causes profondes. Exemple client : « L'audit financier était propre. Pulse a révélé qu'un seul commercial détenait 30% du CA dans sa tête. On a ajusté l'opération. »",
      },
    },
    {
      '@type': 'Question',
      'name': "Que signifie « Powered by AI. Trained by Pros. » ?",
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "L'IA analyse données CRM, taux de conversion, performance par commercial, questionnaires anonymes (120 questions) et signaux faibles. Les experts traduisent ces analyses via 8 à 20 entretiens croisés, un diagnostic contextualisé, des quick wins chiffrés, un séminaire d'alignement et un plan 30-60-90 jours.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Quelles sont les différentes offres Pulse ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Pulse Express — Gratuit, pour équipes ≤10 (questionnaire IA, score instantané, benchmark, debrief 1h). Pulse Startup/PME — À partir de 12K€, équipes 10+, diagnostic complet 4 semaines, 8 entretiens, 3 quick wins, séminaire ½ journée, roadmap 12 mois. Pulse ETI/Multi-pays — À partir de 25K€, multi-sites, 12-20 entretiens, benchmark inter-sites, séminaire CODIR, roadmap 18 mois. Pulse for PE — Sur mesure pour fonds, 4 modules (pré-acquisition, post-closing, turnaround, exit).",
      },
    },
    {
      '@type': 'Question',
      'name': 'Les réponses individuelles sont-elles vraiment anonymes ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Absolument. Le dirigeant reçoit score global, scores par dimension et équipe, écarts de perception, verbatims anonymisés et recommandations. En aucun cas il n'a accès aux réponses nominatives. Règle non négociable, contractuellement garantie. Hébergement Europe (RGPD), NDA systématique, suppression des données brutes après livraison.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Faut-il continuer avec Keep Growing après le diagnostic ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Non. Le diagnostic est conçu pour être autonome et actionnable. 60% de nos clients choisissent un accompagnement post-diagnostic (Teach You, Done With You, Done For You) — mais c'est leur choix. Notre métier est de révéler le potentiel ; la transformation vous appartient.",
      },
    },
  ],
};

const FAQ_TEACH_YOU = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': "Qu'est-ce que Teach You ?",
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Teach You est l'offre formation de Keep Growing : des programmes concrets de montée en compétences commerciales, animés par d'anciens dirigeants commerciaux. Couvre la vente & négociation, le management & leadership, le développement commercial et le marketing. Organisme de formation certifié Qualiopi, financement OPCO possible.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Keep Growing est-il certifié Qualiopi ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Oui. Keep Growing est un organisme de formation certifié Qualiopi, garantissant des standards d'excellence et la prise en charge des formations par les OPCO. Cette certification couvre l'ensemble de nos programmes Teach You ainsi que nos bilans de compétences.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Quelles formations proposez-vous ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "4 grandes catégories. Vente & négociation : L'art de la vente métier (3 jours, à partir de 1 800 € HT), prospection B2B (5 jours, 3 000 € HT), négociation commerciale, ventes complexes, posture commerciale, IA dans la vente. Management & leadership : Management & Leadership commercial (2-4 jours + ancrage, 1 200 € HT), DISC influence, posture du mentor. Développement commercial : Réseau de partenaires (2-4 jours, 1 500 € HT), assurance & posture. Marketing : Growth Marketing experts comptables, marque personnelle.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Proposez-vous des bilans de compétences ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Oui. Notre bilan de compétences vous aide à retrouver de la clarté, du sens et une trajectoire alignée avec votre potentiel. Il est éligible au CPF et à la prise en charge OPCO, et est délivré dans le cadre de notre certification Qualiopi.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Quels sont les délais d\'accès aux formations ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Délai moyen d'accès : 10 jours ouvrés après validation. Le parcours type : entretien gratuit de 45 min pour formuler le besoin, envoi du programme détaillé avec objectifs et devis, auto-positionnement ou test pour ajuster les contenus, puis signature de la convention de formation et règlement intérieur.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Les formations sont-elles accessibles aux personnes en situation de handicap ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Oui. Nos accompagnements sont accessibles aux personnes en situation de handicap. Étude des besoins en amont avec notre référent handicap, mobilisation de ressources compétentes ou orientation vers des partenaires spécialisés (AGEFIPH, FIPHFP, CAP EMPLOI, MDPH). Contact : hello@keepgrowing.fr.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Quels sont vos indicateurs de qualité ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Sur les 12 derniers mois, nous avons délivré 1 246 heures de formation. Nos notes moyennes apprenants : 18.33/20 sur la satisfaction globale, 18.41/20 sur la qualité pédagogique, 19.34/20 sur la recommandation. Animation assurée par des professionnels actifs apportant une vision terrain.",
      },
    },
  ],
};

const FAQ_DONE_WITH_YOU = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': "Qu'est-ce que l'offre Done With You ?",
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Done With You, c'est un Business Partner et sparring partner en mentoring commercial — opérationnel, pas théorique. Un ancien CEO/CSO à vos côtés pour révéler le potentiel de votre organisation commerciale, sur la durée. L'accompagnement s'appuie sur le diagnostic Pulse pour identifier précisément les priorités à adresser.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Comment se déroule un accompagnement Done With You ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "On part du diagnostic Pulse pour identifier les priorités et construire le plan d'action. Définition conjointe des objectifs, KPIs, fréquence des sessions et durée d'engagement. Sessions de mentoring régulières (6 à 7h/mois) avec votre Business Partner dédié. Revue des KPIs, ajustement du plan, hotline email & téléphone disponible entre les sessions.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Quels sont les domaines couverts par le mentoring ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Tous les leviers commerciaux : organisation, recrutement, onboarding, montée en compétences ; qualification, closing, négociation, CRM et outils ; management commercial, mentoring managers, rituels de pilotage ; budget, forecasting, QBR, reporting au CODIR ; changement de modèle, restructuration, croissance externe ; dashboards, indicateurs de performance, optimisation continue.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Quelles sont les formules et tarifs ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Mentoring : 2 sessions de 2h-2h30 / mois en présentiel ou visio, point intermédiaire, analyse psychométrique des talents, accompagnement réunions commerciales, hotline email & téléphone, engagement 6 mois minimum, 2 500€ / mois HT. Mentoring Premium : accompagnement renforcé avec séminaires d'équipe inclus, idéal pour les transformations structurantes.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Pour qui est conçu Done With You ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Les CEO, DG et Directeurs Commerciaux qui veulent structurer leur croissance sans casser ce qui fonctionne, réussir leur prise de poste et asseoir leur crédibilité, piloter une transformation commerciale complexe, ou accompagner leurs participations dans leur croissance (fonds d'investissement).",
      },
    },
    {
      '@type': 'Question',
      'name': 'Qui sont les Business Partners de Keep Growing ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "Anciens dirigeants commerciaux avec +20 ans d'expérience moyenne. Ils ont tous managé avant de conseiller. Profils variés : 20+ ans EMEA en business strategy et partenariats structurants ; performance commerciale terrain en environnements internationaux ; distribution multicanale, business plans, P&L international ; productivité sales, KPIs & rituels, playbook ; santé, distribution, transformation digitale ; data-driven, environnements complexes.",
      },
    },
    {
      '@type': 'Question',
      'name': 'Quels résultats peut-on attendre ?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': "+17 points d'engagement équipe en moyenne sur les missions documentées. Cas client Alcatel (Philippe Cros) : « 2024 : on fait le chiffre, mais dans la douleur. Équipe absente, déstructurée. 2025 : bon 1er trimestre, équipe complète, le bon profil au bon poste, One Team en mode Guerrier. » Cas client Kapptivate : transformation de la vision et de la structure commerciale, approche stratégique fluide et humaine.",
      },
    },
  ],
};

// Map pathname → FAQ schema for the LLM Visibility injection.
const FAQ_BY_PATH = {
  '/pulse-audit-commercial/': FAQ_PULSE_AUDIT,
  '/teach-you/': FAQ_TEACH_YOU,
  '/done-with-you/': FAQ_DONE_WITH_YOU,
};

function buildFaqScript(pathname) {
  const faq = FAQ_BY_PATH[pathname];
  if (!faq) return null;
  return `<script type="application/ld+json">${JSON.stringify(faq)}</script>`;
}

// =====================================================================
// LLM Visibility Phase 2 — Webikeo cross-citation.
// Inject VideoObject JSON-LD on 5 Ghost blog posts that thematically
// match a Moon Shot Mindset webinar replay (Webikeo channel, 2 219
// cumulative registrations across 20 webinars). Webikeo does NOT emit
// its own VideoObject schema → we provide it from keepgrowing.fr,
// creating a bidirectional authority signal that ChatGPT, Perplexity
// and Gemini can pick up. Source audit: report 12-webikeo-moonshot.
// =====================================================================

const KG_LOGO = `https://${PUBLIC_HOST}/logo-keepgrowing.png`;
const DAVID_AUTHOR = {
  '@type': 'Person',
  name: 'David Zaoui',
  url: `https://${PUBLIC_HOST}/qui-sommes-nous`,
};
const MOON_SHOT_PUBLISHER = {
  '@type': 'Organization',
  name: 'Moon Shot Mindset',
  url: 'https://webikeo.fr/chaine/moon-shot-mindset',
  logo: { '@type': 'ImageObject', url: KG_LOGO },
};

// Webinar 1 — Méthode Harvard (262 inscrits, top performer chaîne, 28/02/2024, 1h)
const VIDEO_OBJ_HARVARD = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: 'La méthode Harvard : LA clé pour révéler vos talents cachés',
  description: "Webinar Moon Shot Mindset animé par David Zaoui (Keep Growing) sur l'application de la méthode Harvard pour révéler les talents cachés d'une organisation et d'un leadership commercial.",
  thumbnailUrl: 'https://media.webikeo.fr/file/preview-image/01J89BHM3RJ3M0E1ECMAJVT7Z3.png',
  uploadDate: '2024-02-28',
  duration: 'PT60M',
  contentUrl: 'https://webikeo.fr/webinar/la-methode-harvard-la-cle-pour-reveler-vos-talents-caches-1',
  embedUrl: 'https://webikeo.fr/webinar/la-methode-harvard-la-cle-pour-reveler-vos-talents-caches-1',
  interactionStatistic: {
    '@type': 'InteractionCounter',
    interactionType: 'https://schema.org/WatchAction',
    userInteractionCount: 262,
  },
  publisher: MOON_SHOT_PUBLISHER,
  author: DAVID_AUTHOR,
};

// Webinar 2 — Management 3.0 (185 inscrits, 05/09/2024, 30 min)
const VIDEO_OBJ_MGMT3 = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: 'Management 3.0 : le nouveau paradigme du management',
  description: 'Webinar Moon Shot Mindset animé par David Zaoui (Keep Growing) sur le management 3.0 et le nouveau paradigme du leadership des équipes commerciales B2B.',
  thumbnailUrl: 'https://media.webikeo.fr/file/preview-image/management-3-0.png',
  uploadDate: '2024-09-05',
  duration: 'PT30M',
  contentUrl: 'https://webikeo.fr/webinar/management-3-0-le-nouveau-paradigme-du-management-1',
  embedUrl: 'https://webikeo.fr/webinar/management-3-0-le-nouveau-paradigme-du-management-1',
  interactionStatistic: {
    '@type': 'InteractionCounter',
    interactionType: 'https://schema.org/WatchAction',
    userInteractionCount: 185,
  },
  publisher: MOON_SHOT_PUBLISHER,
  author: DAVID_AUTHOR,
};

// Webinar 3 — 4 piliers fondamentaux d'une équipe commerciale efficace (219 inscrits, 15/02/2024, 1h)
const VIDEO_OBJ_PILIERS = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: "Les quatre piliers fondamentaux d'une équipe commerciale efficace",
  description: 'Webinar Moon Shot Mindset animé par David Zaoui (Keep Growing) sur les 4 piliers fondamentaux pour structurer une équipe commerciale B2B performante : rôles, responsabilités, rituels et indicateurs.',
  thumbnailUrl: 'https://media.webikeo.fr/file/preview-image/4-piliers-equipe-commerciale.png',
  uploadDate: '2024-02-15',
  duration: 'PT60M',
  contentUrl: 'https://webikeo.fr/webinar/les-quatre-piliers-fondamentaux-d-une-equipe-commerciale-efficace-4',
  embedUrl: 'https://webikeo.fr/webinar/les-quatre-piliers-fondamentaux-d-une-equipe-commerciale-efficace-4',
  interactionStatistic: {
    '@type': 'InteractionCounter',
    interactionType: 'https://schema.org/WatchAction',
    userInteractionCount: 219,
  },
  publisher: MOON_SHOT_PUBLISHER,
  author: DAVID_AUTHOR,
};

// Webinar 4 — Expérience client : la clé de la fidélité et de la croissance (112 inscrits, 08/01/2025, 30 min)
const VIDEO_OBJ_EXPERIENCE = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: "L'expérience client : la clé de la fidélité et de la croissance",
  description: "Webinar Moon Shot Mindset animé par David Zaoui (Keep Growing) sur l'expérience client B2B comme levier majeur de fidélisation et de croissance durable.",
  thumbnailUrl: 'https://media.webikeo.fr/file/preview-image/experience-client.png',
  uploadDate: '2025-01-08',
  duration: 'PT30M',
  contentUrl: 'https://webikeo.fr/webinar/l-experience-client-la-cle-de-la-fidelite-et-de-la-croissance',
  embedUrl: 'https://webikeo.fr/webinar/l-experience-client-la-cle-de-la-fidelite-et-de-la-croissance',
  interactionStatistic: {
    '@type': 'InteractionCounter',
    interactionType: 'https://schema.org/WatchAction',
    userInteractionCount: 112,
  },
  publisher: MOON_SHOT_PUBLISHER,
  author: DAVID_AUTHOR,
};

// Webinar 5 — Définir votre 'Pourquoi' : la clé du succès entrepreneurial (76 inscrits, 29/08/2024, 30 min)
const VIDEO_OBJ_POURQUOI = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: "Définir votre 'Pourquoi' : la clé du succès entrepreneurial",
  description: "Webinar Moon Shot Mindset animé par David Zaoui (Keep Growing) sur la méthode pour définir son 'Pourquoi' entrepreneurial et le traduire en pitch et en stratégie commerciale.",
  thumbnailUrl: 'https://media.webikeo.fr/file/preview-image/definir-pourquoi.png',
  uploadDate: '2024-08-29',
  duration: 'PT30M',
  contentUrl: 'https://webikeo.fr/webinar/definir-votre-pourquoi-la-cle-du-succes-entrepreneurial',
  embedUrl: 'https://webikeo.fr/webinar/definir-votre-pourquoi-la-cle-du-succes-entrepreneurial',
  interactionStatistic: {
    '@type': 'InteractionCounter',
    interactionType: 'https://schema.org/WatchAction',
    userInteractionCount: 76,
  },
  publisher: MOON_SHOT_PUBLISHER,
  author: DAVID_AUTHOR,
};

// Map Ghost pathname → VideoObject (thematic Webikeo replay).
// Pathnames are RELATIVE to BLOG_PATH (i.e. the slice after /blog-conseils-strategie-croissance).
// Matching rationale documented inline:
//   - leadership-startup           ⟶ Harvard (talents/leadership)
//   - leadership-equipe-facteur    ⟶ Management 3.0 (paradigme management)
//   - roles-et-responsabilites     ⟶ 4 piliers (structure d'équipe)
//   - fideliser-clients-b2b        ⟶ Expérience client (fidélité)
//   - pitch-efficace-b-pourquoi    ⟶ Définir votre Pourquoi
const VIDEO_BY_GHOST_PATH = {
  '/maitriser-leadership-startup/': VIDEO_OBJ_HARVARD,
  '/le-leadership-de-lequipe-commerciale-facteur-humain-au/': VIDEO_OBJ_MGMT3,
  '/limportance-des-roles-et-responsabilites-pour-une-equipe/': VIDEO_OBJ_PILIERS,
  '/strategies-pour-fideliser-vos-clients-b2b/': VIDEO_OBJ_EXPERIENCE,
  '/creer-un-pitch-efficace-b-pourquoi/': VIDEO_OBJ_POURQUOI,
};

function buildVideoObjectScript(ghostPath) {
  const video = VIDEO_BY_GHOST_PATH[ghostPath];
  if (!video) return null;
  return `<script type="application/ld+json">${JSON.stringify(video)}</script>`;
}

// Recursively walk a parsed JSON-LD schema and: (1) make relative URLs absolute,
// (2) strip null / "" / "@type"-only sentinel objects, (3) inject real client reviews
// + aggregateRating into Product/Service schemas where Squarespace emitted null,
// (4) overwrite stale NAP (address + telephone) on Organization/LocalBusiness types.
function cleanSchemaObject(obj, parentType = null) {
  if (Array.isArray(obj)) {
    return obj.map(v => cleanSchemaObject(v, parentType)).filter(v => v !== null && v !== undefined);
  }
  if (obj && typeof obj === 'object') {
    const type = obj['@type'] || parentType;
    const out = {};
    let hadNullReview = false;
    let hadNullRating = false;

    for (const [k, v] of Object.entries(obj)) {
      // Detect Squarespace null sentinels for review fields → mark for replacement
      if ((k === 'review' || k === 'reviews') && (v === null || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 1 && v['@type']))) {
        hadNullReview = true;
        continue;
      }
      if (k === 'aggregateRating' && (v === null || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 1 && v['@type']))) {
        hadNullRating = true;
        continue;
      }
      // Strip null fields entirely (schema.org rejects nulls)
      if (v === null) continue;
      // Strip empty-string fields (Squarespace emits description:"" on its
      // native WebSite block — validators flag empty values; audit 114515
      // "JSON LD Schema" × 238 pages)
      if (typeof v === 'string' && v.trim() === '' && k !== '@id') continue;
      // Strip empty placeholder objects like { "@type": "Review" } (Squarespace stubs)
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const keys = Object.keys(v);
        if (keys.length === 1 && keys[0] === '@type') continue;
      }
      // Recurse
      let cleaned = cleanSchemaObject(v, type);
      // Make URL fields absolute (handle keys 'url', 'item', 'image', 'sameAs', 'logo')
      if ((k === 'url' || k === 'item' || k === 'image' || k === 'logo') && typeof cleaned === 'string') {
        if (cleaned.startsWith('//')) {
          // Protocol-relative (Squarespace native WebSite block) → force https
          cleaned = `https:${cleaned}`;
        } else if (cleaned.startsWith('/')) {
          cleaned = `https://${PUBLIC_HOST}${cleaned}`;
        }
      }
      out[k] = cleaned;
    }

    // Normalize @context to https — Squarespace WebSite schema emits
    // "http://schema.org" which fails Google's modern Rich Results validator.
    if (out['@context'] === 'http://schema.org') {
      out['@context'] = 'https://schema.org';
    }

    // Overwrite stale NAP on Organization/LocalBusiness — Squarespace business
    // profile still emits the old office address. Strip telephone entirely:
    // David's GBP number is a personal mobile that must not appear publicly.
    const isNapBearing = type === 'Organization' || type === 'LocalBusiness';
    if (isNapBearing) {
      if ('address' in out) out.address = { ...CORRECT_ADDRESS };
      if ('telephone' in out) delete out.telephone;
    }

    // Google review-snippet rules (GSC Rich Results FAIL, 2026-06-15):
    // review/aggregateRating are ONLY valid on a supported type (Product etc.).
    // On `Service` Google raises a hard ERROR ("Type d'objet non valide pour le
    // champ parent_node"); on Organization/LocalBusiness self-serving reviews
    // are silently ignored. So: inject reviews ONLY into Product, and strip any
    // review/aggregateRating that OTTO/Squarespace put on Service/Org/LocalBusiness.
    if (type === 'Service' || type === 'Organization' || type === 'LocalBusiness') {
      delete out.review;
      delete out.reviews;
      delete out.aggregateRating;
    }
    // Inject real reviews + aggregateRating for Product schemas where:
    // (a) Squarespace emitted null sentinels (review: null, aggregateRating: null)
    // (b) Schema has offers but NO review field at all (Squarespace removed even the nulls)
    // (c) aggregateRating.reviewCount > listed reviews.length (mismatch)
    const isReviewable = type === 'Product';
    if (isReviewable) {
      const { reviews, aggregate } = buildReviewBlock();
      // Marker that this is a real commercial offering: has offers OR price OR brand
      const isCommercialOffering = ('offers' in out) || ('price' in out) || ('brand' in out);

      // Case (a): had null sentinel
      if (hadNullReview && !out.review) out.review = reviews;
      if (hadNullRating && !out.aggregateRating) out.aggregateRating = aggregate;

      // Case (b): no review field at all but commercial product
      if (isCommercialOffering && !out.review) out.review = reviews;
      if (isCommercialOffering && !out.aggregateRating) out.aggregateRating = aggregate;

      // Case (c): mismatch reviewCount vs review[].length
      if (out.aggregateRating && typeof out.aggregateRating === 'object') {
        const stated = parseInt(out.aggregateRating.reviewCount || '0', 10);
        const existing = Array.isArray(out.review) ? out.review : (out.review ? [out.review] : []);
        if (stated > existing.length && existing.length < reviews.length) {
          const existingNames = new Set(existing.map(r => (r.author && r.author.name) || ''));
          const filler = reviews.filter(r => !existingNames.has(r.author.name)).slice(0, stated - existing.length);
          out.review = [...existing, ...filler];
        }
      }
    }
    return out;
  }
  return obj;
}

function truncateMeta(html) {
  return html
    .replace(/(<meta\s+property="og:title"\s+content=")([^"]+)(")/gi, (m, p, content, s) =>
      p + smartTruncate(content, OG_TITLE_MAX) + s
    )
    .replace(/(<meta\s+(?:name|property)="og:description"\s+content=")([^"]+)(")/gi, (m, p, content, s) =>
      p + smartTruncate(content, OG_DESC_MAX) + s
    )
    .replace(/(<meta\s+name="description"\s+content=")([^"]+)(")/gi, (m, p, content, s) =>
      p + smartTruncate(content, OG_DESC_MAX) + s
    );
}

// Decode HTML entities found in scraped HTML text (used for breadcrumb name)
function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2013;/gi, '–')
    .replace(/&#x2014;/gi, '—')
    .replace(/&#x2026;/gi, '…')
    .replace(/&#xa0;/gi, ' ')
    .replace(/&#160;/g, ' ');
}

function buildBreadcrumbJsonLd(pathname, html) {
  // Detect article URL: /blog-.../single-segment/ (with optional trailing slash already there)
  const articleMatch = pathname.match(/^\/blog-conseils-strategie-croissance\/([^/]+)\/?$/);
  if (!articleMatch || articleMatch[1] === '') return null;
  const slug = articleMatch[1];
  // Skip Ghost system paths
  if (['tag', 'author', 'page', 'rss', 'sitemap.xml', 'sitemap-posts.xml', 'sitemap-pages.xml', 'sitemap-authors.xml', 'sitemap-tags.xml', 'robots.txt'].includes(slug)) return null;
  // Extract article H1 as breadcrumb leaf, decode entities (e.g. d&#x27;une → d'une)
  const h1Match = html.match(/<h1[^>]*class="gh-article-title[^"]*"[^>]*>([^<]+)<\/h1>/);
  const rawTitle = h1Match ? h1Match[1].trim() : slug.replace(/-/g, ' ');
  const articleTitle = decodeHtmlEntities(rawTitle);
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `https://${PUBLIC_HOST}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${PUBLIC_BASE}/` },
      { '@type': 'ListItem', position: 3, name: articleTitle, item: `${PUBLIC_BASE}/${slug}/` },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`;
}

// Generate a complete, consistent Twitter Card meta set from the page's
// existing Open Graph tags. X/LinkedIn fall back to OG anyway, but Search
// Atlas audits twitter:* explicitly — deriving them from OG satisfies the
// audit AND keeps a single source of truth. twitter:site is intentionally
// omitted (Keep Growing has no X account; an empty handle would be invalid).
function deriveTwitterFromOg(html) {
  const og = (prop) => {
    const m = html.match(new RegExp(`<meta\\s+(?:property|name)="og:${prop}"\\s+content="([^"]*)"`, 'i'));
    return m ? m[1] : null;
  };
  const title = og('title');
  const desc = og('description');
  const image = og('image');
  if (!title && !image) return html; // no OG to derive from
  const esc = (s) => (s || '').replace(/"/g, '&quot;');
  let tags = '<meta name="twitter:card" content="summary_large_image"/>';
  if (title) tags += `\n<meta name="twitter:title" content="${esc(title)}"/>`;
  if (desc) {
    // Search Atlas flags twitter:description > 125 chars. Truncate on a word
    // boundary to clear the flag while staying readable.
    const short = desc.length > 125 ? desc.slice(0, 124).replace(/\s+\S*$/, '') + '…' : desc;
    tags += `\n<meta name="twitter:description" content="${esc(short)}"/>`;
  }
  if (image) tags += `\n<meta name="twitter:image" content="${esc(image)}"/>`;
  return html.replace('</head>', `${tags}\n</head>`);
}

function rewriteHtml(html, pathname, ghostPath) {
  let out = rewriteBody(html)
    .replace(/(href|src|action|content|data-src|data-href)="\/(?!\/)/g, `$1="${BLOG_PATH}/`)
    .replace(/(srcset)="\/(?!\/)/g, `$1="${BLOG_PATH}/`)
    // Replace Ghost default publication-cover.jpg with Keep Growing brand image
    .replace(/https:\/\/static\.ghost\.org\/v\d+\.\d+\.\d+\/images\/publication-cover\.jpg/g, KG_OG_FALLBACK)
    // Remove existing Twitter tags — they are regenerated from OG below so the
    // set is complete & consistent (audit 114515 flagged 100s of Ghost pages
    // for missing twitter:card/title/description/image when they were stripped).
    .replace(/\s*<meta\s+(?:name|property)="twitter:[^"]*"[^>]*\/?>\s*/gi, '');

  out = deriveTwitterFromOg(out);
  out = truncateMeta(out);

  // Decode HTML entities inside JSON-LD blocks — Schema.org validators reject
  // values like "d&#x27;une approche" (Ghost's emit format).
  out = decodeJsonLdEntities(out);

  const breadcrumb = buildBreadcrumbJsonLd(pathname, out);
  if (breadcrumb) {
    out = out.replace('</head>', `${breadcrumb}\n</head>`);
  }

  // LLM Visibility Phase 2 — Webikeo Moon Shot Mindset cross-citation:
  // inject VideoObject JSON-LD on the 5 Ghost articles thematically aligned
  // to a webinar replay. Provides Bing/ChatGPT/Perplexity with a structured
  // bidirectional authority link (KG ↔ Webikeo).
  if (ghostPath) {
    const videoScript = buildVideoObjectScript(ghostPath);
    if (videoScript && !out.includes('"@type":"VideoObject"')) {
      out = out.replace('</head>', `${videoScript}\n</head>`);
    }
  }

  // Inject OTTO pixel before </head> so Search Atlas can apply on-page recos on blog pages
  if (!out.includes('id="sa-dynamic-optimization"')) {
    out = out.replace('</head>', `${OTTO_PIXEL}\n</head>`);
  }

  // Fix internal links that point at redirecting URLs (trailing slash + legacy)
  out = fixInternalRedirectLinks(out);

  // Near-duplicate consolidation: point the weaker article's canonical at the
  // stronger one (see DUPLICATE_CANONICALS).
  if (ghostPath && DUPLICATE_CANONICALS[ghostPath]) {
    const canonicalTarget = `https://${PUBLIC_HOST}${BLOG_PATH}${DUPLICATE_CANONICALS[ghostPath]}`;
    out = out.replace(
      /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
      `<link rel="canonical" href="${canonicalTarget}"/>`
    );
  }

  // Noindex tag/author archive pages. These are thin, duplicate-content listing
  // pages (Ghost auto-generated) that GSC/OTTO flag as "non unique content" +
  // "non unique title". Standard SEO practice: keep them crawlable (follow) so
  // link equity flows to posts, but out of the index. "follow" preserves
  // internal link discovery. Only applied to /tag/ and /author/ archives.
  if (/^\/(tag|author)\//.test(ghostPath || '')) {
    if (/<meta\s+name=["']robots["']/i.test(out)) {
      out = out.replace(
        /<meta\s+name=["']robots["'][^>]*>/i,
        '<meta name="robots" content="noindex,follow"/>'
      );
    } else {
      out = out.replace('</head>', '<meta name="robots" content="noindex,follow"/>\n</head>');
    }
  }

  return out;
}

function addTrailingSlashesToSitemap(xml) {
  // Inject the homepage if Squarespace omitted it. Squarespace exports /home
  // (the page) but not the root /, so the most important URL is missing from
  // the sitemap (audit 114515 "Page Not In Sitemap"). Add it right after the
  // opening <urlset> tag, and drop any /home or /home/ entry (it 301s to /).
  if (!/<loc>https:\/\/keepgrowing\.fr\/?<\/loc>/.test(xml)) {
    xml = xml.replace(/(<urlset[^>]*>)/i, `$1<url><loc>https://${PUBLIC_HOST}/</loc><priority>1.0</priority></url>`);
  }
  xml = xml.replace(/<url>(?:(?!<\/url>).)*<loc>https:\/\/keepgrowing\.fr\/home\/?<\/loc>(?:(?!<\/url>).)*<\/url>/gs, '');

  return xml.replace(/<loc>(https?:\/\/[^<]+)<\/loc>/g, (match, url) => {
    try {
      const u = new URL(url);
      if (u.hostname !== PUBLIC_HOST) return match;
      if (/\.[a-z0-9]{1,5}$/i.test(u.pathname)) return match;
      // Ghost (blog) canonical includes trailing slash → align sitemap with slash
      if (u.pathname.startsWith(BLOG_PATH + '/') && !u.pathname.endsWith('/')) {
        u.pathname += '/';
        return `<loc>${u.toString()}</loc>`;
      }
      // Squarespace (apex) canonical INCLUDES trailing slash (Vercel 308 enforces this).
      // Sitemap must match canonical, otherwise Google flags "Page avec redirection".
      if (!u.pathname.startsWith(BLOG_PATH) && u.pathname !== '/' && !u.pathname.endsWith('/')) {
        u.pathname += '/';
        return `<loc>${u.toString()}</loc>`;
      }
      return match;
    } catch {
      return match;
    }
  });
}

const INDEXNOW_KEY = '2b3c37d13ada98fe63c1cb99c4dfd1a7';

// Typo-protection: catch malformed blog path "stratgie" (missing é) and 301 to canonical
const BLOG_PATH_TYPO_RX = /^\/blog-conseils-stratgie-croissance(\/.*)?$/i;

// Legacy URL redirects — old paths from previous Squarespace/Ghost iterations that
// Google still has indexed. Done at middleware level rather than Squarespace URL Mappings
// because (a) blog paths bypass Squarespace, (b) Squarespace's mappings emit
// off-domain Location headers (to bamboo-celery-eayp.squarespace.com), losing SEO juice.
const LEGACY_REDIRECTS = {
  // Apex / Squarespace paths
  // /home and /home/ are Squarespace duplicate of /, must 301 to root
  '/home': '/',
  '/home/': '/',
  // /nos-ressources currently chains 3 redirects to the blog index, and 272
  // internal links across the site still point at it (audit 114515).
  // Direct mapping + fixInternalRedirectLinks rewrites those links in place.
  '/nos-ressources': '/blog-conseils-strategie-croissance/',
  // Duplicate Squarespace page of the white paper (canonical mismatch in audit)
  '/les-100-premiers-jours-du-directeur-commercial-1': '/les-100-premiers-jours-du-directeur-commercial/',
  '/nos-solutions': '/pulse-audit-commercial/',
  '/nos-accompagnements': '/done-with-you/',
  '/articles-linkedin': '/articles-linkedin-dirigeant-commercial/',
  '/rendezvous-1': '/rendezvous/',
  '/landing-page-le-collectif-commercial': '/livre-blanc-le-collectif-commercial/',
  '/a-propos-keepgrowing': '/a-propos-keep-growing/',
  '/done-with-you-1': '/done-with-you/',
  '/diagnostic-commercial': '/pulse-audit-commercial/',
  // Old blog article slugs → canonical pages
  '/blog-conseils-strategie-croissance/dominer-marche-strategie-commerciale-ciblee': '/blog-conseils-strategie-croissance/',
  '/blog-conseils-strategie-croissance/collectif-commercial-attitudes-exemplaires-8a7a7': '/blog-conseils-strategie-croissance/collectif-commercial-attitudes-exemplaires/',
  '/blog-conseils-strategie-croissance/fondamentaux-processus-commerciaux-9cyj3': '/blog-conseils-strategie-croissance/fondamentaux-processus-commerciaux/',
  '/blog-conseils-strategie-croissance/le-sales-business-coach-un-directeur-commercial-augmente': '/blog-conseils-strategie-croissance/',
  '/blog-conseils-strategie-croissance/back-basics': '/blog-conseils-strategie-croissance/fonction-commerciale-retour-fondamentaux/',
  '/blog-conseils-strategie-croissance/meddic-la-cle-de-victoire-dans-les-ventes-b2b-complexes': '/livre-blanc-meddicc/',
  '/blog-conseils-strategie-croissance/conseils-pour-un-onboarding-commercial-reussi': '/livre-blanc-lonboarding-efficace-des-commerciaux/',
  '/blog-conseils-strategie-croissance/prise-de-fonction-en-tant-que-directeur-commercial-les-100-premiers-jours': '/les-100-premiers-jours-du-directeur-commercial/',
  '/blog-conseils-strategie-croissance/maitriser-lart-de-la-prospection-en-b2b': '/blog-conseils-strategie-croissance/prospection-les-cles-dune-approche-gagnante/',
  '/blog-conseils-strategie-croissance/maitriser-lart-du-pitch-trois-scenarios-pratiques': '/blog-conseils-strategie-croissance/executive-conversation-pitch-dirigeant/',
  '/blog-conseils-strategie-croissance/assurer-le-suivi-des-clients-cles-pour-fideliser-la-relation-en-b2b': '/livre-blanc-gestion-de-grands-comptes/',
  '/blog-conseils-strategie-croissance/pivoter-avec-precision-lart-de-la-reorientation-en-startup': '/blog-conseils-strategie-croissance/',
  '/blog-conseils-strategie-croissance/seminaire-de-fin-dannee-loccasion-reflechir-et-dinnover': '/blog-conseils-strategie-croissance/',
  // Old category URLs (Squarespace had categories; Ghost uses tags)
  '/blog-conseils-strategie-croissance/category/Management-Leadership': '/blog-conseils-strategie-croissance/tag/leadership/',
  '/blog-conseils-strategie-croissance/category/Transformation-commerciale': '/blog-conseils-strategie-croissance/tag/management-commercial/',
};

function lookupLegacyRedirect(pathname) {
  // Try exact match (case-insensitive on the path)
  const lower = pathname.toLowerCase();
  // Strip trailing slash for lookup (we store keys without trailing slash)
  const key = lower.endsWith('/') && lower.length > 1 ? lower.slice(0, -1) : lower;
  if (LEGACY_REDIRECTS[key]) return LEGACY_REDIRECTS[key];
  return null;
}

// Rewrite internal links so they point at their FINAL destination instead of
// going through a redirect hop. Replaces the OTTO "Issues with Links" fix
// (952 links across 137 pages in audit 114515) deterministically, at zero AI
// quota. Two cases:
//   1. internal links missing the trailing slash (Vercel 308s them) → add "/"
//   2. links to legacy paths still present in old content → LEGACY_REDIRECTS target
// Also normalizes absolute www.keepgrowing.fr hrefs to the apex host.
// Skips: external URLs, protocol-relative (//), file paths (.pdf, .xml, ...),
// root "/", and preserves any ?query / #fragment suffix.
function fixInternalRedirectLinks(html) {
  return html.replace(
    /(href=")(https?:\/\/(?:www\.)?keepgrowing\.fr)?(\/(?!\/)[^"]*)(")/g,
    (match, attr, host, path, quote) => {
      const m = path.match(/^([^?#]*)([?#][^"]*)?$/);
      let p = (m && m[1]) || '';
      const suffix = (m && m[2]) || '';
      if (!p || p === '/') return match;
      const key = (p.endsWith('/') ? p.slice(0, -1) : p).toLowerCase();
      if (LEGACY_REDIRECTS[key]) {
        p = LEGACY_REDIRECTS[key];
      } else if (/\.[a-z0-9]{1,5}$/i.test(p)) {
        return match; // file (pdf, xml, txt, images…) — no trailing slash
      } else if (!p.endsWith('/')) {
        p += '/';
      } else if (!host) {
        return match; // already canonical and relative — nothing to fix
      }
      const prefix = host ? `https://${PUBLIC_HOST}` : '';
      return `${attr}${prefix}${p}${suffix}${quote}`;
    }
  );
}

// Tag/author URL normalization → 301 redirect to canonical ASCII-lowercase-hyphenated slug.
// Fixes Google "Page avec redirection" + "Introuvable (404)" + "duplicate canonical" errors
// for URLs like /tag/Leadership/, /tag/efficacité, /tag/diagnostic commercial, /tag/OKR.
function normalizeTagSlug(pathname) {
  const m = pathname.match(/^(\/blog-conseils-strategie-croissance\/(?:tag|author)\/)([^\/]+)(\/?$)/);
  if (!m) return null;
  const segment = decodeURIComponent(m[2]);
  // Normalize: NFD decompose + strip combining marks (é → e), lowercase, non-alphanum → hyphen
  const normalized = segment
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) return null;
  if (normalized === segment) return null;
  return `${m[1]}${normalized}/`;
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // Fix 0: legacy URL redirects (old Squarespace + old Ghost slugs)
  const legacyTarget = lookupLegacyRedirect(pathname);
  if (legacyTarget) {
    const url = new URL(legacyTarget + search, request.url);
    return NextResponse.redirect(url, 301);
  }

  // Fix 1: typo path "stratgie" (missing é) → 301 to canonical "strategie"
  if (BLOG_PATH_TYPO_RX.test(pathname)) {
    const fixed = pathname.replace(/blog-conseils-stratgie-croissance/i, 'blog-conseils-strategie-croissance');
    const url = new URL(fixed + search, request.url);
    return NextResponse.redirect(url, 301);
  }

  // Fix 2: tag/author URLs with accented chars → 301 to ASCII slug
  const normalizedTag = normalizeTagSlug(pathname);
  if (normalizedTag) {
    const url = new URL(normalizedTag + search, request.url);
    return NextResponse.redirect(url, 301);
  }

  // IndexNow key file at site root — required to authenticate IndexNow submissions
  if (pathname === `/${INDEXNOW_KEY}.txt` || pathname === `/${INDEXNOW_KEY}.txt/`) {
    return new NextResponse(INDEXNOW_KEY, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  }

  // Squarespace-only sitemap (legacy URL — kept for direct access).
  if (pathname === '/sitemap-squarespace.xml' || pathname === '/sitemap-squarespace.xml/') {
    try {
      const res = await fetch(`https://${SQUARESPACE_HOST}/sitemap.xml`, { redirect: 'follow' });
      const xml = await res.text();
      return new NextResponse(addTrailingSlashesToSitemap(xml), {
        status: res.status,
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
      });
    } catch {
      return NextResponse.next();
    }
  }

  // /sitemap.xml — return a sitemap INDEX that references both the Squarespace
  // sitemap AND the Ghost (blog) sitemap. Without this, OTTO/Google only crawl
  // the Squarespace URLs and miss every recent Ghost blog post (DKN articles,
  // rebrand posts, scheduled content). Diagnosed via OTTO inventory 2026-05-26:
  // 158 URLs in sitemap vs 165 total pages — Ghost sub-sitemap was isolated.
  if (pathname === '/sitemap.xml' || pathname === '/sitemap.xml/') {
    const now = new Date().toISOString();
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://${PUBLIC_HOST}/sitemap-squarespace.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://${PUBLIC_HOST}${BLOG_PATH}/sitemap-pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://${PUBLIC_HOST}${BLOG_PATH}/sitemap-posts.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>
`;
  // Ghost sitemap-authors.xml and sitemap-tags.xml are intentionally EXCLUDED
  // from the index: those archive pages are served robots noindex,follow
  // (thin/duplicate), so listing them in a sitemap is a contradictory signal
  // that Search Atlas/Google flag ("Page Not Absent From Sitemap", 73 URLs,
  // audit 114515). Posts + pages + Squarespace cover every indexable URL.
    return new NextResponse(indexXml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
    });
  }

  // Apex (Squarespace) schema cleanup proxy — only for pages with known schema issues.
  // Catches Product/Service schemas with relative URLs + null fields emitted by Squarespace.
  const APEX_SCHEMA_PAGES = new Set([
    '/', '/contact/',
    '/pulse-audit-commercial/', '/pulse-fonds/', '/teach-you/',
    '/done-with-you/', '/done-for-you/', '/due-diligence-commerciale/',
    '/livre-blanc-le-collectif-commercial/', '/livre-blanc-meddicc/',
    '/livre-blanc-reseau-de-partenaires/', '/livre-blanc-introduction-aux-okr/',
    '/livre-blanc-lonboarding-efficace-des-commerciaux/',
    '/livre-blanc-gestion-de-grands-comptes/', '/livre-blanc-booster-votre-business/',
    '/lb-pilotez-la-performance-kpi/', '/lintelligence-artificielle-vente-b2b/',
    '/les-12-profils-relationnels-en-vente/', '/le-dirigeant-de-startup-dcrypt/',
    '/les-profils-commerciaux-dcrypts/', '/recruter-le-bon-commercial-en-2026/',
    '/les-100-premiers-jours-du-directeur-commercial/',
    '/contact-vision/', '/contact-culture/',
    '/atelier-disc-leadership/', '/atelier-disc-devenez-influent/',
    '/atelier-vision-strategie/', '/atelier-culture-adn/',
    '/merci-rdv/', '/a-propos-keep-growing/',
    // Added 2026-06-09: Squarespace emits canonical without trailing slash on
    // these pages too. GSC flagged /bilan-de-competences/ as "Page en double
    // — canonical différent" (Coverage Validation 2026-06-09). All 10 confirmed
    // via canonical check. Adding to ensure middleware forces canonical match.
    '/bilan-de-competences/', '/cabinets-experts/',
    '/cgu/', '/cgv/',
    '/frequent-asked-questions/',
    '/livres-blancs-expertise-commerciale/',
    '/articles-linkedin-dirigeant-commercial/',
    '/newsletter-strategie-commerciale-dirigeants/',
    '/rendezvous/', '/videos-dirigeants-commercial/',
  ]);
  if (APEX_SCHEMA_PAGES.has(pathname)) {
    try {
      const res = await fetch(`https://${SQUARESPACE_HOST}${pathname}${search}`, { redirect: 'follow' });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        let html = await res.text();
        // Apply schema cleanup (decode entities, absolute URLs, strip nulls)
        html = decodeJsonLdEntities(html);

        // Fix Squarespace canonical bug: it emits the canonical href WITHOUT
        // a trailing slash, while the public URL is served WITH a trailing
        // slash. Google then flags every apex page as "duplicate, canonical
        // differs" (GSC report 2026-05-26). Force canonical to match the
        // public URL exactly.
        const canonicalUrl = `https://${PUBLIC_HOST}${pathname}`;
        html = html.replace(
          /<link\s+rel=["']canonical["']\s+href=["']https?:\/\/[^"']*?(?:\/)?["']\s*\/?>/i,
          `<link rel="canonical" href="${canonicalUrl}"/>`
        );

        // Fix internal links that point at redirecting URLs (trailing slash + legacy)
        html = fixInternalRedirectLinks(html);

        // Mobile LCP fix (audit v2 2026-06-11): Squarespace loads 5-8 decorative
        // GPU image-effect scripts (refracted-circles, liquid, film-grain,
        // parallax, refracted-lines) on every page. They are pure decoration,
        // cost main-thread time and delay LCP on mobile (14.7s measured).
        // Strip them server-side since the Squarespace editor toggles are
        // per-section and easy to regress. Responsive-image loaders
        // (imageFluid.visitor.js etc.) are NOT touched.
        html = html.replace(/<script[^>]*src="[^"]*\/image-effect-[^"]*"[^>]*><\/script>\s*/gi, '');

        // Resource hints: Squarespace hero images come from images.squarespace-cdn.com
        // and static1.squarespace.com — preconnect shaves DNS+TLS off the LCP path.
        if (!html.includes('rel="preconnect" href="https://images.squarespace-cdn.com"')) {
          html = html.replace(
            '</head>',
            '<link rel="preconnect" href="https://images.squarespace-cdn.com" crossorigin/>\n' +
            '<link rel="preconnect" href="https://static1.squarespace.com" crossorigin/>\n</head>'
          );
        }

        // Duplicate H1 differentiation (audit 114515 "Non Unique H1", 2 pairs).
        // Squarespace reuses the same H1 across page pairs; rewrite one of
        // each pair server-side so every page has a unique H1.
        if (pathname === '/videos-dirigeants-commercial/') {
          html = html.replace(/(<h1[^>]*>)[\s\S]*?(<\/h1>)/, '$1Vidéos pour dirigeants et commerciaux B2B$2');
        }
        if (pathname === '/atelier-disc-leadership/') {
          html = html.replace(/(<h1[^>]*>)[\s\S]*?(<\/h1>)/, '$1Atelier DISC Leadership : décryptez les profils comportementaux$2');
        }

        // VideoObject ItemList on the videos page (audit gap fix)
        if (pathname === '/videos-dirigeants-commercial/' && !html.includes('"@type":"VideoObject"') && !html.includes("'@type': 'VideoObject'")) {
          html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(VIDEOS_PAGE_SCHEMA)}</script>\n</head>`);
        }

        // Conversion-page guard: OTTO's "missing headings" autopilot injects
        // large AI-generated H2+paragraph blocks client-side. On conversion
        // pages (contact, rendezvous, thank-you) that violates the
        // one-page-one-CTA rule, and the OTTO API rejects editing list-type
        // suggestions. Guard: a tiny MutationObserver that strips any
        // body-content element OTTO injects on these pages. Head-level
        // optimizations (title, meta, OG) are untouched.
        const CONVERSION_PAGES = new Set([
          '/contact/', '/rendezvous/', '/merci-rdv/',
          '/contact-vision/', '/contact-culture/',
        ]);
        if (CONVERSION_PAGES.has(pathname)) {
          const guard = '<script>(function(){var sel=\'h2[data-otto-pixel="dynamic-seo"],h3[data-otto-pixel="dynamic-seo"],p[data-otto-pixel="dynamic-seo"],div[data-otto-pixel="dynamic-seo"]\';var kill=function(n){try{if(n.matches&&n.matches(sel))n.remove();}catch(e){}};new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++)kill(a[j]);}}).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll(sel).forEach(function(n){n.remove();});});})();</script>';
          html = html.replace('</head>', `${guard}\n</head>`);
        }

        // LLM Visibility Phase 1: inject a FAQPage schema on the 3 main
        // service pages (Pulse, Teach You, Done With You). LLMs (ChatGPT,
        // Gemini, Perplexity) extract FAQPage entries natively as citable
        // Q&A — this hands them a clean, hand-curated source.
        const faqScript = buildFaqScript(pathname);
        if (faqScript && !html.includes('"@type":"FAQPage"')) {
          html = html.replace('</head>', `${faqScript}\n</head>`);
        }

        return new NextResponse(html, {
          status: res.status,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=600',
          }
        });
      }
    } catch {
      return NextResponse.next();
    }
  }

  // Blog reverse proxy
  if (!pathname.startsWith(BLOG_PATH)) return NextResponse.next();

  let ghostPath = pathname.slice(BLOG_PATH.length) || '/';
  if (!ghostPath.startsWith('/')) ghostPath = '/' + ghostPath;
  const ghostUrl = `https://${GHOST_HOST}${ghostPath}${search}`;

  try {
    const res = await fetch(ghostUrl, { redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';

    // Convert 404 → 410 Gone for non-existent tag/author URLs.
    // Tells Google these are permanently removed → de-index. Avoids "Introuvable (404)" pile-up.
    if (res.status === 404 && /^\/(?:tag|author)\//.test(ghostPath)) {
      return new NextResponse('<!doctype html><html><head><title>410 Gone</title><meta name="robots" content="noindex"></head><body><h1>410 Gone</h1><p>This page has been permanently removed.</p><p><a href="/blog-conseils-strategie-croissance/">Back to blog</a></p></body></html>', {
        status: 410,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        }
      });
    }

    if (ct.includes('text/html')) {
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        // CDN cache: 5 min fresh, 10 min stale-while-revalidate. Browsers get must-revalidate.
        'Cache-Control': 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=600',
      };
      return new NextResponse(rewriteHtml(await res.text(), pathname, ghostPath), {
        status: res.status,
        headers
      });
    }

    if (/(application\/json|application\/xml|text\/xml|application\/rss\+xml|application\/atom\+xml|application\/ld\+json|text\/plain)/i.test(ct)) {
      return new NextResponse(rewriteBody(await res.text()), {
        status: res.status,
        headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=300, s-maxage=600' }
      });
    }

    return new NextResponse(await res.arrayBuffer(), {
      status: res.status,
      headers: { 'Content-Type': ct, 'Cache-Control': res.headers.get('cache-control') || 'public, max-age=86400, s-maxage=604800' }
    });
  } catch (e) {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/blog-conseils-strategie-croissance(.*)',
    '/blog-conseils-stratgie-croissance(.*)',
    '/sitemap.xml',
    '/sitemap.xml/',
    '/sitemap-squarespace.xml',
    '/sitemap-squarespace.xml/',
    '/2b3c37d13ada98fe63c1cb99c4dfd1a7.txt',
    '/2b3c37d13ada98fe63c1cb99c4dfd1a7.txt/',
    // Legacy URLs — caught by lookupLegacyRedirect()
    '/nos-solutions',
    '/nos-solutions/',
    '/nos-accompagnements',
    '/nos-accompagnements/',
    '/articles-linkedin',
    '/articles-linkedin/',
    '/rendezvous-1',
    '/rendezvous-1/',
    '/landing-page-le-collectif-commercial',
    '/landing-page-le-collectif-commercial/',
    '/a-propos-keepgrowing',
    '/a-propos-keepgrowing/',
    '/done-with-you-1',
    '/done-with-you-1/',
    '/diagnostic-commercial',
    '/diagnostic-commercial/',
    '/nos-ressources',
    '/nos-ressources/',
    '/les-100-premiers-jours-du-directeur-commercial-1',
    '/les-100-premiers-jours-du-directeur-commercial-1/',
    // Apex pages with Squarespace schema cleanup needed (cf. APEX_SCHEMA_PAGES)
    '/',
    '/contact/',
    '/pulse-audit-commercial/',
    '/pulse-fonds/',
    '/teach-you/',
    '/done-with-you/',
    '/done-for-you/',
    '/due-diligence-commerciale/',
    '/livre-blanc-le-collectif-commercial/',
    '/livre-blanc-meddicc/',
    '/livre-blanc-reseau-de-partenaires/',
    '/livre-blanc-introduction-aux-okr/',
    '/livre-blanc-lonboarding-efficace-des-commerciaux/',
    '/livre-blanc-gestion-de-grands-comptes/',
    '/livre-blanc-booster-votre-business/',
    '/lb-pilotez-la-performance-kpi/',
    '/lintelligence-artificielle-vente-b2b/',
    '/les-12-profils-relationnels-en-vente/',
    '/le-dirigeant-de-startup-dcrypt/',
    '/les-profils-commerciaux-dcrypts/',
    '/recruter-le-bon-commercial-en-2026/',
    '/les-100-premiers-jours-du-directeur-commercial/',
    '/contact-vision/',
    '/contact-culture/',
    '/atelier-disc-leadership/',
    '/atelier-disc-devenez-influent/',
    '/atelier-vision-strategie/',
    '/atelier-culture-adn/',
    '/merci-rdv/',
    '/a-propos-keep-growing/',
    // Added 2026-06-09: pages with Squarespace canonical bug (missing trailing slash)
    '/bilan-de-competences/',
    '/cabinets-experts/',
    '/cgu/',
    '/cgv/',
    '/frequent-asked-questions/',
    '/livres-blancs-expertise-commerciale/',
    '/articles-linkedin-dirigeant-commercial/',
    '/newsletter-strategie-commerciale-dirigeants/',
    '/rendezvous/',
    '/videos-dirigeants-commercial/',
  ]
};
