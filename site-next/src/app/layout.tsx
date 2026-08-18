import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Dancing_Script } from "next/font/google";
import "./globals.css";

// Three faces, the same set the rest of the house uses. Bricolage Grotesque
// carries the voice — the same lockup Binary and Delta use, so they read as one
// house; its optical-size axis holds from 10px tracking labels up to display,
// and its tabular numerals keep measured figures aligned down a column.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

/** Everything that is code or machine output — Cypher, transcripts, versions. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Used sparingly, for human asides — never for data or navigation. */
const dancingScript = Dancing_Script({
  variable: "--font-script-face",
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
    <html
      lang="en"
      className={`${bricolage.variable} ${geistMono.variable} ${dancingScript.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
