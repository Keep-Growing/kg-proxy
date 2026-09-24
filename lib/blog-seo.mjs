export function fixBlogIndexHeading(html, ghostPath) {
  if (ghostPath !== '/' || /<h1\b/i.test(html)) return html;
  return html.replace(/<h2(\s[^>]*class="[^"]*gh-cta-title[^"]*"[^>]*)>[\s\S]*?<\/h2>/i,
    '<h1$1>Conseils en stratégie et performance commerciale B2B</h1>');
}
export function removeRetiredSitemapUrls(xml) {
  return xml.replace(/<url\b[^>]*>[\s\S]*?<\/url>/g, block => {
    const match=block.match(/<loc>(.*?)<\/loc>/);
    return match && /\/blog-conseils-strategie-croissance\/(?:about|back-basics)\/?$/.test(match[1]) ? '' : block;
  });
}
