"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useState } from "react";

const DiscordActivity = dynamic(() => import("./DiscordActivity"), {
  ssr: false,
});
export function DiscordEntry({
  children,
  dedicated = false,
}: {
  children?: ReactNode;
  dedicated?: boolean;
}) {
  const [embedded, setEmbedded] = useState<boolean | null>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setEmbedded(query.has("frame_id") && query.has("instance_id"));
  }, []);
  if (embedded) return <DiscordActivity />;
  if (!dedicated) return children;
  return (
    <main className="lobby p-8">
      <h1 className="text-3xl">Craft Ones on Discord</h1>
      <p>
        {embedded === null
          ? "Opening Discord…"
          : "Open Craft Ones from Discord’s App Launcher to play with a friend."}
      </p>
      <a href="/" className="cta gold">
        Play in your browser
      </a>
    </main>
  );
}
