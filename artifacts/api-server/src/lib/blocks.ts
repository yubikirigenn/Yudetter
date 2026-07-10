import { db, blocksTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

export async function getBlockedUserIds(userId: number | undefined): Promise<number[]> {
  if (!userId) return [];
  
  const blocks = await db
    .select({ blockerId: blocksTable.blockerId, blockedId: blocksTable.blockedId })
    .from(blocksTable)
    .where(or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedId, userId)));
    
  return blocks.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);
}
