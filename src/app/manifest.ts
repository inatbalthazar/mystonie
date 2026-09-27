import type { MetadataRoute } from "next";

/**
 * Web app manifest (ADR 0028): makes Mystonie installable (Android/desktop install prompt, iOS "Add to Home
 * Screen"), which iOS needs before it allows notifications. English, like the brand; the app itself follows
 * the user's saved language once it opens.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mystonie",
    short_name: "Mystonie",
    description: "Finished it? Mystonie it. Turn the shows and movies you finish into artwork worth sharing.",
    // Signed in, Home; signed out, the proxy sends it to sign-in and back.
    start_url: "/home?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf9f5",
    theme_color: "#fbf9f5",
    categories: ["entertainment", "lifestyle"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
