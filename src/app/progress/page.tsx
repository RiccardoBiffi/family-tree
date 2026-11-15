import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Stato delle verifiche | Archivio di famiglia",
  robots: {
    follow: false,
    index: false,
  },
};

const rounds = [
  {
    name: "Versione iniziale",
    status: "Completata",
    finding: "La visualizzazione inizia sotto sezioni ripetute sull’archivio e sull’accesso.",
  },
  {
    name: "Riferimenti approvati",
    status: "Completata",
    finding: "Cinque proposte approvate per computer e dispositivi mobili definiscono la gerarchia visiva e le interazioni.",
  },
  {
    name: "Sviluppo · fase 1",
    status: "Revisionata",
    finding: "La nuova versione ha prevalso nel test A/B in cieco. La revisione ha rilevato un diagramma troppo piccolo e una cronologia troppo densa.",
  },
  {
    name: "Correzioni · fase 2",
    status: "Completata",
    finding: "Sono stati introdotti il diagramma adattabile, margini precisi per l’inquadratura, una cronologia più compatta, i nomi anagrafici e i comandi per dispositivi mobili.",
  },
  {
    name: "Verifica · fase 3",
    status: "Superata",
    finding: "Superati i percorsi nel browser su computer e dispositivi mobili e i controlli su aree interattive da 44 px, focus, axe, lint, test, tipi e compilazione.",
  },
  {
    name: "Revisione nel browser · fase 4",
    status: "Revisionata",
    finding: "Sono stati verificati separatamente nove problemi annotati nell’interfaccia, il salvataggio delle relazioni e la configurazione al primo avvio.",
  },
  {
    name: "Correzioni · fase 5",
    status: "Superata",
    finding: "Verificati nel browser salvataggio e ricaricamento, riordino di tutte le colonne, intestazione fissa dell’editor, avviso per modifiche non salvate, configurazione iniziale e contorno di selezione di 2 px.",
  },
  {
    name: "Contenuti multimediali locali · fase 6",
    status: "Revisionata",
    finding: "Una prima versione includeva contenuti multimediali dimostrativi, salvataggio in IndexedDB e il menu dell’archivio. Una revisione successiva ha stabilito che i file multimediali devono provenire solo dall’utente.",
  },
  {
    name: "Portabilità · fase 7",
    status: "Superata",
    finding: "Il file .albero scaricato coincideva byte per byte con il Blob. Dopo aver cancellato i dati locali, l’importazione e il ricaricamento hanno ripristinato 21 file con gli stessi hash SHA-256.",
  },
  {
    name: "Revisione delle finestre di dialogo · fase 8",
    status: "Superata",
    finding: "Verificati la chiusura tramite icona, i comandi del ritratto, la pulizia dei dati d’archivio, l’avviso per modifiche non salvate e le dimensioni esatte della finestra del browser su computer e dispositivi mobili.",
  },
  {
    name: "Correzioni delle finestre e dei contenuti multimediali · fase 9",
    status: "Superata",
    finding: "Sono stati rimossi tutti i pulsanti di chiusura. Verificati nel browser l’aggiunta e la rimozione di file locali, l’avviso per modifiche non salvate premendo Esc o facendo clic sullo sfondo e l’eliminazione di una persona dopo conferma.",
  },
  {
    name: "Rilascio senza contenuti multimediali inclusi · fase 10",
    status: "Superata",
    finding: "Il file autonomo non contiene file o dati multimediali. I file caricati dagli utenti restano in IndexedDB e negli archivi portatili .albero.",
  },
];

const goldReferences = [
  {
    alt: "Riferimento approvato del Diagramma su computer",
    height: 963,
    label: "Diagramma · computer",
    src: "/qa/gold-diagram-desktop.png",
    width: 1633,
  },
  {
    alt: "Riferimento approvato della Tabella su computer",
    height: 963,
    label: "Tabella · computer",
    src: "/qa/gold-table-desktop.png",
    width: 1633,
  },
  {
    alt: "Riferimento approvato della Cronologia su computer",
    height: 963,
    label: "Cronologia · computer",
    src: "/qa/gold-timeline-desktop.png",
    width: 1633,
  },
  {
    alt: "Riferimento approvato del Diagramma su dispositivo mobile",
    height: 1846,
    label: "Diagramma · dispositivo mobile",
    src: "/qa/gold-diagram-mobile.png",
    width: 852,
  },
  {
    alt: "Riferimento approvato della Cronologia su dispositivo mobile",
    height: 1846,
    label: "Cronologia · dispositivo mobile",
    src: "/qa/gold-timeline-mobile.png",
    width: 852,
  },
];

export default function ProgressPage() {
  return (
    <main className="min-h-screen bg-[#f4f7f3] px-4 py-8 text-[#152219] sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#cbd5cb] pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#65746a]">
              Avanzamento delle verifiche
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[#17351f] sm:text-5xl">
              Riprogettazione dell’archivio di famiglia
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#526158]">
            Confronto tra la versione iniziale, i riferimenti approvati e le schermate della versione
            realizzata, con i problemi rilevati e la cronologia delle verifiche. La pagina è
            accessibile dal suo indirizzo diretto.
          </p>
        </header>

        <section aria-labelledby="status-heading" className="py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold" id="status-heading">
              Stato attuale
            </h2>
            <span className="rounded-full bg-[#fff0d8] px-3 py-1.5 text-xs font-semibold text-[#8b5b12]">
              Nuova versione preferita · finestre e contenuti multimediali verificati
            </span>
          </div>
          <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-[#cbd5cb] bg-[#cbd5cb] md:grid-cols-2 xl:grid-cols-4">
            {rounds.map((round) => (
              <article className="bg-white p-5" key={round.name}>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold">{round.name}</h3>
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#65746a]">
                    {round.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#526158]">{round.finding}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="comparison-heading">
          <h2 className="text-lg font-semibold" id="comparison-heading">
            Versione iniziale → riferimento approvato → ultima versione
          </h2>
          <div className="mt-4 grid gap-5 xl:grid-cols-3">
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <div className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Versione iniziale · 1440×900
              </div>
              <Image
                alt="Versione iniziale dell’archivio di famiglia su computer"
                className="h-auto w-full"
                height={900}
                priority
                src="/qa/baseline-desktop.png"
                width={1440}
              />
            </figure>

            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <div className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Riferimento approvato · Diagramma
              </div>
              <Image
                alt="Riferimento approvato del Diagramma su computer"
                className="h-auto w-full"
                height={963}
                priority
                src="/qa/gold-diagram-desktop.png"
                width={1633}
              />
            </figure>

            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <div className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Ultima versione · 1440×900
              </div>
              <Image
                alt="Ultima schermata del Diagramma verificata nel browser"
                className="h-auto w-full"
                height={900}
                priority
                src="/qa/latest-diagram-desktop.png"
                width={1440}
              />
            </figure>
          </div>
        </section>

        <section aria-labelledby="score-heading" className="py-8">
          <h2 className="text-lg font-semibold" id="score-heading">
            Risultati del test A/B in cieco
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#dfe5df] px-5 py-4 text-sm">
              <span>Gerarchia visiva e utilità della schermata iniziale</span>
              <strong className="text-[#0c3b24]">Nuova versione · 3/3</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#dfe5df] px-5 py-4 text-sm">
              <span>Facilità di trovare le tre viste</span>
              <strong className="text-[#0c3b24]">Nuova versione · 3/3</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#dfe5df] px-5 py-4 text-sm">
              <span>Comprensione del Diagramma</span>
              <strong className="text-[#0c3b24]">Versione corretta</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#dfe5df] px-5 py-4 text-sm">
              <span>Navigazione nella Cronologia</span>
              <strong className="text-[#0c3b24]">Versione corretta</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 text-sm">
              <span>Finitura visiva e adattamento alle dimensioni dello schermo</span>
              <strong className="text-[#0c3b24]">Nuova versione</strong>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#526158]">
            Le correzioni principali riguardano l’inquadratura del Diagramma, la densità della
            Cronologia, la rimozione delle relazioni anche dopo il ricaricamento, il riordino
            delle colonne, l’avviso per modifiche non salvate, la coerenza dei riferimenti nel file
            .albero e la disposizione della barra degli strumenti. Sono stati corretti anche la
            modifica delle foto dal ritratto, la pulizia dei dati dell’archivio, il ripristino in
            caso di file non valido, la chiusura delle finestre con Esc o dallo sfondo, la modifica
            dei file multimediali locali e l’eliminazione di una persona dopo conferma.
            I riferimenti approvati per dispositivi mobili usano un’area più alta. Nella versione
            realizzata, la pagina rientra nei 390×844 pixel e permette di spostarsi e scorrere
            all’interno della visualizzazione.
          </p>
        </section>

        <section aria-labelledby="latest-heading" className="pb-8">
          <h2 className="text-lg font-semibold" id="latest-heading">
            Ultime schermate alle dimensioni di verifica
          </h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Tabella · 1440×900
              </figcaption>
              <Image
                alt="Ultima schermata della Tabella verificata nel browser su computer"
                className="h-auto w-full"
                height={900}
                src="/qa/latest-table-desktop.png"
                width={1440}
              />
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Cronologia · 1440×900
              </figcaption>
              <Image
                alt="Ultima schermata della Cronologia verificata nel browser su computer"
                className="h-auto w-full"
                height={900}
                src="/qa/latest-timeline-desktop.png"
                width={1440}
              />
            </figure>
            <div className="grid grid-cols-2 gap-4">
              <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
                <figcaption className="border-b border-[#dfe5df] px-3 py-3 text-xs font-semibold">
                  Diagramma · 390×844
                </figcaption>
                <Image
                  alt="Ultima schermata del Diagramma verificata nel browser su dispositivo mobile"
                  className="h-auto w-full"
                  height={844}
                  src="/qa/latest-diagram-mobile.png"
                  width={390}
                />
              </figure>
              <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
                <figcaption className="border-b border-[#dfe5df] px-3 py-3 text-xs font-semibold">
                  Cronologia · 390×844
                </figcaption>
                <Image
                  alt="Ultima schermata della Cronologia verificata nel browser su dispositivo mobile"
                  className="h-auto w-full"
                  height={844}
                  src="/qa/latest-timeline-mobile.png"
                  width={390}
                />
              </figure>
            </div>
          </div>
        </section>

        <section aria-labelledby="media-evidence-heading" className="pb-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" id="media-evidence-heading">
                Contenuti multimediali locali e archivio portatile
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526158]">
                Nel browser sono stati verificati la selezione del ritratto e la riproduzione audio.
                Dopo l’esportazione in un singolo file e la cancellazione dei dati locali,
                l’importazione e il ricaricamento hanno ripristinato i file byte per byte.
              </p>
            </div>
            <span className="rounded-full bg-[#e5f4e8] px-3 py-1.5 text-xs font-semibold text-[#0c3b24]">
              Contenuti dell’utente · IndexedDB · 0 file inclusi
            </span>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Scheda della persona · ritratto e audio locali
              </figcaption>
              <Image
                alt="Scheda finale su computer con un ritratto locale e due lettori audio"
                className="h-auto w-full"
                height={900}
                src="/qa/latest-media-desktop.png"
                width={1440}
              />
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Menu dell’archivio · 390×844
              </figcaption>
              <Image
                alt="Menu finale per importare ed esportare l’archivio su dispositivo mobile"
                className="h-auto w-full"
                height={844}
                src="/qa/latest-archive-mobile.png"
                width={390}
              />
            </figure>
          </div>
        </section>

        <section aria-labelledby="modal-evidence-heading" className="pb-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" id="modal-evidence-heading">
                Chiusura delle finestre e contenuti multimediali
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526158]">
                Le finestre di dialogo si chiudono solo premendo Esc o facendo clic sullo sfondo.
                La foto si gestisce dal ritratto. Il pannello ripristinato per i contenuti
                multimediali locali permette di aggiungere e rimuovere file o annullare la rimozione,
                sia durante la creazione sia durante la modifica, senza usare i vecchi campi per
                gli allegati.
              </p>
            </div>
            <span className="rounded-full bg-[#e5f4e8] px-3 py-1.5 text-xs font-semibold text-[#0c3b24]">
              48 test · 0 problemi gravi rilevati da axe · 0 fuoriuscite dall’area visibile
            </span>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Editor della scheda · 1304×1035
              </figcaption>
              <Image
                alt="Editor verificato su computer, senza pulsante di chiusura e con modifica dei file multimediali locali"
                className="h-auto w-full"
                height={1035}
                src="/qa/latest-modal-desktop.png"
                width={1304}
              />
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Editor della scheda · 390×844
              </figcaption>
              <Image
                alt="Editor verificato su dispositivo mobile, con file multimediali locali in attesa di salvataggio e senza pulsante di chiusura"
                className="h-auto w-full"
                height={844}
                src="/qa/latest-modal-mobile.png"
                width={390}
              />
            </figure>
          </div>
        </section>

        <details className="rounded-2xl border border-[#cbd5cb] bg-white">
          <summary className="cursor-pointer px-5 py-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#0c3b24]">
            Tutti i riferimenti approvati
          </summary>
          <div className="grid gap-5 border-t border-[#dfe5df] p-5 lg:grid-cols-2">
            {goldReferences.map((reference) => (
              <figure className="overflow-hidden rounded-xl border border-[#dfe5df]" key={reference.src}>
                <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-medium">
                  {reference.label}
                </figcaption>
                <Image
                  alt={reference.alt}
                  className="h-auto w-full"
                  height={reference.height}
                  src={reference.src}
                  width={reference.width}
                />
              </figure>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}
