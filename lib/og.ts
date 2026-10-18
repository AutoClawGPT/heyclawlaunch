import type { Metadata } from "next";
import { cfg } from "@/lib/config";
/** OG + Twitter large card for a page; image rendered by /api/og. */
export function ogMeta(title: string, description: string, q: string): Metadata {
  const image = { url: `${cfg.appUrl}/api/og?${q}`, width: 1200, height: 630, alt: title };
  return { title, description, openGraph: { title, description, images: [image], siteName: cfg.brand, type: "website" }, twitter: { card: "summary_large_image", title, description, images: [image.url] } };
}
