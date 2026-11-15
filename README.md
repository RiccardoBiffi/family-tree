This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Rilascio standalone offline

Il target di produzione predefinito è un unico file HTML autosufficiente:

```bash
npm run build
```

L’artefatto viene scritto in
`dist-offline/archivio-famiglia.html`. Può essere aperto direttamente con un
doppio clic, senza server e senza connessione Internet. JavaScript, CSS e i
dati demo testuali sono incorporati nel file; non contiene file multimediali.
Immagini, audio, video e PDF vengono aggiunti esclusivamente dall’utente e
salvati nel database IndexedDB del browser.

- `archivio-famiglia.html` apre l’archivio in modalità visitatore.
- `archivio-famiglia.html?admin` abilita la modalità amministratore.
- Entrambe le modalità possono importare ed esportare l’archivio completo
  tramite un unico file `.albero`.
- Anche `?admin=` è valido; parametri diversi, come `?administrator`, non
  abilitano l’amministrazione.
- La UI non espone controlli per passare tra le due modalità.
- Creazione, modifica ed eliminazione delle persone restano riservate all’admin.

La build verifica che l’output contenga esattamente un file, non superi 8 MiB,
non referenzi script, fogli di stile, media o source map esterni e includa tutti
i dati dell’app senza incorporare contenuti multimediali. Al termine stampa
dimensione e SHA-256:

```bash
npm run verify:offline
```

Questo comando apre entrambe le modalità tramite `file://` in Chromium con il
browser impostato offline, sia a 1440×900 sia a 390×844.
Per usare Google Chrome già installato, impostare
`PLAYWRIGHT_CHROMIUM_CHANNEL=chrome` nell’ambiente della verifica.

La variante Next.js rimane disponibile separatamente:

```bash
npm run build:web
npm run start:web
```

La pipeline completa di rilascio esegue lint, typecheck, test, build Next,
build standalone e verifica browser:

```bash
npm run release
```

## Stato locale e “senza dati”

L’app salva lo snapshot e i media in IndexedDB. All’apertura copia lo snapshot
legacy da `localStorage` se IndexedDB non contiene ancora un archivio, lasciando
disponibile il valore originale di `family-tree.snapshot.v1`. L’assenza di uno
snapshot apre la configurazione iniziale. Uno snapshot con `people: []` conta
come archivio inizializzato. Se lo snapshot legacy è illeggibile, l’app apre i
dati demo Rinaldi.

Se il browser rifiuta la scrittura, l’ultima versione salvata rimane disponibile
al ricaricamento. L’app segnala le modifiche conservate solo in sessione, che
possono essere salvate esportando un file `.albero`.

## Genitori e Diagramma

La scheda distingue genitori biologici, fino a due, e genitori adottivi. Con
uno o due genitori registrati il Diagramma li mostra automaticamente. Con più
genitori, scegli i due da mostrare nella scheda di modifica. Il controllo di
coerenza segnala le schede con una scelta ancora incompleta.

Per gli archivi precedenti alla distinzione, l’app propone come biologici i
primi due genitori nell’ordine salvato. Verifica questa classificazione nelle
schede dove il tipo di legame è rilevante. Il formato `.albero` conserva
entrambe le scelte quando sono state registrate.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Vercel deploys the Next.js application through the repository-owned
`vercel.json`, which runs `npm run build:web` and leaves the output directory at
the Next.js default `.next`. The separate `npm run build` command remains the
standalone offline release target.

Do not configure a custom Output Directory in the Vercel dashboard for this
project; use the framework default so Vercel can read
`.next/routes-manifest.json`.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
