import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GSCProvider } from "@/contexts/GSCContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medcert.com Performance Metrics Dashboard | MedCerts",
  description: "Comprehensive SEO performance analytics dashboard for Medcert.com, combining Google Search Console and Ahrefs data for unified insights.",
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
        <GSCProvider>
          {children}
        </GSCProvider>
      </body>
    </html>
  );
}
