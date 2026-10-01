import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "RfpFit",
  description:
    "A brief with teeth. Prize locked. Bids judged against the written requirements. Winner paid by the contract.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
