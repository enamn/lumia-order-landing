import type { Metadata } from "next";
import "./globals.css";
import { FontWarmup } from "@/components/font-warmup";
export const metadata: Metadata = { title: "Lumia Order · Your workspace", description: "Your business, your customers. All in one place.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><head><link rel="preload" href="/fonts/dirham-sans.woff2" as="font" type="font/woff2" crossOrigin=""/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap"/></head><body><FontWarmup/>{children}</body></html>; }
