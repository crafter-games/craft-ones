import Image from "next/image";
import { Brand } from "../components/Brand";
import { CtaLink } from "../components/CtaLink";
import { HeroStage } from "../components/HeroStage";

export default function Home() {
  return (
    <main className="lobby home">
      <div className="home-scrim" aria-hidden="true" />
      <header className="lobby-header">
        <Brand as="span" />
        <span className="pill">Play Lab · Prototype</span>
      </header>
      <HeroStage />
      <div className="home-copy">
        <p className="hero-kicker">Made of mischief. Born in Peru.</p>
        <h1 className="hero-title">
          Small paws.
          <br />
          <span>Big trouble.</span>
        </h1>
        <p className="hero-lead">
          Six rivals. Six tools. Plenty of bad ideas.
          <br />
          Aim, charge, and send your friendly rivalry flying.
        </p>
      </div>
      <div className="home-actions">
        <CtaLink href="/setup?mode=local" className="cta gold">
          Playground <small>LOCAL · 2 SEATS</small>
        </CtaLink>
        <p className="cta dark is-soon" aria-disabled="true">
          Create Game <small>SOON</small>
        </p>
        <p className="home-note">
          Playground opens a one-screen setup: pick a map, a critter and a coat.
          No sign-up.
        </p>
        <p className="home-stats">100 HP · 15-second turns · 4 maps</p>
      </div>
      <footer className="lobby-footer">
        <span>Six critters · 100 HP · 15-second turns</span>
        <a
          className="made-by"
          href="https://crafter.run"
          target="_blank"
          rel="noreferrer"
        >
          <Image
            src="/brand/crafter-station-mark.svg"
            alt=""
            width={14}
            height={14}
          />
          Built by <b>Crafter Station</b>
        </a>
      </footer>
    </main>
  );
}
