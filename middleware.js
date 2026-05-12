import { NextResponse } from 'next/server';

const GHOST_HOST = 'blog-conseils-strategie-croissance.ghost.io';
const SQUARESPACE_HOST = 'bamboo-celery-eayp.squarespace.com';
const BLOG_PATH = '/blog-conseils-strategie-croissance';
const PUBLIC_HOST = 'keepgrowing.fr';
const PUBLIC_BASE = `https://${PUBLIC_HOST}${BLOG_PATH}`;

// Keep Growing brand logo for OG/Twitter sharing when Ghost has no custom image
const KG_OG_FALLBACK = 'https://static1.squarespace.com/static/671e09206ef0e92e89d66701/t/69530af543467e5d367d1359/1732363625778/logo-keepgrowing-fond-blanc.jpg?format=1500w';

function rewriteBody(text) {
  return text
    .replace(/https?:\/\/blog-conseils-strategie-croissance\.ghost\.io/g, PUBLIC_BASE)
    .replace(/blog-conseils-strategie-croissance\.ghost\.io/g, `${PUBLIC_HOST}${BLOG_PATH}`);
}

function rewriteHtml(html) {
  return rewriteBody(html)
    .replace(/(href|src|action|content|data-src|data-href)="\/(?!\/)/g, `$1="${BLOG_PATH}/`)
    .replace(/(srcset)="\/(?!\/)/g, `$1="${BLOG_PATH}/`)
    // Replace Ghost default publication-cover.jpg with Keep Growing brand image
    .replace(/https:\/\/static\.ghost\.org\/v\d+\.\d+\.\d+\/images\/publication-cover\.jpg/g, KG_OG_FALLBACK)
    // Strip Twitter Card meta tags (Keep Growing has no Twitter; OG is used by LinkedIn/Slack/WhatsApp)
    .replace(/\s*<meta\s+(?:name|property)="twitter:[^"]*"[^>]*\/?>\s*/gi, '');
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

  // Sitemap rewrite: ensure all URLs have trailing slash to match canonicals
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
      return new NextResponse(rewriteHtml(await res.text()), {
        status: res.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (/(application\/json|application\/xml|text\/xml|application\/rss\+xml|application\/atom\+xml|application\/ld\+json|text\/plain)/i.test(ct)) {
      return new NextResponse(rewriteBody(await res.text()), {
        status: res.status,
        headers: { 'Content-Type': ct }
      });
    }

    return new NextResponse(await res.arrayBuffer(), {
      status: res.status,
      headers: { 'Content-Type': ct, 'Cache-Control': res.headers.get('cache-control') || 'public, max-age=300' }
    });
  } catch (e) {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/blog-conseils-strategie-croissance(.*)', '/sitemap.xml', '/sitemap.xml/']
};
