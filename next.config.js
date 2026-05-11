const nextConfig = {
  trailingSlash: true,
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
