export function AccountTypeIcon({ type }: { type: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "CHECKING":
    case "SAVINGS":
      return (
        <svg {...common}>
          <rect x="2.5" y="6.5" width="19" height="13" rx="3" />
          <path d="M2.5 10.5 V7.8 Q2.5 6 4.5 6 H16 Q18 6 18 7.8 V10.5" />
          <circle cx="16" cy="13" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "CREDIT_CARD":
      return (
        <svg {...common}>
          <rect x="2.5" y="6.5" width="19" height="13" rx="3" />
          <line x1="2.5" y1="10.5" x2="21.5" y2="10.5" />
        </svg>
      );
    case "CASH":
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M4 10 H20" />
          <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "INVESTMENT":
      return (
        <svg {...common}>
          <path d="M4 19 L4 13 L9 13 L9 19 M11 19 L11 8 L15 8 L15 19 M17 19 L17 4 L21 4 L21 19" />
        </svg>
      );
    case "LOAN":
    case "MORTGAGE":
      return (
        <svg {...common}>
          <path d="M12 3 L20 9 V19 H4 V9 Z" />
          <path d="M10 19 V13 H14 V19" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
