import type { PrismaClient } from "@prisma/client";

import { addInterval } from "@/lib/schedule";
import type { PushPayload } from "@/server/push";

/**
 * Who to tell what today: for each Member, the Reminders assigned to them (or
 * to Everyone) that fall due today, plus a single nudge for ones that are
 * exactly 2 days overdue. Anything overdue longer than that stays red in the
 * app but never notifies again.
 */
export async function buildDigests(prisma: PrismaClient, today: Date) {
  const twoDaysAgo = addInterval(today, -2, "DAY");
  const reminders = await prisma.reminder.findMany({
    where: { nextDueDate: { in: [today, twoDaysAgo] } },
    select: { title: true, ownerId: true, householdId: true, nextDueDate: true },
  });

  const households = [...new Set(reminders.map((r) => r.householdId))];
  const members = await prisma.householdMember.findMany({
    where: { householdId: { in: households } },
    select: { userId: true, householdId: true },
  });

  const byUser = new Map<string, { dueToday: string[]; overdue: string[] }>();
  for (const r of reminders) {
    const recipients = r.ownerId
      ? [r.ownerId]
      : members.filter((m) => m.householdId === r.householdId).map((m) => m.userId);
    for (const userId of recipients) {
      const entry = byUser.get(userId) ?? { dueToday: [], overdue: [] };
      (r.nextDueDate.getTime() === today.getTime() ? entry.dueToday : entry.overdue).push(r.title);
      byUser.set(userId, entry);
    }
  }
  return byUser;
}

const list = (items: string[]) => (items.length <= 3 ? items.join(", ") : `${items.slice(0, 3).join(", ")} and ${items.length - 3} more`);

/** The one message a person gets. */
export function digestMessage(entry: { dueToday: string[]; overdue: string[] }): PushPayload {
  const parts: string[] = [];
  if (entry.dueToday.length === 1) parts.push(`${entry.dueToday[0]} is due today`);
  else if (entry.dueToday.length > 1) parts.push(`Due today: ${list(entry.dueToday)}`);
  if (entry.overdue.length === 1) parts.push(`${entry.overdue[0]} is 2 days overdue`);
  else if (entry.overdue.length > 1) parts.push(`2 days overdue: ${list(entry.overdue)}`);
  return { title: "Homebase", body: parts.join(" · "), url: "/tasks" };
}
