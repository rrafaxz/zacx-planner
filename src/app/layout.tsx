import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Poppins, Sora } from "next/font/google";

import { ThemeProvider } from "@/components/theme/theme-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-poppins",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Zacx Planner",
  description: "Planejamento e apresentações visuais",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zacx Planner",
  },
  icons: {
    icon: [
      {
        url: "/favicon.ico?v=5",
        type: "image/x-icon",
      },
      {
        url: "/icons/icon-192.png?v=5",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png?v=5",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico?v=5",
    apple: [
      {
        url: "/apple-touch-icon.png?v=5",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1D10D7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="light" suppressHydrationWarning>
      <body className={`${poppins.variable} ${sora.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
