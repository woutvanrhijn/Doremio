'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type Klas = { id: string; naam: string }
type Student = { id: string; naam: string; instrument: string | null }
type Sessie = {
  id: string; student_id: string; duur: number; created_at: string
  partituren: { titel: string } | null
}
type SessieFeed = {
  id: string; student_id: string; duur: number; gevoel: string | null
  tops: string | null; created_at: string
  partituren: { titel: string; componist: string | null } | null
}
type Reactie = { id: string; sessie_id: string; inhoud: string; created_at: string }

const GEVOEL_EMOJI: Record<string, string> = {
  'Super goed!': '🔥', 'Goed bezig': '😊', 'Oké': '😐', 'Moeilijk': '😓',
}

function formatDuur(s: number): string {
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}min` : `${s}s`
}

export default function ClassviewPage() {
  const [userId, setUserId] = useState('')
  const [actieveTab, setActieveTab] = useState<'overzicht' | 'activiteiten' | 'klassen'>('overzicht')
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [studentenPerKlas, setStudentenPerKlas] = useState<Record<string, Student[]>>({})
  const [profielMap, setProfielMap] = useState<Record<string, Student>>({})
  const [sessiesDezeWeek, setSessiesDezeWeek] = useState<Sessie[]>([])
  const [sessiesFeed, setSessiesFeed] = useState<SessieFeed[]>([])
  const [reacties, setReacties] = useState<Reactie[]>([])
  const [reactieTekst, setReactieTekst] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filterKlasId, setFilterKlasId] = useState<string | null>(null)
  const [zoekStudent, setZoekStudent] = useState('')
  const [verstuurBezig, setVerstuurBezig] = useState(false)
  const [zoekActiviteit, setZoekActiviteit] = useState('')

  const [toonKlasForm, setToonKlasForm] = useState(false)
  const [nieuweKlasNaam, setNieuweKlasNaam] = useState('')
  const [toonStudentKeuze, setToonStudentKeuze] = useState<string | null>(null)
  const [beschikbareStudenten, setBeschikbareStudenten] = useState<Student[]>([])

  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: klassenData } = await supabase
        .from('klassen').select('id, naam').eq('leraar_id', user.id)
        .order('created_at', { ascending: true })
      const klassen = klassenData || []
      setKlassen(klassen)

      if (klassen.length === 0) { setLoading(false); return }

      const klasIds = klassen.map(k => k.id)
      const { data: ksData } = await supabase
        .from('klas_studenten').select('klas_id, student_id').in('klas_id', klasIds)
      const alleIds = [...new Set((ksData || []).map((ks: any) => ks.student_id))]

      let profielen: Student[] = []
      if (alleIds.length > 0) {
        const { data } = await supabase.from('profiles').select('id, naam, instrument').in('id', alleIds)
        profielen = data || []
      }

      const map: Record<string, Student> = {}
      profielen.forEach(p => { map[p.id] = p })
      setProfielMap(map)

      const perKlas: Record<string, Student[]> = {}
      for (const ks of (ksData || [])) {
        const k = ks as any
        if (!perKlas[k.klas_id]) perKlas[k.klas_id] = []
        if (map[k.student_id]) perKlas[k.klas_id].push(map[k.student_id])
      }
      setStudentenPerKlas(perKlas)

      if (alleIds.length > 0) {
        const weekGeleden = new Date(Date.now() - 7 * 86400000).toISOString()
        const { data: sessies } = await supabase
          .from('oefensessies').select('id, student_id, duur, created_at, partituren(titel)')
          .in('student_id', alleIds).gte('created_at', weekGeleden)
          .order('created_at', { ascending: false })
        setSessiesDezeWeek((sessies as any) || [])

        const maandGeleden = new Date(Date.now() - 30 * 86400000).toISOString()
        const { data: feed } = await supabase
          .from('oefensessies')
          .select('id, student_id, duur, gevoel, tops, created_at, partituren(titel, componist)')
          .in('student_id', alleIds).gte('created_at', maandGeleden)
          .order('created_at', { ascending: false }).limit(60)
        const feedData = (feed as any) || []
        setSessiesFeed(feedData)

        const feedIds = feedData.map((s: SessieFeed) => s.id)
        if (feedIds.length > 0) {
          const { data: r } = await supabase.from('feedback')
            .select('id, sessie_id, inhoud, created_at')
            .in('sessie_id', feedIds).eq('auteur_id', user.id)
          setReacties(r || [])
        }
      }
      setLoading(false)
    }
    haalOp()
  }, [router])

  const stuurReactie = async (sessieId: string, inhoud: string) => {
    if (!inhoud?.trim()) return
    setVerstuurBezig(true)
    const { data } = await supabase.from('feedback').insert({
      sessie_id: sessieId, auteur_id: userId, inhoud: inhoud.trim(), type: 'leraar_reactie'
    }).select('id, sessie_id, inhoud, created_at').single()
    if (data) setReacties(prev => [...prev, data])
    setReactieTekst(prev => ({ ...prev, [sessieId]: '' }))
    setVerstuurBezig(false)
  }

  const maakKlasAan = async () => {
    if (!nieuweKlasNaam.trim()) return
    const { data } = await supabase.from('klassen')
      .insert({ naam: nieuweKlasNaam.trim(), leraar_id: userId })
      .select('id, naam').single()
    if (data) {
      setKlassen(prev => [...prev, data])
      setStudentenPerKlas(prev => ({ ...prev, [data.id]: [] }))
    }
    setNieuweKlasNaam(''); setToonKlasForm(false)
  }

  const laadBeschikbareStudenten = async (klasId: string) => {
    const huidigeIds = (studentenPerKlas[klasId] || []).map(s => s.id)
    const { data } = await supabase.from('profiles').select('id, naam, instrument')
      .eq('role', 'student').order('naam', { ascending: true })
    setBeschikbareStudenten((data || []).filter((s: any) => !huidigeIds.includes(s.id)))
    setToonStudentKeuze(klasId)
  }

  const voegStudentToe = async (klasId: string, student: Student) => {
    const { error } = await supabase.from('klas_studenten').insert({ klas_id: klasId, student_id: student.id })
    if (!error) {
      setStudentenPerKlas(prev => ({ ...prev, [klasId]: [...(prev[klasId] || []), student] }))
      setProfielMap(prev => ({ ...prev, [student.id]: student }))
      setBeschikbareStudenten(prev => prev.filter(s => s.id !== student.id))
    }
  }

  const verwijderStudent = async (klasId: string, studentId: string) => {
    await supabase.from('klas_studenten').delete().eq('klas_id', klasId).eq('student_id', studentId)
    setStudentenPerKlas(prev => ({
      ...prev, [klasId]: (prev[klasId] || []).filter(s => s.id !== studentId)
    }))
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  const alleStudenten = [...new Set(Object.values(studentenPerKlas).flat().map(s => s.id))]
    .map(id => profielMap[id]).filter(Boolean) as Student[]

  const actiefDezeWeek = new Set(sessiesDezeWeek.map(s => s.student_id))
  const percentActief = alleStudenten.length > 0
    ? Math.round((actiefDezeWeek.size / alleStudenten.length) * 100) : 0
  const gemDuurMin = sessiesDezeWeek.length > 0
    ? Math.round(sessiesDezeWeek.reduce((a, s) => a + (s.duur || 0), 0) / sessiesDezeWeek.length / 60) : 0

  const gefilterdStudenten: Student[] = (filterKlasId
    ? (studentenPerKlas[filterKlasId] || []) : alleStudenten)
    .filter(s => !zoekStudent || s.naam?.toLowerCase().includes(zoekStudent.toLowerCase()))
  const studentIdsGefilterd = new Set(gefilterdStudenten.map(s => s.id))
  const gefilterdeFeed = sessiesFeed
    .filter(s => (!filterKlasId || studentIdsGefilterd.has(s.student_id)) &&
      (!zoekActiviteit || profielMap[s.student_id]?.naam?.toLowerCase().includes(zoekActiviteit.toLowerCase())))

  const TABS = [
    { key: 'overzicht', label: 'Overzicht' },
    { key: 'activiteiten', label: 'Activiteiten' },
    { key: 'klassen', label: 'Klassen' },
  ] as const

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>

      {/* Blauwe header met 3-tab bar */}
      <div style={{ backgroundColor: '#0766C6' }}>
        <div className="max-w-2xl mx-auto px-6 pt-10">
          <button onClick={() => router.push('/dashboard')}
            className="mb-3 text-sm font-medium" style={{ color: '#93c5fd' }}>
            ← Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white">Classview</h1>
          <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>Oefenactiviteit van je studenten</p>

          <div className="flex mt-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setActieveTab(key)}
                className="px-4 py-3 text-sm font-semibold relative transition-colors"
                style={{ color: actieveTab === key ? '#fff' : 'rgba(255,255,255,0.45)' }}>
                {label}
                {actieveTab === key && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ backgroundColor: '#fff' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-6">

        {/* ===== OVERZICHT ===== */}
        {actieveTab === 'overzicht' && (
          <div className="flex flex-col gap-8">
            {alleStudenten.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#fff' }}>
                <p className="text-4xl mb-3">👥</p>
                <p className="font-semibold mb-1" style={{ color: '#333' }}>Nog geen studenten</p>
                <p className="text-sm mb-4" style={{ color: '#888' }}>Maak klassen aan via het Klassen-tab.</p>
                <button onClick={() => setActieveTab('klassen')}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-medium"
                  style={{ backgroundColor: '#0766C6' }}>
                  Naar Klassen →
                </button>
              </div>
            ) : (
              <>
                {/* Zoekbalk student */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#bbb' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Zoek student..."
                    value={zoekStudent}
                    onChange={e => setZoekStudent(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: '#fff', color: '#333' }}
                  />
                </div>

                {/* Klas filter pills */}
                {klassen.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => setFilterKlasId(null)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: filterKlasId === null ? '#0766C6' : '#fff',
                        color: filterKlasId === null ? '#fff' : '#666',
                      }}>
                      Alle klassen
                    </button>
                    {klassen.map(k => (
                      <button key={k.id} onClick={() => setFilterKlasId(k.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: filterKlasId === k.id ? '#0766C6' : '#fff',
                          color: filterKlasId === k.id ? '#fff' : '#666',
                        }}>
                        {k.naam}
                      </button>
                    ))}
                  </div>
                )}

                {/* Student grid */}
                {gefilterdStudenten.length === 0 && zoekStudent ? (
                  <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#fff' }}>
                    <p className="text-sm font-semibold" style={{ color: '#333' }}>Geen student gevonden</p>
                    <p className="text-xs mt-1" style={{ color: '#888' }}>"{zoekStudent}" komt niet overeen met een naam.</p>
                  </div>
                ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {gefilterdStudenten.map(student => {
                    const actief = actiefDezeWeek.has(student.id)
                    const aantalSessies = sessiesDezeWeek.filter(s => s.student_id === student.id).length
                    return (
                      <button key={student.id}
                        onClick={() => router.push(`/venster/student/${student.id}`)}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-transform hover:scale-[1.02]"
                        style={{ backgroundColor: '#fff' }}>
                        <div className="relative">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-xl"
                            style={{
                              backgroundColor: actief ? '#0766C6' : '#F3E7DD',
                              color: actief ? '#fff' : '#bbb',
                              boxShadow: actief ? '0 0 0 3px #bfdbfe' : 'none',
                            }}>
                            {student.naam?.slice(0, 1) || '?'}
                          </div>
                          {actief && aantalSessies > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: '#FF560D', fontSize: '10px' }}>
                              {aantalSessies}
                            </div>
                          )}
                        </div>
                        <div className="text-center w-full">
                          <p className="text-xs font-semibold truncate" style={{ color: actief ? '#333' : '#bbb' }}>
                            {student.naam?.split(' ')[0] || '?'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: actief ? '#22c55e' : '#bbb' }}>
                            {actief ? `${aantalSessies}× actief` : 'Inactief'}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#0766C6' }}>
                    <p className="text-3xl font-bold text-white">{percentActief}%</p>
                    <p className="text-xs mt-1" style={{ color: '#93c5fd' }}>Actief deze week</p>
                  </div>
                  <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#fff' }}>
                    <p className="text-2xl font-bold" style={{ color: '#0766C6' }}>{gemDuurMin}min</p>
                    <p className="text-xs mt-1" style={{ color: '#888' }}>Gem. sessieduur</p>
                  </div>
                  <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#FF560D' }}>
                    <p className="text-3xl font-bold text-white">{sessiesDezeWeek.length}</p>
                    <p className="text-xs mt-1" style={{ color: '#ffd0b5' }}>Sessies deze week</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== ACTIVITEITEN FEED ===== */}
        {actieveTab === 'activiteiten' && (
          <div className="flex flex-col gap-4">
            {/* Zoekbalk */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#bbb' }}>🔍</span>
              <input
                type="text"
                placeholder="Zoek student..."
                value={zoekActiviteit}
                onChange={e => setZoekActiviteit(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: '#fff', color: '#333' }}
              />
            </div>

            {klassen.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => setFilterKlasId(null)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: filterKlasId === null ? '#0766C6' : '#fff', color: filterKlasId === null ? '#fff' : '#666' }}>
                  Alle klassen
                </button>
                {klassen.map(k => (
                  <button key={k.id} onClick={() => setFilterKlasId(k.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: filterKlasId === k.id ? '#0766C6' : '#fff', color: filterKlasId === k.id ? '#fff' : '#666' }}>
                    {k.naam}
                  </button>
                ))}
              </div>
            )}

            {gefilterdeFeed.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#fff' }}>
                <p className="text-3xl mb-3">🎵</p>
                <p className="font-semibold" style={{ color: '#333' }}>Nog geen activiteiten</p>
                <p className="text-sm mt-1" style={{ color: '#888' }}>Sessies van de afgelopen 30 dagen verschijnen hier.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {gefilterdeFeed.map(sessie => {
                  const student = profielMap[sessie.student_id]
                  const sessieReacties = reacties.filter(r => r.sessie_id === sessie.id)
                  const heeftDuim = sessieReacties.some(r => r.inhoud === '👍 Goed gedaan!')
                  const heeftBoost = sessieReacties.some(r => r.inhoud === '🔥 Geweldig!')
                  const datum = new Date(sessie.created_at).toLocaleDateString('nl-BE', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  })
                  return (
                    <div key={sessie.id} className="rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: '#fff' }}>
                      <div className="flex items-center gap-3 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #F3E7DD' }}>
                        <button onClick={() => router.push(`/venster/student/${sessie.student_id}`)}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: '#0766C6' }}>
                            {student?.naam?.slice(0, 1) || '?'}
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm" style={{ color: '#333' }}>
                            {student?.naam || 'Onbekende student'}
                          </p>
                          <p className="text-xs" style={{ color: '#888' }}>{datum}</p>
                        </div>
                        {sessie.gevoel && (
                          <span className="text-xl">{GEVOEL_EMOJI[sessie.gevoel] || '🎵'}</span>
                        )}
                      </div>

                      <div className="px-4 py-3">
                        <p className="font-semibold text-sm" style={{ color: '#0766C6' }}>
                          {sessie.partituren?.titel || 'Vrije sessie'}
                        </p>
                        {sessie.partituren?.componist && (
                          <p className="text-xs mt-0.5" style={{ color: '#888' }}>{sessie.partituren.componist}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: '#F3E7DD', color: '#555' }}>
                            ⏱ {formatDuur(sessie.duur || 0)}
                          </span>
                          {sessie.gevoel && (
                            <span className="text-xs px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: '#F3E7DD', color: '#555' }}>
                              {sessie.gevoel}
                            </span>
                          )}
                        </div>
                        {sessie.tops && (
                          <p className="text-xs mt-2 italic leading-relaxed" style={{ color: '#555' }}>
                            "{sessie.tops.slice(0, 120)}{sessie.tops.length > 120 ? '…' : ''}"
                          </p>
                        )}
                      </div>

                      {sessieReacties.length > 0 && (
                        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                          {sessieReacties.map(r => (
                            <span key={r.id} className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                              {r.inhoud}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid #F3E7DD' }}>
                        <button onClick={() => !heeftDuim && stuurReactie(sessie.id, '👍 Goed gedaan!')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: heeftDuim ? '#0766C6' : '#F3E7DD', color: heeftDuim ? '#fff' : '#555' }}>
                          👍 Goed!
                        </button>
                        <button onClick={() => !heeftBoost && stuurReactie(sessie.id, '🔥 Geweldig!')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: heeftBoost ? '#FF560D' : '#F3E7DD', color: heeftBoost ? '#fff' : '#555' }}>
                          🔥 Boost!
                        </button>
                        <input type="text" placeholder="Reactie..."
                          value={reactieTekst[sessie.id] || ''}
                          onChange={e => setReactieTekst(prev => ({ ...prev, [sessie.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && stuurReactie(sessie.id, reactieTekst[sessie.id])}
                          className="flex-1 px-3 py-2 rounded-xl text-xs outline-none min-w-0"
                          style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
                        <button onClick={() => stuurReactie(sessie.id, reactieTekst[sessie.id])}
                          disabled={!reactieTekst[sessie.id]?.trim() || verstuurBezig}
                          className="px-3 py-2 rounded-xl text-white text-xs font-medium flex-shrink-0"
                          style={{ backgroundColor: reactieTekst[sessie.id]?.trim() ? '#0766C6' : '#ccc' }}>
                          Stuur
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== KLASSEN BEHEER ===== */}
        {actieveTab === 'klassen' && (
          <div className="flex flex-col gap-4">

            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
                {klassen.length} klas{klassen.length !== 1 ? 'sen' : ''}
              </p>
              <button onClick={() => setToonKlasForm(v => !v)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#0766C6' }}>
                + Nieuwe klas
              </button>
            </div>

            {toonKlasForm && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
                <p className="font-semibold mb-3 text-sm" style={{ color: '#333' }}>Nieuwe klas aanmaken</p>
                <input type="text" placeholder="Naam van de klas (bijv. 1A, Gitaar 2)" value={nieuweKlasNaam}
                  onChange={e => setNieuweKlasNaam(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && maakKlasAan()} autoFocus
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm mb-3"
                  style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
                <div className="flex gap-2">
                  <button onClick={maakKlasAan} disabled={!nieuweKlasNaam.trim()}
                    className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm"
                    style={{ backgroundColor: nieuweKlasNaam.trim() ? '#0766C6' : '#ccc' }}>
                    Aanmaken
                  </button>
                  <button onClick={() => { setToonKlasForm(false); setNieuweKlasNaam('') }}
                    className="flex-1 py-2.5 rounded-xl text-sm"
                    style={{ backgroundColor: '#F3E7DD', color: '#666' }}>
                    Annuleren
                  </button>
                </div>
              </div>
            )}

            {klassen.length === 0 && !toonKlasForm ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#fff' }}>
                <p className="text-4xl mb-3">🎓</p>
                <p className="font-semibold mb-1" style={{ color: '#333' }}>Nog geen klassen</p>
                <p className="text-sm" style={{ color: '#888' }}>Klik op "+ Nieuwe klas" om te beginnen.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {klassen.map(klas => {
                  const studenten = studentenPerKlas[klas.id] || []
                  const actiefInKlas = studenten.filter(s => actiefDezeWeek.has(s.id)).length
                  const pct = studenten.length > 0 ? Math.round((actiefInKlas / studenten.length) * 100) : 0

                  return (
                    <div key={klas.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                      <div className="px-5 py-4 flex items-center justify-between"
                        style={{ borderBottom: '1px solid #F3E7DD' }}>
                        <div>
                          <p className="font-bold" style={{ color: '#333' }}>{klas.naam}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                            {studenten.length} student{studenten.length !== 1 ? 'en' : ''}
                            {studenten.length > 0 && ` · ${pct}% actief deze week`}
                          </p>
                        </div>
                        <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs"
                          style={{
                            backgroundColor: pct >= 70 ? '#0766C6' : pct >= 40 ? '#FF560D' : '#F3E7DD',
                            color: pct >= 40 ? '#fff' : '#bbb',
                          }}>
                          {studenten.length > 0 ? `${pct}%` : '—'}
                        </div>
                      </div>

                      <div className="p-5">
                        {studenten.length === 0 ? (
                          <p className="text-sm text-center py-2 mb-4" style={{ color: '#bbb' }}>
                            Nog geen studenten in deze klas.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2 mb-4">
                            {studenten.map(student => {
                              const actief = actiefDezeWeek.has(student.id)
                              const aantalSessies = sessiesDezeWeek.filter(s => s.student_id === student.id).length
                              return (
                                <div key={student.id} className="flex items-center gap-2">
                                  <button onClick={() => router.push(`/venster/student/${student.id}`)}
                                    className="flex-1 flex items-center gap-3 p-3 rounded-xl text-left transition-transform hover:scale-[1.01]"
                                    style={{ backgroundColor: '#F3E7DD' }}>
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                                      style={{ backgroundColor: actief ? '#0766C6' : '#bbb' }}>
                                      {student.naam?.slice(0, 1)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold truncate" style={{ color: '#333' }}>
                                        {student.naam}
                                      </p>
                                      <p className="text-xs" style={{ color: '#888' }}>
                                        {student.instrument || '—'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <div className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: actief ? '#22c55e' : '#e5e7eb' }} />
                                      <span className="text-xs" style={{ color: actief ? '#16a34a' : '#bbb' }}>
                                        {actief ? `${aantalSessies}× deze week` : 'Inactief'}
                                      </span>
                                    </div>
                                  </button>
                                  <button onClick={() => verwijderStudent(klas.id, student.id)}
                                    title="Verwijder uit klas"
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                                    style={{ backgroundColor: '#F3E7DD', color: '#bbb' }}>
                                    ✕
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {toonStudentKeuze === klas.id ? (
                          <div>
                            <p className="text-xs font-semibold mb-2" style={{ color: '#888' }}>
                              Student toevoegen aan {klas.naam}
                            </p>
                            {beschikbareStudenten.length === 0 ? (
                              <p className="text-xs py-2 text-center" style={{ color: '#bbb' }}>
                                Alle geregistreerde studenten zijn al toegevoegd.
                              </p>
                            ) : (
                              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto mb-3">
                                {beschikbareStudenten.map(s => (
                                  <button key={s.id} onClick={() => voegStudentToe(klas.id, s)}
                                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-transform hover:scale-[1.01]"
                                    style={{ backgroundColor: '#F3E7DD', color: '#333' }}>
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                                      style={{ backgroundColor: '#0766C6' }}>
                                      {s.naam?.slice(0, 1)}
                                    </div>
                                    <div>
                                      <span className="font-medium text-sm">{s.naam}</span>
                                      {s.instrument && (
                                        <span className="ml-2 text-xs" style={{ color: '#888' }}>{s.instrument}</span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                            <button onClick={() => setToonStudentKeuze(null)}
                              className="text-xs font-medium" style={{ color: '#bbb' }}>
                              Sluiten
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => laadBeschikbareStudenten(klas.id)}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold"
                            style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                            + Student toevoegen
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
