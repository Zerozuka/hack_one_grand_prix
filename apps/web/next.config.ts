import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@knowledge-mesh/contracts"],
};

export default nextConfig;
