import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import WhatsNewModal from "@/components/whats-new-modal";
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
  title: "Short Cutter — Find the best Shorts in your videos",
  description:
    "Paste a YouTube URL and get AI-powered suggestions for the best Short clips to cut from your long-form videos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <WhatsNewModal />
      </body>
    </html>
  );
}
