export function blogConsentRuntime() {
  if (window.location.hostname !== 'keepgrowing.fr' || window.__kgBlogConsent) return;
  window.__kgBlogConsent = true;
  const key = 'kg-blog-analytics-consent-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  function notify(accepted) {
    window.dispatchEvent(new CustomEvent('kg:analytics-consent', { detail: accepted }));
  }
  function mount() {
    const panel = document.createElement('section');
    panel.setAttribute('aria-label', 'Mesure d’audience du blog');
    panel.id = 'kg-blog-consent';
    panel.innerHTML = '<p>Autorisez-vous Google Analytics à mesurer la lecture des articles et les clics vers nos offres ? Vous pouvez refuser et continuer à lire.</p><div><button type="button" data-choice="yes">Accepter</button><button type="button" data-choice="no">Refuser</button><a href="/cgu/">Confidentialité</a></div>';
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.id = 'kg-blog-consent-settings';
    toggle.textContent = 'Cookies : mesure d’audience';
    toggle.setAttribute('aria-controls', panel.id);
    const style = document.createElement('style');
    style.textContent = '#kg-blog-consent{position:fixed;bottom:60px;left:16px;right:16px;max-width:540px;padding:20px;background:#fff;color:#172031;border:1px solid #172031;border-radius:12px;box-shadow:0 4px 24px #0003;z-index:2147483000;font:16px/1.5 system-ui}#kg-blog-consent[hidden]{display:none}#kg-blog-consent p{margin:0 0 14px}#kg-blog-consent div{display:flex;gap:12px;align-items:center;flex-wrap:wrap}#kg-blog-consent button,#kg-blog-consent-settings{font:inherit;cursor:pointer;background:#172031;color:#fff;border:1px solid #172031;border-radius:6px;padding:10px 16px}#kg-blog-consent a{color:#172031;text-decoration:underline}#kg-blog-consent-settings{position:fixed;bottom:10px;left:16px;z-index:2147483000;font:13px/1.5 system-ui}#kg-blog-consent button:focus-visible,#kg-blog-consent a:focus-visible,#kg-blog-consent-settings:focus-visible{outline:3px solid #007a78;outline-offset:3px}';
    document.head.appendChild(style);
    document.body.appendChild(panel); document.body.appendChild(toggle);
    function visible(show) { panel.hidden = !show; toggle.setAttribute('aria-expanded', String(show)); }
    visible(true);
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && typeof saved.accepted === 'boolean' && saved.time <= Date.now() && Date.now() - saved.time < lifetime) {
        visible(false); notify(saved.accepted);
      }
    } catch { /* Without storage, ask again on the next page. */ }
    panel.addEventListener('click', event => {
      const choice = event.target.getAttribute('data-choice');
      if (!choice) return;
      const accepted = choice === 'yes';
      try { localStorage.setItem(key, JSON.stringify({ accepted, time: Date.now() })); } catch {}
      notify(accepted); visible(false); toggle.focus();
    });
    toggle.addEventListener('click', () => {
      visible(panel.hidden);
      if (!panel.hidden) panel.querySelector('button').focus();
    });
    window.addEventListener('storage', event => {
      if (event.key !== key) return;
      try { const saved = JSON.parse(event.newValue); notify(saved && saved.accepted === true); }
      catch { notify(false); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
}
