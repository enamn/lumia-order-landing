import { useEffect, useState } from 'react';

/** True when the viewport is at least `min` px wide. */
export function useWide(min = 880) {
  const get = () => (typeof window === 'undefined' ? true : window.innerWidth >= min);
  const [wide, setWide] = useState(get);
  useEffect(() => {
    const onResize = () => setWide(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [min]);
  return wide;
}

/** Class name helper for the `.fade` reveal transition. */
export const fade = (on: boolean, extra = '') => `fade${on ? '' : ' is-off'}${extra ? ' ' + extra : ''}`;
