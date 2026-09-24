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

// Bloc Pulse 360 en fin d'article (24/09/2026, validé par David) :
// le blog amène des lecteurs, ce bloc les oriente vers Pulse 360 et le rendez-vous.
// Uniquement sur les pages article (post-template), jamais sur l'index, les tags ou les pages.
const PULSE_CTA = '<aside id="kg-pulse-cta" class="kg-pulse-cta" aria-label="Pulse 360°">'
 + '<style>#kg-pulse-cta{max-width:720px;margin:48px auto 8px;padding:32px 30px;border-radius:16px;background:linear-gradient(160deg,#23334A,#1b2939);color:#fff;font-family:inherit}'
 + '#kg-pulse-cta .kpc-eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#3FB4B1;margin-bottom:10px}'
 + '#kg-pulse-cta .kpc-title{font-size:24px;line-height:1.25;font-weight:800;margin:0 0 12px;color:#fff}'
 + '#kg-pulse-cta .kpc-text{font-size:16px;line-height:1.6;margin:0 0 22px;color:rgba(255,255,255,.85)}'
 + '#kg-pulse-cta .kpc-actions{display:flex;flex-wrap:wrap;gap:12px}'
 + '#kg-pulse-cta .kpc-btn{display:inline-block;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px;text-decoration:none}'
 + '#kg-pulse-cta .kpc-primary{background:#3FB4B1;color:#fff}#kg-pulse-cta .kpc-secondary{border:1.5px solid rgba(255,255,255,.6);color:#fff}'
 + '#kg-pulse-cta .kpc-btn:hover{opacity:.9}@media(max-width:600px){#kg-pulse-cta{margin:36px 16px 8px;padding:26px 20px}#kg-pulse-cta .kpc-title{font-size:20px}}</style>'
 + '<span class="kpc-eyebrow">Pulse 360°</span>'
 + '<p class="kpc-title">Ce qui freine vraiment ton équipe commerciale, mesuré en 4 semaines</p>'
 + '<p class="kpc-text">Pulse 360° croise tes indicateurs avec la perception de la direction, des managers et des commerciaux. Tu repars avec les écarts qui coûtent et un plan d’action à 90 jours.</p>'
 + '<div class="kpc-actions"><a class="kpc-btn kpc-primary" href="/pulse-audit-commercial/">Découvrir Pulse 360°</a><a class="kpc-btn kpc-secondary" href="/rendezvous/">Prendre rendez-vous</a></div>'
 + '</aside>';

export function addPulseCta(html) {
 if (html.includes('id="kg-pulse-cta"')) return html;
 if (!/<body[^>]*class="[^"]*post-template/.test(html)) return html;
 return html.replace(/(<section class="gh-content[\s\S]*?<\/section>)(\s*<\/article>)/, '$1' + PULSE_CTA + '$2');
}
