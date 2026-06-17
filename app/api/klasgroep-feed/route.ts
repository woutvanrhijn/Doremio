import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const MILESTONES = [1, 5, 10, 25]

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Geen token' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const userId = user.id

  const { data: eigenProfiel } = await admin
    .from('profiles').select('naam').eq('id', userId).single()
  const eigenNaam: string = eigenProfiel?.naam ?? user.email ?? 'Jij'

  const { data: ksData } = await admin
    .from('klas_studenten').select('klas_id').eq('student_id', userId)
  const klasIds: string[] = (ksData ?? []).map((k: any) => k.klas_id)

  const klasNaamMap: Record<string, string> = {}
  const klasLeraarMap: Record<string, string> = {}
  const leraarNaamMap: Record<string, string> = {}
  const studentNaamMap: Record<string, string> = { [userId]: eigenNaam }
  let studentKlasMap: Record<string, string> = {}
  let alleStudentIds: string[] = [userId]
  let klassen: Array<{ id: string; naam: string; leraar_id: string }> = []
  let geenKlassen = false

  if (klasIds.length === 0) {
    geenKlassen = true
  } else {
    const { data: klassenData } = await admin
      .from('klassen').select('id, naam, leraar_id').in('id', klasIds).order('naam')
    klassen = klassenData ?? []
    klassen.forEach(k => {
      klasNaamMap[k.id] = k.naam
      klasLeraarMap[k.id] = k.leraar_id
    })

    const leraarIds = [...new Set(klassen.map(k => k.leraar_id))]
    if (leraarIds.length > 0) {
      const { data: leraarProfielen } = await admin
        .from('profiles').select('id, naam').in('id', leraarIds)
      ;(leraarProfielen ?? []).forEach((p: any) => { leraarNaamMap[p.id] = p.naam })
    }

    const { data: alleKsData } = await admin
      .from('klas_studenten').select('klas_id, student_id').in('klas_id', klasIds)

    for (const ks of alleKsData ?? []) {
      if (!studentKlasMap[(ks as any).student_id]) {
        studentKlasMap[(ks as any).student_id] = (ks as any).klas_id
      }
    }

    alleStudentIds = [...new Set([userId, ...(alleKsData ?? []).map((k: any) => k.student_id as string)])]

    const vreemdeIds = alleStudentIds.filter(id => id !== userId)
    if (vreemdeIds.length > 0) {
      const { data: studProfielen } = await admin
        .from('profiles').select('id, naam').in('id', vreemdeIds)
      ;(studProfielen ?? []).forEach((p: any) => { studentNaamMap[p.id] = p.naam })
    }
  }

  const maandGeleden = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: sessiesData } = await admin
    .from('oefensessies')
    .select('id, student_id, created_at, duur, bpm, gevoel, partituren(titel, componist)')
    .in('student_id', alleStudentIds)
    .gte('created_at', maandGeleden)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: alleStudentSessies } = await admin
    .from('oefensessies').select('id, student_id').in('student_id', alleStudentIds)
  const sessieCountMap: Record<string, number> = {}
  for (const s of alleStudentSessies ?? []) {
    sessieCountMap[(s as any).student_id] = (sessieCountMap[(s as any).student_id] ?? 0) + 1
  }

  const leraarIdsVoorPartituren = [...new Set(klassen.map(k => k.leraar_id).filter(Boolean))]
  const { data: partiturenData } = leraarIdsVoorPartituren.length > 0
    ? await admin.from('partituren')
        .select('id, titel, componist, leraar_id, klas_id, created_at')
        .in('leraar_id', leraarIdsVoorPartituren)
        .order('created_at', { ascending: false })
        .limit(10)
    : { data: [] }

  const feedKaarten: any[] = []

  for (const s of sessiesData ?? []) {
    const sTyped = s as any
    const klasId = studentKlasMap[sTyped.student_id] ?? null
    const leraarId = klasId ? klasLeraarMap[klasId] : null
    feedKaarten.push({
      type: 'sessie',
      id: sTyped.id,
      studentId: sTyped.student_id,
      studentNaam: studentNaamMap[sTyped.student_id] ?? 'Klasgenoot',
      datum: sTyped.created_at,
      titel: (sTyped.partituren as any)?.titel ?? 'Vrije sessie',
      componist: (sTyped.partituren as any)?.componist ?? null,
      klasId,
      klasNaam: klasId ? (klasNaamMap[klasId] ?? null) : null,
      leraarNaam: leraarId ? (leraarNaamMap[leraarId] ?? null) : null,
      sessieCount: sessieCountMap[sTyped.student_id] ?? 0,
      duur: sTyped.duur ?? 0,
      bpm: sTyped.bpm ?? null,
      gevoel: sTyped.gevoel ?? null,
    })
  }

  for (const p of partiturenData ?? []) {
    const pTyped = p as any
    const klasId = pTyped.klas_id ?? null
    feedKaarten.push({
      type: 'materiaal',
      id: `mat-${pTyped.id}`,
      leraarId: pTyped.leraar_id,
      leraarNaam: leraarNaamMap[pTyped.leraar_id] ?? 'Leraar',
      datum: pTyped.created_at,
      titel: pTyped.titel ?? 'Onbekend',
      componist: pTyped.componist ?? null,
      klasId,
      klasNaam: klasId ? (klasNaamMap[klasId] ?? null) : null,
    })
  }

  const behandeldeStudenten = new Set<string>()
  for (const s of sessiesData ?? []) {
    const sTyped = s as any
    const studentId: string = sTyped.student_id
    if (behandeldeStudenten.has(studentId)) continue
    behandeldeStudenten.add(studentId)

    const count = sessieCountMap[studentId] ?? 0
    const haalteMijlpalen = MILESTONES.filter(m => count >= m)
    if (haalteMijlpalen.length > 0) {
      const hoogsteMijlpaal = Math.max(...haalteMijlpalen)
      const klasId = studentKlasMap[studentId] ?? null
      feedKaarten.push({
        type: 'achievement',
        id: `ach-${studentId}-${hoogsteMijlpaal}`,
        studentId,
        studentNaam: studentNaamMap[studentId] ?? 'Klasgenoot',
        datum: sTyped.created_at,
        milestone: hoogsteMijlpaal,
        sessieCount: count,
        klasId,
        klasNaam: klasId ? (klasNaamMap[klasId] ?? null) : null,
      })
    }
  }

  feedKaarten.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())

  return NextResponse.json({ userId, geenKlassen, klassen, feed: feedKaarten })
}
