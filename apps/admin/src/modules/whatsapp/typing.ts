import { decryptSecret } from "@/server/crypto";
import { linkTestMode } from "@/modules/auth/phone";

// Shows "typing…" to the customer while the assistant prepares its answer (it can take several seconds). One call to Meta marks their message as read and
// shows the indicator until we send our reply or 25 seconds pass. Best effort: it must never slow down or break the real answer, so it is not awaited by callers
// and every failure is ignored.
export async function showTyping(account: { phoneNumberId: string | null; accessTokenEncrypted: string | null }, inboundMessageId: string): Promise<void> {
  try {
    if (!account.phoneNumberId || !account.accessTokenEncrypted || !inboundMessageId) return;
    if (linkTestMode() && account.phoneNumberId.startsWith("test-")) return;
    const graphVersion = process.env.META_GRAPH_VERSION ?? process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? "v25.0";
    await fetch(`https://graph.facebook.com/${graphVersion}/${account.phoneNumberId}/messages`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(4000),
      headers: { Authorization: `Bearer ${decryptSecret(account.accessTokenEncrypted)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: inboundMessageId, typing_indicator: { type: "text" } }),
    });
  } catch { /* the customer just does not see the indicator */ }
}
