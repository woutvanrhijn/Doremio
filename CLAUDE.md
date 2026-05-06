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
- AI integratie: Anthropic API (nog te integreren)

## Kleurenpalet en stijl
- Primair blauw: #0766C6
- Accent oranje: #FF560D  
- Warm wit: #F3E7DD (hoofdachtergrond van het volledige platform)
- Geel accent: #FFD100
- Sfeer: zoals Duolingo — speels, educatief, vol leven maar dan met muziek
- Animaties via Framer Motion
- Custom illustraties via Procreate/Adobe (nog te maken door Wout)
- Visuele identiteit: uitgesproken en herkenbaar

## Vijf functionele clusters
### 1. De Partituur (kern object)
- Leraar uploadt PDF/afbeelding van partituur
- Leraar voegt globale annotaties toe: tekst, audionotitie, oefenmethode
- Mogelijkheid tot positiegebonden annotaties op specifieke plekken
- Student voegt eigen notities toe
- Referentie-audio koppeling: manueel via URL (YouTube etc.) of IMSLP
- Als geen opname beschikbaar: koppeling aan externe database
### 1. De Partituur — volledig overzicht

**Upload — twee wegen:**
- Weg A: PDF upload door leraar of student
- Weg B: Foto via camera → automatisch verbeterd → omgezet naar PDF

**AI verrijking na upload:**
- Anthropic API herkent titel en componist
- YouTube API zoekt 2-3 tutorials en uitvoeringen
- Spotify link indien beschikbaar
- Leraar keurt links goed, verwijdert of voegt toe

**Annotaties door leraar:**
- Globale tekstinstructie
- Eigen audio/video opname via platform
- Specifieke opmerkingen per sectie (optioneel)
- Leraar krijgt notificatie bij studentupload en kan annotaties toevoegen

**Toewijzing:**
- Leraar wijst toe aan individuele student of klasgroep
- Student uploadt zelf → automatisch eigen profiel
- Leraar ontvangt notificatie bij studentupload

**Benodigde API sleutels:**
- Anthropic API (titel/componist herkenning + link curatie)
- YouTube Data API (referentie-links)
- Spotify API (muzieklinks)

### 2. De Studio (oefensessie)
- Student start sessie vanuit een partituur
- Stap-voor-stap begeleiding via aanwijzingen van leraar
- Opname via microfoon/camera van eigen toestel
- Automatische logging: datum, duur, gekoppelde partituur
- Opname wordt opgeslagen en gekoppeld aan partituur

### 3. Het Venster (observatie en bijsturing)
- Leraar ziet wanneer, hoe lang en wat er geoefend werd
- Laagdrempelige reactie: duim, korte tekstnotitie, audio-reactie
- Ouder ziet vereenvoudigde versie van activiteit kind
- Medestudenten kunnen beperkt betrokken worden
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
profiles (id, role, naam, instrument, academie, avatar_url, created_at)
klassen (id, naam, leraar_id, created_at)
klas_studenten (klas_id, student_id)
partituren (id, titel, componist, bestand_url, referentie_url, leraar_id, klas_id, created_at)
annotaties (id, partituur_id, auteur_id, inhoud, audio_url, type, created_at)
oefensessies (id, student_id, partituur_id, duur, opname_url, notities, created_at)
feedback (id, sessie_id, auteur_id, inhoud, audio_url, type, created_at)
```
Row Level Security is ingeschakeld op alle tabellen.

## Wat al gebouwd is
- ✅ Next.js project aangemaakt en draait op localhost:3000
- ✅ Supabase gekoppeld via lib/supabase.ts
- ✅ .env.local met credentials (nooit naar GitHub)
- ✅ Alle database tabellen aangemaakt in Supabase
- ✅ Landingspagina met rolkeuze (app/page.tsx)
- ✅ Login/registratie pagina (app/auth/login/page.tsx)
- ✅ GitHub repository opgezet

## Wat nog gebouwd moet worden (prioriteit volgorde)
1. Auth callback pagina (app/auth/callback/route.ts)
2. Rol-selectie na registratie (app/onboarding/page.tsx)
3. Dashboard per rol (app/dashboard/page.tsx)
4. Partituur uploaden en bekijken
5. Annotaties toevoegen aan partituur
6. Oefensessie starten en opnemen
7. Leraarsdashboard met overzicht studenten
8. Feedback geven op sessies
9. Voortgang en gamificatie
10. Profiel en community

## GitHub
https://github.com/woutvanrhijn/Doremio

## Hoe een nieuwe chat starten met Claude
1. Open deze chat: https://claude.ai
2. Begin met: "We werken samen aan mijn masterproef Doremio. 
   Lees eerst dit projectdocument:"
3. Plak de volledige inhoud van dit CLAUDE.md bestand
4. Zeg daarna: "De GitHub repo is https://github.com/woutvanrhijn/Doremio. 
   We waren bezig met [beschrijf laatste stap]."
5. Claude heeft dan alle context om naadloos verder te werken.

## Belangrijke afspraken
- We bouwen Weg C: design én functie tegelijk per cluster
- PoC eerst, extra specificaties later
- Geen hardware, enkel digitaal platform
- Academische onderbouwing blijft belangrijk naast het bouwen
- Vibecoding aanpak: Claude schrijft code, Wout stuurt bij
## Ontwikkelstrategie (aangepast)

### Fase 1 — Functioneel (nu bezig)
Bouwen zonder focus op visuele afwerking.
Prioriteit: alles moet werken.
1. Authenticatie en onboarding ✅
2. Partituur uploaden en annoteren
3. Oefensessie starten en opnemen
4. Leraarsdashboard en observatie
5. Voortgang en gamificatie
6. Profiel en community

### Fase 2 — Design (na kernfunctionaliteit)
Per scherm een volwaardige mockup maken in Doremio stijl.
- Wout ontwerpt illustraties en iconen in Procreate/Adobe
- Illustraties worden als SVG/PNG geëxporteerd en ingeladen
- Animaties via Framer Motion
- Volledige visuele stijl per scherm implementeren
- Referentie: here.o app niveau van afwerking

### Fase 3 — Integratie en PoC demo
- Volledige gebruikersflow testen per rol
- Demo scenario voorbereiden
- Documentatie afwerken voor masterproef