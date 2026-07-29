import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Family Tree QA Progress",
  robots: {
    follow: false,
    index: false,
  },
};

const rounds = [
  {
    name: "Baseline",
    status: "Complete",
    finding: "The visualization starts below repeated archive and access sections.",
  },
  {
    name: "Gold references",
    status: "Complete",
    finding: "Five approved desktop/mobile concepts lock hierarchy and interaction anatomy.",
  },
  {
    name: "Build round 1",
    status: "Critiqued",
    finding: "Candidate won blind A/B; critics found miniaturized diagram framing and excessive timeline density.",
  },
  {
    name: "Repair round 2",
    status: "Complete",
    finding: "Responsive diagram geometry, exact fit padding, denser timeline, legal names, and mobile controls shipped.",
  },
  {
    name: "Verification round 3",
    status: "Passed",
    finding: "Desktop/mobile browser flows, 44px targets, focus behavior, axe, lint, tests, types, and build pass.",
  },
  {
    name: "Browser feedback round 4",
    status: "Critiqued",
    finding: "Nine annotated UI gaps plus relationship persistence and first-run setup were tested independently.",
  },
  {
    name: "Repair round 5",
    status: "Passed",
    finding: "Real-browser save/reload, all-column reordering, sticky editor, dirty-close guard, onboarding, and 2px selection pass.",
  },
];

const goldReferences = [
  {
    alt: "Approved Diagramma desktop reference",
    height: 963,
    label: "Diagramma · desktop",
    src: "/qa/gold-diagram-desktop.png",
    width: 1633,
  },
  {
    alt: "Approved Tabella desktop reference",
    height: 963,
    label: "Tabella · desktop",
    src: "/qa/gold-table-desktop.png",
    width: 1633,
  },
  {
    alt: "Approved Timeline desktop reference",
    height: 963,
    label: "Timeline · desktop",
    src: "/qa/gold-timeline-desktop.png",
    width: 1633,
  },
  {
    alt: "Approved Diagramma mobile reference",
    height: 1846,
    label: "Diagramma · mobile",
    src: "/qa/gold-diagram-mobile.png",
    width: 852,
  },
  {
    alt: "Approved Timeline mobile reference",
    height: 1846,
    label: "Timeline · mobile",
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
              QA-only progress
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[#17351f] sm:text-5xl">
              Family archive redesign
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#526158]">
            Live comparison surface for the baseline, approved references, implementation renders,
            critic gaps, and round history. This route is intentionally absent from product
            navigation.
          </p>
        </header>

        <section aria-labelledby="status-heading" className="py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold" id="status-heading">
              Current status
            </h2>
            <span className="rounded-full bg-[#fff0d8] px-3 py-1.5 text-xs font-semibold text-[#8b5b12]">
              Candidate wins · all fresh critics
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
            Baseline → gold → latest
          </h2>
          <div className="mt-4 grid gap-5 xl:grid-cols-3">
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <div className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Baseline · 1440×900
              </div>
              <Image
                alt="Original family archive desktop baseline"
                className="h-auto w-full"
                height={900}
                priority
                src="/qa/baseline-desktop.png"
                width={1440}
              />
            </figure>

            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <div className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Gold · Diagramma
              </div>
              <Image
                alt="Approved Diagramma desktop reference"
                className="h-auto w-full"
                height={963}
                priority
                src="/qa/gold-diagram-desktop.png"
                width={1633}
              />
            </figure>

            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <div className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Latest · 1440×900
              </div>
              <Image
                alt="Latest browser-tested Diagramma render"
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
            Blind A/B scorecard
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#dfe5df] px-5 py-4 text-sm">
              <span>Hierarchy and first-viewport usefulness</span>
              <strong className="text-[#0c3b24]">Candidate · 3/3</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#dfe5df] px-5 py-4 text-sm">
              <span>Three-view discoverability</span>
              <strong className="text-[#0c3b24]">Candidate · 3/3</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#dfe5df] px-5 py-4 text-sm">
              <span>Diagram comprehension</span>
              <strong className="text-[#0c3b24]">Candidate after repair</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#dfe5df] px-5 py-4 text-sm">
              <span>Timeline navigation</span>
              <strong className="text-[#0c3b24]">Candidate after repair</strong>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 text-sm">
              <span>Visual polish and responsive quality</span>
              <strong className="text-[#0c3b24]">Candidate</strong>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#526158]">
            Largest critic gaps closed: diagram framing, timeline density, relationship removal
            after reload, all-column reordering, and editor close protection. Remaining intentional
            delta: the gold mobile concepts use a taller canvas; the product keeps the 390×844 page
            contained and gives the visualization its own pan/scroll surface.
          </p>
        </section>

        <section aria-labelledby="latest-heading" className="pb-8">
          <h2 className="text-lg font-semibold" id="latest-heading">
            Latest exact-size renders
          </h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-3">
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Tabella · 1440×900
              </figcaption>
              <Image
                alt="Latest browser-tested Tabella desktop render"
                className="h-auto w-full"
                height={900}
                src="/qa/latest-table-desktop.png"
                width={1440}
              />
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
              <figcaption className="border-b border-[#dfe5df] px-4 py-3 text-sm font-semibold">
                Timeline · 1440×900
              </figcaption>
              <Image
                alt="Latest browser-tested Timeline desktop render"
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
                  alt="Latest browser-tested Diagramma mobile render"
                  className="h-auto w-full"
                  height={844}
                  src="/qa/latest-diagram-mobile.png"
                  width={390}
                />
              </figure>
              <figure className="overflow-hidden rounded-2xl border border-[#cbd5cb] bg-white">
                <figcaption className="border-b border-[#dfe5df] px-3 py-3 text-xs font-semibold">
                  Timeline · 390×844
                </figcaption>
                <Image
                  alt="Latest browser-tested Timeline mobile render"
                  className="h-auto w-full"
                  height={844}
                  src="/qa/latest-timeline-mobile.png"
                  width={390}
                />
              </figure>
            </div>
          </div>
        </section>

        <details className="rounded-2xl border border-[#cbd5cb] bg-white">
          <summary className="cursor-pointer px-5 py-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#0c3b24]">
            All approved references
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
