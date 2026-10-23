"use client";
import { useState } from "react";
/** Agent banner that disappears (instead of showing a broken image) when its URL fails to load. */
export default function AgentBanner({ src, className }: { src?: string | null; className?: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return null;
  return <img src={src} alt="" className={className} onError={() => setBad(true)} />;
}
