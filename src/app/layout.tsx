import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { auth } from "@/auth";
import {
  PWA_APPLE_TOUCH_ICON_PATH,
  PWA_FAVICON_PATH,
  PWA_ICON_192_PATH,
  PWA_MANIFEST_PATH,
} from "@/lib/pwa-icons";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ADIMAGENDO | Participant App",
  description: "Study participant app for ADIMAGENDO",
  manifest: PWA_MANIFEST_PATH,
  icons: {
    icon: [
      { url: PWA_FAVICON_PATH, sizes: "32x32", type: "image/png" },
      { url: PWA_ICON_192_PATH, sizes: "192x192", type: "image/png" },
    ],
    apple: [
      {
        url: PWA_APPLE_TOUCH_ICON_PATH,
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: PWA_FAVICON_PATH,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ADIMAGENDO",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
