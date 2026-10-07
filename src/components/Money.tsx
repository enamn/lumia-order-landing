// A price with its currency sign: the UAE dirham sign (drawn by the "Dirham" font loaded in index.html) for AED, the Saudi riyal sign (U+20C1) for SAR,
// and the ISO code for the other Gulf currencies. Whole amounts show without decimals, others with the currency's own.
export const amountText = (n: number, decimals: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));

export function Money({ n, cur, dec }: { n: number; cur: string; dec: number }) {
  const amount = amountText(n, dec);
  if (cur === 'AED') return <span className="money" aria-label={`${amount} UAE dirhams`}><i className="dirham-symbol dirham-symbol-sans" aria-hidden="true" style={{ fontSize: '0.9em', marginInlineEnd: '0.18em' }} />{amount}</span>;
  if (cur === 'SAR') return <span className="money" aria-label={`${amount} Saudi riyals`}><span aria-hidden="true" style={{ marginInlineEnd: '0.18em' }}>{'⃁'}</span>{amount}</span>;
  return <span className="money">{cur} {amount}</span>;
}
