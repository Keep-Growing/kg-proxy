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
const OTTO_PIXEL = '<script nowprocket nitro-exclude type="text/javascript" id="sa-dynamic-optimization" data-uuid="a1e21b39-6f92-46d4-98ad-5b6be780d7c9" src="data:text/javascript;base64,dmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoInNjcmlwdCIpO3NjcmlwdC5zZXRBdHRyaWJ1dGUoIm5vd3Byb2NrZXQiLCAiIik7c2NyaXB0LnNldEF0dHJpYnV0ZSgibml0cm8tZXhjbHVkZSIsICIiKTtzY3JpcHQuc3JjID0gImh0dHBzOi8vZGFzaGJvYXJkLnNlYXJjaGF0bGFzLmNvbS9zY3JpcHRzL2R5bmFtaWNfb3B0aW1pemF0aW9uLmpzIjtzY3JpcHQuZGF0YXNldC51dWlkID0gImExZTIxYjM5LTZmOTItNDZkNC05OGFkLTViNmJlNzgwZDdjOSI7c2NyaXB0LmlkID0gInNhLWR5bmFtaWMtb3B0aW1pemF0aW9uLWxvYWRlciI7ZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpOw=="></script>';

// SEO display limits (Google SERP truncates beyond these)
const OG_TITLE_MAX = 70;
const OG_DESC_MAX = 160;

function smartTruncate(str, max) {
  if (str.length <= max) return str;
  return str.substr(0, max - 1).replace(/\s+\S*$/, '').replace(/[\s\p{P}]+$/u, '') + '…';
}

function rewriteBody(text) {
  return text
    .replace(/https?:\/\/blog-conseils-strategie-croissance\.ghost\.io/g, PUBLIC_BASE)
    .replace(/blog-conseils-strategie-croissance\.ghost\.io/g, `${PUBLIC_HOST}${BLOG_PATH}`);
}

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
const CLIENT_REVIEWS = [
  { name: 'Laurent Bouchoucha', company: 'Alcatel', body: "Keep Growing propose un accompagnement dans la durée qui fait toute la différence. Les recommandations sont simples, pertinentes, immédiatement applicables. L'expertise de David Zaoui, nourrie par son expérience produit et ventes en start-up, scale-up et grands groupes, apporte un regard global et percutant.", date: '2025-06-15' },
  { name: 'Valentin Lecomte', company: 'Kuantom', body: "L'accompagnement avec Keep Growing a catalysé un changement de posture essentiel, propulsant nos ventes et renforçant notre équipe, grâce à une approche qui allie focus, engagement et humanité.", date: '2025-04-22' },
  { name: 'Manon Chevalier', company: 'Kapptivate', body: "Grâce à l'expertise et au soutien de David de Keep Growing, nous avons transformé notre approche commerciale en une machine bien huilée, rendant l'ambition non seulement réalisable mais sereinement gérable, étape par étape.", date: '2025-03-10' },
  { name: 'Alexis Kaplan', company: 'Kuantom', body: "David est la personne que vous voulez à vos côtés pour vous accompagner à 360 dans votre développement commercial. De la mécanique commerciale à la stratégie d'implantation marché, il nous a fait gagner un temps précieux et beaucoup d'argent dans notre phase de scale.", date: '2025-05-08' },
  { name: 'Sébastien Lecocq', company: 'Arkhos', body: "David Zaoui est un véritable leader, capable de penser stratégiquement et d'accompagner des organisations avec talents. Une personne fiable, brillante et compétente. Je recommande vivement.", date: '2024-11-19' },
  { name: 'François de Pimodan', company: 'Bleckwen', body: "David est un excellent coach que ce soit pour accompagner la structuration d'une équipe commerciale ou le développement personnel et la gestion de carrière.", date: '2024-10-03' },
  { name: 'Philippe Cros', company: 'Alcatel', body: "KeepGrowing à travers David a pleinement contribué à notre transformation : équipe complète, bon profil au bon poste, feuille de route claire & documentée, One Team en mode Guerrier.", date: '2025-04-18' },
  { name: 'Philippe Bletterie', company: 'Alcatel', body: "David prend le temps de comprendre les enjeux spécifiques de chacun, avec une écoute bienveillante mais toujours exigeante. Conseils concrets, outils puissants, et une capacité rare à faire émerger des prises de conscience stratégiques. Un véritable levier de transformation.", date: '2025-02-14' },
  { name: 'Yoann Cohen', company: 'Alcatel', body: "Commencer dans le management n'est pas une tâche facile dans des organisations complexes. David a su me guider et m'accompagner avec bienveillance, me permettant de grandir plus rapidement dans mon nouveau rôle.", date: '2024-12-05' },
  { name: 'Alexandre Grais', company: 'Kapptivate', body: "L'accompagnement avec Keep Growing a transformé ma vision et ma structure commerciale, me permettant de prendre du recul et d'adopter une approche stratégique fluide, efficace et profondément humaine.", date: '2025-03-12' },
];

// Build a Review array + AggregateRating block for schemas missing them
function buildReviewBlock() {
  const reviews = CLIENT_REVIEWS.map(r => ({
    '@type': 'Review',
    'reviewRating': { '@type': 'Rating', 'ratingValue': '5', 'bestRating': '5' },
    'author': { '@type': 'Person', 'name': r.name, ...(r.company ? { 'jobTitle': r.company } : {}) },
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
      // Strip empty placeholder objects like { "@type": "Review" } (Squarespace stubs)
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const keys = Object.keys(v);
        if (keys.length === 1 && keys[0] === '@type') continue;
      }
      // Recurse
      let cleaned = cleanSchemaObject(v, type);
      // Make URL fields absolute (handle keys 'url', 'item', 'image', 'sameAs', 'logo')
      if ((k === 'url' || k === 'item' || k === 'image' || k === 'logo') && typeof cleaned === 'string') {
        if (cleaned.startsWith('/') && !cleaned.startsWith('//')) {
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

    // Inject real reviews + aggregateRating for Product/Service schemas where:
    // (a) Squarespace emitted null sentinels (review: null, aggregateRating: null)
    // (b) Schema has offers but NO review field at all (Squarespace removed even the nulls)
    // (c) aggregateRating.reviewCount > listed reviews.length (mismatch)
    const isReviewable = type === 'Product' || type === 'Service' || type === 'LocalBusiness';
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

function rewriteHtml(html, pathname) {
  let out = rewriteBody(html)
    .replace(/(href|src|action|content|data-src|data-href)="\/(?!\/)/g, `$1="${BLOG_PATH}/`)
    .replace(/(srcset)="\/(?!\/)/g, `$1="${BLOG_PATH}/`)
    // Replace Ghost default publication-cover.jpg with Keep Growing brand image
    .replace(/https:\/\/static\.ghost\.org\/v\d+\.\d+\.\d+\/images\/publication-cover\.jpg/g, KG_OG_FALLBACK)
    // Strip Twitter Card meta tags (no Twitter account; OG covers LinkedIn/Slack/WhatsApp)
    .replace(/\s*<meta\s+(?:name|property)="twitter:[^"]*"[^>]*\/?>\s*/gi, '');

  out = truncateMeta(out);

  // Decode HTML entities inside JSON-LD blocks — Schema.org validators reject
  // values like "d&#x27;une approche" (Ghost's emit format).
  out = decodeJsonLdEntities(out);

  const breadcrumb = buildBreadcrumbJsonLd(pathname, out);
  if (breadcrumb) {
    out = out.replace('</head>', `${breadcrumb}\n</head>`);
  }

  // Inject OTTO pixel before </head> so Search Atlas can apply on-page recos on blog pages
  if (!out.includes('id="sa-dynamic-optimization"')) {
    out = out.replace('</head>', `${OTTO_PIXEL}\n</head>`);
  }

  return out;
}

function addTrailingSlashesToSitemap(xml) {
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
      // Squarespace (apex) canonical excludes trailing slash → align sitemap without slash
      if (!u.pathname.startsWith(BLOG_PATH) && u.pathname !== '/' && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.replace(/\/$/, '');
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

  // Sitemap rewrite: trailing slash + remove non-indexable patterns (tag/author/page-N)
  if (pathname === '/sitemap.xml' || pathname === '/sitemap.xml/') {
    try {
      const res = await fetch(`https://${SQUARESPACE_HOST}/sitemap.xml`, { redirect: 'follow' });
      const ct = res.headers.get('content-type') || 'application/xml; charset=utf-8';
      const xml = await res.text();
      return new NextResponse(addTrailingSlashesToSitemap(xml), {
        status: res.status,
        headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
      });
    } catch {
      return NextResponse.next();
    }
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
  ]);
  if (APEX_SCHEMA_PAGES.has(pathname)) {
    try {
      const res = await fetch(`https://${SQUARESPACE_HOST}${pathname}${search}`, { redirect: 'follow' });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        let html = await res.text();
        // Apply schema cleanup (decode entities, absolute URLs, strip nulls)
        html = decodeJsonLdEntities(html);

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
      return new NextResponse(rewriteHtml(await res.text(), pathname), {
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
  ]
};
