import Link from "next/link";
import { Brand } from "../components/Brand";
import { HeroScene } from "../components/HeroScene";

export default function Home() {
  return (
    <main className="lobby home">
      <div className="home-scrim" aria-hidden="true" />
      <header className="lobby-header">
        <Brand as="span" />
        <span className="pill">Crafter Station · Play Lab</span>
      </header>
      <div className="home-scene">
        <HeroScene />
      </div>
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
        <Link href="/setup?mode=local" className="cta gold">
          Playground <small>LOCAL · 2 SEATS</small>
        </Link>
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
        <span>Craft Ones / First playable</span>
      </footer>
    </main>
  );
}
