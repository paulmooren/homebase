import type { Metadata, Viewport } from "next";
import { IS_DEMO_CLIENT } from "@/lib/demo";
import { Instrument_Sans, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";

import { TRPCProvider } from "@/trpc/react";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  weight: ["400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Homebase",
  description: "An overview of your accounts, budgets, and spending.",
  // Lets iOS run the saved home-screen app full screen, with the right name.
  appleWebApp: { capable: true, title: "Homebase", statusBarStyle: "default" },
  // The Demo is for showing, not for search results.
  ...(IS_DEMO_CLIENT ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSans.variable} ${plusJakartaSans.variable}`}
      >
        <TRPCProvider>{children}</TRPCProvider>
        <Script id="register-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`}
        </Script>
      </body>
    </html>
  );
}
