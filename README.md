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

L’app considera un avvio **senza dati** soltanto quando nel browser non esiste
la chiave `family-tree.snapshot.v1`. In quel caso mostra la configurazione
iniziale e salva un archivio vuoto con il nome della famiglia inserito.

Un archivio già salvato con `people: []` è invece un archivio valido e
inizializzato: al ricaricamento non viene mostrata di nuovo la configurazione.
Gli snapshot v1 esistenti continuano a essere letti con la stessa chiave e lo
stesso schema, perché `familyName` era già parte dei metadati. Un payload non
decodificabile mantiene il comportamento di recupero precedente caricando i
dati demo Rinaldi.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
