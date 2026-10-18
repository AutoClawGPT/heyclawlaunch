import { appendFileSync } from "fs";
export function report(name: string, pass: boolean, detail: string) {
  const line = `| ${name} | ${pass ? "PASS" : "FAIL"} | ${detail.replace(/\n/g, " ")} |`;
  console.log(line); appendFileSync("DEVNET_REPORT.md", line + "\n");
}
export const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
