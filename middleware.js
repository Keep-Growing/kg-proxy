import { NextResponse } from 'next/server';

const GHOST_HOST = 'blog-conseils-strategie-croissance.ghost.io';
const BLOG_PATH = '/blog-conseils-strategie-croissance';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith(BLOG_PATH)) return NextResponse.next();

  const ghostUrl = `https://${GHOST_HOST}${pathname}${request.nextUrl.search}`;

  try {
    const res = await fetch(ghostUrl, {
      headers: { 'X-Forwarded-Host': 'keepgrowing.fr' },
      redirect: 'follow'
    });
    const ct = res.headers.get('content-type') || '';

    if (ct.includes('text/html')) {
      let html = await res.text();
      html = html.replace(/https?:\/\/blog-conseils-strategie-croissance\.ghost\.io\//g, 'https://keepgrowing.fr/');
      return new NextResponse(html, {
        status: res.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new NextResponse(await res.arrayBuffer(), {
      status: res.status,
      headers: { 'Content-Type': ct }
    });
  } catch (e) {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/blog-conseils-strategie-croissance', '/blog-conseils-strategie-croissance/:path*']
};
