import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./Brand";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <header>
        <Brand />
        <Link href="/">Back to the game</Link>
      </header>
      <article>
        <p className="legal-eyebrow">Craft Ones · Crafter Station</p>
        <h1>{title}</h1>
        <p className="legal-updated">Effective September 17, 2026</p>
        {children}
      </article>
      <footer>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <a href="mailto:hi@railly.dev">Contact support</a>
      </footer>
    </main>
  );
}
