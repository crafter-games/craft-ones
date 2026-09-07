import type { Metadata } from "next";
import Playground from "./Playground";

export const metadata: Metadata = {
  title: "Craft Ones playground",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlaygroundPage() {
  return <Playground />;
}
