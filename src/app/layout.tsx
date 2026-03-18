import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "@/contexts/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Base Campaign Vault Agent",
  description: "Scaffold for campaign flow + USDC escrow on Base Sepolia",
  icons: {
    icon: "/logo-new.png",
  },

  other: {
    "talentapp:project_verification":
      "4ad9f659e345183da07bd0a42ae805eac4d4e49af9587bdf324f0881b81b8d1e2a708794dc463c046d9c28535bfdea7c138df41336fa359d4a934c78835ba8b7",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
