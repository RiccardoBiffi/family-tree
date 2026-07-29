import type { PersonSex } from "@/models/Person";

interface PersonGlyphProps {
  className?: string;
  sex: PersonSex;
}

export function PersonGlyph({ className, sex }: PersonGlyphProps) {
  const feminine = sex === "female";

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="7.25" r="3.25" />
      {feminine ? (
        <>
          <path d="M8.15 11.3h7.7l2.35 8.2H5.8l2.35-8.2Z" />
          <path d="M7.3 20.8h9.4v-2.1H7.3z" />
        </>
      ) : (
        <path d="M4.8 20.4v-1.25a7.2 7.2 0 0 1 14.4 0v1.25H4.8Z" />
      )}
    </svg>
  );
}
