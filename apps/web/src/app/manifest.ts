import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Craft Ones",
    short_name: "Craft Ones",
    description: "Free 1v1 artillery with small paws and big trouble.",
    start_url: "/",
    display: "standalone",
    background_color: "#14251f",
    theme_color: "#14251f",
    icons: [
      {
        src: "/brand/craft-ones-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/craft-ones-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
