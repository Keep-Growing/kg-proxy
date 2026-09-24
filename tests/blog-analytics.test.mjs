import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { blogAnalyticsRuntime, injectBlogAnalytics } from '../lib/blog-analytics.mjs';
function browser(hostname = 'keepgrowing.fr') {
  const handlers = {}, scripts = [];
  const window = { location: { hostname, origin: 'https://' + hostname, pathname: '/blog-conseils-strategie-croissance/article/', href: 'https://' + hostname + '/blog-conseils-strategie-croissance/article/' }, addEventListener: (n, f) => handlers[n] = f };
  const document = { addEventListener: (n, f) => handlers[n] = f, querySelector: () => null, createElement: () => ({}), head: { appendChild: s => scripts.push(s) } };
  vm.runInNewContext('(' + blogAnalyticsRuntime.toString() + ')()', { window, document, URL });
  return { window, scripts, handlers, commands: () => (window.dataLayer || []).map(x => Array.from(x)) };
}
test('no Google script before consent, reject stays disabled', () => {
  const b = browser(); assert.equal(b.scripts.length, 0);
  b.handlers['kg:analytics-consent']({ detail: false });
  assert.equal(b.scripts.length, 0); assert.equal(b.window['ga-disable-G-CL8FNXBBD8'], true);
});
test('accept once, repeated accept and reaccept do not duplicate page views', () => {
  const b = browser(); const consent = b.handlers['kg:analytics-consent'];
  consent({ detail: true }); consent({ detail: true });
  assert.equal(b.scripts.length, 1);
  assert.equal(b.commands().filter(x => x[0] === 'event' && x[1] === 'page_view').length, 1);
  consent({ detail: false }); assert.equal(b.window['ga-disable-G-CL8FNXBBD8'], true);
  consent({ detail: true }); assert.equal(b.scripts.length, 1);
});
test('preview never initializes production measurement', () => {
  const b = browser('kg-proxy-test.vercel.app'); assert.equal(b.scripts.length, 0); assert.deepEqual(b.commands(), []);
});
test('offer click contains only paths and controlled offer identifier', () => {
  const b = browser(); b.handlers['kg:analytics-consent']({ detail: true });
  b.handlers.click({ target: { closest: () => ({ href: 'https://keepgrowing.fr/teach-you/?email=private@example.com' }) } });
  const event = b.commands().find(x => x[1] === 'blog_offer_click');
  assert.equal(event[2].offer_name, 'formation'); assert.equal(event[2].destination_path, '/teach-you');
  assert.ok(!JSON.stringify(event).includes('private'));
});
test('injection is idempotent and preserves upstream measurement', () => {
  const html = '<html><head><title>Test</title></head><body>Article</body></html>';
  const out = injectBlogAnalytics(html); assert.equal(injectBlogAnalytics(out), out);
  assert.equal(injectBlogAnalytics(html + 'G-CL8FNXBBD8'), html + 'G-CL8FNXBBD8');
  assert.ok(out.includes('<title>Test</title>')); assert.ok(out.includes('<body>Article</body>'));
});
test('vercel insights injected once before </body>', async () => {
  const { injectVercelInsights } = await import('../lib/blog-analytics.mjs');
  const html = '<html><head></head><body><p>x</p></body></html>';
  const out = injectVercelInsights(html);
  assert.ok(out.includes('<script defer src="/_vercel/insights/script.js"></script><script defer src="/_vercel/speed-insights/script.js"></script></body>'));
  assert.equal(injectVercelInsights(out), out);
  assert.equal(injectVercelInsights('{"not":"html"}'), '{"not":"html"}');
});
