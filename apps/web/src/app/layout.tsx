import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
