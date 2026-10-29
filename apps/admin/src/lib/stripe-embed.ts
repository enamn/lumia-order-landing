// Stripe's Embedded Checkout: the payment form is drawn inside our page. Card details go straight to Stripe's frame, never through Lumia.
export interface EmbeddedForm { destroy(): void }
type Raw = { mount(el: HTMLElement): void; destroy(): void };
// Stripe allows one Embedded Checkout at a time. A page that re-renders while the first form is still loading would start a second one,
// so every mount first waits for the previous one to finish and removes it.
let last: Promise<Raw | null> = Promise.resolve(null);
export async function mountEmbeddedCheckout(el: HTMLElement, clientSecret: string, publishableKey: string, onComplete: () => void): Promise<EmbeddedForm> {
  const w = window as unknown as { Stripe?: (key: string) => { initEmbeddedCheckout(o: { clientSecret: string; onComplete: () => void }): Promise<Raw> } };
  const before = last;
  const mine = (async () => {
    try { (await before)?.destroy(); } catch { /* the earlier form is already gone */ }
    if (!w.Stripe) await new Promise<void>((resolve, reject) => { const t = document.createElement("script"); t.src = "https://js.stripe.com/v3/"; t.onload = () => resolve(); t.onerror = () => reject(Error("We couldn’t load the payment form.")); document.head.appendChild(t); });
    if (!w.Stripe) throw Error("We couldn’t load the payment form.");
    const form = await w.Stripe(publishableKey).initEmbeddedCheckout({ clientSecret, onComplete });
    form.mount(el);
    return form;
  })();
  last = mine.catch(() => null);
  const form = await mine;
  return { destroy() { try { form.destroy(); } catch { /* already destroyed */ } } };
}
