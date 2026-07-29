"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { ArchiveIcon } from "@/components/ArchiveIcon";

export interface ArchiveActionsProps {
  mode: "visitor" | "admin";
  query: string;
  onCreatePerson: () => void;
  onExportArchive: () => Promise<void>;
  onImportArchive: (file: File) => Promise<boolean | void>;
  onQueryChange: (value: string) => void;
}

type ArchiveOperation = "export" | "import";
type FeedbackTone = "error" | "progress" | "success";

interface ArchiveFeedback {
  message: string;
  tone: FeedbackTone;
}

export function ArchiveActions({
  mode,
  query,
  onCreatePerson,
  onExportArchive,
  onImportArchive,
  onQueryChange,
}: ArchiveActionsProps) {
  const isAdmin = mode === "admin";
  const menuId = useId();
  const searchInputId = useId();
  const statusId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const managementButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [busyOperation, setBusyOperation] = useState<ArchiveOperation | null>(
    null,
  );
  const [feedback, setFeedback] = useState<ArchiveFeedback | null>(null);
  const isBusy = busyOperation !== null;

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    managementButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    menuRef.current
      ?.querySelector<HTMLButtonElement>("[role='menuitem']")
      ?.focus();

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        (managementButtonRef.current?.contains(event.target) ||
          menuRef.current?.contains(event.target))
      ) {
        return;
      }

      closeMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeMenu();
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeMenu, isMenuOpen]);

  const runOperation = async (
    operation: ArchiveOperation,
    callback: () => Promise<boolean | void>,
  ) => {
    const isExport = operation === "export";

    setBusyOperation(operation);
    setFeedback({
      message: isExport
        ? "Esportazione in corso…"
        : "Importazione in corso…",
      tone: "progress",
    });

    try {
      const completed = await callback();
      if (completed === false) {
        setFeedback({
          message: "Importazione annullata.",
          tone: "success",
        });
        return;
      }

      setFeedback({
        message: isExport ? "Archivio esportato." : "Archivio importato.",
        tone: "success",
      });
    } catch {
      setFeedback({
        message: isExport
          ? "Esportazione non riuscita. Riprova."
          : "Importazione non riuscita. Controlla il file.",
        tone: "error",
      });
    } finally {
      setBusyOperation(null);
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        "[role='menuitem']",
      ) ?? [],
    );

    if (menuItems.length === 0) {
      return;
    }

    event.preventDefault();
    const activeIndex = menuItems.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex = activeIndex;

    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = menuItems.length - 1;
    } else if (event.key === "ArrowDown") {
      nextIndex = (activeIndex + 1) % menuItems.length;
    } else {
      nextIndex = (activeIndex - 1 + menuItems.length) % menuItems.length;
    }

    menuItems[nextIndex]?.focus();
  };

  return (
    <div
      className={
        isAdmin
          ? "archive-actions archive-actions--admin relative"
          : "archive-actions relative"
      }
    >
      <label className="archive-search" htmlFor={searchInputId}>
        <span className="sr-only">Cerca una persona</span>
        <ArchiveIcon className="archive-search__icon" name="search" />
        <input
          aria-label="Cerca una persona"
          id={searchInputId}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Cerca una persona"
          type="search"
          value={query}
        />
      </label>

      {isAdmin ? (
        <div aria-label="Azioni archivio" className="archive-admin-toolbar" role="toolbar">
          <button
            aria-label="Nuova persona"
            onClick={onCreatePerson}
            title="Nuova persona"
            type="button"
          >
            <ArchiveIcon className="archive-action-icon" name="plus" />
            <span className="sr-only">Nuova persona</span>
          </button>
          <button
            aria-busy={isBusy}
            aria-controls={menuId}
            aria-describedby={feedback ? statusId : undefined}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="Gestisci archivio"
            disabled={isBusy}
            onClick={() => {
              if (isMenuOpen) {
                closeMenu();
                return;
              }

              setFeedback(null);
              setIsMenuOpen(true);
            }}
            ref={managementButtonRef}
            title="Gestisci archivio"
            type="button"
          >
            <ArchiveIcon
              className={
                isBusy
                  ? "archive-action-icon animate-pulse"
                  : "archive-action-icon"
              }
              name="archive"
            />
            <span className="sr-only">Gestisci archivio</span>
          </button>
        </div>
      ) : null}

      {isAdmin && isMenuOpen ? (
        <div
          aria-label="Gestione archivio"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-[#d5ddd5] bg-white p-2 shadow-[0_18px_48px_rgba(24,45,31,0.16)]"
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          <button
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-[#26372c] outline-none transition hover:bg-[#f4f7f3] focus-visible:bg-[#eef3ee] focus-visible:ring-2 focus-visible:ring-[#0c3b24]"
            onClick={() => {
              closeMenu();
              void runOperation("export", onExportArchive);
            }}
            role="menuitem"
            type="button"
          >
            Esporta archivio
          </button>
          <button
            className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-[#26372c] outline-none transition hover:bg-[#f4f7f3] focus-visible:bg-[#eef3ee] focus-visible:ring-2 focus-visible:ring-[#0c3b24]"
            onClick={() => {
              closeMenu();
              fileInputRef.current?.click();
            }}
            role="menuitem"
            type="button"
          >
            Importa archivio
          </button>
        </div>
      ) : null}

      {isAdmin ? (
        <input
          accept=".albero"
          aria-label="Seleziona archivio da importare"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";

            if (file) {
              void runOperation("import", () => onImportArchive(file));
            }
          }}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />
      ) : null}

      {isAdmin && feedback ? (
        <p
          aria-live="polite"
          className={[
            "absolute right-0 top-full z-40 mt-2 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border bg-white px-3 py-2 text-sm shadow-[0_12px_32px_rgba(24,45,31,0.14)]",
            feedback.tone === "error"
              ? "border-[#d8a5a5] text-[#8b3030]"
              : "border-[#b9c5b8] text-[#26372c]",
          ].join(" ")}
          data-tone={feedback.tone}
          id={statusId}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
