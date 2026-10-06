// The calendar day in Dubai (YYYY-MM-DD): analytics days start and end at midnight in the UAE.
export const dubaiDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
