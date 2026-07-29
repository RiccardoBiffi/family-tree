"use client";

import { type FormEvent, useState } from "react";

interface ArchiveOnboardingProps {
  onSubmit: (familyName: string) => void;
}

export function ArchiveOnboarding({ onSubmit }: ArchiveOnboardingProps) {
  const [familyName, setFamilyName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedFamilyName = familyName.trim();

    if (!normalizedFamilyName) {
      setError("Inserisci il nome della famiglia per continuare.");
      return;
    }

    setError("");
    onSubmit(normalizedFamilyName);
  };

  return (
    <main className="archive-onboarding">
      <section
        aria-labelledby="archive-onboarding-title"
        className="archive-onboarding__card"
      >
        <p className="archive-onboarding__eyebrow">Prima configurazione</p>
        <h1 id="archive-onboarding-title">Crea il tuo archivio di famiglia</h1>
        <p className="archive-onboarding__intro">
          Raccogli persone, relazioni e ricordi in un unico albero genealogico.
          L&apos;archivio resta salvato solo in questo browser.
        </p>

        <form className="archive-onboarding__form" onSubmit={handleSubmit}>
          <label htmlFor="archive-family-name">Nome della famiglia</label>
          <p className="archive-onboarding__hint" id="archive-family-name-hint">
            Verrà usato nel titolo dell&apos;archivio su questo dispositivo.
          </p>
          <input
            aria-describedby={[
              "archive-family-name-hint",
              error ? "archive-family-name-error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={error ? "true" : undefined}
            autoComplete="family-name"
            id="archive-family-name"
            maxLength={80}
            onChange={(event) => {
              setFamilyName(event.target.value);
              if (error) {
                setError("");
              }
            }}
            placeholder="Per esempio, Rinaldi"
            required
            type="text"
            value={familyName}
          />
          {error ? (
            <p
              className="archive-onboarding__error"
              id="archive-family-name-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button type="submit">Crea l&apos;archivio</button>
        </form>
      </section>
    </main>
  );
}
