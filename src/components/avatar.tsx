"use client";

import { Avatar as BaseAvatar } from "@base-ui/react/avatar";

/** Profile picture, or the first letter of the name when there isn't one. */
export function Avatar({
  name,
  image,
  size = 20,
  className = "",
}: {
  name: string;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.45)) };
  return (
    <BaseAvatar.Root
      style={style}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 font-semibold text-text-muted ${className}`}
    >
      {image && <BaseAvatar.Image src={image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
      <BaseAvatar.Fallback>{name.trim().charAt(0).toUpperCase() || "?"}</BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
