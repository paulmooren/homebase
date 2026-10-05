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
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URLs and Google avatars; nothing to optimize
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-text-muted ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
