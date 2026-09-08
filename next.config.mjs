import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep native/server-only packages out of the bundler in Next 15.
  serverExternalPackages: ["@prisma/client", "stripe", "@aws-sdk/client-cloudwatch"],
  // A stray package-lock.json in the home dir confuses root inference.
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
