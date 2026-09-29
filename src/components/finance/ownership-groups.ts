export type Member = { user: { id: string; name: string | null; email: string } };

/** "You" first, then other household members in join order, "Shared" last. */
export function groupOrder(members: Member[], currentUserId: string): (string | null)[] {
  const others = members.map((m) => m.user.id).filter((id) => id !== currentUserId);
  return [currentUserId, ...others, null];
}

export function groupLabel(ownerId: string | null, members: Member[], currentUserId: string) {
  if (ownerId === null) return "Shared";
  if (ownerId === currentUserId) return "You";
  const member = members.find((m) => m.user.id === ownerId);
  return member?.user.name || member?.user.email || "Household member";
}
