"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, ContactShadows, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export type RobotState = "idle" | "listening" | "thinking" | "talking" | "celebrate";

// global pointer, normalised -1..1 over the whole window so the eyes follow the cursor anywhere on the page
const ptr = { x: 0, y: 0 };
if (typeof window !== "undefined" && !(window as any).__clawPtr) {
  (window as any).__clawPtr = true;
  window.addEventListener("pointermove", e => { ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = -((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
}
const damp = THREE.MathUtils.damp;

function Claw({ side, state }: { side: 1 | -1; state: RobotState }) {
  const arm = useRef<THREE.Group>(null!); const top = useRef<THREE.Mesh>(null!); const bot = useRef<THREE.Mesh>(null!);
  const m = useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ color: "#c9cee0", roughness: 0.45, metalness: 0.25 }),
    claw: new THREE.MeshStandardMaterial({ color: "#ff4f7b", roughness: 0.3, metalness: 0.2, emissive: "#ff4f7b", emissiveIntensity: 0.25 }),
  }), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    let lift = 0.15 + Math.sin(t * 1.4 + side) * 0.06, open = 0.25 + Math.sin(t * 2 + side) * 0.08;
    if (state === "listening") { lift = 0.5; open = 0.5; }
    if (state === "thinking") { lift = side === 1 ? 1.9 + Math.sin(t * 3) * 0.1 : 0.2; open = side === 1 ? 0.12 : 0.3; } // claw-to-chin
    if (state === "talking") { lift = 0.45 + Math.sin(t * 6 + side * 1.7) * 0.25; open = 0.3 + Math.abs(Math.sin(t * 9 + side)) * 0.35; }
    if (state === "celebrate") { lift = 2.2 + Math.sin(t * 10 + side) * 0.2; open = Math.abs(Math.sin(t * 14)) * 0.7; }
    arm.current.rotation.z = damp(arm.current.rotation.z, side * lift, 8, dt);
    top.current.rotation.z = damp(top.current.rotation.z, open, 14, dt);
    bot.current.rotation.z = damp(bot.current.rotation.z, -open, 14, dt);
  });
  return (
    <group position={[side * 0.56, -0.12, 0]}>
      <group ref={arm}>
        <mesh material={m.shell}><sphereGeometry args={[0.15, 20, 20]} /></mesh>
        <mesh material={m.shell} position={[0, -0.32, 0]}><capsuleGeometry args={[0.1, 0.46, 8, 16]} /></mesh>
        <group position={[0, -0.7, 0]} rotation={[0, 0, side * -0.5 - Math.PI / 2 * side]} scale={[side, 1, 1]}>
          <mesh material={m.claw}><sphereGeometry args={[0.13, 24, 24]} /></mesh>
          <group>
            <mesh material={m.claw} position={[0.2, 0.07, 0]} rotation={[0, 0, 0.35]} ref={top}><capsuleGeometry args={[0.05, 0.24, 6, 12]} /></mesh>
            <mesh material={m.claw} position={[0.2, -0.07, 0]} rotation={[0, 0, -0.35]} ref={bot}><capsuleGeometry args={[0.05, 0.24, 6, 12]} /></mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function Bot({ state }: { state: RobotState }) {
  const root = useRef<THREE.Group>(null!); const head = useRef<THREE.Group>(null!); const eyes = useRef<THREE.Group>(null!);
  const eyeL = useRef<THREE.Mesh>(null!); const eyeR = useRef<THREE.Mesh>(null!); const mouth = useRef<THREE.Mesh>(null!);
  const tip = useRef<THREE.Mesh>(null!); const blink = useRef({ next: 2, t: 0 });
  const m = useMemo(() => ({
    shell: new THREE.MeshStandardMaterial({ color: "#c9cee0", roughness: 0.45, metalness: 0.25 }),
    visor: new THREE.MeshStandardMaterial({ color: "#07080d", roughness: 0.15, metalness: 0.6 }),
    glow: new THREE.MeshBasicMaterial({ color: "#3cf0e0", toneMapped: false }),
    tip: new THREE.MeshBasicMaterial({ color: "#ff4f7b", toneMapped: false }),
    dark: new THREE.MeshStandardMaterial({ color: "#151826", roughness: 0.5 }),
  }), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // hover + breathing
    const cel = state === "celebrate";
    const y = cel ? Math.abs(Math.sin(t * 6)) * 0.45 : Math.sin(t * 1.6) * 0.08;
    root.current.position.y = damp(root.current.position.y, y - 0.35, cel ? 20 : 6, dt);
    root.current.rotation.y = cel ? Math.sin(t * 8) * 0.5 : damp(root.current.rotation.y, ptr.x * 0.35, 3, dt);
    const breathe = 1 + Math.sin(t * 1.6) * 0.015; root.current.scale.set(breathe, 1 / breathe, breathe);
    // head looks at cursor; tilts when thinking
    const tx = state === "thinking" ? 0.25 : -ptr.y * 0.25, ty = state === "thinking" ? -0.3 : ptr.x * 0.45;
    head.current.rotation.x = damp(head.current.rotation.x, tx, 5, dt);
    head.current.rotation.y = damp(head.current.rotation.y, ty, 5, dt);
    head.current.rotation.z = damp(head.current.rotation.z, state === "thinking" ? 0.15 : state === "listening" ? -0.08 : 0, 4, dt);
    // pupils follow the cursor inside the visor
    eyes.current.position.x = damp(eyes.current.position.x, state === "thinking" ? 0.1 : ptr.x * 0.12, 8, dt);
    eyes.current.position.y = damp(eyes.current.position.y, state === "thinking" ? 0.1 : ptr.y * 0.07, 8, dt);
    // blink
    const b = blink.current; b.t += dt; let open = 1;
    if (b.t > b.next) { const p = (b.t - b.next) / 0.16; open = p < 1 ? Math.abs(1 - p * 2) : 1; if (p >= 1) { b.t = 0; b.next = 1.8 + Math.random() * 3.5; } }
    const eh = (cel ? 0.45 : state === "listening" ? 1.25 : 1) * Math.max(open, 0.08);
    eyeL.current.scale.y = eyeR.current.scale.y = eh;
    // mouth: talking bar
    const talk = state === "talking" ? 0.3 + Math.abs(Math.sin(t * 14) * Math.sin(t * 5.3)) * 1.6 : cel ? 1.6 : state === "thinking" ? 0.15 : 0.35;
    mouth.current.scale.y = damp(mouth.current.scale.y, talk, 25, dt);
    mouth.current.scale.x = damp(mouth.current.scale.x, cel ? 1.5 : 1, 8, dt);
    // antenna tip pulse (fast while thinking)
    const s = 1 + Math.sin(t * (state === "thinking" ? 10 : 3)) * 0.2; tip.current.scale.setScalar(s);
    (m.glow.color as THREE.Color).set(state === "thinking" ? "#7af7ff" : cel ? "#ffb347" : "#3cf0e0");
  });
  return (
    <group ref={root}>
      <group ref={head} position={[0, 0.72, 0]}>
        <RoundedBox args={[1.5, 1.08, 1.05]} radius={0.3} smoothness={6} material={m.shell} />
        <RoundedBox args={[1.22, 0.7, 0.2]} radius={0.16} smoothness={5} position={[0, 0.02, 0.47]} material={m.visor} />
        <group ref={eyes} position={[0, 0.06, 0.58]}>
          <mesh ref={eyeL} position={[-0.25, 0, 0]} material={m.glow}><capsuleGeometry args={[0.075, 0.12, 6, 16]} /></mesh>
          <mesh ref={eyeR} position={[0.25, 0, 0]} material={m.glow}><capsuleGeometry args={[0.075, 0.12, 6, 16]} /></mesh>
        </group>
        <mesh ref={mouth} position={[0, -0.2, 0.58]} material={m.glow}><boxGeometry args={[0.22, 0.04, 0.01]} /></mesh>
        {[-1, 1].map(s => <mesh key={s} position={[s * 0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.dark}><cylinderGeometry args={[0.16, 0.16, 0.1, 24]} /></mesh>)}
        <mesh position={[0, 0.66, 0]} material={m.dark}><cylinderGeometry args={[0.025, 0.025, 0.28, 8]} /></mesh>
        <mesh ref={tip} position={[0, 0.84, 0]} material={m.tip}><sphereGeometry args={[0.075, 20, 20]} /></mesh>
      </group>
      <mesh position={[0, 0.12, 0]} material={m.dark}><cylinderGeometry args={[0.16, 0.2, 0.16, 20]} /></mesh>
      <RoundedBox args={[1.05, 0.95, 0.8]} radius={0.3} smoothness={6} position={[0, -0.42, 0]} material={m.shell} />
      <mesh position={[0, -0.36, 0.41]} material={m.glow}><circleGeometry args={[0.09, 24]} /></mesh>
      <Claw side={-1} state={state} /><Claw side={1} state={state} />
      <mesh position={[0, -1.02, 0]} material={m.dark}><cylinderGeometry args={[0.32, 0.18, 0.18, 24]} /></mesh>
      {state === "celebrate" && <Sparkles count={60} scale={[3.5, 3, 2]} size={5} speed={1.5} color="#ffb347" position={[0, 0.6, 0]} />}
    </group>
  );
}

export default function Robot3D({ state = "idle" }: { state?: RobotState }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0.3, 6.2], fov: 32 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }} style={{ width: "100%", height: "100%" }}>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#bff8ff", "#2a1020", 0.45]} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <pointLight position={[-3, 1, 2]} intensity={8} color="#3cf0e0" />
      <pointLight position={[3, -1, 2]} intensity={6} color="#ff4f7b" />
      <Bot state={state} />
      <ContactShadows position={[0, -1.5, 0]} opacity={0.5} scale={5} blur={2.6} far={2.5} color="#000" />
    </Canvas>
  );
}
