import type { Metadata, Viewport } from "next";
import { Syne, Outfit } from "next/font/google";
import { Sprite } from "@/components/Sprite";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FriaDay",
  description: "El parche lleva la cuenta. Nadie más está invitado.",
  manifest: "/manifest.webmanifest",
  applicationName: "FriaDay",
  appleWebApp: {
    capable: true,
    title: "FriaDay",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#120E0A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${syne.variable} ${outfit.variable}`}>
      <body>
        <Sprite />
        {children}
      </body>
    </html>
  );
}
