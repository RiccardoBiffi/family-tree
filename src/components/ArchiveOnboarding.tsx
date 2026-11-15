"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

import { ALBERO_FILE_EXTENSION } from "@/utils/alberoPackage";

interface ArchiveOnboardingProps {
  onSubmit: (familyName: string) => Promise<void>;
  onImportArchive: (file: File) => Promise<boolean>;
}

export function ArchiveOnboarding({ onSubmit, onImportArchive }: ArchiveOnboardingProps) {
  const [familyName, setFamilyName] = useState("");
  const [error, setError] = useState("");
  const [operation, setOperation] = useState<"create" | "import" | null>(null);
  const [importFeedback, setImportFeedback] = useState("");
  const [importFailed, setImportFailed] = useState(false);
  const pending = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) {
      return;
    }
    const normalizedFamilyName = familyName.trim();
    if (!normalizedFamilyName) {
      setError("Inserisci il nome della famiglia per continuare.");
      return;
    }
    setError("");
    pending.current = true;
    setOperation("create");
    try {
      await onSubmit(normalizedFamilyName);
    } finally {
      pending.current = false;
      setOperation(null);
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || pending.current) {
      return;
    }
    pending.current = true;
    setOperation("import");
    setImportFailed(false);
    setImportFeedback("Importazione in corso…");
    try {
      if (!(await onImportArchive(file))) {
        setImportFeedback("Importazione annullata.");
      }
    } catch {
      setImportFailed(true);
      setImportFeedback("Importazione non riuscita. Controlla il file.");
    } finally {
      pending.current = false;
      setOperation(null);
    }
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
            L&apos;archivio userà questo nome e includerà una famiglia di esempio.
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
            disabled={operation !== null}
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
          <button disabled={operation !== null} type="submit">
            {operation === "create" ? "Creazione in corso…" : "Crea l'archivio"}
          </button>
        </form>
        <div className="archive-onboarding__import">
          <p>Hai già un backup del tuo archivio?</p>
          <button
            disabled={operation !== null}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Importa archivio .albero
          </button>
          <input
            accept={ALBERO_FILE_EXTENSION}
            aria-label="Seleziona archivio da importare"
            className="sr-only"
            disabled={operation !== null}
            onChange={handleImport}
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
          />
          {importFeedback ? (
            <p className={importFailed ? "archive-onboarding__error" : undefined} role="status">
              {importFeedback}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
