import { blogConsentRuntime } from './blog-consent.mjs';
// Blog pages bypass the Next layout: insert analytics in the proxied HTML.
export function blogAnalyticsRuntime() {
  const w = window;
  const id = 'G-CL8FNXBBD8';
  if (w.location.hostname !== 'keepgrowing.fr' || w.__kgBlogAnalytics) return;
  w.__kgBlogAnalytics = true;
  w['ga-disable-' + id] = true;
  w.dataLayer = w.dataLayer || [];
  w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };
  w.gtag('consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  });
  let configured = false;
  let granted = false;
  function setConsent(value) {
    granted = value === true;
    w['ga-disable-' + id] = !granted;
    w.gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' });
    if (!granted || configured) return;
    configured = true;
    w.gtag('js', new Date());
    w.gtag('config', id, {
      send_page_view: false, content_group: 'Blog',
      page_location: w.location.origin + w.location.pathname,
      allow_google_signals: false, allow_ad_personalization_signals: false
    });
    w.gtag('event', 'page_view', { send_to: id });
    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      const script = document.createElement('script');
      script.async = true;
      // Match the working shared Google loader on the main site. The direct
      // GA4 loader returns 404; only the GA4 destination is configured here.
      script.src = 'https://www.googletagmanager.com/gtag/js?id=AW-17862707625';
      document.head.appendChild(script);
    }
  }
  // The consent UI calls this event both for stored choices and later changes.
  w.addEventListener('kg:analytics-consent', event => setConsent(event.detail === true));
  document.addEventListener('click', event => {
    if (!granted) return;
    const anchor = event.target.closest && event.target.closest('a[href]');
    if (!anchor) return;
    let target;
    try { target = new URL(anchor.href, w.location.href); } catch { return; }
    if (!['keepgrowing.fr', 'pulse.express.keepgrowing.fr'].includes(target.hostname)) return;
    const path = target.pathname.replace(/\/$/, '') || '/';
    const offers = {
      '/pulse-audit-commercial': 'pulse', '/teach-you': 'formation',
      '/done-with-you': 'mentoring', '/done-for-you': 'direction_transition',
      '/contact': 'contact', '/rendezvous': 'rendezvous', '/pulse-fonds': 'pulse_fonds'
    };
    const offer = target.hostname === 'pulse.express.keepgrowing.fr' ? 'pulse_express' : offers[path] || (/^\/(livre-blanc|lb-)/.test(path) ? 'livre_blanc' : null);
    if (!offer) return;
    try { sessionStorage.setItem('kg-blog-origin-v1', JSON.stringify({path:w.location.pathname,time:Date.now()})); } catch {}
    w.gtag('event', 'blog_offer_click', {
      send_to: id, article_path: w.location.pathname,
      offer_name: offer, destination_path: path, transport_type: 'beacon'
    });
  });
}

export function injectBlogAnalytics(html) {
  // Do not compete with an upstream GA4 installation if Ghost gains one later.
  if (html.includes('id="kg-blog-analytics"') || html.includes('G-CL8FNXBBD8')) return html;
  return html.replace(/<head\b[^>]*>/i, match => match +
    '<script id="kg-blog-analytics">(' + blogAnalyticsRuntime.toString() + ')();(' + blogConsentRuntime.toString() + ')();</script>');
}
