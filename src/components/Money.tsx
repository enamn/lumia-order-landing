import { usePriceInfo } from '../pricing';
// A price with its currency sign: the UAE dirham sign (drawn by the "Dirham" font loaded in index.html) for AED, the Saudi riyal sign (U+20C1) for SAR,
// and the ISO code (OMR, BHD, QAR, KWD) for the other Gulf currencies: they have no sign of their own in English. Whole amounts show without decimals, others with the currency's own.
// Whole amounts show no decimals (209, not 209.000). Others show only the decimals they need: 15.9 and 13.25 in the 3-decimal currencies, always two (294.50) in the 2-decimal ones.
export const amountText = (n: number, decimals: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: decimals === 2 ? 2 : 0, maximumFractionDigits: decimals }));

export function Money({ n, cur, dec, fixed }: { n: number; cur: string; dec: number; fixed?: boolean }) {
  const amount = fixed ? n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : amountText(n, dec);
  if (cur === 'AED') return <span className="money" aria-label={`${amount} UAE dirhams`}><i className="dirham-symbol dirham-symbol-sans" aria-hidden="true" style={{ fontSize: '0.9em', marginInlineEnd: '0.18em' }} />{amount}</span>;
  if (cur === 'SAR') return <span className="money" aria-label={`${amount} Saudi riyals`}><span aria-hidden="true" style={{ marginInlineEnd: '0.18em' }}>{'⃁'}</span>{amount}</span>;
  return <span className="money">{cur} {amount}</span>;
}

// The sample amounts shown in the demos: same numbers, in the visitor's currency when it has prices (otherwise dirhams).
export function Aed({ n, fixed }: { n: number; fixed?: boolean }) {
  const info = usePriceInfo();
  return info?.local ? <Money n={n} cur={info.currency} dec={info.decimals} fixed={fixed} /> : <Money n={n} cur="AED" dec={2} fixed={fixed} />;
}
