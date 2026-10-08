import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Lumia Order · Your workspace", description: "Your business, your customers. All in one place.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><head><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/dirham@1.3.0/dist/css/dirham.css"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap"/></head><body>{children}</body></html>; }
