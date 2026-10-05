import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
