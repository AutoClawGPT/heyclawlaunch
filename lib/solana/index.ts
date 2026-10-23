import { Connection, Keypair, PublicKey, ComputeBudgetProgram, TransactionMessage, VersionedTransaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { NATIVE_MINT, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getMint } from "@solana/spl-token";
import BN from "bn.js";
import bs58 from "bs58";
import { PUMP_SDK, OnlinePumpSdk, feeSharingConfigPda, bondingCurvePda } from "./pump";
import { cfg } from "@/lib/config";
import { isTransient } from "./errors";

export const RENT_ZERO = 650_240;
const g = globalThis as unknown as { __conn?: Connection };
export const conn = () => (g.__conn ??= new Connection(cfg.rpc, "confirmed"));
export const online = () => new OnlinePumpSdk(conn());

export function parseSecret(raw: string): Keypair {
  raw = raw.trim();
  const sk = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw);
  return sk.length === 64 ? Keypair.fromSecretKey(sk) : Keypair.fromSeed(sk);
}
let _launch: Keypair | undefined;
export const launchWallet = () => (_launch ??= parseSecret(process.env.LAUNCH_WALLET_SECRET!));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function sendV0(ixs: TransactionInstruction[], signers: Keypair[], payer = signers[0].publicKey) {
  const c = conn();
  let tx!: VersionedTransaction, blockhash = "", lastValidBlockHeight = 0;
  for (let i = 0; ; i++) { // retry transient RPC errors before anything is sent
    try {
      ({ blockhash, lastValidBlockHeight } = await c.getLatestBlockhash("confirmed"));
      tx = new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message());
      tx.sign(signers);
      const sim = await c.simulateTransaction(tx, { sigVerify: false });
      if (sim.value.err) throw new Error(`simulation failed: ${JSON.stringify(sim.value.err)} ${(sim.value.logs ?? []).slice(-6).join(" | ")}`);
      break;
    } catch (e) { if (i >= 2 || !isTransient(e)) throw e; await sleep(600 * (i + 1) ** 2); }
  }
  const sig = await c.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
  try {
    const res = await c.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    if (res.value.err) throw new Error(`tx ${sig} failed: ${JSON.stringify(res.value.err)}`);
  } catch (e) { // confirmation can time out/expire even though the tx landed: check before reporting failure
    if (String((e as any)?.message).startsWith(`tx ${sig} failed`)) throw e;
    const st = (await c.getSignatureStatuses([sig], { searchTransactionHistory: true }).catch(() => null))?.value?.[0];
    if (st && !st.err && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return sig;
    if (st?.err) throw new Error(`tx ${sig} failed: ${JSON.stringify(st.err)}`);
    throw e;
  }
  return sig;
}

export async function createCoin(d: { name: string; symbol: string; uri: string; holders: boolean; quoteMint?: PublicKey; creatorFeeBps?: number }) {
  const launch = launchWallet();
  const mint = Keypair.generate();
  const quoteMint = d.quoteMint ?? NATIVE_MINT;
  const resolved: any = await online().resolveQuoteMint(quoteMint);
  const ix = await PUMP_SDK.createV2Instruction({
    mint: mint.publicKey, name: d.name, symbol: d.symbol, uri: d.uri,
    creator: launch.publicKey, user: launch.publicKey, mayhemMode: false,
    quoteMint, quoteTokenProgram: resolved.quoteTokenProgram,
    creatorFeeBps: d.creatorFeeBps ? new BN(d.creatorFeeBps) : undefined,
    holderReward: d.holders, pumpQuote: resolved.pumpQuote?.accounts,
  });
  const sig = await sendV0([
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: Number(process.env.CREATE_CU_PRICE ?? 350_000) }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), ix,
  ], [launch, mint]);
  return { mint: mint.publicKey, sig };
}

export async function splitFees(mint: PublicKey, recipient: PublicKey, quoteMint: PublicKey = NATIVE_MINT) {
  const launch = launchWallet();
  const newShareholders = [{ address: recipient, shareBps: 10_000 - cfg.platformBps }, { address: launch.publicKey, shareBps: cfg.platformBps }];
  const sol = quoteMint.equals(NATIVE_MINT);
  const pre: TransactionInstruction[] = [];
  if (!sol) { // V2 pays pending quote-token fees to current shareholders first: their quote ATAs must exist
    const qp = (await conn().getAccountInfo(quoteMint))!.owner;
    for (const o of [launch.publicKey, recipient]) pre.push(createAssociatedTokenAccountIdempotentInstruction(launch.publicKey, getAssociatedTokenAddressSync(quoteMint, o, true, qp), o, quoteMint, qp));
  }
  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
    ...pre,
    await PUMP_SDK.createFeeSharingConfig({ creator: launch.publicKey, mint, pool: null }),
    sol // v1 for SOL coins (as HeyClawLaunch); v2 for any other quote mint
      ? await PUMP_SDK.updateFeeShares({ authority: launch.publicKey, mint, currentShareholders: [launch.publicKey], newShareholders, bondingCurveComplete: false })
      : await PUMP_SDK.updateFeeSharesV2({ authority: launch.publicKey, mint, currentShareholders: [launch.publicKey], newShareholders, quoteMint, quoteTokenProgram: (await conn().getAccountInfo(quoteMint))!.owner, bondingCurveComplete: false }),
  ];
  return sendV0(ixs, [launch]);
}

export async function readSharingConfig(mint: PublicKey) {
  const info = await conn().getAccountInfo(feeSharingConfigPda(mint));
  if (!info) return null;
  return PUMP_SDK.decodeSharingConfig(info);
}

export async function distribute(mint: PublicKey, quoteMint = NATIVE_MINT) {
  const launch = launchWallet();
  const sc = await readSharingConfig(mint);
  if (!sc) throw new Error("no sharing config");
  const min = await online().getMinimumDistributableFee(mint, launch.publicKey, { quoteMint, payer: launch.publicKey });
  if (!min.canDistribute) return { skipped: true as const, min };
  const { instructions } = await online().buildDistributeCreatorFeesInstructions(mint, { quoteMint, payer: launch.publicKey });
  const pre: TransactionInstruction[] = [];
  for (const s of (sc as any).shareholders as { address: PublicKey }[])
    if ((await conn().getBalance(s.address)) === 0) pre.push(SystemProgram.transfer({ fromPubkey: launch.publicKey, toPubkey: s.address, lamports: RENT_ZERO }));
  const sig = await sendV0([ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }), ...pre, ...instructions], [launch]);
  return { skipped: false as const, sig, min };
}

export async function transferFrom(user: Keypair, to: PublicKey, token: { mint: PublicKey | "SOL"; amount: bigint }) {
  const launch = launchWallet();
  const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitLimit({ units: token.mint === "SOL" ? 10_000 : 60_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 })];
  if (token.mint === "SOL") ixs.push(SystemProgram.transfer({ fromPubkey: user.publicKey, toPubkey: to, lamports: token.amount }));
  else {
    const prog = (await conn().getAccountInfo(token.mint))!.owner;
    const m = await getMint(conn(), token.mint, "confirmed", prog);
    const dst = getAssociatedTokenAddressSync(token.mint, to, true, prog);
    ixs.push(createAssociatedTokenAccountIdempotentInstruction(launch.publicKey, dst, to, token.mint, prog),
      createTransferCheckedInstruction(getAssociatedTokenAddressSync(token.mint, user.publicKey, true, prog), token.mint, dst, user.publicKey, token.amount, m.decimals, [], prog));
  }
  return sendV0(ixs, [launch, user], launch.publicKey);
}

export async function curveExists(mint: PublicKey) { return !!(await conn().getAccountInfo(bondingCurvePda(mint))); }
export { NATIVE_MINT, PublicKey, Keypair, BN };
