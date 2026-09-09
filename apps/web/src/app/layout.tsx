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
  title: "Craft Ones — One shot. Your turn.",
  description:
    "An original, tiny 1v1 artillery playground by Crafter Station. Invite a friend and make your shot count.",
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
