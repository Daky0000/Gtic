import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that must not be bundled into client code.
  serverExternalPackages: ["@prisma/client"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Browsers pin HTTPS for a year after the first visit — a network
          // attacker can no longer downgrade the login or payment pages.
          // Harmless on plain-HTTP localhost (browsers ignore it there).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
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
