const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/sitemap.xml',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' }],
      },
      {
        source: '/blog-conseils-strategie-croissance/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=604800, immutable' }],
      },
    ];
  },
  // 301 redirects to fix legacy / vestigial URLs that GSC reports as 404.
  // These intercept BEFORE the rewrite fallback to Squarespace, so they avoid
  // the bamboo-celery chain (4 hops → 1 hop, same-domain).
  // Diagnostic: GSC Coverage report 2026-05-18 → 17 vestigial URLs + 4 old blog slugs.
  async redirects() {
    return [
      // --- Vestigial pages (old slugs from previous site iterations) ---
      { source: '/formations/', destination: '/teach-you/', permanent: true },
      { source: '/cabinets-experts-comptables/', destination: '/cabinets-experts/', permanent: true },
      { source: '/home-page-kg/', destination: '/', permanent: true },
      { source: '/home-1/', destination: '/', permanent: true },
      { source: '/nouvelle-page/', destination: '/', permanent: true },
      { source: '/pulse/', destination: '/pulse-audit-commercial/', permanent: true },
      { source: '/pulse-diagnostic-performance-commercial/', destination: '/pulse-audit-commercial/', permanent: true },
      { source: '/pulse-diagnostic-performance-commercial1/', destination: '/pulse-audit-commercial/', permanent: true },
      { source: '/apropos/', destination: '/a-propos-keep-growing/', permanent: true },
      { source: '/done-with-you-1-1/', destination: '/done-with-you/', permanent: true },
      { source: '/videosdirigeantscommercial/', destination: '/videos-dirigeants-commercial/', permanent: true },
      { source: '/videos/', destination: '/videos-dirigeants-commercial/', permanent: true },
      { source: '/newsletter/', destination: '/newsletter-strategie-commerciale-dirigeants/', permanent: true },
      { source: '/blog/', destination: '/blog-conseils-strategie-croissance/', permanent: true },
      { source: '/index.php/mentions-legales-cgu/', destination: '/cgu/', permanent: true },

      // --- Old blog post slugs (Squarespace random-suffix duplicates) ---
      {
        source: '/blog-conseils-strategie-croissance/fondamentaux-processus-commerciaux-9cyj3-5b4fg/',
        destination: '/blog-conseils-strategie-croissance/fondamentaux-processus-commerciaux/',
        permanent: true,
      },
      {
        source: '/blog-conseils-strategie-croissance/collectif-commercial-attitudes-exemplaires-8a7a7/',
        destination: '/blog-conseils-strategie-croissance/collectif-commercial-attitudes-exemplaires/',
        permanent: true,
      },
      {
        source: '/blog-conseils-strategie-croissance/dominer-marche-strategie-commerciale-ciblee/',
        destination: '/blog-conseils-strategie-croissance/',
        permanent: true,
      },
      {
        source: '/blog-conseils-strategie-croissance/https/keepgrowingfr/strategie-reseau-partenaires-b2b/',
        destination: '/blog-conseils-strategie-croissance/strategie-reseau-partenaires-b2b/',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      fallback: [{
        source: '/:path*',
        destination: 'https://bamboo-celery-eayp.squarespace.com/:path*'
      }]
    };
  }
};

module.exports = nextConfig;
