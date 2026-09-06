import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@craft-ones/shared"],
  devIndicators: false,
};

export default config;
