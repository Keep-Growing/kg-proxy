// Vitesse du blog (24/10/2026, rapport PERFORMANCES_2026-10-22, point 4).
// L'image de couverture d'un article (img.gh-feature-image) est servie en PNG
// (jusqu'a 1 Mo) sans dimensions : LCP mobile de 6 s et decalage de mise en page.
// Ghost sait produire du WebP redimensionne via /content/images/size/wNNN/format/webp/ :
// on reecrit src et srcset vers ces versions, on ajoute width/height (lus dans le
// JSON-LD Article que Ghost emet avec les dimensions de la couverture) et
// fetchpriority="high". Meme image, meme cadrage : seul le format change.

const FEATURE_IMG = /<img\s[^>]*class="gh-feature-image"[^>]*>/;
const SIZED = /(\/content\/images\/size\/w\d+(?:h\d+)?\/)(?!format\/)([^"\s,]+?\.(?:png|jpe?g))(?=[\s",])/gi;

function coverDimensions(html, src) {
  // URL de la couverture sans le segment /size/wNNN/ : c'est celle du JSON-LD.
  const original = src.replace(/\/size\/w\d+(?:h\d+)?\//, '/');
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    for (const node of [data, ...(Array.isArray(data['@graph']) ? data['@graph'] : [])]) {
      const img = node && node.image;
      if (img && typeof img === 'object' && img.url === original && img.width && img.height) {
        return { width: img.width, height: img.height };
      }
    }
  }
  return null;
}

export function optimizeFeatureImage(html) {
  const m = html.match(FEATURE_IMG);
  if (!m) return html;
  let tag = m[0];
  const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1] || '';
  tag = tag.replace(SIZED, '$1format/webp/$2');
  tag = tag.replace(/\sloading="lazy"/, '');
  const extra = [];
  if (!/\swidth="/.test(tag) && src) {
    const dim = coverDimensions(html, src);
    if (dim) extra.push(`width="${dim.width}"`, `height="${dim.height}"`);
  }
  if (!/\sfetchpriority=/.test(tag)) extra.push('fetchpriority="high"');
  if (extra.length) tag = tag.replace(/\s*\/?>$/, ` ${extra.join(' ')}>`);
  return html.replace(m[0], tag);
}
