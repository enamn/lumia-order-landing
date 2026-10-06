import { gunzipSync } from "node:zlib";
import { COUNTRIES, V4, V6 } from "./geoip-data";

// Country of an IP address, looked up in a table bundled with the app (so the address is never sent to anyone). Data: CC0 registry records, see scripts/build-geoip.mjs.
let t4: Buffer | null = null, t6: Buffer | null = null;
const load4 = () => (t4 ??= gunzipSync(Buffer.from(V4, "base64")));
const load6 = () => (t6 ??= gunzipSync(Buffer.from(V6, "base64")));

function search<T extends number | bigint>(table: Buffer, rec: number, key: T, read: (b: Buffer, o: number) => T): number | null {
  let lo = 0, hi = table.length / rec - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, o = mid * rec, start = read(table, o), end = read(table, o + (rec === 9 ? 4 : 8));
    if (key < start) hi = mid - 1; else if (key > end) lo = mid + 1; else return table[o + rec - 1]!;
  }
  return null;
}
export function ipv6Top64(ip: string): bigint | null {
  const clean = ip.split("%")[0]!;
  if (!/^[0-9a-f:.]+$/i.test(clean) || !clean.includes(":")) return null;
  let s = clean;
  const m = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(s); // ::ffff:1.2.3.4
  if (m) { const o = m[2]!.split(".").map(Number); if (o.some(n => n > 255)) return null; s = m[1]! + ((o[0]! << 8) | o[1]!).toString(16) + ":" + ((o[2]! << 8) | o[3]!).toString(16); }
  const [head, tail = ""] = s.split("::"); if (s.split("::").length > 2) return null;
  const h = head ? head.split(":") : [], t = tail ? tail.split(":") : [];
  if (h.length + t.length > 8) return null;
  const parts = [...h, ...Array(8 - h.length - t.length).fill("0"), ...t];
  if (parts.some(p => !/^[0-9a-f]{1,4}$/i.test(p))) return null;
  return parts.slice(0, 4).reduce((a, p) => (a << 16n) | BigInt(parseInt(p, 16)), 0n);
}
export function countryOfIp(ip: string): string | null {
  const v = ip.trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(v)?.[1];
  const v4 = mapped ?? (/^\d+\.\d+\.\d+\.\d+$/.test(v) ? v : null);
  if (v4) {
    const o = v4.split(".").map(Number); if (o.length !== 4 || o.some(n => !(n >= 0 && n <= 255))) return null;
    const i = search(load4(), 9, o.reduce((a, n) => a * 256 + n, 0), (b, off) => b.readUInt32BE(off));
    return i === null ? null : COUNTRIES[i] ?? null;
  }
  const top = ipv6Top64(v); if (top === null) return null;
  const i = search(load6(), 17, top, (b, off) => b.readBigUInt64BE(off));
  return i === null ? null : COUNTRIES[i] ?? null;
}
