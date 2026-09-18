import type { Metadata } from "next";
import { Archivo, Bungee } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});
// The wordmark wants a face with more character than the UI text.
const bungee = Bungee({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://craft-ones.crafter.run"),
  applicationName: "Craft Ones",
  title: "Craft Ones | One shot. Your turn.",
  description:
    "Small paws. Big trouble. A free 1v1 artillery game by Crafter Station. Play in your browser or on Discord, invite a friend and make your shot count.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Craft Ones",
    title: "Craft Ones | One shot. Your turn.",
    description:
      "Pick your critter, aim your shot and challenge a friend. Free 1v1 artillery in your browser and on Discord.",
    images: [
      {
        url: "/brand/craft-ones-og.jpg",
        width: 1200,
        height: 630,
        alt: "Craft Ones: a cream guinea pig with a rocket launcher against a golden burst. Small paws. Big trouble.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Craft Ones | One shot. Your turn.",
    description:
      "Small paws. Big trouble. Play free 1v1 artillery with a friend in your browser or on Discord.",
    images: [
      {
        url: "/brand/craft-ones-og.jpg",
        alt: "Craft Ones: a cream guinea pig with a rocket launcher against a golden burst. Small paws. Big trouble.",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${bungee.variable}`}>
      <body>{children}</body>
    </html>
  );
}
