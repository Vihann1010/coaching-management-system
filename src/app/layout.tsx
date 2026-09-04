import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coaching Management System",
  description: "Student records, fees, attendance, tests and reports — all in one place.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [{ url: "/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Coaching CMS",
  },
};

export const viewport: Viewport = {
  themeColor: "#00923f",
  width: "device-width",
  initialScale: 1,
  // Staff will often be tapping tight table rows and dialog controls on a
  // phone in a hurry between classes — allowing pinch-zoom is an
  // accessibility/usability net positive, so we deliberately don't lock it.
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Brand fonts, loaded at runtime rather than next/font's build-time
            fetch — keeps builds working in network-restricted environments
            (offline CI, self-hosted runners) without touching fonts.googleapis.com
            during `next build`. Falls back to the system font stack in
            globals.css if this request is blocked or slow. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap"
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
