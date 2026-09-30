"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="standalone"><h1>We couldn’t load your workspace.</h1><p className="muted">Please try again in a moment.</p><Button onClick={reset}>Try again</Button></main>; }
