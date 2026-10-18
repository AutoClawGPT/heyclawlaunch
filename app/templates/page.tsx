import { listTemplates } from "@/lib/core/templates";
import { currentUser } from "@/lib/auth/session";
import TemplatesClient from "@/components/hcl/TemplatesClient";
import { PageHead } from "@/components/hcl/ui";
export const dynamic = "force-dynamic";
export const metadata = { title: "Templates" };
export default async function Page() {
  const [t, u] = await Promise.all([listTemplates(), currentUser()]);
  return <main><PageHead eyebrow="Templates · one tap" title={<>Pick a coin.<br /><span className="text-grad">Launch it.</span></>} sub="Ready-made coins with AI-generated name, ticker, description and logo. Tap one, check the preview, confirm. It launches from your own wallet and the creator fees go to you." art="/art/section-templates.jpg" /><div className="wrap pb-20"><TemplatesClient templates={t as any} signedIn={!!u} /></div></main>;
}
