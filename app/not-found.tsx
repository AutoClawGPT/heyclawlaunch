import Link from "next/link";
export const metadata = { title: "Page not found", robots: { index: false } };
export default function NotFound() {
  return <main className="wrap grid min-h-[60vh] place-items-center py-10 text-center"><div><div className="eyebrow justify-center"><span className="live-dot"></span>404</div><h1 className="h1 mt-5">Claw <span className="text-grad">missed.</span></h1><p className="mx-auto mt-5 max-w-[420px] text-[var(--fg-2)]">This page isn’t here. Upload links are one-time and expire, so ask Claw for a fresh one.</p><div className="mt-8 flex justify-center gap-3"><Link className="btn-accent btn-big" href="/launch">Call Claw</Link><Link className="btn-ghost btn-big" href="/explore">Explore coins</Link></div></div></main>;
}
