import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Homebase",
    short_name: "Homebase",
    description: "An overview of your accounts, budgets, and spending.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#18181b",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
