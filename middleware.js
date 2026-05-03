import { NextResponse } from 'next/server';

const GHOST_HOST = 'blog-conseils-strategie-croissance.ghost.io';
const BLOG_PATH = '/blog-conseils-strategie-croissance';
const PUBLIC_HOST = 'keepgrowing.fr';
const PUBLIC_BASE = `https://${PUBLIC_HOST}${BLOG_PATH}`;

function rewriteBody(text) {
  return text
    .replace(/https?:\/\/blog-conseils-strategie-croissance\.ghost\.io/g, PUBLIC_BASE)
    .replace(/blog-conseils-strategie-croissance\.ghost\.io/g, `${PUBLIC_HOST}${BLOG_PATH}`);
}

function rewriteHtml(html) {
  return rewriteBody(html)
    .replace(/(href|src|action|content|data-src|data-href)="\/(?!\/)/g, `$1="${BLOG_PATH}/`)
    .replace(/(srcset)="\/(?!\/)/g, `$1="${BLOG_PATH}/`);
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith(BLOG_PATH)) return NextResponse.next();

  let ghostPath = pathname.slice(BLOG_PATH.length) || '/';
  if (!ghostPath.startsWith('/')) ghostPath = '/' + ghostPath;
  const ghostUrl = `https://${GHOST_HOST}${ghostPath}${search}`;

  try {
    const res = await fetch(ghostUrl, { redirect: 'manual' });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (loc) {
        let newLoc = loc.replace(/^https?:\/\/blog-conseils-strategie-croissance\.ghost\.io/, '');
        if (newLoc.startsWith('/') && !newLoc.startsWith(BLOG_PATH)) {
          newLoc = BLOG_PATH + (newLoc === '/' ? '' : newLoc);
        }
        const target = newLoc.startsWith('http') ? newLoc : new URL(newLoc, request.url).toString();
        return NextResponse.redirect(target, res.status);
      }
    }

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
  matcher: ['/blog-conseils-strategie-croissance', '/blog-conseils-strategie-croissance/:path*']
};
