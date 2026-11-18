import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  reactStrictMode: true,
  // Ship the recorded database with serverless deployments so it can be copied to a writable folder.
  outputFileTracingIncludes: { "/**/*": ["./data/meter.db"] },
};
export default config;
