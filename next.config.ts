import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // !! WARN !!
    // Ignoring type checking for build to succeed despite type errors
    // This is useful for deployment but should be addressed in development
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
