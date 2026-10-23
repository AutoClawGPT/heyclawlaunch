"use client";
// framer-motion's MotionConfig moved into the clients that use motion (Bots/Templates/Leaderboard) to keep it out of every page's JS.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
