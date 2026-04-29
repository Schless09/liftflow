import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-liftflow",
});

export const metadata: Metadata = {
  title: "LiftFlow",
  description: "AI-assisted workout execution — fast, minimal, gym-ready.",
  appleWebApp: { capable: true, title: "LiftFlow" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full bg-zinc-950 antialiased`}>
      <body className={`${dmSans.className} flex min-h-dvh flex-col text-zinc-100`}>{children}</body>
    </html>
  );
}
