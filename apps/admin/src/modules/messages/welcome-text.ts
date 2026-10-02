// The greeting a customer gets the first time they contact a restaurant: the owner's own text, or a bilingual default.
export const defaultWelcome = (name: string) => `Welcome to ${name}! 👋\nI'm the restaurant's assistant. Ask me about the menu, or tell me what you'd like to order and I'll take care of it.\n\nأهلاً بك في ${name}! 👋\nأنا مساعد المطعم. اسألني عن القائمة أو أخبرني بما تريد طلبه وسأساعدك.`;
export function welcomeFor(agent: { configuration?: unknown } | null, businessName: string): string {
  const custom = (agent?.configuration as { welcome?: unknown } | null)?.welcome;
  return typeof custom === "string" && custom.trim() ? custom.trim() : defaultWelcome(businessName);
}
