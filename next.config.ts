import type { NextConfig } from "next";
import assets from "./lib/assets.json";
// Binary art lives on IPFS (lib/assets.json, see scripts/cli/pin-assets.ts); local files win when present.
const art = Object.entries(assets as Record<string, string>).filter(([n]) => !n.startsWith("hcl-")).map(([n, cid]) => ({ source: `/art/${n}`, destination: `/api/ipfs/${cid}` }));
const nextConfig: NextConfig = {
  serverExternalPackages: ["@pump-fun/pump-sdk", "@pump-fun/pump-swap-sdk", "@coral-xyz/anchor", "@solana/web3.js", "@solana/spl-token", "@neondatabase/serverless", "ws", "bufferutil", "utf-8-validate", "grammy"],
  async rewrites() { return { beforeFiles: [], afterFiles: art, fallback: [] }; },
};
export default nextConfig;
