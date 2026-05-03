const nextConfig = {
  async rewrites() {
    return {
      fallback: [{
        source: '/:path*',
        destination: 'https://keepgrowing.squarespace.com/:path*'
      }]
    };
  }
};

module.exports = nextConfig;
