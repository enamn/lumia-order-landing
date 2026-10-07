// The plan prices shown on the landing page: the visitor's own country (when it is in the Gulf and has approved prices), otherwise the UAE prices in AED.
// The country is looked up by the admin app from the visitor's IP; nothing is stored. While it loads, or if it fails, the UAE prices show.
import { useEffect, useState } from 'react';

const env = (import.meta as unknown as { env?: { VITE_ADMIN_URL?: string; DEV?: boolean } }).env;
const ADMIN = (env?.VITE_ADMIN_URL ?? (env?.DEV ? 'http://localhost:3000' : '')).replace(/\/$/, '');

export interface PriceInfo { detected: string; country: string; countryName: string; currency: string; decimals: number; local: boolean; paidOpen: boolean; plans: Record<'starter' | 'plus' | 'pro', { monthly: number; yearly: number }> }
export const AED: Pick<PriceInfo, 'currency' | 'decimals' | 'local'> = { currency: 'AED', decimals: 2, local: false };

export function usePriceInfo(): PriceInfo | null {
  const [info, setInfo] = useState<PriceInfo | null>(() => { try { const v = sessionStorage.getItem('lumia-prices'); return v ? (JSON.parse(v) as PriceInfo) : null; } catch { return null; } });
  useEffect(() => {
    if (!ADMIN || info) return;
    let live = true;
    fetch(`${ADMIN}/api/public/pricing${new URLSearchParams(location.search).get('country') ? `?country=${encodeURIComponent(new URLSearchParams(location.search).get('country')!)}` : ''}`, { credentials: 'omit' })
      .then(r => (r.ok ? r.json() : null)).then(j => { const d = j?.data as PriceInfo | undefined; if (d && live) { setInfo(d); try { sessionStorage.setItem('lumia-prices', JSON.stringify(d)); } catch { /* optional */ } } }).catch(() => undefined);
    return () => { live = false; };
  }, [info]);
  return info;
}

// "AED 1,490", "SAR 299", "OMR 24.900": whole amounts without decimals, others with the currency's own.
export function money(n: number, currency: string, decimals: number) {
  return `${currency} ${Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
