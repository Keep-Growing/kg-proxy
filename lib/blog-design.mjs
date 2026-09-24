export function refineBlogDesign(html) {
 if(html.includes('id="kg-blog-design"'))return html;
 let out=html.replace(/(<a\b[^>]*class="gh-navigation-logo[^>]*>)[\s\S]*?(<\/a>)/, '$1Keep<span>Growing</span>$2');
 out=out.replace(/(<nav class="gh-navigation-menu"[^>]*>)[\s\S]*?(<\/nav>)/, '$1<ul class="nav"><li><a href="/">Accueil</a></li><li><a href="/teach-you/">Formation</a></li><li><a href="/done-with-you/">Mentoring</a></li><li><a href="/done-for-you/">Transition</a></li><li><a href="/livres-blancs-expertise-commerciale/">Ressources</a></li><li><a href="#/portal/signup" data-portal="signup">S’abonner</a></li><li><a href="#/portal/signin" data-portal="signin">Connexion</a></li></ul>$2');
 out=out.replace(/<div class="gh-navigation-members">[\s\S]*?<\/div>/, '<div class="gh-navigation-members"><a class="gh-button kg-blog-pulse" href="/pulse-audit-commercial/">Découvrir Pulse 360°</a></div>');
 out=out.replace(/(<header id="gh-navigation"[\s\S]*?)(<\/header>)/, '$1<a class="kg-blog-mobile-pulse" href="/pulse-audit-commercial/">Découvrir Pulse 360°</a>$2');
 out=out.replace('</head>','<link id="kg-blog-design" rel="stylesheet" href="/assets/kg-blog-design-20260908.css"></head>');
 return out.replace("</body>",blogMenuScript+"</body>");
}

function enhanceBlogMenu(){
 const header=document.querySelector('#gh-navigation'),button=header?.querySelector('.gh-burger'),nav=header?.querySelector('.gh-navigation-menu');
 if(!button||!nav)return;nav.id='blog-navigation-menu';nav.setAttribute('aria-label','Navigation du blog');button.setAttribute('aria-controls',nav.id);
 const update=()=>{const open=header.classList.contains('is-open');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');};
 update();new MutationObserver(update).observe(header,{attributes:true,attributeFilter:['class']});
 header.addEventListener('keydown',e=>{if(e.key==='Escape'&&header.classList.contains('is-open')){button.click();button.focus();}});
 document.addEventListener('click',e=>{if(header.classList.contains('is-open')&&!header.contains(e.target))button.click();});
 header.addEventListener('focusout',e=>{if(e.relatedTarget&&!header.contains(e.relatedTarget)&&header.classList.contains('is-open'))button.click();});
 nav.addEventListener('click',e=>{if(e.target.closest('a')&&header.classList.contains('is-open'))button.click();});
}
export const blogMenuScript='<script>('+enhanceBlogMenu.toString()+')();</script>';

// Bloc offre en fin d'article (24/09/2026). Chaque article est rattache a un theme
// (lib/blog-clusters.mjs) : le bloc oriente vers l'offre du theme et propose trois
// articles du meme theme, ce qui donne a chaque article au moins trois liens entrants.
// Uniquement sur les pages article (post-template), jamais sur l'index, les tags ou les pages.
import { BLOG_CLUSTERS } from './blog-clusters.mjs';

const BLOG = '/blog-conseils-strategie-croissance/';
const RDV = ['/rendezvous/', 'Prendre rendez-vous'];
export const OFFERS = {
 diagnostic: { eyebrow: 'Pulse 360°', title: 'Ce qui freine vraiment ton équipe commerciale, mesuré en 4 semaines',
  text: 'Pulse 360° croise tes indicateurs avec la perception de la direction, des managers et des commerciaux. Tu repars avec les écarts qui coûtent et un plan d’action à 90 jours.',
  primary: ['/pulse-audit-commercial/', 'Découvrir Pulse 360°'], secondary: RDV },
 vente: { eyebrow: 'Formation vente B2B', title: 'Faire progresser ton équipe sur ses vrais deals',
  text: 'Vente complexe, MEDDIC, négociation, objections : des formations animées par d’anciens directeurs commerciaux, certifiées Qualiopi et finançables par ton OPCO.',
  primary: ['/teach-you/', 'Voir les formations'], secondary: RDV,
  extra: ['/sales-pilot/', 'Entre deux sessions, Sales Pilot entraîne tes commerciaux à la voix'] },
 prospection: { eyebrow: 'Prospection', title: 'Faire de la prospection une routine qui rapporte',
  text: 'Nos formations prospection travaillent sur tes cibles réelles. Et Sales Pilot prépare chaque appel avec tes commerciaux, en deux minutes, à la voix.',
  primary: ['/teach-you/', 'Voir les formations'], secondary: ['/sales-pilot/', 'Découvrir Sales Pilot'] },
 management: { eyebrow: 'Mentoring commercial', title: 'Un ancien dirigeant commercial à tes côtés pour faire grandir l’équipe',
  text: 'Motivation, intégration, recrutement, rituels : un mentor qui a tenu le poste t’aide à décider et à exécuter, en sessions régulières et en hotline.',
  primary: ['/done-with-you/', 'Découvrir le mentoring'], secondary: RDV },
 direction: { eyebrow: 'Direction commerciale', title: 'Besoin d’une direction commerciale solide, maintenant ?',
  text: 'En transition pour reprendre la main vite, ou en mentoring pour réussir ta prise de poste : d’anciens dirigeants commerciaux prennent le relais ou t’accompagnent.',
  primary: ['/done-for-you/', 'Direction de transition'], secondary: ['/done-with-you/', 'Mentoring dirigeant'] },
 partenaires: { eyebrow: 'Réseau de partenaires', title: 'Faire de tes partenaires un vrai canal de vente',
  text: 'Sélection, contrat, animation, indicateurs : notre livre blanc gratuit détaille la méthode pour bâtir un réseau de distribution rentable.',
  primary: ['/livre-blanc-reseau-de-partenaires/', 'Télécharger le livre blanc'], secondary: RDV },
};
// Ajustements ponctuels : une page plus pertinente que l'offre du theme.
const ARTICLE_EXTRA = {
 'formation-commerciale-qualiopi-financement-opco': ['/pulse-formation/', 'Tu diriges un organisme de formation ? Pulse Formation simplifie Qualiopi'],
 'pme-eti-la-transformation-digitale-de-votre-force': ['/atelier-ia-generative/', 'Passer à l’action avec l’atelier IA générative en entreprise'],
 'experts-comptables-vendre-valeur': ['/cabinets-experts/', 'Développement commercial des cabinets d’expertise comptable'],
};

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SLUGS_BY_CLUSTER = {};
for (const [slug, v] of Object.entries(BLOG_CLUSTERS)) (SLUGS_BY_CLUSTER[v.c] ||= []).push(slug);

export function relatedArticles(slug, n = 3) {
 const c = BLOG_CLUSTERS[slug]?.c, list = SLUGS_BY_CLUSTER[c] || [];
 const i = list.indexOf(slug);
 if (i < 0) return [];
 const out = [];
 for (let k = 1; k <= Math.min(n, list.length - 1); k++) out.push(list[(i + k) % list.length]);
 return out;
}

const CTA_STYLE = '<style>#kg-pulse-cta{max-width:720px;margin:48px auto 8px;padding:32px 30px;border-radius:16px;background:linear-gradient(160deg,#23334A,#1b2939);color:#fff;font-family:inherit}'
 + '#kg-pulse-cta .kpc-eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3FB4B1;margin-bottom:10px}'
 + '#kg-pulse-cta .kpc-title{font-size:24px;line-height:1.25;font-weight:800;margin:0 0 12px;color:#fff}'
 + '#kg-pulse-cta .kpc-text{font-size:16px;line-height:1.6;margin:0 0 22px;color:rgba(255,255,255,.85)}'
 + '#kg-pulse-cta .kpc-actions{display:flex;flex-wrap:wrap;gap:12px}'
 + '#kg-pulse-cta .kpc-btn{display:inline-block;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px;text-decoration:none}'
 + '#kg-pulse-cta .kpc-primary{background:#3FB4B1;color:#fff}#kg-pulse-cta .kpc-secondary{border:1.5px solid rgba(255,255,255,.6);color:#fff}'
 + '#kg-pulse-cta .kpc-btn:hover{opacity:.9}'
 + '#kg-pulse-cta .kpc-extra{margin:18px 0 0;font-size:15px}#kg-pulse-cta .kpc-extra a{color:#3FB4B1;font-weight:700}'
 + '#kg-pulse-cta .kpc-related{margin:26px 0 0;padding:20px 0 0;border-top:1px solid rgba(255,255,255,.18)}'
 + '#kg-pulse-cta .kpc-related-t{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.7);margin:0 0 10px}'
 + '#kg-pulse-cta .kpc-related ul{margin:0;padding:0;list-style:none}#kg-pulse-cta .kpc-related li{margin:0 0 8px;font-size:15px;line-height:1.45}'
 + '#kg-pulse-cta .kpc-related a{color:#fff;text-decoration:underline;text-underline-offset:3px}'
 + '@media(max-width:600px){#kg-pulse-cta{margin:36px 16px 8px;padding:26px 20px}#kg-pulse-cta .kpc-title{font-size:20px}}</style>';

export function offerCta(slug) {
 const o = OFFERS[BLOG_CLUSTERS[slug]?.c] || OFFERS.diagnostic;
 const extra = ARTICLE_EXTRA[slug] || o.extra;
 const rel = relatedArticles(slug);
 return '<aside id="kg-pulse-cta" class="kg-pulse-cta" aria-label="' + esc(o.eyebrow) + '">' + CTA_STYLE
  + '<span class="kpc-eyebrow">' + esc(o.eyebrow) + '</span>'
  + '<p class="kpc-title">' + esc(o.title) + '</p>'
  + '<p class="kpc-text">' + esc(o.text) + '</p>'
  + '<div class="kpc-actions"><a class="kpc-btn kpc-primary" href="' + o.primary[0] + '">' + esc(o.primary[1]) + '</a>'
  + '<a class="kpc-btn kpc-secondary" href="' + o.secondary[0] + '">' + esc(o.secondary[1]) + '</a></div>'
  + (extra ? '<p class="kpc-extra"><a href="' + extra[0] + '">' + esc(extra[1]) + ' →</a></p>' : '')
  + (rel.length ? '<nav class="kpc-related" aria-label="À lire aussi"><p class="kpc-related-t">À lire aussi</p><ul>'
    + rel.map(r => '<li><a href="' + BLOG + r + '/">' + esc(BLOG_CLUSTERS[r].t) + '</a></li>').join('') + '</ul></nav>' : '')
  + CTA_TRACKING
  + '</aside>';
}

// Suivi des clics du bloc offre dans Vercel Web Analytics (sans cookie, donc
// independant du consentement GA4). Evenement « Blog offre » : offre + article.
const CTA_TRACKING = '<script>(function(){window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};'
 + 'var a=document.getElementById("kg-pulse-cta");if(!a)return;a.addEventListener("click",function(e){var l=e.target.closest("a");if(!l)return;'
 + 'try{window.va("event",{name:"Blog offre",data:{destination:new URL(l.href,location.href).pathname,article:location.pathname}})}catch(x){}});})();</script>';

function articleSlug(html) {
 const m = html.match(/<link rel="canonical" href="[^"]*\/blog-conseils-strategie-croissance\/([^"\/]+)\/"/);
 return m ? m[1] : '';
}

export function addPulseCta(html) {
 if (html.includes('id="kg-pulse-cta"')) return html;
 if (!/<body[^>]*class="[^"]*post-template/.test(html)) return html;
 const cta = offerCta(articleSlug(html));
 return html.replace(/(<section class="gh-content[\s\S]*?<\/section>)(\s*<\/article>)/, (m, a, b) => a + cta + b);
}
