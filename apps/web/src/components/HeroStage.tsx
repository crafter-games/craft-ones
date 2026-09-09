"use client";

import dynamic from "next/dynamic";
import { HeroScene } from "./HeroScene";

// WebGL is lazy and optional: the vector poster carries the hero until (and
// unless) the canvas paints over it.
const HeroCanvas = dynamic(() => import("./HeroCanvas"), { ssr: false });

export function HeroStage() {
  return (
    <div className="home-scene">
      <HeroScene />
      <HeroCanvas />
    </div>
  );
}
