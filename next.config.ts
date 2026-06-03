import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 3,
      static: 30,
    },
  },
};

export default nextConfig;
