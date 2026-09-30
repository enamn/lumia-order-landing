import { Prisma } from "@prisma/client";
import { db } from "./db";
// MongoDB write conflicts abort transactions. Retry the complete unit of work.
export async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(work, { maxWait: 5000, timeout: 15000 }); }
    catch (error) {
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "";
      if (attempt >= 4 || !["P2034", "P2002"].includes(code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
    }
  }
}
