import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that must not be bundled into client code.
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
