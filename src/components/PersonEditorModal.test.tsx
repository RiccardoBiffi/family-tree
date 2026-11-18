import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PersonEditorModal,
  type PersonMediaView,
  type PersonPhotoView,
} from "@/components/PersonEditorModal";
import { seedFamilyTree } from "@/data/seedFamilyTree";
import { createEmptyPersonDraft } from "@/utils/familyTree";

const anna = seedFamilyTree.people.find(
  (person) => person.name === "Anna",
) as (typeof seedFamilyTree.people)[number];

const expectedPhotoAccept = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
].join(",");

const expectedMediaAccept = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "application/pdf",
].join(",");

function renderEditor(
  onClose = vi.fn(),
  options: {
    existingMedia?: readonly PersonMediaView[];
    existingPhoto?: PersonPhotoView | null;
    mode?: "create" | "edit";
    person?: typeof anna;
  } = {},
) {
  const onSave = vi.fn();
  const mode = options.mode ?? "edit";

  const view = render(
    <PersonEditorModal
      existingMedia={options.existingMedia}
      existingPhoto={options.existingPhoto}
      mode={mode}
      onClose={onClose}
      onSave={onSave}
      people={seedFamilyTree.people}
      person={options.person ?? (mode === "create" ? createEmptyPersonDraft() : anna)}
    />,
  );

  return { ...view, onClose, onSave };
}

describe("PersonEditorModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps save in the sticky header without any modal close control or helper copy", () => {
    renderEditor();

    const dialog = screen.getByRole("dialog", { name: /Modifica Anna Conti/i });
    const save = within(dialog).getByRole("button", { name: "Salva modifiche" });

    expect(save).toHaveAttribute("form");
    expect(save.closest(".sticky")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /chiudi|close/i }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Annulla" })).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(
        "Usa la stessa struttura della scheda persona e salva quando i dati sono coerenti.",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(
        "Le relazioni si selezionano da dropdown con ricerca integrata, per evitare liste lunghe e poco leggibili.",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows the exact multimedia section in edit and create without legacy wording", () => {
    const editView = renderEditor();

    expect(screen.queryByText(/Allegati legacy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^File locali$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carica foto locale/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aggiungi file multimediali/i)).not.toBeInTheDocument();
    expect(
      screen.getByText("Contenuti multimediali", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Aggiungi contenuti multimediali")).toHaveAttribute(
      "accept",
      expectedMediaAccept,
    );

    editView.unmount();
    renderEditor(vi.fn(), { mode: "create" });

    expect(
      screen.getByText("Contenuti multimediali", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Aggiungi contenuti multimediali")).toHaveAttribute(
      "multiple",
    );
    expect(screen.queryByText(/Allegati legacy|File locali/i)).not.toBeInTheDocument();
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

    confirm.mockReturnValueOnce(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(confirm).toHaveBeenLastCalledWith(
      "Hai modifiche non salvate. Vuoi chiudere e perdere i dati inseriti?",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("limits biological parents and independently edits the pair shown in the diagram", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(vi.fn(), {
      person: { ...anna, parentIds: ["p1", "p3", "p4"], biologicalParentIds: ["p1", "p3"] },
    });
    const biological = screen.getByRole("button", { name: "Genitori biologici" });
    await user.click(biological);
    expect(screen.getByRole("checkbox", { name: /Lucia Rinaldi/i })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Marco Rinaldi/i }));
    await user.click(screen.getByRole("checkbox", { name: /Lucia Rinaldi/i }));
    await user.click(biological);
    const adoptive = screen.getByRole("button", { name: "Genitori adottivi" });
    await user.click(adoptive);
    await user.click(screen.getByRole("checkbox", { name: /Marco Rinaldi/i }));
    await user.click(adoptive);
    const diagram = screen.getByRole("button", { name: "Genitori nel diagramma" });
    await user.click(diagram);
    await user.click(screen.getByRole("checkbox", { name: /Marco Rinaldi/i }));
    await user.click(screen.getByRole("checkbox", { name: /Lucia Rinaldi/i }));
    await user.click(diagram);
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(onSave.mock.calls[0][0]).toMatchObject({
      parentIds: expect.arrayContaining(["p1", "p3", "p4"]),
      biologicalParentIds: ["p1", "p4"],
      diagramParentIds: ["p3", "p4"],
    });
  });

  it("submits every editable field and keeps commas usable in tags", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    const tagsInput = screen.getByLabelText("Etichette separate da virgola");

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
    await user.clear(tagsInput);
    await user.type(tagsInput, "memoria, fotografie");
    fireEvent.change(screen.getByLabelText("Segni distintivi"), {
      target: { value: "Occhiali rossi" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Biografia verificata." },
    });

    expect(tagsInput).toHaveValue("memoria, fotografie");

    await user.click(screen.getByRole("button", { name: "Genitori biologici" }));
    await user.click(screen.getByRole("checkbox", { name: /Marco Rinaldi/i }));
    await user.click(screen.getByRole("button", { name: "Genitori biologici" }));
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
      tags: ["memoria", "fotografie"],
      distinguishingMarks: "Occhiali rossi",
      notes: "Biografia verificata.",
      parentIds: expect.arrayContaining(["p3"]),
      partnerIds: expect.arrayContaining(["p1", "p4"]),
      childIds: expect.arrayContaining(["p3", "p4", "p7"]),
    });
    expect(onSave.mock.calls[0][1]).toEqual({
      mediaFiles: [],
      photoFile: null,
      removePhoto: false,
      removedMediaIds: [],
    });
  });

  it("keeps raw year edits, prevents invalid saves, and submits both year-only dates", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose, onSave } = renderEditor(vi.fn(), { mode: "create" });
    const birthDate = screen.getByLabelText("Data di nascita");
    const deathDate = screen.getByLabelText("Data di decesso");
    expect(birthDate).toHaveAttribute("type", "date");
    expect(deathDate).toHaveAttribute("type", "date");

    await user.click(screen.getByRole("checkbox", { name: "Solo anno di nascita" }));
    await user.type(birthDate, "187");
    expect(birthDate).toHaveValue("187");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Nome"), "Giulia");
    const save = screen.getByRole("button", { name: "Crea persona" });
    await user.click(save);
    expect(birthDate).toHaveFocus();
    expect(birthDate).toBeInvalid();
    expect(birthDate).toHaveAccessibleDescription(/anno di quattro cifre/);
    expect(onSave).not.toHaveBeenCalled();

    await user.type(birthDate, "2");
    await user.click(screen.getByRole("checkbox", { name: "Solo anno di decesso" }));
    await user.type(deathDate, "0000");
    await user.click(save);
    expect(deathDate).toBeInvalid();
    expect(onSave).not.toHaveBeenCalled();

    await user.clear(deathDate);
    await user.type(deathDate, "1956");
    await user.click(save);
    expect(onSave.mock.calls[0][0]).toMatchObject({ birthDate: "1872", deathDate: "1956" });
  });

  it("retains the draft dates when switching precision and requires an explicit full date", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(vi.fn(), {
      person: { ...anna, birthDate: "1947", deathDate: "2025-03-04" },
    });
    const birthDate = screen.getByLabelText("Data di nascita");
    const deathDate = screen.getByLabelText("Data di decesso");
    const birthYear = screen.getByRole("checkbox", { name: "Solo anno di nascita" });
    const deathYear = screen.getByRole("checkbox", { name: "Solo anno di decesso" });
    const save = screen.getByRole("button", { name: "Salva modifiche" });
    expect(birthYear).toBeChecked();
    expect(birthDate).toHaveValue("1947");

    await user.click(deathYear);
    expect(deathDate).toHaveValue("2025");
    await user.click(deathYear);
    expect(deathDate).toHaveValue("2025-03-04");

    await user.click(birthYear);
    expect(birthDate).toHaveValue("");
    await user.click(save);
    expect(birthDate).toHaveAccessibleDescription(/data completa/);
    expect(onSave).not.toHaveBeenCalled();

    await user.click(birthYear);
    expect(birthDate).toHaveValue("1947");
    await user.click(birthYear);
    fireEvent.change(birthDate, { target: { value: "1947-04-05" } });
    await user.click(save);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      birthDate: "1947-04-05",
      deathDate: "2025-03-04",
    });
  });

  it("retains a stored year on unrelated edits and lets the user clear it", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(vi.fn(), { person: { ...anna, deathDate: "2025" } });
    const deathDate = screen.getByLabelText("Data di decesso");
    const save = screen.getByRole("button", { name: "Salva modifiche" });
    await user.type(screen.getByLabelText("Nome noto"), "Nina");
    await user.click(save);
    expect(onSave.mock.calls[0][0]).toMatchObject({ deathDate: "2025", knownAs: "Nina" });

    await user.clear(deathDate);
    await user.click(save);
    expect(onSave.mock.calls[1][0].deathDate).toBeNull();
  });

  it("adds and replaces a photo from the portrait control", async () => {
    const user = userEvent.setup();
    const existingPhoto: PersonPhotoView = {
      fileName: "anna-esistente.jpg",
      id: "photo-1",
      url: "blob:anna-esistente",
    };
    const { onSave } = renderEditor(vi.fn(), { existingPhoto });
    const photoInput = screen.getByLabelText("Seleziona foto");
    const replacement = new File(["photo"], "ritratto-nuovo.png", {
      type: "image/png",
    });
    const unsafeSvg = new File(["<svg />"], "unsafe.svg", {
      type: "image/svg+xml",
    });

    expect(photoInput).toHaveAttribute("accept", expectedPhotoAccept);
    expect(screen.getByRole("button", { name: "Sostituisci foto" })).toBeInTheDocument();

    await user.upload(photoInput, unsafeSvg);
    expect((photoInput as HTMLInputElement).files).toHaveLength(0);

    await user.upload(photoInput, replacement);

    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    expect(onSave.mock.calls[0][1]).toEqual({
      mediaFiles: [],
      photoFile: replacement,
      removePhoto: false,
      removedMediaIds: [],
    });
  });

  it("activates photo selection from a native button and supports removal with undo", async () => {
    const user = userEvent.setup();
    const existingPhoto: PersonPhotoView = {
      fileName: "anna-esistente.jpg",
      id: "photo-1",
      url: "blob:anna-esistente",
    };
    const { onSave } = renderEditor(vi.fn(), { existingPhoto });
    const inputClick = vi.spyOn(
      screen.getByLabelText("Seleziona foto"),
      "click",
    );
    const replace = screen.getByRole("button", { name: "Sostituisci foto" });

    await user.click(replace);
    expect(inputClick).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Rimuovi foto" }));
    expect(screen.getByRole("button", { name: "Aggiungi foto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ripristina foto" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ripristina foto" }));
    expect(screen.getByRole("button", { name: "Sostituisci foto" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rimuovi foto" }));
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    expect(onSave.mock.calls[0][1]).toEqual({
      mediaFiles: [],
      photoFile: null,
      removePhoto: true,
      removedMediaIds: [],
    });
  });

  it("stages allowed multimedia, removes new files, and removes or restores existing media", async () => {
    const user = userEvent.setup();
    const existingMedia: PersonMediaView[] = [
      {
        fileName: "foto-storica.jpg",
        id: "media-image",
        kind: "image",
        url: "blob:foto-storica",
      },
      {
        fileName: "intervista.wav",
        id: "media-audio",
        kind: "audio",
        url: "blob:intervista",
      },
      {
        fileName: "filmato.mp4",
        id: "media-video",
        kind: "video",
        url: "blob:filmato",
      },
      {
        fileName: "documento.pdf",
        id: "media-pdf",
        kind: "pdf",
        url: "blob:documento",
      },
    ];
    const { onSave } = renderEditor(vi.fn(), { existingMedia });
    const mediaInput = screen.getByLabelText("Aggiungi contenuti multimediali");
    const image = new File(["image"], "nuova-foto.png", { type: "image/png" });
    const audio = new File(["audio"], "nuovo-audio.wav", { type: "audio/wav" });
    const video = new File(["video"], "nuovo-video.mp4", { type: "video/mp4" });
    const pdf = new File(["pdf"], "nuovo-documento.pdf", {
      type: "application/pdf",
    });
    const unsafeSvg = new File(["<svg />"], "unsafe.svg", {
      type: "image/svg+xml",
    });

    expect(mediaInput).toHaveAttribute("accept", expectedMediaAccept);
    expect(mediaInput).toHaveAttribute("multiple");
    expect(screen.getByRole("list", { name: "Contenuti multimediali esistenti" }))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rimuovi intervista.wav" }));
    expect(
      screen.getByRole("button", { name: "Ripristina intervista.wav" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ripristina intervista.wav" }));
    expect(screen.getByRole("button", { name: "Rimuovi intervista.wav" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rimuovi documento.pdf" }));
    await user.upload(mediaInput, [image, audio, video, pdf, unsafeSvg]);

    const stagedMedia = screen.getByRole("list", { name: "Nuovi contenuti multimediali" });
    expect(within(stagedMedia).getByText("nuova-foto.png")).toBeInTheDocument();
    expect(within(stagedMedia).getByText("nuovo-audio.wav")).toBeInTheDocument();
    expect(within(stagedMedia).getByText("nuovo-video.mp4")).toBeInTheDocument();
    expect(within(stagedMedia).getByText("nuovo-documento.pdf")).toBeInTheDocument();
    expect(within(stagedMedia).queryByText("unsafe.svg")).not.toBeInTheDocument();

    await user.click(
      within(stagedMedia).getByRole("button", {
        name: "Rimuovi nuovo contenuto nuovo-video.mp4",
      }),
    );
    expect(within(stagedMedia).queryByText("nuovo-video.mp4")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(onSave.mock.calls[0][1]).toEqual({
      mediaFiles: [image, audio, pdf],
      photoFile: null,
      removePhoto: false,
      removedMediaIds: ["media-pdf"],
    });
  });

  it("creates a person with local multimedia without requiring a photo", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor(vi.fn(), { mode: "create" });
    const audio = new File(["audio"], "ricordo.wav", { type: "audio/wav" });

    await user.type(screen.getByLabelText("Nome"), "Carla");
    await user.upload(screen.getByLabelText("Aggiungi contenuti multimediali"), audio);
    await user.click(screen.getByRole("button", { name: "Crea persona" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: "Carla",
      photo: null,
    });
    expect(onSave.mock.calls[0][1]).toEqual({
      mediaFiles: [audio],
      photoFile: null,
      removePhoto: false,
      removedMediaIds: [],
    });
  });
});
