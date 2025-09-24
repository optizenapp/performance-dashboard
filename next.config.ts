import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Increase body size limit for large CSV uploads
    serverComponentsExternalPackages: [],
  },
  // Configure API routes to handle larger payloads
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default nextConfig;
