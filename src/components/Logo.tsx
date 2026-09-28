import { useId } from 'react';

/** The Lumia Order speech-bubble "Lo" mark. */
export function LogoMark({ size = 30, ink = '#1A0815' }: { size?: number; ink?: string }) {
  const id = useId();
  const stroke = `url(#${id})`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ display: 'block', flex: 'none' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF5577" />
          <stop offset="1" stopColor="#C93DFF" />
        </linearGradient>
      </defs>
      <path
        d="M32 10H68a22 22 0 0 1 22 22v36a22 22 0 0 1-22 22H36L17 95l4-13a22 22 0 0 1-11-14V32a22 22 0 0 1 22-22z"
        stroke={stroke}
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path d="M28 30V66H40" stroke={ink} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="64" cy="55" r="11" stroke={stroke} strokeWidth="10" />
    </svg>
  );
}

export function Brand({ size = 30, small = false }: { size?: number; small?: boolean }) {
  return (
    <a href="#top" className="brand" aria-label="Lumia Order home">
      <LogoMark size={size} />
      <span className="brand__word" style={small ? { fontSize: '0.95em' } : undefined}>
        <b style={small ? { fontSize: 18 } : undefined}>Lumia</b>
        <span style={small ? { fontSize: 14 } : undefined}>Order</span>
      </span>
    </a>
  );
}
