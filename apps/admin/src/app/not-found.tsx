import Link from "next/link";
export default function NotFound() { return <main className="standalone"><h1>Page not found.</h1><p>This workspace or page is not available to your account.</p><Link className="button button-primary" href="/dashboard">Back to your workspace</Link></main>; }
