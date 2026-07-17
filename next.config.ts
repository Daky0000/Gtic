import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that must not be bundled into client code.
  serverExternalPackages: ["@prisma/client"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No page in the app is meant to be embedded — blocks clickjacking
          // (especially around the payment and login flows).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
