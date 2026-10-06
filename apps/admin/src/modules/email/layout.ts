// The look of every email Lumia Order sends: a branded header, a white card, one clear button, a quiet footer.
// Table layout with inline styles only, because email apps ignore most CSS. The gradient has a solid colour behind it for apps that do not draw gradients.
const esc = (v: string) => v.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]!);

export interface EmailContent {
  lang: "en" | "ar";
  heading: string;
  /** Plain paragraphs (escaped). */
  body: string[];
  /** A big highlighted value, for example a verification code. */
  highlight?: string;
  /** Short label above the highlighted value. */
  highlightLabel?: string;
  button?: { label: string; url: string };
  /** Small grey text under the button. */
  note?: string;
  /** Hidden preview text some email apps show next to the subject. */
  preheader?: string;
}

export function brandedEmail(c: EmailContent): { html: string; text: string } {
  const ar = c.lang === "ar", dir = ar ? "rtl" : "ltr", align = ar ? "right" : "left", font = "'Segoe UI',Tahoma,Arial,sans-serif";
  const footer = ar ? "رسالة تلقائية من لوميا أوردر · استقبال طلبات واتساب لمطعمك" : "An automatic message from Lumia Order · WhatsApp ordering for your restaurant";
  const html = `<!doctype html><html lang="${c.lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#FBF3F8;font-family:${font};color:#1A0815">
${c.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#FBF3F8">${esc(c.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF3F8"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #F0E4E8">
<tr><td bgcolor="#E0498F" style="background:#E0498F;background-image:linear-gradient(135deg,#FF5577 0%,#C93DFF 100%);padding:26px 32px;text-align:${align}">
<span style="font-size:26px;font-weight:700;letter-spacing:-0.03em;color:#ffffff;font-family:${font}">Lumia</span><span style="font-size:26px;font-weight:300;letter-spacing:-0.02em;color:#ffffff;font-family:${font}"> Order</span>
</td></tr>
<tr><td style="padding:32px 32px 8px;text-align:${align}">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.025em;color:#1A0815;font-family:${font}">${esc(c.heading)}</h1>
${c.body.map(p => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3D1C31;font-family:${font}">${esc(p)}</p>`).join("\n")}
${c.highlight ? `<div style="margin:22px 0;padding:20px;border-radius:16px;background:#FBF3F8;border:1px solid #F0E4E8;text-align:center">${c.highlightLabel ? `<div style="font-size:13px;color:#8A5A6E;margin-bottom:8px;font-family:${font}">${esc(c.highlightLabel)}</div>` : ""}<div style="font-size:38px;font-weight:700;letter-spacing:10px;color:#1A0815;font-family:'Courier New',monospace;padding-left:10px">${esc(c.highlight)}</div></div>` : ""}
</td></tr>
${c.button ? `<tr><td style="padding:8px 32px 8px;text-align:${align}"><a href="${esc(c.button.url)}" style="display:inline-block;background:#E0498F;background-image:linear-gradient(90deg,#FF5577,#C93DFF);color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:12px;font-family:${font}">${esc(c.button.label)}</a></td></tr>` : ""}
${c.note ? `<tr><td style="padding:14px 32px 0;text-align:${align}"><p style="margin:0;font-size:13px;line-height:1.5;color:#8A5A6E;font-family:${font}">${esc(c.note)}</p></td></tr>` : ""}
<tr><td style="padding:28px 32px 30px;text-align:${align}"><div style="border-top:1px solid #F0E4E8;padding-top:18px;font-size:12px;line-height:1.5;color:#8A5A6E;font-family:${font}">${esc(footer)}<br><a href="https://order.lumia.ae" style="color:#8A5A6E">order.lumia.ae</a></div></td></tr>
</table></td></tr></table></body></html>`;
  const text = [c.heading, "", ...c.body, ...(c.highlight ? ["", c.highlight] : []), ...(c.button ? ["", `${c.button.label}: ${c.button.url}`] : []), ...(c.note ? ["", c.note] : []), "", "Lumia Order · order.lumia.ae"].join("\n");
  return { html, text };
}
