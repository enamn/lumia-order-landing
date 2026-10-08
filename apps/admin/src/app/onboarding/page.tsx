import { redirect } from "next/navigation";
// The onboarding steps now live in the login flow (name → menu) and on the dashboard setup banner.
export default function Onboarding() { redirect("/login"); } // the login page shows "create your restaurant" for someone signed in without one, and sends everyone else on to the dashboard
