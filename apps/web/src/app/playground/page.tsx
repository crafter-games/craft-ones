import type { Metadata } from "next";
import { Suspense } from "react";
import Playground from "./Playground";

export const metadata: Metadata = {
  title: "Craft Ones playground",
  robots: {
    index: false,
    follow: false,
  },
};

/** Unlinked developer route: the local match plus the lab tools. */
export default function PlaygroundPage() {
  return (
    <Suspense fallback={<main className="p-8">Opening playground…</main>}>
      <Playground lab />
    </Suspense>
  );
}
