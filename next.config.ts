import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Moved from experimental.serverComponentsExternalPackages in Next.js 15+
  serverExternalPackages: [],
  
  // Configure API routes to handle larger payloads
  experimental: {
    serverComponentsExternalPackages: [], // Keep for backwards compatibility
  },
  
  // Note: api.bodyParser is only for pages router, not app router
  // For app router, use route.ts files with custom body parsing
};

export default nextConfig;
