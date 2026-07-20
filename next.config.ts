import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase the body size limit for file uploads (default is 1MB)
  // We support up to 10MB files
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
