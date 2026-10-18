/** Animated site background: generated night-market art, drifting neon orbs and a slow scanning grid. Pure CSS, respects reduced motion. */
export default function Backdrop() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    <div className="absolute inset-0 bg-[url('/art/hero-bg.jpg')] bg-cover bg-center opacity-[0.13] [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_75%)]" />
    <div className="orb absolute -left-40 top-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(60,240,224,.22),transparent_65%)]" />
    <div className="orb orb-2 absolute -right-40 top-[30%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,79,123,.16),transparent_65%)]" />
    <div className="gridlines absolute inset-0 opacity-[0.35]" />
    <div className="noise absolute inset-0 opacity-[0.05]" />
  </div>;
}
