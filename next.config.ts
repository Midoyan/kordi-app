import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/pdf-report': ['./node_modules/@formepdf/core/pkg/*.wasm'],
  },
};

export default nextConfig;
