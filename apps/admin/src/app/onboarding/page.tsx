import { redirect } from "next/navigation";
// The onboarding steps now live in the login flow (name → menu) and on the dashboard setup banner.
export default function Onboarding() { redirect("/dashboard"); }
