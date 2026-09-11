import type { Metadata } from "next";
import { Suspense } from "react";
import Playground from "../playground/Playground";

export const metadata: Metadata = {
  title: "Craft Ones local match",
};

export default function LocalPage() {
  return (
    <Suspense fallback={<main className="p-8">Opening local match…</main>}>
      <Playground />
    </Suspense>
  );
}
