import type { MetadataRoute } from "next";

/** Makes MailMind installable. Colours match `--primary` (indigo-600) and `--background` in globals.css. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MailMind",
    short_name: "MailMind",
    description: "An AI email manager: classification, summaries, smart replies and an agent that asks before it sends.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f46e5",
    icons: [
      { src: "/pwa-icon/192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512.png", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
