import "./globals.css";

import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import { ThemeProvider } from "@/components/theme/theme-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Zacx",
  description: "Planejamento de conteudo e apresentacoes visuais para clientes Zacx.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={poppins.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
