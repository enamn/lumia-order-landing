export const dynamic = "force-dynamic";
// Liveness probe for the hosting platform. Does not touch the database.
export function GET() { return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } }); }
