import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()

  // Anon client met cookies → huidige ingelogde gebruiker ophalen
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Niet ingelogd. Open deze URL terwijl je in de app bent ingelogd.' },
      { status: 401 }
    )
  }

  // Admin client → kan RLS bypassen voor klas_studenten en oefensessies
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const stappen: string[] = []

  // ── 1. Zorg dat gebruiker in een klas zit ────────────────────────────────
  const { data: bestaandeKlassen } = await admin
    .from('klas_studenten')
    .select('klas_id')
    .eq('student_id', user.id)
    .limit(1)

  if (!bestaandeKlassen || bestaandeKlassen.length === 0) {
    // Zoek eerste TEST_SEED klas (aangemaakt door /api/seed)
    const { data: seedKlassen } = await admin
      .from('klassen')
      .select('id, naam')
      .in('naam', ['1A', '1B'])
      .limit(1)

    if (seedKlassen && seedKlassen.length > 0) {
      const klasId = seedKlassen[0].id
      await admin.from('klas_studenten').upsert(
        { klas_id: klasId, student_id: user.id },
        { onConflict: 'klas_id,student_id', ignoreDuplicates: true }
      )
      stappen.push(`✓ Toegevoegd aan klas ${seedKlassen[0].naam}`)
    } else {
      stappen.push('⚠ Geen seed-klas gevonden. Voer eerst /api/seed uit als leraar.')
    }
  } else {
    stappen.push('✓ Zit al in een klas')
  }

  // ── 2. Zorg dat profiel rol 'student' heeft ──────────────────────────────
  const { data: profiel } = await admin
    .from('profiles')
    .select('role, naam')
    .eq('id', user.id)
    .single()

  if (profiel && profiel.role !== 'student') {
    await admin.from('profiles').update({ role: 'student' }).eq('id', user.id)
    stappen.push(`✓ Rol gewijzigd van '${profiel.role}' naar 'student'`)
  } else {
    stappen.push(`✓ Profiel: ${profiel?.naam ?? user.email} (${profiel?.role ?? 'onbekend'})`)
  }

  // ── 3. Seed oefensessies voor de kalender ────────────────────────────────
  const { data: bestaandSeed } = await admin
    .from('oefensessies')
    .select('id')
    .eq('student_id', user.id)
    .like('tops', '%[Kalender-seed]%')
    .limit(1)

  if (bestaandSeed && bestaandSeed.length > 0) {
    stappen.push('✓ Kalender-sessies bestaan al')
  } else {
    const { data: partituren } = await admin.from('partituren').select('id').limit(5)
    const pIds: (string | null)[] = partituren && partituren.length > 0
      ? partituren.map((p: any) => p.id)
      : [null]

    const sessies = [
      { dagenGeleden: 1,  duur: 900,  bpm: 74, gevoel: 'Super goed!', tops: '[Kalender-seed] Heel goed geoefend!',        tips: 'De overgang naar maat 12 verbeteren.' },
      { dagenGeleden: 3,  duur: 720,  bpm: 70, gevoel: 'Goed bezig',  tops: '[Kalender-seed] Ritme zat er goed in.',      tips: 'Meer aandacht voor dynamiek.' },
      { dagenGeleden: 5,  duur: 1080, bpm: 78, gevoel: 'Oké',         tops: '[Kalender-seed] Lange sessie — doorgezet!',  tips: 'Korte pauze nemen.' },
      { dagenGeleden: 8,  duur: 840,  bpm: 72, gevoel: 'Goed bezig',  tops: '[Kalender-seed] Toonladder geoefend.',       tips: 'Snelheid opbouwen.' },
      { dagenGeleden: 12, duur: 960,  bpm: 76, gevoel: 'Super goed!', tops: '[Kalender-seed] Bijna uit het hoofd!',       tips: 'Volgende week verfijnen.' },
    ]

    let aangemaakt = 0
    for (let i = 0; i < sessies.length; i++) {
      const s = sessies[i]
      const { error } = await admin.from('oefensessies').insert({
        student_id: user.id,
        partituur_id: pIds[i % pIds.length],
        duur: s.duur,
        bpm: s.bpm,
        gevoel: s.gevoel,
        tops: s.tops,
        tips: s.tips,
        status: 'afgerond',
        created_at: new Date(Date.now() - s.dagenGeleden * 86400000).toISOString(),
      })
      if (!error) aangemaakt++
    }
    stappen.push(`✓ ${aangemaakt} kalender-sessies aangemaakt`)
  }

  return NextResponse.json({ succes: true, gebruiker: user.email ?? user.id, stappen })
}
