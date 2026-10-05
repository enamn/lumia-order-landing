// Stripe's Embedded Checkout: the payment form is drawn inside our page. Card details go straight to Stripe's frame, never through Lumia.
export interface EmbeddedForm { destroy(): void }
export async function mountEmbeddedCheckout(el: HTMLElement, clientSecret: string, publishableKey: string, onComplete: () => void): Promise<EmbeddedForm> {
  const w = window as unknown as { Stripe?: (key: string) => { initEmbeddedCheckout(o: { clientSecret: string; onComplete: () => void }): Promise<{ mount(el: HTMLElement): void; destroy(): void }> } };
  if (!w.Stripe) await new Promise<void>((resolve, reject) => { const t = document.createElement("script"); t.src = "https://js.stripe.com/v3/"; t.onload = () => resolve(); t.onerror = () => reject(Error("We couldn’t load the payment form.")); document.head.appendChild(t); });
  if (!w.Stripe) throw Error("We couldn’t load the payment form.");
  const form = await w.Stripe(publishableKey).initEmbeddedCheckout({ clientSecret, onComplete });
  form.mount(el);
  return form;
}
