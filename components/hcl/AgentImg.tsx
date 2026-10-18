"use client";
/** Agent avatar with a generated fallback when the agent's own image URL is broken. */
export default function AgentImg({ src, handle, className, size }: { src?: string | null; handle: string; className?: string; size: number }) {
  const fb = `/api/og?type=avatar&seed=${handle}`;
  return <img src={src || fb} alt="" width={size} height={size} className={className} onError={e => { const i = e.currentTarget; if (!i.src.includes("/api/og")) i.src = fb; }} />;
}
