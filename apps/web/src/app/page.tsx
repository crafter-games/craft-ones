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
        <span className="pill">Local + online</span>
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
          Six critters. Three guests. Plenty of bad ideas.
          <br />
          Aim, charge, and send your friendly rivalry flying.
        </p>
      </div>
      <div className="home-actions">
        <CtaLink href="/setup?mode=local" className="cta gold">
          Playground <small>LOCAL · 2 SEATS</small>
        </CtaLink>
        <CtaLink href="/setup?mode=create" className="cta dark">
          Create Game <small>ONLINE · INVITE A FRIEND</small>
        </CtaLink>
        <p className="home-note">
          Playground opens a one-screen setup: pick a map, a critter and a coat.
          No sign-up.
        </p>
        <p className="home-stats">100 HP · 15-second turns · 10 maps</p>
      </div>
      <footer className="lobby-footer">
        <span>Nine characters · 100 HP · 15-second turns</span>
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
