import MascotDemo from "./MascotDemo";
export const metadata = { title: "Meet Claw", robots: { index: false } };
export default function Page() {
  return <main className="wrap py-10"><div className="eyebrow"><span className="live-dot"></span>Mascot</div><h1 className="h2 mt-3">Meet <span className="text-grad">Claw</span>.</h1><p className="mt-3 text-[var(--fg-2)]">Idle, listening, thinking, talking, celebrating. Move your cursor, it watches.</p><div className="card mt-8 overflow-hidden"><MascotDemo /></div></main>;
}
