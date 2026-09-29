type IconProps = { active?: boolean };

export function DashboardIcon({ active }: IconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="3" width="8" height="8" rx="2.6" />
        <rect x="13" y="3" width="8" height="8" rx="2.6" />
        <rect x="3" y="13" width="8" height="8" rx="2.6" />
        <rect x="13" y="13" width="8" height="8" rx="2.6" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

export function TransactionsIcon({ active }: IconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M4 8 H14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <polygon points="12.6,4.4 16.6,8 12.6,9.5" />
        <path d="M20 16 H10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <polygon points="11.4,19.6 7.4,16 11.4,14.5" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8 H16 M16 8 L12.5 4.5" />
      <path d="M20 16 H8 M8 16 L11.5 19.5" />
    </svg>
  );
}

export function RecurringIcon({ active }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? "2.6" : "1.6"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 3 20 7 16 11" />
      <path d="M3 12v-2a4 4 0 0 1 4-4h13" />
      <polyline points="8 21 4 17 8 13" />
      <path d="M21 12v2a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

export function TasksIcon({ active }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? "2.2" : "1.6"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9.5 L9.5 11 L13 7.5" />
      <path d="M8 16 H16" />
    </svg>
  );
}

export function SettingsIcon({ active }: IconProps) {
  if (active) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="3.4" stroke="none" />
        <line x1="12" y1="2.6" x2="12" y2="5.6" />
        <line x1="12" y1="18.4" x2="12" y2="21.4" />
        <line x1="2.6" y1="12" x2="5.6" y2="12" />
        <line x1="18.4" y1="12" x2="21.4" y2="12" />
        <line x1="5.4" y1="5.4" x2="7.5" y2="7.5" />
        <line x1="16.5" y1="16.5" x2="18.6" y2="18.6" />
        <line x1="5.4" y1="18.6" x2="7.5" y2="16.5" />
        <line x1="16.5" y1="7.5" x2="18.6" y2="5.4" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="2.6" />
      <line x1="12" y1="3" x2="12" y2="5.4" />
      <line x1="12" y1="18.6" x2="12" y2="21" />
      <line x1="3" y1="12" x2="5.4" y2="12" />
      <line x1="18.6" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="7.3" y2="7.3" />
      <line x1="16.7" y1="16.7" x2="18.4" y2="18.4" />
      <line x1="5.6" y1="18.4" x2="7.3" y2="16.7" />
      <line x1="16.7" y1="7.3" x2="18.4" y2="5.6" />
    </svg>
  );
}
