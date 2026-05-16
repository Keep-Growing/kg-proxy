import { NextResponse } from 'next/server';

const GHOST_HOST = 'blog-conseils-strategie-croissance.ghost.io';
const SQUARESPACE_HOST = 'bamboo-celery-eayp.squarespace.com';
const BLOG_PATH = '/blog-conseils-strategie-croissance';
const PUBLIC_HOST = 'keepgrowing.fr';
const PUBLIC_BASE = `https://${PUBLIC_HOST}${BLOG_PATH}`;

// Keep Growing brand logo for OG sharing when Ghost has no custom image
const KG_OG_FALLBACK = 'https://static1.squarespace.com/static/671e09206ef0e92e89d66701/t/69530af543467e5d367d1359/1732363625778/logo-keepgrowing-fond-blanc.jpg?format=1500w';

// Search Atlas / OTTO dynamic optimization pixel — injected into Ghost responses
// so OTTO can apply on-page recommendations (title, meta description, keywords, canonical, schema)
// to the proxied blog pages. Without this, OTTO sees /blog-*/ as un-instrumented.
const OTTO_PIXEL = '<script nowprocket nitro-exclude type="text/javascript" id="sa-dynamic-optimization" data-uuid="a1e21b39-6f92-46d4-98ad-5b6be780d7c9" src="data:text/javascript;base64,dmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoInNjcmlwdCIpO3NjcmlwdC5zZXRBdHRyaWJ1dGUoIm5vd3Byb2NrZXQiLCAiIik7c2NyaXB0LnNldEF0dHJpYnV0ZSgibml0cm8tZXhjbHVkZSIsICIiKTtzY3JpcHQuc3JjID0gImh0dHBzOi8vZGFzaGJvYXJkLnNlYXJjaGF0bGFzLmNvbS9zY3JpcHRzL2R5bmFtaWNfb3B0aW1pemF0aW9uLmpzIjtzY3JpcHQuZGF0YXNldC51dWlkID0gImExZTIxYjM5LTZmOTItNDZkNC05OGFkLTViNmJlNzgwZDdjOSI7c2NyaXB0LmlkID0gInNhLWR5bmFtaWMtb3B0aW1pemF0aW9uLWxvYWRlciI7ZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpOw=="></script>';

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

// Decode HTML entities INSIDE JSON-LD <script> blocks + clean schema bugs:
// - Ghost emits "d&#x27;une" inside Article schema → decode entities
// - Squarespace emits Product schema with relative URLs "/contact" → make absolute
// - Squarespace emits "review": null / "aggregateRating": null → strip nulls
// - Trim whitespace/newlines around string values (Squarespace + Ghost both add them)
function decodeJsonLdEntities(html) {
  return html.replace(
    /(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (match, openTag, json, closeTag) => {
      let decoded = json
        .replace(/&amp;/g, '&')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x2013;/gi, '–')
        .replace(/&#x2014;/gi, '—')
        .replace(/&#x2026;/gi, '…')
        .replace(/&#xa0;/gi, ' ')
        .replace(/&#160;/g, ' ')
        // Trim leading/trailing whitespace inside string values
        .replace(/"\s*\n\s*([^"]+?)\s*\n\s*"/g, (m, v) => `"${v.replace(/\s+/g, ' ').trim()}"`);

      // Attempt JSON parse + structural cleanup (relative URL + null fields)
      try {
        const parsed = JSON.parse(decoded);
        const cleaned = cleanSchemaObject(parsed);
        decoded = JSON.stringify(cleaned);
      } catch {
        // If parse fails (e.g. multiple objects on one line, malformed), return decoded-only
      }

      return `${openTag}${decoded}${closeTag}`;
    }
  );
}

// Recursively walk a parsed JSON-LD schema and: (1) make relative URLs absolute,
// (2) strip null / "" / "@type"-only sentinel objects from offers.url, review, aggregateRating.
function cleanSchemaObject(obj) {
  if (Array.isArray(obj)) {
    return obj.map(cleanSchemaObject).filter(v => v !== null && v !== undefined);
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      // Strip null fields entirely (schema.org rejects nulls)
      if (v === null) continue;
      // Strip empty placeholder objects like { "@type": "Review" } (Squarespace stubs)
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const keys = Object.keys(v);
        if (keys.length === 1 && keys[0] === '@type') continue;
      }
      // Recurse
      let cleaned = cleanSchemaObject(v);
      // Make URL fields absolute (handle keys 'url', 'item', 'image', 'sameAs')
      if ((k === 'url' || k === 'item' || k === 'image' || k === 'logo') && typeof cleaned === 'string') {
        if (cleaned.startsWith('/') && !cleaned.startsWith('//')) {
          cleaned = `https://${PUBLIC_HOST}${cleaned}`;
        }
      }
      out[k] = cleaned;
    }
    return out;
  }
  return obj;
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

// Decode HTML entities found in scraped HTML text (used for breadcrumb name)
function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2013;/gi, '–')
    .replace(/&#x2014;/gi, '—')
    .replace(/&#x2026;/gi, '…')
    .replace(/&#xa0;/gi, ' ')
    .replace(/&#160;/g, ' ');
}

function buildBreadcrumbJsonLd(pathname, html) {
  // Detect article URL: /blog-.../single-segment/ (with optional trailing slash already there)
  const articleMatch = pathname.match(/^\/blog-conseils-strategie-croissance\/([^/]+)\/?$/);
  if (!articleMatch || articleMatch[1] === '') return null;
  const slug = articleMatch[1];
  // Skip Ghost system paths
  if (['tag', 'author', 'page', 'rss', 'sitemap.xml', 'sitemap-posts.xml', 'sitemap-pages.xml', 'sitemap-authors.xml', 'sitemap-tags.xml', 'robots.txt'].includes(slug)) return null;
  // Extract article H1 as breadcrumb leaf, decode entities (e.g. d&#x27;une → d'une)
  const h1Match = html.match(/<h1[^>]*class="gh-article-title[^"]*"[^>]*>([^<]+)<\/h1>/);
  const rawTitle = h1Match ? h1Match[1].trim() : slug.replace(/-/g, ' ');
  const articleTitle = decodeHtmlEntities(rawTitle);
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

  // Decode HTML entities inside JSON-LD blocks — Schema.org validators reject
  // values like "d&#x27;une approche" (Ghost's emit format).
  out = decodeJsonLdEntities(out);

  const breadcrumb = buildBreadcrumbJsonLd(pathname, out);
  if (breadcrumb) {
    out = out.replace('</head>', `${breadcrumb}\n</head>`);
  }

  // Inject OTTO pixel before </head> so Search Atlas can apply on-page recos on blog pages
  if (!out.includes('id="sa-dynamic-optimization"')) {
    out = out.replace('</head>', `${OTTO_PIXEL}\n</head>`);
  }

  return out;
}

function addTrailingSlashesToSitemap(xml) {
  return xml.replace(/<loc>(https?:\/\/[^<]+)<\/loc>/g, (match, url) => {
    try {
      const u = new URL(url);
      if (u.hostname !== PUBLIC_HOST) return match;
      if (/\.[a-z0-9]{1,5}$/i.test(u.pathname)) return match;
      // Ghost (blog) canonical includes trailing slash → align sitemap with slash
      if (u.pathname.startsWith(BLOG_PATH + '/') && !u.pathname.endsWith('/')) {
        u.pathname += '/';
        return `<loc>${u.toString()}</loc>`;
      }
      // Squarespace (apex) canonical excludes trailing slash → align sitemap without slash
      if (!u.pathname.startsWith(BLOG_PATH) && u.pathname !== '/' && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.replace(/\/$/, '');
        return `<loc>${u.toString()}</loc>`;
      }
      return match;
    } catch {
      return match;
    }
  });
}

const INDEXNOW_KEY = '2b3c37d13ada98fe63c1cb99c4dfd1a7';

// Typo-protection: catch malformed blog path "stratgie" (missing é) and 301 to canonical
const BLOG_PATH_TYPO_RX = /^\/blog-conseils-stratgie-croissance(\/.*)?$/i;

// Legacy URL redirects — old paths from previous Squarespace/Ghost iterations that
// Google still has indexed. Done at middleware level rather than Squarespace URL Mappings
// because (a) blog paths bypass Squarespace, (b) Squarespace's mappings emit
// off-domain Location headers (to bamboo-celery-eayp.squarespace.com), losing SEO juice.
const LEGACY_REDIRECTS = {
  // Apex / Squarespace paths
  '/nos-solutions': '/pulse-audit-commercial/',
  '/nos-accompagnements': '/done-with-you/',
  '/articles-linkedin': '/articles-linkedin-dirigeant-commercial/',
  '/rendezvous-1': '/rendezvous/',
  '/landing-page-le-collectif-commercial': '/livre-blanc-le-collectif-commercial/',
  '/a-propos-keepgrowing': '/a-propos-keep-growing/',
  '/done-with-you-1': '/done-with-you/',
  '/diagnostic-commercial': '/pulse-audit-commercial/',
  // Old blog article slugs → canonical pages
  '/blog-conseils-strategie-croissance/dominer-marche-strategie-commerciale-ciblee': '/blog-conseils-strategie-croissance/',
  '/blog-conseils-strategie-croissance/collectif-commercial-attitudes-exemplaires-8a7a7': '/blog-conseils-strategie-croissance/collectif-commercial-attitudes-exemplaires/',
  '/blog-conseils-strategie-croissance/fondamentaux-processus-commerciaux-9cyj3': '/blog-conseils-strategie-croissance/fondamentaux-processus-commerciaux/',
  '/blog-conseils-strategie-croissance/le-sales-business-coach-un-directeur-commercial-augmente': '/blog-conseils-strategie-croissance/',
  '/blog-conseils-strategie-croissance/back-basics': '/blog-conseils-strategie-croissance/fonction-commerciale-retour-fondamentaux/',
  '/blog-conseils-strategie-croissance/meddic-la-cle-de-victoire-dans-les-ventes-b2b-complexes': '/livre-blanc-meddicc/',
  '/blog-conseils-strategie-croissance/conseils-pour-un-onboarding-commercial-reussi': '/livre-blanc-lonboarding-efficace-des-commerciaux/',
  '/blog-conseils-strategie-croissance/prise-de-fonction-en-tant-que-directeur-commercial-les-100-premiers-jours': '/les-100-premiers-jours-du-directeur-commercial/',
  '/blog-conseils-strategie-croissance/maitriser-lart-de-la-prospection-en-b2b': '/blog-conseils-strategie-croissance/prospection-les-cles-dune-approche-gagnante/',
  '/blog-conseils-strategie-croissance/maitriser-lart-du-pitch-trois-scenarios-pratiques': '/blog-conseils-strategie-croissance/executive-conversation-pitch-dirigeant/',
  '/blog-conseils-strategie-croissance/assurer-le-suivi-des-clients-cles-pour-fideliser-la-relation-en-b2b': '/livre-blanc-gestion-de-grands-comptes/',
  '/blog-conseils-strategie-croissance/pivoter-avec-precision-lart-de-la-reorientation-en-startup': '/blog-conseils-strategie-croissance/',
  '/blog-conseils-strategie-croissance/seminaire-de-fin-dannee-loccasion-reflechir-et-dinnover': '/blog-conseils-strategie-croissance/',
  // Old category URLs (Squarespace had categories; Ghost uses tags)
  '/blog-conseils-strategie-croissance/category/Management-Leadership': '/blog-conseils-strategie-croissance/tag/leadership/',
  '/blog-conseils-strategie-croissance/category/Transformation-commerciale': '/blog-conseils-strategie-croissance/tag/management-commercial/',
};

function lookupLegacyRedirect(pathname) {
  // Try exact match (case-insensitive on the path)
  const lower = pathname.toLowerCase();
  // Strip trailing slash for lookup (we store keys without trailing slash)
  const key = lower.endsWith('/') && lower.length > 1 ? lower.slice(0, -1) : lower;
  if (LEGACY_REDIRECTS[key]) return LEGACY_REDIRECTS[key];
  return null;
}

// Tag/author URL normalization → 301 redirect to canonical ASCII-lowercase-hyphenated slug.
// Fixes Google "Page avec redirection" + "Introuvable (404)" + "duplicate canonical" errors
// for URLs like /tag/Leadership/, /tag/efficacité, /tag/diagnostic commercial, /tag/OKR.
function normalizeTagSlug(pathname) {
  const m = pathname.match(/^(\/blog-conseils-strategie-croissance\/(?:tag|author)\/)([^\/]+)(\/?$)/);
  if (!m) return null;
  const segment = decodeURIComponent(m[2]);
  // Normalize: NFD decompose + strip combining marks (é → e), lowercase, non-alphanum → hyphen
  const normalized = segment
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) return null;
  if (normalized === segment) return null;
  return `${m[1]}${normalized}/`;
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // Fix 0: legacy URL redirects (old Squarespace + old Ghost slugs)
  const legacyTarget = lookupLegacyRedirect(pathname);
  if (legacyTarget) {
    const url = new URL(legacyTarget + search, request.url);
    return NextResponse.redirect(url, 301);
  }

  // Fix 1: typo path "stratgie" (missing é) → 301 to canonical "strategie"
  if (BLOG_PATH_TYPO_RX.test(pathname)) {
    const fixed = pathname.replace(/blog-conseils-stratgie-croissance/i, 'blog-conseils-strategie-croissance');
    const url = new URL(fixed + search, request.url);
    return NextResponse.redirect(url, 301);
  }

  // Fix 2: tag/author URLs with accented chars → 301 to ASCII slug
  const normalizedTag = normalizeTagSlug(pathname);
  if (normalizedTag) {
    const url = new URL(normalizedTag + search, request.url);
    return NextResponse.redirect(url, 301);
  }

  // IndexNow key file at site root — required to authenticate IndexNow submissions
  if (pathname === `/${INDEXNOW_KEY}.txt` || pathname === `/${INDEXNOW_KEY}.txt/`) {
    return new NextResponse(INDEXNOW_KEY, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  }

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

  // Apex (Squarespace) schema cleanup proxy — only for pages with known schema issues.
  // Catches Product/Service schemas with relative URLs + null fields emitted by Squarespace.
  const APEX_SCHEMA_PAGES = new Set([
    '/pulse-audit-commercial/', '/pulse-fonds/', '/teach-you/',
    '/done-with-you/', '/done-for-you/', '/due-diligence-commerciale/',
    '/livre-blanc-le-collectif-commercial/', '/livre-blanc-meddicc/',
    '/livre-blanc-reseau-de-partenaires/', '/livre-blanc-introduction-aux-okr/',
    '/livre-blanc-lonboarding-efficace-des-commerciaux/',
    '/livre-blanc-gestion-de-grands-comptes/', '/livre-blanc-booster-votre-business/',
    '/lb-pilotez-la-performance-kpi/', '/lintelligence-artificielle-vente-b2b/',
    '/les-12-profils-relationnels-en-vente/', '/le-dirigeant-de-startup-dcrypt/',
    '/les-profils-commerciaux-dcrypts/', '/recruter-le-bon-commercial-en-2026/',
    '/les-100-premiers-jours-du-directeur-commercial/',
    '/contact-vision/', '/contact-culture/',
    '/atelier-disc-leadership/', '/atelier-disc-devenez-influent/',
    '/atelier-vision-strategie/', '/atelier-culture-adn/',
    '/merci-rdv/', '/a-propos-keep-growing/',
  ]);
  if (APEX_SCHEMA_PAGES.has(pathname)) {
    try {
      const res = await fetch(`https://${SQUARESPACE_HOST}${pathname}${search}`, { redirect: 'follow' });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        let html = await res.text();
        // Apply schema cleanup (decode entities, absolute URLs, strip nulls)
        html = decodeJsonLdEntities(html);
        return new NextResponse(html, {
          status: res.status,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=600',
          }
        });
      }
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

    // Convert 404 → 410 Gone for non-existent tag/author URLs.
    // Tells Google these are permanently removed → de-index. Avoids "Introuvable (404)" pile-up.
    if (res.status === 404 && /^\/(?:tag|author)\//.test(ghostPath)) {
      return new NextResponse('<!doctype html><html><head><title>410 Gone</title><meta name="robots" content="noindex"></head><body><h1>410 Gone</h1><p>This page has been permanently removed.</p><p><a href="/blog-conseils-strategie-croissance/">Back to blog</a></p></body></html>', {
        status: 410,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        }
      });
    }

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
  matcher: [
    '/blog-conseils-strategie-croissance(.*)',
    '/blog-conseils-stratgie-croissance(.*)',
    '/sitemap.xml',
    '/sitemap.xml/',
    '/2b3c37d13ada98fe63c1cb99c4dfd1a7.txt',
    '/2b3c37d13ada98fe63c1cb99c4dfd1a7.txt/',
    // Legacy URLs — caught by lookupLegacyRedirect()
    '/nos-solutions',
    '/nos-solutions/',
    '/nos-accompagnements',
    '/nos-accompagnements/',
    '/articles-linkedin',
    '/articles-linkedin/',
    '/rendezvous-1',
    '/rendezvous-1/',
    '/landing-page-le-collectif-commercial',
    '/landing-page-le-collectif-commercial/',
    '/a-propos-keepgrowing',
    '/a-propos-keepgrowing/',
    '/done-with-you-1',
    '/done-with-you-1/',
    '/diagnostic-commercial',
    '/diagnostic-commercial/',
    // Apex pages with Squarespace schema cleanup needed (cf. APEX_SCHEMA_PAGES)
    '/pulse-audit-commercial/',
    '/pulse-fonds/',
    '/teach-you/',
    '/done-with-you/',
    '/done-for-you/',
    '/due-diligence-commerciale/',
    '/livre-blanc-le-collectif-commercial/',
    '/livre-blanc-meddicc/',
    '/livre-blanc-reseau-de-partenaires/',
    '/livre-blanc-introduction-aux-okr/',
    '/livre-blanc-lonboarding-efficace-des-commerciaux/',
    '/livre-blanc-gestion-de-grands-comptes/',
    '/livre-blanc-booster-votre-business/',
    '/lb-pilotez-la-performance-kpi/',
    '/lintelligence-artificielle-vente-b2b/',
    '/les-12-profils-relationnels-en-vente/',
    '/le-dirigeant-de-startup-dcrypt/',
    '/les-profils-commerciaux-dcrypts/',
    '/recruter-le-bon-commercial-en-2026/',
    '/les-100-premiers-jours-du-directeur-commercial/',
    '/contact-vision/',
    '/contact-culture/',
    '/atelier-disc-leadership/',
    '/atelier-disc-devenez-influent/',
    '/atelier-vision-strategie/',
    '/atelier-culture-adn/',
    '/merci-rdv/',
    '/a-propos-keep-growing/',
  ]
};
