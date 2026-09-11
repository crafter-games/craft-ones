import { join } from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  output: process.env.VERCEL ? undefined : "standalone",
  outputFileTracingRoot: join(__dirname, "../.."),
  transpilePackages: ["@craft-ones/shared"],
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      ...["/", "/discord"].map((source) => ({
        source,
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors https://discord.com https://*.discord.com https://discordapp.com https://*.discordapp.com",
          },
        ],
      })),
    ];
  },
};

export default config;
