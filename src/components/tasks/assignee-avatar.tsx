"use client";

import { Avatar } from "@/components/avatar";
import { MenuItem, PopoverMenu } from "@/components/popover-menu";
import type { Member } from "@/components/tasks/task-row";

function SharedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5" />
      <path d="M17.5 14.2A6 6 0 0 1 21 19" />
    </svg>
  );
}

/** Who the task is for: their picture in a circle. Click it to hand the task to someone else, or to everyone. */
export function AssigneeAvatar({
  ownerId,
  members,
  currentUserId,
  onChange,
  size = 28,
}: {
  ownerId: string | null;
  members: Member[];
  currentUserId: string;
  onChange: (ownerId: string | null) => void;
  size?: number;
}) {
  const owner = members.find((m) => m.user.id === ownerId);
  const label = ownerId === null ? "Everyone" : owner ? owner.user.name || owner.user.email : "Someone";

  return (
    <PopoverMenu
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Assigned to ${label}, click to change`}
          title={label}
          className="rounded-full transition-opacity hover:opacity-80"
        >
          {owner ? (
            <Avatar name={owner.user.name || owner.user.email} image={owner.user.image} size={size} />
          ) : (
            <span
              className="flex items-center justify-center rounded-full bg-surface-2 p-[5px] text-text-muted"
              style={{ width: size, height: size }}
            >
              <SharedIcon />
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <>
          {[...members]
            .sort((a, b) => (a.user.id === currentUserId ? -1 : b.user.id === currentUserId ? 1 : 0))
            .map((m) => (
              <MenuItem
                key={m.user.id}
                active={m.user.id === ownerId}
                onClick={() => {
                  onChange(m.user.id);
                  close();
                }}
              >
                <Avatar name={m.user.name || m.user.email} image={m.user.image} size={22} />
                {m.user.id === currentUserId ? "You" : m.user.name || m.user.email}
              </MenuItem>
            ))}
          <MenuItem
            active={ownerId === null}
            onClick={() => {
              onChange(null);
              close();
            }}
          >
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface-2 p-1 text-text-muted">
              <SharedIcon />
            </span>
            Everyone
          </MenuItem>
        </>
      )}
    </PopoverMenu>
  );
}
