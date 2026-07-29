import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonEditorModal, type PersonMediaView } from "@/components/PersonEditorModal";
import { seedFamilyTree } from "@/data/seedFamilyTree";

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
  expectedPhotoAccept,
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
  mediaProps: {
    existingMedia?: readonly PersonMediaView[];
    existingPhoto?: PersonMediaView | null;
  } = {},
) {
  const onSave = vi.fn();

  render(
    <PersonEditorModal
      {...mediaProps}
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

  it("renders a legacy photo URL without exposing an editable URL field", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const legacyUrl = "https://legacy.example/anna.jpg";

    render(
      <PersonEditorModal
        mode="edit"
        onClose={vi.fn()}
        onSave={onSave}
        people={seedFamilyTree.people}
        person={{ ...anna, photo: legacyUrl }}
      />,
    );

    expect(screen.getByRole("img", { name: /Modifica Anna Conti/i })).toHaveAttribute(
      "src",
      legacyUrl,
    );
    expect(screen.queryByLabelText(/URL immagine/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(legacyUrl)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));
    expect(onSave.mock.calls[0][0].photo).toBe(legacyUrl);
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
    fireEvent.change(screen.getByLabelText("Tags separati da virgola"), {
      target: { value: "memoria, fotografie" },
    });
    fireEvent.change(screen.getByLabelText("Allegati legacy separati da virgola"), {
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
      photo: anna.photo,
      tags: ["memoria", "fotografie"],
      attachments: ["album.pdf", "intervista.mp3"],
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

  it("keeps commas visible while typing and normalizes legacy text only on submit", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    const tagsInput = screen.getByLabelText("Tags separati da virgola");
    const attachmentsInput = screen.getByLabelText("Allegati legacy separati da virgola");

    await user.clear(tagsInput);
    await user.type(tagsInput, "memoria, fotografie");
    await user.clear(attachmentsInput);
    await user.type(attachmentsInput, "album.pdf, intervista.mp3");

    expect(tagsInput).toHaveValue("memoria, fotografie");
    expect(attachmentsInput).toHaveValue("album.pdf, intervista.mp3");

    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(onSave.mock.calls[0][0]).toMatchObject({
      attachments: ["album.pdf", "intervista.mp3"],
      tags: ["memoria", "fotografie"],
    });
  });

  it("stages a replacement photo plus image, audio, video, and PDF files", async () => {
    const user = userEvent.setup();
    const existingPhoto: PersonMediaView = {
      fileName: "anna-esistente.jpg",
      id: "photo-1",
      kind: "image",
      url: "https://example.com/anna-esistente.jpg",
    };
    const { onSave } = renderEditor(vi.fn(), { existingPhoto });
    const replacementPhoto = new File(["photo"], "ritratto-nuovo.png", {
      type: "image/png",
    });
    const image = new File(["image"], "raduno.jpg", { type: "image/jpeg" });
    const audio = new File(["audio"], "intervista.mp3", { type: "audio/mpeg" });
    const video = new File(["video"], "festa.mp4", { type: "video/mp4" });
    const pdf = new File(["pdf"], "lettera.pdf", { type: "application/pdf" });
    const discardedPdf = new File(["draft"], "bozza.pdf", { type: "application/pdf" });
    const unsafeSvg = new File(["<svg />"], "unsafe.svg", { type: "image/svg+xml" });
    const photoInput = screen.getByLabelText("Carica foto locale");
    const mediaInput = screen.getByLabelText("Aggiungi file multimediali");

    expect(photoInput).toHaveAttribute("accept", expectedPhotoAccept);
    expect(mediaInput).toHaveAttribute("accept", expectedMediaAccept);

    await user.upload(photoInput, unsafeSvg);
    await user.upload(mediaInput, unsafeSvg);

    expect((photoInput as HTMLInputElement).files).toHaveLength(0);
    expect((mediaInput as HTMLInputElement).files).toHaveLength(0);
    expect(screen.queryByText("unsafe.svg")).not.toBeInTheDocument();

    await user.upload(photoInput, replacementPhoto);
    await user.upload(mediaInput, [image, audio, video, pdf, discardedPdf]);

    for (const file of [replacementPhoto, image, audio, video, pdf, discardedPdf]) {
      expect(screen.getByText(file.name)).toBeInTheDocument();
    }
    expect(screen.getByText("La foto verrà sostituita al salvataggio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rimuovi nuovo file bozza.pdf" }));
    expect(screen.queryByText("bozza.pdf")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(onSave.mock.calls[0][1]).toEqual({
      mediaFiles: [image, audio, video, pdf],
      photoFile: replacementPhoto,
      removePhoto: false,
      removedMediaIds: [],
    });
  });

  it("lists and stages removal of existing photo and media, with undo", async () => {
    const user = userEvent.setup();
    const existingPhoto: PersonMediaView = {
      fileName: "anna-esistente.jpg",
      id: "photo-1",
      kind: "image",
      url: "https://example.com/anna-esistente.jpg",
    };
    const existingMedia: PersonMediaView[] = [
      { fileName: "foto-gruppo.jpg", id: "image-1", kind: "image", url: "/image" },
      { fileName: "voce.mp3", id: "audio-1", kind: "audio", url: "/audio" },
      { fileName: "cerimonia.mp4", id: "video-1", kind: "video", url: "/video" },
      { fileName: "certificato.pdf", id: "pdf-1", kind: "pdf", url: "/pdf" },
      { fileName: "archivio.bin", id: "file-1", kind: "file", url: "/file" },
    ];
    const { onSave } = renderEditor(vi.fn(), { existingMedia, existingPhoto });
    const existingList = screen.getByRole("list", { name: "File locali esistenti" });

    for (const media of existingMedia) {
      expect(within(existingList).getByRole("link", { name: media.fileName })).toHaveAttribute(
        "href",
        media.url,
      );
    }
    for (const kindLabel of ["Immagine", "Audio", "Video", "PDF", "File"]) {
      expect(within(existingList).getByText(kindLabel)).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Rimuovi foto esistente" }));
    await user.click(screen.getByRole("button", { name: "Rimuovi voce.mp3" }));
    await user.click(screen.getByRole("button", { name: "Rimuovi archivio.bin" }));
    await user.click(
      screen.getByRole("button", { name: "Annulla rimozione di archivio.bin" }),
    );

    expect(screen.getByText("La foto verrà rimossa al salvataggio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    expect(onSave.mock.calls[0][1]).toEqual({
      mediaFiles: [],
      photoFile: null,
      removePhoto: true,
      removedMediaIds: ["audio-1"],
    });
  });

  it("treats local media-only changes as dirty when closing", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderEditor(onClose);

    await user.upload(
      screen.getByLabelText("Aggiungi file multimediali"),
      new File(["notes"], "note.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Chiudi" }));

    expect(confirm).toHaveBeenCalledWith(
      "Hai modifiche non salvate. Vuoi chiudere e perdere i dati inseriti?",
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
