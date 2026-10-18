"use client";
import { useEffect, useState } from "react";
import Robot from "@/components/hg/Robot";
import type { RobotState } from "@/components/hg/Robot3D";
const SEQ: [RobotState, number][] = [["idle", 3000], ["listening", 2000], ["thinking", 2500], ["talking", 2500], ["celebrate", 3500]];
export default function MascotDemo() {
  const [i, setI] = useState(0); const [fixed, setFixed] = useState<RobotState | null>(null);
  useEffect(() => { const q = new URLSearchParams(location.search).get("s") as RobotState | null; if (q) setFixed(q); }, []);
  useEffect(() => { if (fixed) return; const id = setTimeout(() => setI((i + 1) % SEQ.length), SEQ[i][1]); return () => clearTimeout(id); }, [i, fixed]);
  return <div className="relative h-[560px] w-full"><Robot state={fixed ?? SEQ[i][0]} /><div className="tag absolute bottom-4 left-1/2 -translate-x-1/2">{fixed ?? SEQ[i][0]}</div></div>;
}
