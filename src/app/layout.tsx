import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "PRIDE CHAT",
  description: "PRIDE CHAT — a modern social app built with Next.js, Firebase, and Tailwind CSS.",
};

// viewportFit: "cover" lets the app extend into the iPhone home-indicator
// area so env(safe-area-inset-*) values become non-zero; the bottom nav
// pads itself accordingly. themeColor matches the app background.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#050507",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
