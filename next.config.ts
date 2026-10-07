import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Demo runs locally at 127.0.0.1 (so its cookies stay apart from the real app's on localhost). Development only.
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [
      { source: "/finance", destination: "/finance/budgets", permanent: false },
      { source: "/transactions", destination: "/finance/transactions", permanent: false },
      { source: "/recurring", destination: "/finance/budgets", permanent: false },
      { source: "/accounts/:id", destination: "/finance/accounts/:id", permanent: false },
      { source: "/accounts", destination: "/finance/accounts", permanent: false },
    ];
  },
};

export default nextConfig;
