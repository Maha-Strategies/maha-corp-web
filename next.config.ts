import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/research/chronobiological-entrainment-endocrine-homeostasis',
        destination: 'https://research.mahastrategies.com/papers/chronobiological-entrainment',
        permanent: true, // 301
      },
    ];
  },
};

export default nextConfig;