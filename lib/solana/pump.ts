// pump-sdk ESM build imports a BN named export that @coral-xyz/anchor's ESM build lacks; load the CJS build.
import { createRequire } from "module";
const req = createRequire(import.meta.url);
const sdk = req("@pump-fun/pump-sdk") as typeof import("@pump-fun/pump-sdk");
export const { getBuyV3TokenAmountFromQuoteAmount, getSellSolAmountFromTokenAmount, PUMP_SDK, OnlinePumpSdk, feeSharingConfigPda, bondingCurvePda, GLOBAL_PDA, PUMP_FEE_CONFIG_PDA, QUOTE_CONTROL_PDA, getBuyTokenAmountFromSolAmount } = sdk;
export default sdk;
