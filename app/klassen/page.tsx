'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type Student = { id: string; naam: string; instrument: string | null }
type Sessie = {
  id: string
  student_id: string
  duur: number
  created_at: string
  partituren: { titel: string } | null
}
type Bericht = { id: string; inhoud: string; created_at: string }
type KlasData = {
  id: string
  naam: string
  leraarNaam: string
  studenten: Student[]
  sessies: Sessie[]
  berichten: Bericht[]
}

function formatDuur(seconden: number): string {
  const m = Math.floor(seconden / 60)
  return m === 0 ? `${seconden}s` : `${m}min`
}

function tijdGeleden(datum: string): string {
  const diff = Math.floor((Date.now() - new Date(datum).getTime()) / 1000)
  if (diff < 3600) return `${Math.floor(diff / 60)}min geleden`
  if (diff < 86400) return `${Math.floor(diff / 3600)}u geleden`
  const dagen = Math.floor(diff / 86400)
  return dagen === 1 ? 'gisteren' : `${dagen} dagen geleden`
}

export default function KlassenPagina() {
  const [userId, setUserId] = useState('')
  const [klassen, setKlassen] = useState<KlasData[]>([])
  const [profielMap, setProfielMap] = useState<Record<string, Student>>({})
  const [likes, setLikes] = useState<Record<string, string[]>>({})
  const [likeBezig, setLikeBezig] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      // Klassen van student
      const { data: ksData } = await supabase
        .from('klas_studenten').select('klas_id').eq('student_id', user.id)
      const klasIds = (ksData || []).map((k: any) => k.klas_id)

      if (klasIds.length === 0) { setLoading(false); return }

      // Klas details + leraar naam
      const { data: klassenData } = await supabase
        .from('klassen').select('id, naam, leraar_id').in('id', klasIds)
      const leraarIds = [...new Set((klassenData || []).map((k: any) => k.leraar_id).filter(Boolean))]

      const { data: leraarProfielen } = await supabase
        .from('profiles').select('id, naam').in('id', leraarIds)
      const leraarMap: Record<string, string> = {}
      leraarProfielen?.forEach((p: any) => { leraarMap[p.id] = p.naam })

      // Alle studenten in die klassen
      const { data: alleKsData } = await supabase
        .from('klas_studenten').select('klas_id, student_id').in('klas_id', klasIds)
      const alleStudentIds = [...new Set((alleKsData || []).map((k: any) => k.student_id))]

      const { data: studentProfielen } = await supabase
        .from('profiles').select('id, naam, instrument').in('id', alleStudentIds)
      const pMap: Record<string, Student> = {}
      studentProfielen?.forEach((p: any) => { pMap[p.id] = p })
      setProfielMap(pMap)

      // Recente sessies van alle klasgenoten (laatste 14 dagen)
      const veertiendagenGeleden = new Date(Date.now() - 14 * 86400000).toISOString()
      const { data: sessiesData } = await supabase
        .from('oefensessies')
        .select('id, student_id, duur, created_at, partituren(titel)')
        .in('student_id', alleStudentIds)
        .gte('created_at', veertiendagenGeleden)
        .order('created_at', { ascending: false })
        .limit(50)
      const sessies = (sessiesData as any) || []

      // 👍 reacties op die sessies
      const sessieIds = sessies.map((s: Sessie) => s.id)
      let likesMap: Record<string, string[]> = {}
      if (sessieIds.length > 0) {
        const { data: reactiesData } = await supabase
          .from('feedback')
          .select('sessie_id, auteur_id')
          .in('sessie_id', sessieIds)
          .eq('inhoud', '👍')
        reactiesData?.forEach((r: any) => {
          if (!likesMap[r.sessie_id]) likesMap[r.sessie_id] = []
          likesMap[r.sessie_id].push(r.auteur_id)
        })
      }
      setLikes(likesMap)

      // Groepsberichten per klas (laatste 5)
      const { data: berichtenData } = await supabase
        .from('feedback')
        .select('id, klas_id, inhoud, created_at')
        .in('klas_id', klasIds)
        .eq('type', 'klas_bericht')
        .order('created_at', { ascending: false })
        .limit(20)

      // Klassen samenstellen
      const result: KlasData[] = (klassenData || []).map((klas: any) => {
        const klasStudentIds = (alleKsData || [])
          .filter((k: any) => k.klas_id === klas.id)
          .map((k: any) => k.student_id)
        return {
          id: klas.id,
          naam: klas.naam,
          leraarNaam: leraarMap[klas.leraar_id] || 'Onbekende leraar',
          studenten: klasStudentIds.map((id: string) => pMap[id]).filter(Boolean),
          sessies: sessies.filter((s: Sessie) => klasStudentIds.includes(s.student_id)),
          berichten: (berichtenData || [])
            .filter((b: any) => b.klas_id === klas.id)
            .slice(0, 5),
        }
      })
      setKlassen(result)
      setLoading(false)
    }
    haalOp()
  }, [router])

  const toggleLike = async (sessieId: string) => {
    if (!userId || likeBezig) return
    const heeftGelikt = likes[sessieId]?.includes(userId)
    if (heeftGelikt) return // geen unlike voor nu
    setLikeBezig(sessieId)
    const { data } = await supabase.from('feedback').insert({
      sessie_id: sessieId, auteur_id: userId, inhoud: '👍', type: 'student_reactie'
    }).select('sessie_id, auteur_id').single()
    if (data) {
      setLikes(prev => ({
        ...prev,
        [sessieId]: [...(prev[sessieId] || []), userId]
      }))
    }
    setLikeBezig(null)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>

      {/* Header */}
      <div className="px-6 pt-10 pb-6" style={{ backgroundColor: '#0766C6' }}>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Mijn Klassen</h1>
          <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>
            {klassen.length === 0
              ? 'Je zit nog niet in een klas'
              : `${klassen.length} klas${klassen.length !== 1 ? 'sen' : ''}`}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-6 flex flex-col gap-6">

        {klassen.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: '#fff' }}>
            <p className="text-3xl mb-3">🎓</p>
            <p className="font-semibold" style={{ color: '#333' }}>Nog niet in een klas</p>
            <p className="text-sm mt-2" style={{ color: '#888' }}>
              Je leraar voegt je toe aan een klasgroep.
            </p>
          </div>
        ) : (
          klassen.map(klas => (
            <div key={klas.id} className="flex flex-col gap-3">

              {/* Klas header */}
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#0766C6' }}>
                <h2 className="text-xl font-bold text-white">{klas.naam}</h2>
                <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>
                  Leraar: {klas.leraarNaam} · {klas.studenten.length} studenten
                </p>

                {/* Klasgenoten */}
                <div className="flex gap-2 mt-4 flex-wrap">
                  {klas.studenten.map(student => (
                    <div key={student.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: student.id === userId
                          ? 'rgba(255,255,255,0.35)'
                          : 'rgba(255,255,255,0.15)',
                        color: '#fff'
                      }}>
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                        style={{ backgroundColor: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>
                        {student.naam?.slice(0, 1)}
                      </span>
                      {student.naam?.split(' ')[0]}
                      {student.id === userId && ' (jij)'}
                    </div>
                  ))}
                </div>
              </div>

              {/* Groepsberichten van leraar */}
              {klas.berichten.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: '#333' }}>💬 Van de leraar</span>
                  </div>
                  <div className="flex flex-col gap-2 px-4 pb-4">
                    {klas.berichten.map(bericht => (
                      <div key={bericht.id} className="p-3 rounded-xl"
                        style={{ backgroundColor: '#F3E7DD' }}>
                        <p className="text-sm" style={{ color: '#333' }}>{bericht.inhoud}</p>
                        <p className="text-xs mt-1" style={{ color: '#bbb' }}>
                          {tijdGeleden(bericht.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activiteitsfeed */}
              <p className="text-xs font-semibold uppercase tracking-wide px-1"
                style={{ color: '#888' }}>
                Activiteit — laatste 2 weken
              </p>

              {klas.sessies.length === 0 ? (
                <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#fff' }}>
                  <p className="text-sm" style={{ color: '#bbb' }}>Nog geen oefensessies deze week.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {klas.sessies.slice(0, 15).map(sessie => {
                    const student = profielMap[sessie.student_id]
                    const isZelf = sessie.student_id === userId
                    const aantalLikes = likes[sessie.student_id === userId ? sessie.id : sessie.id]?.length || 0
                    const heeftGelikt = likes[sessie.id]?.includes(userId)

                    return (
                      <div key={sessie.id} className="rounded-2xl overflow-hidden"
                        style={{ backgroundColor: '#fff' }}>
                        <div className="flex">
                          <div className="w-1 flex-shrink-0"
                            style={{ backgroundColor: isZelf ? '#FF560D' : '#0766C6' }} />
                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: isZelf ? '#FF560D' : '#0766C6' }}>
                                  {student?.naam?.slice(0, 1) || '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate" style={{ color: '#333' }}>
                                    {isZelf ? 'Jij' : student?.naam?.split(' ')[0] || 'Onbekend'}
                                  </p>
                                  <p className="text-xs truncate" style={{ color: '#888' }}>
                                    {sessie.partituren?.titel || 'Vrije sessie'} · {formatDuur(sessie.duur || 0)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs flex-shrink-0" style={{ color: '#bbb' }}>
                                {tijdGeleden(sessie.created_at)}
                              </p>
                            </div>

                            {/* Like */}
                            {!isZelf && (
                              <div className="flex items-center gap-2 mt-3 pt-3"
                                style={{ borderTop: '1px solid #F3E7DD' }}>
                                <button
                                  onClick={() => toggleLike(sessie.id)}
                                  disabled={heeftGelikt || likeBezig === sessie.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                                  style={{
                                    backgroundColor: heeftGelikt ? '#0766C6' : '#F3E7DD',
                                    color: heeftGelikt ? '#fff' : '#888',
                                  }}>
                                  👍 {aantalLikes > 0 ? aantalLikes : 'Geef een like'}
                                </button>
                              </div>
                            )}
                            {isZelf && aantalLikes > 0 && (
                              <div className="flex items-center gap-1.5 mt-3 pt-3"
                                style={{ borderTop: '1px solid #F3E7DD' }}>
                                <span className="text-xs" style={{ color: '#888' }}>
                                  👍 {aantalLikes} klasgenoot{aantalLikes !== 1 ? 'en' : ''} {aantalLikes !== 1 ? 'vinden' : 'vindt'} dit cool
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <BottomNav />
    </main>
  )
}
