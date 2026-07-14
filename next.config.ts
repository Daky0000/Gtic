import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that must not be bundled into client code.
  serverExternalPackages: ["@prisma/client"],
  // Produces a self-contained server bundle for the Docker image.
  output: "standalone",
};

export default nextConfig;
