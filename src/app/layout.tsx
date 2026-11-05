import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { NavigationProgress } from "@/components/NavigationProgress";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: "Mistři Evropy – Bělehrad 1976", template: "%s · Mistři Evropy 1976" },
};

export const viewport: Viewport = {
  themeColor: "#0f0d0b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className={`${playfair.variable} ${inter.variable} antialiased`}>
        <NavigationProgress />
        {children}
      </body>
    </html>
  );
}
