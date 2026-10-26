"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// A real map for placing a branch pin: click anywhere or drag the pin; the value is "latitude, longitude" (6 decimals), the same text the settings save.
// Tiles are OpenStreetMap's (attribution shown, as their policy requires).
const parse = (v: string): [number, number] | null => { const m = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(v); return m ? [+m[1]!, +m[2]!] : null; };
const PIN = '<svg width="34" height="42" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 23s7-6.3 7-11.6A7 7 0 0 0 3 11.4C3 16.7 10 23 10 23z" fill="#FF5577" stroke="#fff" stroke-width="1.2"/><circle cx="10" cy="11" r="2.8" fill="#fff"/></svg>';

export default function PinMap({ value, onPick, center, height = 260 }: { value: string; onPick: (coords: string) => void; center: [number, number]; height?: number }) {
  const el = useRef<HTMLDivElement>(null), api = useRef<{ map: any; marker: any; L: any } | null>(null), pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !el.current || api.current) return;
      const at = parse(value), map = L.map(el.current, { center: at ?? center, zoom: at ? 17 : 11, scrollWheelZoom: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      const icon = L.divIcon({ html: PIN, className: "", iconSize: [34, 42], iconAnchor: [17, 40] });
      const out = (p: { lat: number; lng: number }) => pick.current(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
      let marker: any = null;
      const put = (ll: [number, number]) => { if (marker) marker.setLatLng(ll); else { marker = L.marker(ll, { icon, draggable: true }).addTo(map); marker.on("dragend", () => out(marker.getLatLng())); api.current!.marker = marker; } };
      api.current = { map, marker: null, L };
      if (at) put(at);
      map.on("click", (e: any) => { put([e.latlng.lat, e.latlng.lng]); out(e.latlng); });
      (api.current as any).put = put;
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => { dead = true; api.current?.map.remove(); api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The pin moved from outside the map (a search result, a pasted link, the current location): follow it.
  useEffect(() => {
    const a = api.current as any, at = parse(value);
    if (!a || !at) return;
    a.put?.(at); a.map.setView(at, Math.max(a.map.getZoom(), 17));
  }, [value]);
  return <div ref={el} style={{ height, width: "100%", borderRadius: 14, border: "1px solid #ECEAEB", overflow: "hidden", zIndex: 0, position: "relative" }} />;
}
