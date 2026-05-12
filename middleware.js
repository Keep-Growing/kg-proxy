import { NextResponse } from 'next/server';

const GHOST_HOST = 'blog-conseils-strategie-croissance.ghost.io';
const SQUARESPACE_HOST = 'bamboo-celery-eayp.squarespace.com';
const BLOG_PATH = '/blog-conseils-strategie-croissance';
const PUBLIC_HOST = 'keepgrowing.fr';
const PUBLIC_BASE = `https://${PUBLIC_HOST}${BLOG_PATH}`;

// Keep Growing brand logo for OG sharing when Ghost has no custom image
const KG_OG_FALLBACK = 'https://static1.squarespace.com/static/671e09206ef0e92e89d66701/t/69530af543467e5d367d1359/1732363625778/logo-keepgrowing-fond-blanc.jpg?format=1500w';

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

function buildBreadcrumbJsonLd(pathname, html) {
  // Detect article URL: /blog-.../single-segment/ (with optional trailing slash already there)
  const articleMatch = pathname.match(/^\/blog-conseils-strategie-croissance\/([^/]+)\/?$/);
  if (!articleMatch || articleMatch[1] === '') return null;
  const slug = articleMatch[1];
  // Skip Ghost system paths
  if (['tag', 'author', 'page', 'rss', 'sitemap.xml', 'sitemap-posts.xml', 'sitemap-pages.xml', 'sitemap-authors.xml', 'sitemap-tags.xml', 'robots.txt'].includes(slug)) return null;
  // Extract article H1 as breadcrumb leaf
  const h1Match = html.match(/<h1[^>]*class="gh-article-title[^"]*"[^>]*>([^<]+)<\/h1>/);
  const articleTitle = h1Match ? h1Match[1].trim() : slug.replace(/-/g, ' ');
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

  const breadcrumb = buildBreadcrumbJsonLd(pathname, out);
  if (breadcrumb) {
    out = out.replace('</head>', `${breadcrumb}\n</head>`);
  }

  return out;
}

function addTrailingSlashesToSitemap(xml) {
  return xml.replace(/<loc>(https?:\/\/[^<]+)<\/loc>/g, (match, url) => {
    try {
      const u = new URL(url);
      if (u.hostname !== PUBLIC_HOST) return match;
      if (u.pathname === '/' || u.pathname.endsWith('/')) return match;
      if (/\.[a-z0-9]{1,5}$/i.test(u.pathname)) return match;
      u.pathname += '/';
      return `<loc>${u.toString()}</loc>`;
    } catch {
      return match;
    }
  });
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

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

  // Blog reverse proxy
  if (!pathname.startsWith(BLOG_PATH)) return NextResponse.next();

  let ghostPath = pathname.slice(BLOG_PATH.length) || '/';
  if (!ghostPath.startsWith('/')) ghostPath = '/' + ghostPath;
  const ghostUrl = `https://${GHOST_HOST}${ghostPath}${search}`;

  try {
    const res = await fetch(ghostUrl, { redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';

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
  matcher: ['/blog-conseils-strategie-croissance(.*)', '/sitemap.xml', '/sitemap.xml/']
};
