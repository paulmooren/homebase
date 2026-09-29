export function formatEUR(value: number): string {
  return (
    "€" +
    value.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatSignedEUR(value: number): string {
  const sign = value < 0 ? "−" : "+";
  return `${sign} ${formatEUR(Math.abs(value))}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
