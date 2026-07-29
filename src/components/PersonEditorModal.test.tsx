import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonEditorModal } from "@/components/PersonEditorModal";
import { seedFamilyTree } from "@/data/seedFamilyTree";

const anna = seedFamilyTree.people.find(
  (person) => person.name === "Anna",
) as (typeof seedFamilyTree.people)[number];

function renderEditor(onClose = vi.fn()) {
  const onSave = vi.fn();

  render(
    <PersonEditorModal
      mode="edit"
      onClose={onClose}
      onSave={onSave}
      people={seedFamilyTree.people}
      person={anna}
    />,
  );

  return { onClose, onSave };
}

describe("PersonEditorModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps Save in the sticky header and removes the duplicate bottom actions", () => {
    renderEditor();

    const dialog = screen.getByRole("dialog", { name: /Modifica Anna Conti/i });
    const save = within(dialog).getByRole("button", { name: "Salva modifiche" });

    expect(save).toHaveAttribute("form");
    expect(save.closest(".sticky")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Annulla" })).not.toBeInTheDocument();
  });

  it("warns before discarding a dirty draft from the header close action", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm");
    renderEditor(onClose);

    await user.clear(screen.getByLabelText("Professione"));
    await user.type(screen.getByLabelText("Professione"), "Restauratrice");

    confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(confirm).toHaveBeenCalledWith(
      "Hai modifiche non salvate. Vuoi chiudere e perdere i dati inseriti?",
    );
    expect(onClose).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("routes Escape and backdrop dismissal through the same dirty-state guard", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderEditor(onClose);

    await user.type(screen.getByLabelText("Nome noto"), "Annetta");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    const overlay = screen.getByRole("dialog").parentElement;
    expect(overlay).not.toBeNull();
    fireEvent.mouseDown(overlay as HTMLElement);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("submits every editable field, including all relationship selectors", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Anita" } });
    fireEvent.change(screen.getByLabelText("Cognome"), { target: { value: "Bianchi" } });
    fireEvent.change(screen.getByLabelText("Nome noto"), { target: { value: "Nina" } });
    await user.selectOptions(screen.getByLabelText("Sesso"), "nonbinary");
    fireEvent.change(screen.getByLabelText("Data di nascita"), {
      target: { value: "1947-01-02" },
    });
    fireEvent.change(screen.getByLabelText("Luogo di nascita"), {
      target: { value: "Torino" },
    });
    fireEvent.change(screen.getByLabelText("Data di decesso"), {
      target: { value: "2025-03-04" },
    });
    fireEvent.change(screen.getByLabelText("Luogo di decesso"), {
      target: { value: "Genova" },
    });
    fireEvent.change(screen.getByLabelText("Professione"), {
      target: { value: "Archivista" },
    });
    fireEvent.change(screen.getByLabelText("Istruzione"), {
      target: { value: "Laurea in storia" },
    });
    fireEvent.change(screen.getByLabelText("Foto o URL immagine"), {
      target: { value: "https://example.com/anna.jpg" },
    });
    fireEvent.change(screen.getByLabelText("Tags separati da virgola"), {
      target: { value: "memoria, fotografie" },
    });
    fireEvent.change(screen.getByLabelText("Allegati separati da virgola"), {
      target: { value: "album.pdf, intervista.mp3" },
    });
    fireEvent.change(screen.getByLabelText("Segni distintivi"), {
      target: { value: "Occhiali rossi" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Biografia verificata." },
    });

    await user.click(screen.getByRole("button", { name: "Genitori" }));
    await user.click(screen.getByRole("checkbox", { name: /Marco Rinaldi/i }));
    await user.click(screen.getByRole("button", { name: "Genitori" }));
    await user.click(screen.getByRole("button", { name: "Partner" }));
    await user.click(screen.getByRole("checkbox", { name: /Lucia Rinaldi/i }));
    await user.click(screen.getByRole("button", { name: "Partner" }));
    await user.click(screen.getByRole("button", { name: "Figli" }));
    await user.click(screen.getByRole("checkbox", { name: /Sofia Rinaldi/i }));
    await user.click(screen.getByRole("button", { name: "Figli" }));

    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: "Anita",
      surname: "Bianchi",
      knownAs: "Nina",
      sex: "nonbinary",
      birthDate: "1947-01-02",
      birthPlace: "Torino",
      deathDate: "2025-03-04",
      deathPlace: "Genova",
      profession: "Archivista",
      instruction: "Laurea in storia",
      photo: "https://example.com/anna.jpg",
      tags: ["memoria", "fotografie"],
      attachments: ["album.pdf", "intervista.mp3"],
      distinguishingMarks: "Occhiali rossi",
      notes: "Biografia verificata.",
      parentIds: expect.arrayContaining(["p3"]),
      partnerIds: expect.arrayContaining(["p1", "p4"]),
      childIds: expect.arrayContaining(["p3", "p4", "p7"]),
    });
  });
});
