import type { Metadata } from "next";
import { Suspense } from "react";
import SetupScreen from "./SetupScreen";

export const metadata: Metadata = {
  title: "Craft Ones — Match setup",
};

export default function SetupPage() {
  return (
    <Suspense fallback={<main className="lobby p-8">Opening setup…</main>}>
      <SetupScreen />
    </Suspense>
  );
}
