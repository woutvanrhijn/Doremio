import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const studenten = [
  { email: 'zoe.dewolf@doremio.test',          naam: 'Zoë de Wolf',         instrument: 'Piano',      klas: '1A' },
  { email: 'lena.peeters@doremio.test',        naam: 'Lena Peeters',        instrument: 'Piano',      klas: '1A' },
  { email: 'noah.janssen@doremio.test',        naam: 'Noah Janssen',        instrument: 'Viool',      klas: '1A' },
  { email: 'emma.claes@doremio.test',          naam: 'Emma Claes',          instrument: 'Fluit',      klas: '1A' },
  { email: 'lucas.vermeersch@doremio.test',    naam: 'Lucas Vermeersch',    instrument: 'Gitaar',     klas: '1A' },
  { email: 'noor.willems@doremio.test',        naam: 'Noor Willems',        instrument: 'Piano',      klas: '1A' },
  { email: 'finn.desmet@doremio.test',         naam: 'Finn Desmet',         instrument: 'Klarinet',   klas: '1B' },
  { email: 'sarah.maes@doremio.test',          naam: 'Sarah Maes',          instrument: 'Cello',      klas: '1B' },
  { email: 'oliver.declercq@doremio.test',     naam: 'Oliver Declercq',     instrument: 'Viool',      klas: '1B' },
  { email: 'julia.bogaert@doremio.test',       naam: 'Julia Bogaert',       instrument: 'Dwarsfluit', klas: '1B' },
  { email: 'thomas.vandenberghe@doremio.test', naam: 'Thomas Vandenberghe', instrument: 'Gitaar',     klas: '1B' },
]

// Sessies per student: [duur in sec, bpm, tops, tips, dagen geleden, gevoel?, partituurIndex?]
type SessieRij = [number, number, string, string, number, string?, number?]
const sessiesPerStudent: Record<string, SessieRij[]> = {
  'zoe.dewolf@doremio.test': [
    [1080, 76, 'De melodie klinkt veel vloeiender!',      'De overgang naar de brug is nog haperend.',     1,  'Goed bezig',  0],
    [1320, 80, 'Heel de eerste pagina uit het hoofd.',    'Linkerhand snelheid verder opbouwen.',          2,  'Super goed!', 1],
    [900,  74, 'Lekker geoefend na school.',              'Niet te snel gaan aan het einde.',              4,  'Oké',         2],
    [1200, 82, 'De moeilijke passage lukt nu bijna!',     'Pianissimo stukken verdienen meer aandacht.',   6,  'Super goed!', 0],
    [840,  78, 'Korte maar geconcentreerde sessie.',      'Morgen het tweede deel aanpakken.',             9,  'Goed bezig',  1],
    [960,  76, 'Ritme zat er heel goed in vandaag.',      'Nog werken aan het pedaalgebruik.',             12, 'Goed bezig',  2],
    [1080, 80, 'Bijna een uur gespeeld — persoonlijk record!', 'Pauze nemen als handen moe worden.',      16, 'Super goed!', 0],
    [720,  74, 'Korte herhalingssessie na les.',          'Volgende keer langer doorspelen.',              19, 'Oké',         1],
    [1140, 82, 'Alles van begin tot einde gespeeld!',     'Meer aandacht voor de dynamiek.',               23, 'Super goed!', 2],
  ],
  'lena.peeters@doremio.test': [
    [960, 72, 'De toonladder ging veel vlotter vandaag!', 'De overgang naar het tweede deel moet beter.', 1],
    [1200, 76, 'Ik kon het hele stuk van buiten spelen.', 'Mijn linkerhand moet nog sterker worden.', 2],
    [840, 70, 'De herhaling lukte goed.', 'Soms speel ik te snel aan het einde.', 4],
    [1080, 80, 'Super goed geoefend vandaag!', 'De pianissimo passages zijn nog moeilijk.', 6],
    [900, 75, 'Ik hou het tempo nu beter bij.', 'De trillertjes in maat 12 lukken nog niet.', 8],
    [780, 72, 'Korte sessie maar geconcentreerd.', 'Morgen langer oefenen.', 13],
  ],
  'noah.janssen@doremio.test': [
    [720, 66, 'De boogstreek gaat al beter.', 'Mijn houding moet ik in het oog houden.', 1],
    [900, 70, 'Ik kon de hoge noten halen.', 'Het vibrato moet nog geoefend worden.', 4],
    [660, 68, 'Oké sessie.', 'Niet zo geconcentreerd vandaag.', 7],
    [840, 72, 'De toonkwaliteit was goed.', 'Meer aandacht voor de nuances.', 11],
    [780, 66, 'Het stuk begint te zitten.', 'Snelheid opbouwen.', 14],
  ],
  'emma.claes@doremio.test': [
    [1080, 84, 'Mijn adem gaat nu veel beter!', 'De snelle passages in het midden zijn lastig.', 1],
    [900, 80, 'Heldere toon vandaag.', 'Meer rust nemen tussen de noten.', 3],
    [840, 82, 'Leuke sessie!', 'De lage noten klinken nog een beetje dof.', 5],
    [720, 78, 'Halve sessie maar goed geconcentreerd.', 'Morgen de rest afmaken.', 7],
    [1020, 86, 'Alles van begin tot einde gespeeld.', 'Nog werken aan de overgangen.', 9],
    [960, 84, 'Bijna perfect!', 'Volgende keer voor de spiegel oefenen.', 12],
  ],
  'lucas.vermeersch@doremio.test': [
    [600, 60, 'De akkoorden lukken beter.', 'Vingers pijn maar ik ga verder!', 2],
    [720, 64, 'Ik ken de vingerposities nu beter.', 'Soms mis ik een noot in de overgang.', 6],
    [540, 60, 'Korte oefening.', 'Volgende keer langer doorgaan.', 10],
    [660, 62, 'De bastonen klinken mooier.', 'Rechterhand leren ontspannen.', 14],
  ],
  'noor.willems@doremio.test': [
    [480, 68, 'Ik heb de eerste pagina geoefend.', 'Ik vergeet soms welke noot het is.', 3],
    [600, 64, 'Vandaag alles rustig gespeeld.', 'Meer oefenen.', 10],
    [540, 60, 'Oké.', 'Meer motivatie nodig.', 17],
  ],
  'finn.desmet@doremio.test': [
    [1080, 92, 'De hoge noten zijn veel beter!', 'De overgang tussen registers oefenen.', 1],
    [960, 88, 'Goed ritme gehouden.', 'Soms te hard blazen.', 2],
    [1200, 94, 'Langste sessie ooit!', 'Pauze nemen als ik moe ben.', 4],
    [840, 90, 'Mooie toon vandaag.', 'Embouchure verder trainen.', 6],
    [900, 86, 'Heel fijn gespeeld.', 'Meer nuance in de dynamiek.', 8],
    [780, 88, 'Goed geoefend.', 'Morgen verder.', 10],
    [1140, 96, 'Super sessie!', 'Blijven doorgaan.', 16],
  ],
  'sarah.maes@doremio.test': [
    [900, 72, 'De strijkbeweging is vlotter.', 'De duimstand is nog ongemakkelijk.', 1],
    [780, 70, 'Mooie volle klank.', 'De hoge posities nog leren.', 4],
    [1020, 74, 'Heel de sessie goed geconcentreerd.', 'Rechterarm ontspannen.', 7],
    [840, 68, 'Het stuk begint goed te klinken.', 'De laatste maten herhalen.', 11],
    [960, 72, 'Goede vooruitgang!', 'Meer aan intonatie werken.', 14],
  ],
  'oliver.declercq@doremio.test': [
    [660, 62, 'De noten zitten er beter in.', 'Boogwissels oefenen.', 2],
    [720, 66, 'Goed bijgehouden.', 'Meer herhalen aan het begin.', 7],
    [600, 60, 'Rustige sessie.', 'Concentratie erbij houden.', 13],
    [780, 68, 'Vandaag goed gevoel.', 'Het vibrato proberen.', 19],
  ],
  'julia.bogaert@doremio.test': [
    [960, 88, 'De toon is ronder geworden.', 'Hoofd recht houden.', 1],
    [840, 84, 'Mooie lange noten.', 'Meer adem nemen.', 3],
    [1080, 90, 'Super tevreden!', 'De triller in maat 8 oefenen.', 6],
    [720, 82, 'Goed geoefend.', 'Vingers losser maken.', 9],
    [900, 86, 'Het stuk klinkt al als muziek!', 'Nog aan de dynamiek werken.', 12],
  ],
  'thomas.vandenberghe@doremio.test': [
    [540, 58, 'De akkoorden lukken een beetje.', 'Vingers doen pijn.', 4],
    [480, 56, 'Korte sessie.', 'Meer oefenen.', 12],
    [600, 60, 'Iets beter vandaag.', 'Doorzetten.', 20],
  ],
}

export async function GET(request: Request) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Controleer dat er een leraar is
  const { data: leraarProfiel } = await admin
    .from('profiles').select('id').eq('role', 'leraar').limit(1).single()
  if (!leraarProfiel) {
    return NextResponse.json({ error: 'Geen leraar gevonden. Log eerst in als leraar.' }, { status: 400 })
  }
  const leraarId = leraarProfiel.id

  // Controleer of seed al gedaan is
  const { data: bestaand } = await admin
    .from('profiles').select('id').eq('academie', 'TEST_SEED').limit(1)
  if (bestaand && bestaand.length > 0) {
    return NextResponse.json({ bericht: 'Test data bestaat al. Gebruik /api/seed/cleanup om te verwijderen.' })
  }

  // Haal alle partituren op
  const { data: allePartituren } = await admin.from('partituren').select('id').limit(6)

  const aangemaakteIds: Record<string, string> = {}

  // Studenten aanmaken
  for (const student of studenten) {
    const { data: authData, error } = await admin.auth.admin.createUser({
      email: student.email,
      password: 'Doremio2026!',
      email_confirm: true,
    })
    if (error || !authData.user) {
      console.error(`Fout bij aanmaken ${student.naam}:`, error)
      continue
    }
    aangemaakteIds[student.email] = authData.user.id

    await admin.from('profiles').upsert({
      id: authData.user.id,
      role: 'student',
      naam: student.naam,
      instrument: student.instrument,
      academie: 'TEST_SEED',
    })
  }

  // Klassen aanmaken
  const { data: klas1A } = await admin.from('klassen')
    .insert({ naam: '1A', leraar_id: leraarId }).select('id').single()
  const { data: klas1B } = await admin.from('klassen')
    .insert({ naam: '1B', leraar_id: leraarId }).select('id').single()

  if (!klas1A || !klas1B) {
    return NextResponse.json({ error: 'Klassen aanmaken mislukt.' }, { status: 500 })
  }

  // Studenten in klassen plaatsen
  for (const student of studenten) {
    const studentId = aangemaakteIds[student.email]
    if (!studentId) continue
    const klasId = student.klas === '1A' ? klas1A.id : klas1B.id
    await admin.from('klas_studenten').insert({ klas_id: klasId, student_id: studentId })
  }

  // Oefensessies aanmaken
  for (const student of studenten) {
    const studentId = aangemaakteIds[student.email]
    if (!studentId) continue
    const sessies = sessiesPerStudent[student.email] || []
    for (const sessie of sessies) {
      const [duur, bpm, tops, tips, dagenGeleden, gevoel, partituurIdx] = sessie as SessieRij
      const datum = new Date(Date.now() - dagenGeleden * 24 * 60 * 60 * 1000).toISOString()
      const partId = allePartituren?.[
        typeof partituurIdx === 'number' ? partituurIdx % (allePartituren?.length || 1) : 0
      ]?.id || allePartituren?.[0]?.id || null
      await admin.from('oefensessies').insert({
        student_id: studentId,
        partituur_id: partId,
        duur,
        bpm,
        tops,
        tips,
        gevoel: gevoel || null,
        status: 'afgerond',
        created_at: datum,
      })
    }
  }

  return NextResponse.json({
    succes: true,
    bericht: `10 teststudenten aangemaakt in klassen 1A en 1B voor leraar ${leraarId}.`,
    studenten: studenten.map(s => s.naam),
  })
}
