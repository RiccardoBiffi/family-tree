type ArchiveIconName = "diagram" | "plus" | "reset" | "search" | "table" | "timeline";

interface ArchiveIconProps {
  className?: string;
  name: ArchiveIconName;
}

export function ArchiveIcon({ className, name }: ArchiveIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {name === "search" ? (
        <>
          <circle cx="10.75" cy="10.75" r="6.25" />
          <path d="m15.5 15.5 4 4" />
        </>
      ) : null}
      {name === "diagram" ? (
        <>
          <circle cx="8" cy="7" r="2.5" />
          <circle cx="16" cy="7" r="2.5" />
          <path d="M3.75 18.5v-1.25A4.25 4.25 0 0 1 8 13h.25a4.25 4.25 0 0 1 4.25 4.25v1.25" />
          <path d="M13 13.35a4.25 4.25 0 0 1 7.25 3v2.15" />
        </>
      ) : null}
      {name === "table" ? (
        <>
          <rect height="16" rx="2.5" width="17" x="3.5" y="4" />
          <path d="M3.5 9.25h17M3.5 14.75h17M9.25 4v16" />
        </>
      ) : null}
      {name === "timeline" ? (
        <>
          <rect height="5" rx="2.5" width="15" x="4.5" y="3.5" />
          <rect height="5" rx="2.5" width="15" x="4.5" y="15.5" />
          <path d="M8 8.5v7M16 8.5v7" />
        </>
      ) : null}
      {name === "plus" ? <path d="M12 5v14M5 12h14" /> : null}
      {name === "reset" ? (
        <>
          <path d="M5.25 8.5H9v-3.75" />
          <path d="M6.1 17.2A8 8 0 1 0 5.25 8.5" />
        </>
      ) : null}
    </svg>
  );
}
