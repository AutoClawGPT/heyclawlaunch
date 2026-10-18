import type { Metadata, Viewport } from "next";
import { Unbounded, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/hg/Header";
import Footer from "@/components/hg/Footer";
import Providers from "@/components/hg/Providers";
import Backdrop from "@/components/hcl/Backdrop";
import { cfg } from "@/lib/config";
const head = Unbounded({ subsets: ["latin"], variable: "--font-head", weight: ["500", "600", "700"] });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code" });
export const metadata: Metadata = { metadataBase: new URL(cfg.appUrl), title: { default: `${cfg.brand} — Hey Claw, launch a coin`, template: `%s · ${cfg.brand}` }, description: "Launch a pump.fun coin by chatting with Claw. No wallet, no SOL, no dev buy. Fees split 80/20 on chain.", icons: { icon: "/heyclaw-mark.svg" }, openGraph: { title: cfg.brand, description: "Say “launch a coin”. Live on pump.fun in seconds." } };
export const viewport: Viewport = { themeColor: "#07080d", width: "device-width", initialScale: 1 };
const tg = process.env.TELEGRAM_BOT_USERNAME ?? "HeyClawLaunchBot";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable} ${code.variable}`}>
      <body>
        <Providers>
          <Backdrop />
          <Header cluster={cfg.cluster} tg={tg} />
          <div className="min-h-[60vh]">{children}</div>
          <Footer cluster={cfg.cluster} tg={tg} />
        </Providers>
      </body>
    </html>
  );
}
