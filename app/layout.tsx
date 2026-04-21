import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import { SerwistProvider } from "./serwist";
import { SyncListener } from "@/components/sync-listener";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const APP_NAME = "Biblioteca Escuela";
const APP_DESCRIPTION = "Sistema de registro de acceso a la biblioteca escolar";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e40af",
};

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    apple: "/icons/icon-192x192.png",
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" dir="ltr">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <SerwistProvider swUrl="/serwist/sw.js">
          <SyncListener />
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
