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
// Ghost (injection de code globale) déclare sa propre fiche Keep Growing : autre logo,
// Pulse « en 4 semaines », ancienne tag line. On la remplace par une référence à l'entité
// du site (#org) et on relie le WebSite à #site (audit données structurées du 18/10/2026).
export function linkKgEntities(node) {
 const ORG = 'https://keepgrowing.fr/#org';
 if (!node || typeof node !== 'object' || Array.isArray(node) || node['@id']) return node;
 if (node['@type'] === 'Organization' && node.name === 'Keep Growing')
  return { '@context': node['@context'] || 'https://schema.org', '@type': 'Organization', '@id': ORG, name: 'Keep Growing', url: 'https://keepgrowing.fr/' };
 if (node['@type'] === 'WebSite' && /^https:\/\/keepgrowing\.fr\/?$/.test(node.url || ''))
  return { ...node, '@id': 'https://keepgrowing.fr/#site', url: 'https://keepgrowing.fr/', publisher: { '@id': ORG } };
 return node;
}
