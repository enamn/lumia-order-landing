"use client";
import { useEffect } from "react";
// Browsers load a font that only covers one character (the dirham sign) lazily, and some leave the character as an empty box until it is asked for. Asking once at start-up avoids that.
export function FontWarmup() {
  useEffect(() => { try { void document.fonts?.load('1em "Dirham-Sans"', "⃃"); } catch { /* the sign then falls back to the browser's own font */ } }, []);
  return null;
}
