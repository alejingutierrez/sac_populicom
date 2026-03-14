import type { Metadata } from "next";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  variable: "--font-display"
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "SAC Populicom",
  description: "Consola inicial de monitoreo SAC para el Gobierno de Puerto Rico."
};

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <html lang="es">
    <body className={`${display.variable} ${body.variable}`}>{children}</body>
  </html>
);

export default RootLayout;
