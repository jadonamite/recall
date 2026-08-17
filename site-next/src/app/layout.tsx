import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

// One face everywhere: Bricolage Grotesque — the same lockup Binary and Delta
// use, so the three read as one house. Its optical-size axis holds from 10px
// tracking labels up to display, and tabular numerals keep the measured
// figures aligned down a column.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recall — run your bill of materials backwards",
  description:
    "Toyota has run this query since the 1970s. Recall traverses a dependency graph upward: which packages reach the compromised one, by what chain, and which single upgrade severs the most paths.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
