import Link from "next/link";
import { pageContext } from "@/server/page-context";
import { templateCapability } from "@/modules/whatsapp/templates";
import { WhatsAppTemplateForm } from "@/components/whatsapp-template-form";
export const dynamic = "force-dynamic";
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { businessId } = await searchParams; const { business, user } = await pageContext(businessId);
  const capability = await templateCapability(user.id, business.id);
  return <main className="wt-page"><header className="wt-header"><Link className="wt-brand" href={`/dashboard?page=whatsapp&businessId=${business.id}`}><span className="wt-mark">L</span><span><b>Lumia</b> Order</span></Link><Link className="wt-back" href={`/dashboard?page=whatsapp&businessId=${business.id}`}>← Back to WhatsApp</Link></header><section className="wt-title"><span className="wt-kicker">MESSAGE TEMPLATES</span><h1>Create a WhatsApp template</h1><p>Create an approved message format for order updates. Meta reviews every template before it can be sent to customers.</p></section><WhatsAppTemplateForm businessId={business.id} enabled={capability.enabled} reviewMode={capability.reviewMode}/></main>;
}
