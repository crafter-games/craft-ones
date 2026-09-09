import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="lobby home">
      <div className="home-scene" aria-hidden="true" />
      <header className="lobby-header">
        <span className="brand">
          CRAFT <span>ONES</span>
        </span>
        <span className="pill">Crafter Station · Play Lab</span>
      </header>
      <div className="home-poster">
        <Image
          src="/art/duel-poster.svg"
          alt="An original caramel Cuy and a cream Llama face off in cartoon Andean grasslands."
          width={720}
          height={620}
          priority
        />
      </div>
      <div className="home-copy">
        <p className="hero-kicker">Made of mischief. Born in Peru.</p>
        <h1 className="hero-title">
          Small paws.
          <br />
          <span>Big trouble.</span>
        </h1>
        <p className="hero-lead">
          Four rivals. Six tools. Plenty of bad ideas.
          <br />
          Aim, charge, and send your friendly rivalry flying.
        </p>
      </div>
      <div className="home-actions">
        <Link href="/setup?mode=local" className="cta gold">
          Playground <small>LOCAL · 2 SEATS</small>
        </Link>
        <Link href="/setup?mode=create" className="cta dark">
          Create Game <small>INVITE A FRIEND</small>
        </Link>
        <p className="home-note">
          Both lead to a one-screen setup: pick a map, a critter and a coat. No
          sign-up.
        </p>
        <p className="home-stats">100 HP · 15-second turns · 4 maps</p>
      </div>
      <footer className="lobby-footer">
        <span>Four critters · 100 HP · 15-second turns</span>
        <span>Craft Ones / First playable</span>
      </footer>
    </main>
  );
}
