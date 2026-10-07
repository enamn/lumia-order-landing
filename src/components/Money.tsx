import { usePriceInfo } from '../pricing';
// The signs of the other Gulf currencies are their usual Arabic abbreviations (as in the e-commerce admin).
const ABBREVIATION: Record<string, string> = { OMR: 'ر.ع.', BHD: '.د.ب', QAR: 'ر.ق', KWD: 'د.ك' };

// A price with its currency sign: the UAE dirham sign (drawn by the "Dirham" font loaded in index.html) for AED, the Saudi riyal sign (U+20C1) for SAR,
// and the Arabic abbreviation for the other Gulf currencies (ر.ع. OMR, .د.ب BHD, ر.ق QAR, د.ك KWD). Whole amounts show without decimals, others with the currency's own.
export const amountText = (n: number, decimals: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));

export function Money({ n, cur, dec, fixed }: { n: number; cur: string; dec: number; fixed?: boolean }) {
  const amount = fixed ? n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : amountText(n, dec);
  if (cur === 'AED') return <span className="money" aria-label={`${amount} UAE dirhams`}><i className="dirham-symbol dirham-symbol-sans" aria-hidden="true" style={{ fontSize: '0.9em', marginInlineEnd: '0.18em' }} />{amount}</span>;
  if (cur === 'SAR') return <span className="money" aria-label={`${amount} Saudi riyals`}><span aria-hidden="true" style={{ marginInlineEnd: '0.18em' }}>{'⃁'}</span>{amount}</span>;
  const ar = ABBREVIATION[cur];
  if (ar) return <span className="money" aria-label={`${amount} ${cur}`}><bdi lang="ar" dir="rtl" aria-hidden="true">{ar}</bdi>{'\u00A0'}{amount}</span>;
  return <span className="money">{cur} {amount}</span>;
}

// The sample amounts shown in the demos: same numbers, in the visitor's currency when it has prices (otherwise dirhams).
export function Aed({ n, fixed }: { n: number; fixed?: boolean }) {
  const info = usePriceInfo();
  return info?.local ? <Money n={n} cur={info.currency} dec={info.decimals} fixed={fixed} /> : <Money n={n} cur="AED" dec={2} fixed={fixed} />;
}
