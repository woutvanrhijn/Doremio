# Doremio — Projectdocument voor Claude

## Context en achtergrond
Masterproef van Wout van Rhijn, 2MA Productontwikkeling 2025/26, PXL.
Begeleider: Jouke Verlinden.

Het probleem: In het Vlaams DKO (Deeltijds Kunstonderwijs) bedraagt de
doorstroom van graad 2 naar graad 3 slechts 34-35%. Hoofdoorzaken zijn
motivatieverlies, gebrek aan leerstrategieën en een zwakke muzikale
identiteit. De wekelijkse contactmomenten worden onvoldoende overbrugd.

Doremio is GEEN hardware product. Het is uitsluitend een digitaal
leer- en speelplatform.

## Productdefinitie
"Een geïntegreerd digitaal leer- en speelplatform dat binnen DKO-muziek
ondersteuning biedt aan studenten met betrekking tot zelfstandig oefenen,
leerstrategieën en muzikale identiteitsvorming. Anderzijds ondersteunt het
lerarenteams in het overbruggen van contactmomenten en het maximaliseren
van leerwinst."

## Theoretisch raamwerk
- Self-Determination Theory (SDT): competentie, verbondenheid, autonomie
- Flow Theory
- Deliberate Practice
- Motivation Theory
- Intrinsieke motivatie als kern van retentie

## Doelgroep
- Primair: DKO studenten graad 2-3 (tieners)
- Secundair: instrumentleraren DKO
- Tertiair: ouders

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- shadcn/ui met Radix componenten
- Supabase (PostgreSQL database, authenticatie, bestandsopslag, realtime)
- Framer Motion (animaties — nog te installeren)
- Deployment: Vercel (nog te doen)
- AI integratie: Anthropic API (claude-opus-4-6 voor studio feedback, claude-haiku-4-5 voor challenges)
- YouTube Data API v3
- Spotify API (nog te integreren)

## Kleurenpalet en stijl
- Primair blauw: #0766C6
- Accent oranje: #FF560D
- Warm wit: #F3E7DD (hoofdachtergrond van het volledige platform)
- Geel accent: #FFD100
- Sfeer: zoals Duolingo — speels, educatief, vol leven maar dan met muziek
- Animaties via Framer Motion (nog te installeren)
- Custom illustraties via Procreate/Adobe (nog te maken door Wout)
- Visuele identiteit: uitgesproken en herkenbaar
- Responsive: werkt op smartphone, iPad en laptop

## Vijf functionele clusters

### 1. De Partituur (kern object)
- Leraar uploadt PDF of foto van partituur
- AI herkent automatisch titel en componist via Anthropic API
- YouTube zoekt automatisch uitvoeringen (2-12 min) en Shorts (≤60 sec)
- Leraar voegt annotaties toe: tekst, audio-opname, instructies
- Leraar kan eigen audio opnemen of uploaden als referentie
- Student voegt eigen notities toe
- Leraar wijst partituur toe aan student of klas

### 2. De Studio (oefensessie)
- Student start sessie vanuit een partituur
- Briefing met challenges van leraar (game-achtig)
- Toggle menu: student kiest welke elementen zichtbaar zijn
- Opname via microfoon, timer, visuele metronoom
- Tijdstempel annotaties op eigen opname
- Reflectie met 3 vragen + gamification elementen
- AI feedback op basis van reflectie (tops/tips/motivatie)
- Sessie gelogd in Supabase met datum, duur, opname, feedback

### 3. Het Venster (observatie en bijsturing)
- Leraar ziet wanneer, hoe lang en wat er geoefend werd
- Laagdrempelige reactie: duim, korte tekstnotitie, audio-reactie
- Ouder ziet vereenvoudigde versie van activiteit kind
- Geen volwaardig berichtensysteem — transparantielaag

### 4. Het Parcours (voortgang en gamificatie)
- Persoonlijk groeipad van de student
- Zachte gamificatie: visuele progressie, streaks, mijlpalen
- GEEN harde puntenrangen of competitieve leaderboards
- Intrinsiek motiverend — persoonlijk parcours, niet competitief
- Leraar beheert doelen per student

### 5. Het Profiel (identiteit en community)
- Persoonlijke muzikantenpagina
- Muzikale smaak, instrument, favorieten, opgeslagen opnames
- Sociaal aspect binnen academie-bubble
- Medestudenten zien elkaars profiel
- Versterkt transitie van "leerling" naar "muzikant"

## Supabase database tabellen

```sql
-- Originele tabellen
profiles (id, role, naam, instrument, academie, avatar_url, created_at)
klassen (id, naam, leraar_id, created_at)
klas_studenten (klas_id, student_id)
partituren (id, titel, componist, bestand_url, referentie_url, leraar_audio_url, leraar_id, klas_id, created_at)
annotaties (id, partituur_id, auteur_id, inhoud, audio_url, type, created_at)
oefensessies (id, student_id, partituur_id, duur, opname_url, notities, doel, tops, tips, ai_feedback, bpm, status, gevoel, challenges, created_at)
feedback (id, sessie_id, auteur_id, inhoud, audio_url, type, created_at)

-- Nieuwe tabel toegevoegd
opname_annotaties (id, opname_url, auteur_id, partituur_id, tijdstip, inhoud, created_at)
```

Row Level Security is ingeschakeld op alle tabellen.

### Supabase Storage buckets
- `partituren` — PDF bestanden en leraar audio uploads
- `opnames` — student opnames van oefensessies

## Kritieke dataformaten

### oefensessies.challenges
Opgeslagen als `string[]` (plain strings). Studio converteert de API-respons van
`[{"challenge": "..."}]` naar `["..."]` voor opslaan. Bij weergave altijd normaliseren:
```ts
const normalized: string[] = (raw || []).map((c: any) =>
  typeof c === 'string' ? c : (c.challenge ?? '')
).filter(Boolean)
```

### oefensessies.ai_feedback
Opgeslagen als JSON string. `tops` en `tips` zijn PLAIN STRINGS (geen arrays).
`motivatie` is ook een string. Bij weergave normaliseren naar arrays:
```ts
const feedbackTops: string[] = aiFeedback?.tops
  ? Array.isArray(aiFeedback.tops) ? aiFeedback.tops : [aiFeedback.tops]
  : []
```

### oefensessies.gevoel
Mogelijke waarden: `'Super goed!'`, `'Goed bezig'`, `'Oké'`, `'Moeilijk'`

### feedback.type
Interactietypes die studenten op elkaars sessies kunnen plaatsen:
`'leraar_reactie'`, `'student_kudo'`, `'student_boost'`, `'student_reactie'`

## Bestandsstructuur

```
app/
  page.tsx                          — landingspagina met rolkeuze
  layout.tsx
  globals.css
  auth/
    callback/route.ts               — auth callback
    login/page.tsx                  — login + registratie
    registreren/page.tsx
  onboarding/
    rol/page.tsx                    — rolkeuze na registratie
    profiel/page.tsx                — profielinvulling
    welkom/page.tsx                 — welkomstscherm
  dashboard/
    page.tsx                        — dashboard per rol met echte data
  partituren/
    page.tsx                        — overzichtslijst + quickstart widget (student) / upload knop (leraar)
    nieuw/page.tsx                  — upload flow PDF + foto
    [id]/page.tsx                   — detailpagina met PDF viewer + referenties
    [id]/bewerken/page.tsx          — partituur bewerken (leraar)
  studio/
    [id]/page.tsx                   — volledige oefenstudio (5 stappen)
  sessies/
    page.tsx                        — logboek: eigen + groepsactiviteit, filters, interacties
    [id]/page.tsx                   — sessiedetail: opname, annotaties, AI feedback, challenges
  profiel/
    page.tsx                        — profiel met 3 tabs: Ik / Traject / Oefenen
  venster/
    page.tsx                        — classview voor leraar: overzicht / activiteiten / klassen
  parcours/
    page.tsx                        — parcours/voortgang student
  klassen/
    page.tsx                        — klasbeheer
  api/
    herken-partituur/route.ts       — Anthropic API: titel/componist herkenning
    zoek-referenties/route.ts       — YouTube API: uitvoeringen + Shorts
    studio-feedback/route.ts        — Anthropic API: AI reflectie feedback (claude-opus-4-6)
    genereer-challenges/route.ts    — Anthropic API: AI challenges genereren (claude-haiku-4-5)
    oefenprofiel/route.ts           — oefenprofiel API
    seed/route.ts                   — seed route (dev only)
lib/
  supabase.ts                       — Supabase client
components/
  BottomNav.tsx                     — role-aware bottom navigatie (student vs leraar)
```

## Wat al gebouwd is ✅

### Authenticatie & onboarding
- Next.js project op localhost:3000
- Supabase gekoppeld via lib/supabase.ts
- .env.local met API keys (nooit naar GitHub)
- Landingspagina met rolkeuze
- Login/registratie pagina
- Auth callback route
- Volledige onboarding flow student + leraar

### Cluster 1 — De Partituur
- PDF + foto upload naar Supabase storage
- AI-herkenning titel/componist via Anthropic API
  → Werkt correct maar vereist Anthropic credits
  → Bij lege credits: velden manueel invullen
- YouTube uitvoeringen (2-12 min) gefilterd op duur
- YouTube Shorts (≤60 sec) via #shorts query
- Beide categorieën parallel opgehaald en apart weergegeven
- Annotaties opslaan + weergeven (leraar vs student gescheiden)
- Partiturenlijst met uploader + datum + gekleurde bovenrand
- Detailpagina met inline PDF viewer (standaard open)
- Quickstart widget bovenaan partiturenlijst (student): top 3 partituren direct starten
- "Verdergaan" kaart (oranje) toont laatste geoefende partituur apart van quickstart
- Dashboard met echte Supabase data, uploadersnamen, recente partituren

### Cluster 2 — De Studio
- Volledige oefenstudio in 5 stappen:
  - Stap 1 Briefing: partituur info + challenges van leraar (oranje game-achtige badges) + referentie audio
  - Stap 2 Toggles: student kiest zichtbare elementen (timer/opname/challenges altijd aan, rest optioneel)
  - Stap 3 Sessie actief: opname start/stop/pauze, timer, visuele metronoom, PDF toggle, leraar track, tijdstempel annotaties
  - Stap 4 Reflectie: 3 vragen met gamification (genummerde badges, emoji keuze voor gevoel)
  - Stap 5 Analyse: AI feedback tops/tips/motivatie + opname terugluisteren met annotaties
- Metronoom via Web Audio API met visuele beat indicator
- Opname via MediaRecorder API met correcte MIME type detectie
- Auto-stop metronoom + audio bij sessie afronden
- AI feedback via Anthropic API (claude-opus-4-6)
- AI challenges genereren via Anthropic API (claude-haiku-4-5)
- Sessie + annotaties opgeslagen in Supabase

### Cluster 3 — Het Venster
- Classview pagina voor leraar (app/venster/page.tsx)
- Tab: Overzicht — studentengrid met actief/inactief status, sessiebadges, stats (% actief, gem. duur)
- Tab: Activiteiten — feed van alle studentsessies met 👍/🔥 quick reactions + tekstinput per sessie
- Tab: Klassen — klassen aanmaken/beheren, studenten toevoegen/verwijderen
- Leraarreacties worden opgeslagen in feedback tabel (type: leraar_reactie)

### Cluster 4 — Het Parcours / Logboek
- Logboek pagina voor student (app/sessies/page.tsx)
- Eigen sessies + klasgenoot sessies (laatste 30 dagen)
- Twee-laags filter: activiteitstype (eigen/alles) + groepsfilter (per klas, enkel bij "alles")
- Interacties per sessiekaart: kudos, boosts, comments (student_kudo / student_boost / student_reactie)
- Statsstrip: aantal sessies, totale tijd, streak
- Datumgroepering met dagindicatoren
- Sessiedetailpagina (app/sessies/[id]/page.tsx): opname, tijdnotities, challenges, reflectie, AI feedback, leraarreacties

### Cluster 5 — Het Profiel
- Profielpagina met 3 tabs: Ik / Traject / Oefenen
- Tab Ik: grote avatar (kleurverloop cirkel), bio, genres, 3-kolom stats, groepen, laatste badges
- Tab Traject: laatste sessie widget, niveau + volgende mijlpaal gecombineerd, actieve challenges (string[]),
  weekkalender, mijlpalen 2-kolom grid, activiteitsfeed
- Tab Oefenen: partiturenlijst met directe studio-knop per partituur
- Actieve challenges worden opgehaald + genormaliseerd (string[] of legacy {challenge: string}[])

### Navigatie
- BottomNav component (components/BottomNav.tsx)
- Role-aware: student nav vs leraar nav
- Student: Home / Oefenen / Logboek / Profiel
- Leraar: Home / Partituren / Classview / Profiel
- Safe-area inset voor iPhone bottom bar

## Wat nog gebouwd moet worden ❌

### Prioriteit 1 — Leraar audio upload bij partituur
- In partituren/nieuw/page.tsx: optie voor leraar om audio op te nemen via microfoon in platform
- Trim functionaliteit (begin/einde inkorten)
- Tijdstempel annotaties op leraar opname
- Opslaan als leraar_audio_url in partituren tabel

### Prioriteit 2 — Ouder-view in Het Venster
- Vereenvoudigde versie van activiteitsoverzicht voor ouders
- Enkel voortgang kind zichtbaar, geen klasgegevens
- Aparte rol 'ouder' of gefilterde view op basis van rol

### Prioriteit 3 — Toewijzing partituur aan student/klas
- Leraar kan partituur koppelen aan specifieke student of klas
- Student ziet enkel aan hem/haar toegewezen partituren in logboek/dashboard

### Prioriteit 4 — Parcours pagina verder uitwerken
- Streaks op basis van echte oefensessies bijhouden
- Mijlpalen koppelen aan echte data
- Visueel groeipad

### Later / Fase 2
- Framer Motion animaties toevoegen
- Vercel deployment
- Spotify API integratie
- Camerafunctie testen op mobiel
- Custom illustraties van Wout integreren

## Omgeving & API keys (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
YOUTUBE_API_KEY=...
```

## GitHub
https://github.com/woutvanrhijn/Doremio

## Belangrijke afspraken
- Vibecoding aanpak: Claude schrijft code, Wout stuurt bij
- PoC eerst, visuele verfijning in Fase 2
- Geen hardware, enkel digitaal platform
- Academische onderbouwing blijft belangrijk naast het bouwen
- Responsive: smartphone, iPad en laptop
- Altijd volledige bestanden schrijven bij aanpassingen zodat copy-paste foutloos werkt
- Bij twijfel: eerst diagnosticeren, dan pas code schrijven
- Variabelen en code in het Nederlands
- Kleuren altijd via inline style={{}} — geen Tailwind kleurklassen

## Hoe een nieuwe chat starten
1. Ga naar claude.ai → Doremio project
2. Claude leest CLAUDE.md automatisch uit project knowledge
3. Begin met: "We werken samen aan mijn masterproef Doremio. We waren bezig met [beschrijf laatste stap]."
4. Claude heeft dan alle context om naadloos verder te werken.
