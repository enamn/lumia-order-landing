// Pictures that ship inside the build (served from /_next/static), not from public/: on the hosted site files in public/ were answered with 404.
import terminal from "./terminal.png";
import terminalOrder from "./terminal-order.png";
const url = (m: unknown): string => (typeof m === "string" ? m : (m as { src: string }).src);
export const terminalUrl = url(terminal), terminalOrderUrl = url(terminalOrder);
