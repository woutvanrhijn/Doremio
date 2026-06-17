import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()

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
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const userId = user.id

  const { data: ksData } = await admin
    .from('klas_studenten').select('klas_id').eq('student_id', userId)
  const klasIds = (ksData ?? []).map((k: any) => k.klas_id)

  const { data: klassenData } = await admin
    .from('klassen').select('id, naam, leraar_id').in('id', klasIds)

  const leraarIds = [...new Set((klassenData ?? []).map((k: any) => k.leraar_id))]

  const { data: alleKsData } = await admin
    .from('klas_studenten').select('klas_id, student_id').in('klas_id', klasIds)

  const alleStudentIds = [...new Set([userId, ...(alleKsData ?? []).map((k: any) => k.student_id)])]

  const maandGeleden = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: sessiesData } = await admin
    .from('oefensessies')
    .select('id, student_id, created_at, duur, bpm, gevoel')
    .in('student_id', alleStudentIds)
    .gte('created_at', maandGeleden)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: partiturenData } = leraarIds.length > 0
    ? await admin.from('partituren')
        .select('id, titel, leraar_id, klas_id, created_at')
        .in('leraar_id', leraarIds)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  return NextResponse.json({
    gebruiker: user.email,
    userId,
    klasIds,
    klassen: klassenData,
    leraarIds,
    alleStudentIds,
    aantalSessies: sessiesData?.length ?? 0,
    sessieStudentIds: [...new Set(sessiesData?.map((s: any) => s.student_id) ?? [])],
    aantalPartituren: partiturenData?.length ?? 0,
    partituren: (partiturenData ?? []).map((p: any) => ({ titel: p.titel, klas_id: p.klas_id, datum: p.created_at })),
  })
}
