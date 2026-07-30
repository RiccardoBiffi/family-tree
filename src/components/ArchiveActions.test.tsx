import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ArchiveActions,
  type ArchiveActionsProps,
} from "@/components/ArchiveActions";

function renderArchiveActions(overrides: Partial<ArchiveActionsProps> = {}) {
  const props: ArchiveActionsProps = {
    mode: "admin",
    query: "",
    onCreatePerson: vi.fn(),
    onExportArchive: vi.fn().mockResolvedValue(undefined),
    onImportArchive: vi.fn().mockResolvedValue(undefined),
    onQueryChange: vi.fn(),
    ...overrides,
  };

  render(<ArchiveActions {...props} />);

  return props;
}

describe("ArchiveActions archive management", () => {
  it("opens an accessible keyboard menu and restores focus when it closes", async () => {
    const user = userEvent.setup();
    renderArchiveActions();

    const trigger = screen.getByRole("button", { name: "Gestisci archivio" });

    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Ripristina demo" }),
    ).not.toBeInTheDocument();

    await user.click(trigger);

    const menu = screen.getByRole("menu", { name: "Gestione archivio" });
    const exportItem = within(menu).getByRole("menuitem", {
      name: "Esporta archivio",
    });
    const importItem = within(menu).getByRole("menuitem", {
      name: "Importa archivio",
    });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(menu).toHaveClass("absolute");
    expect(exportItem).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(importItem).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("menu", { name: "Gestione archivio" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    fireEvent.pointerDown(document.body);

    expect(
      screen.queryByRole("menu", { name: "Gestione archivio" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(
      screen.getByRole("searchbox", { name: "Cerca una persona" }),
    );
    expect(
      screen.queryByRole("menu", { name: "Gestione archivio" }),
    ).not.toBeInTheDocument();
  });

  it("exposes export progress and success without changing header layout", async () => {
    const user = userEvent.setup();
    let resolveExport: (() => void) | undefined;
    const onExportArchive = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveExport = resolve;
        }),
    );

    renderArchiveActions({ onExportArchive });

    const trigger = screen.getByRole("button", { name: "Gestisci archivio" });
    await user.click(trigger);
    await user.click(
      screen.getByRole("menuitem", { name: "Esporta archivio" }),
    );

    expect(onExportArchive).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute("aria-busy", "true");
    expect(trigger).toBeDisabled();

    const progress = screen.getByRole("status");
    expect(progress).toHaveTextContent("Esportazione in corso…");
    expect(progress).toHaveAttribute("aria-live", "polite");
    expect(progress).toHaveAttribute("data-tone", "progress");
    expect(progress).toHaveClass("absolute");

    await act(async () => {
      resolveExport?.();
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-busy", "false");
    });

    expect(trigger).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Archivio esportato.",
    );
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-tone",
      "success",
    );
  });

  it("accepts an .albero file, forwards it, and reports import errors politely", async () => {
    const user = userEvent.setup();
    const onImportArchive = vi
      .fn()
      .mockRejectedValue(new Error("Archivio non valido"));

    renderArchiveActions({ onImportArchive });

    const trigger = screen.getByRole("button", { name: "Gestisci archivio" });
    const fileInput = screen.getByLabelText(
      "Seleziona archivio da importare",
    ) as HTMLInputElement;
    const archiveFile = new File(["archivio"], "famiglia.albero", {
      type: "application/octet-stream",
    });

    expect(fileInput).toHaveAttribute("accept", ".albero");

    await user.click(trigger);
    await user.click(
      screen.getByRole("menuitem", { name: "Importa archivio" }),
    );

    expect(trigger).toHaveFocus();

    await user.upload(fileInput, archiveFile);

    expect(onImportArchive).toHaveBeenCalledOnce();
    expect(onImportArchive).toHaveBeenCalledWith(archiveFile);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-busy", "false");
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Importazione non riuscita. Controlla il file.",
    );
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("data-tone", "error");
  });

  it("reports a cancelled import without treating it as an error", async () => {
    const user = userEvent.setup();
    const onImportArchive = vi.fn().mockResolvedValue(false);

    renderArchiveActions({ onImportArchive });

    const trigger = screen.getByRole("button", { name: "Gestisci archivio" });
    const fileInput = screen.getByLabelText(
      "Seleziona archivio da importare",
    ) as HTMLInputElement;
    const archiveFile = new File(["archivio"], "famiglia.albero", {
      type: "application/octet-stream",
    });

    await user.click(trigger);
    await user.click(
      screen.getByRole("menuitem", { name: "Importa archivio" }),
    );
    await user.upload(fileInput, archiveFile);

    expect(onImportArchive).toHaveBeenCalledWith(archiveFile);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-busy", "false");
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Importazione annullata.");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("data-tone", "success");
  });

  it("lets visitors export and import without exposing person creation", async () => {
    const user = userEvent.setup();
    const onCreatePerson = vi.fn();
    const onExportArchive = vi.fn().mockResolvedValue(undefined);
    const onImportArchive = vi.fn().mockResolvedValue(undefined);

    renderArchiveActions({
      mode: "visitor",
      onCreatePerson,
      onExportArchive,
      onImportArchive,
    });

    expect(
      screen.getByRole("searchbox", { name: "Cerca una persona" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nuova persona" }),
    ).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Gestisci archivio" });
    const fileInput = screen.getByLabelText(
      "Seleziona archivio da importare",
    ) as HTMLInputElement;
    const archiveFile = new File(["archivio"], "famiglia.albero", {
      type: "application/octet-stream",
    });

    await user.click(trigger);
    await user.click(
      screen.getByRole("menuitem", { name: "Esporta archivio" }),
    );
    await waitFor(() => expect(onExportArchive).toHaveBeenCalledOnce());

    await user.click(trigger);
    await user.click(
      screen.getByRole("menuitem", { name: "Importa archivio" }),
    );
    await user.upload(fileInput, archiveFile);

    await waitFor(() => {
      expect(onImportArchive).toHaveBeenCalledWith(archiveFile);
    });
    expect(onCreatePerson).not.toHaveBeenCalled();
  });
});
