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

const STUDENT_KLEUREN = ['#FF560D', '#0766C6', '#FFD100', '#22C55E', '#A855F7', '#EC4899', '#14B8A6', '#F97316']

const GEVOEL_WOORD: Record<string, string[]> = {
  'Super goed!': ['Plezier', 'Voldoening'],
  'Goed bezig': ['Zelfvertrouwen', 'Voldoening'],
  'Oké': ['Gefocust', 'Rustig'],
  'Moeilijk': ['Moeilijk', 'Uitdaging'],
}

const FICTIEVE_WOORDEN = ['Plezier', 'Moeilijk', 'Zelfvertrouwen', 'Concentratie', 'Voldoening']

const FICTIEVE_STUDENTEN: Array<{ id: string; naam: string; instrument: string | null; fictief: true }> = [
  { id: 'fict-amber', naam: 'Amber Claes', instrument: 'Piano', fictief: true },
  { id: 'fict-thomas', naam: 'Thomas Peeters', instrument: 'Gitaar', fictief: true },
  { id: 'fict-lien', naam: 'Lien Vandenb.', instrument: 'Viool', fictief: true },
  { id: 'fict-remi', naam: 'Remi Wouters', instrument: 'Klarinet', fictief: true },
  { id: 'fict-fien', naam: 'Fien De Smedt', instrument: 'Piano', fictief: true },
  { id: 'fict-lars', naam: 'Lars Bogaert', instrument: 'Trompet', fictief: true },
]

const FICTIEVE_SESSIE_COUNT: Record<string, number> = {
  'fict-amber': 8, 'fict-thomas': 12, 'fict-lien': 5,
  'fict-remi': 3, 'fict-fien': 15, 'fict-lars': 7,
}
const FICTIEVE_LAAST: Record<string, string> = {
  'fict-amber': 'Gisteren', 'fict-thomas': '2 dagen geleden', 'fict-lien': '4 dagen geleden',
  'fict-remi': 'Vandaag', 'fict-fien': 'Gisteren', 'fict-lars': '3 dagen geleden',
}
const FICTIEVE_STUK: Record<string, string> = {
  'fict-amber': 'Nocturne Op. 9 No. 2', 'fict-thomas': 'Say It Ain\'t So',
  'fict-lien': 'Canon in D', 'fict-remi': 'Knockin\' On Heaven\'s Door',
  'fict-fien': 'La Vie en Rose', 'fict-lars': 'What\'s Up?',
}

const FICTIEVE_STUDENT_SESSIES = [
  { naam: 'Amber Claes', stuk: 'Nocturne Op. 9 No. 2', datum: 'Gisteren', duur: '22min', kleur: STUDENT_KLEUREN[0] },
  { naam: 'Thomas Peeters', stuk: "Say It Ain't So", datum: '2 dagen geleden', duur: '18min', kleur: STUDENT_KLEUREN[1] },
  { naam: 'Fien De Smedt', stuk: 'La Vie en Rose', datum: '3 dagen geleden', duur: '31min', kleur: STUDENT_KLEUREN[4] },
]

function formatDuur(s: number): string {
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}min` : `${s}s`
}

const FICTIEVE_LERAAR_FEED_INIT = [
  { id: 'fv-1', leraarNaam: "Lukas D'hondt", titel: "Knockin' On Heaven's Door", componist: 'Bob Dylan', klasNaam: '2A', datum: new Date(Date.now() - 2 * 86400000), isOpname: false, isEigen: true },
  { id: 'fv-2', leraarNaam: 'H. Jacobs', titel: "Knockin' On Heaven's Door", componist: 'Bob Dylan', klasNaam: '1A', datum: new Date(Date.now() - 5 * 86400000), isOpname: true, isEigen: false },
  { id: 'fv-3', leraarNaam: 'G. Jansen', titel: "Friday I'm In Love", componist: 'The Cure', klasNaam: '3C', datum: new Date(Date.now() - 10 * 86400000), isOpname: false, isEigen: false },
]

type FeedInteractie = { gelikt: boolean; opgeslagen: boolean; commentOpen: boolean }

export default function ClassviewPage() {
  const [modus, setModus] = useState<'feed' | 'classview'>('feed')
  const [zoektermFeed, setZoektermFeed] = useState('')
  const [actieveFeedFilter, setActieveFeedFilter] = useState('all')
  const [userId, setUserId] = useState('')
  const [actieveTab, setActieveTab] = useState<'overzicht' | 'profielen' | 'klassen'>('overzicht')
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [studentenPerKlas, setStudentenPerKlas] = useState<Record<string, Student[]>>({})
  const [profielMap, setProfielMap] = useState<Record<string, Student>>({})
  const [sessiesDezeWeek, setSessiesDezeWeek] = useState<Sessie[]>([])
  const [sessiesFeed, setSessiesFeed] = useState<SessieFeed[]>([])
  const [reacties, setReacties] = useState<Reactie[]>([])
  const [reactieTekst, setReactieTekst] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [verstuurBezig, setVerstuurBezig] = useState(false)

  const [toonKlasForm, setToonKlasForm] = useState(false)
  const [nieuweKlasNaam, setNieuweKlasNaam] = useState('')
  const [toonStudentKeuze, setToonStudentKeuze] = useState<string | null>(null)
  const [beschikbareStudenten, setBeschikbareStudenten] = useState<Student[]>([])

  const [geselecteerdeStudentId, setGeselecteerdeStudentId] = useState<string | null>(null)
  const [leraarFeed, setLeraarFeed] = useState(FICTIEVE_LERAAR_FEED_INIT)
  const [verwijderBevestig, setVerwijderBevestig] = useState<string | null>(null)
  const [feedInteractie, setFeedInteractie] = useState<Record<string, FeedInteractie>>(() => {
    const init: Record<string, FeedInteractie> = {}
    const alleIds = [
      ...FICTIEVE_LERAAR_FEED_INIT.map(f => f.id),
      ...FICTIEVE_STUDENT_SESSIES.map((_, i) => `fict-student-${i}`),
    ]
    alleIds.forEach(id => { init[id] = { gelikt: false, opgeslagen: false, commentOpen: false } })
    return init
  })
  const [feedCommentTekst, setFeedCommentTekst] = useState<Record<string, string>>({})

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
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0D1B2A' }}>
      <p style={{ color: '#8FA3B8' }}>Laden...</p>
    </main>
  )

  const alleStudenten = [...new Set(Object.values(studentenPerKlas).flat().map(s => s.id))]
    .map(id => profielMap[id]).filter(Boolean) as Student[]

  const actiefDezeWeek = new Set(sessiesDezeWeek.map(s => s.student_id))
  const percentActief = alleStudenten.length > 0
    ? Math.round((actiefDezeWeek.size / alleStudenten.length) * 100) : 0

  const woordenCount: Record<string, number> = {}
  for (const s of sessiesDezeWeek) {
    const woorden = (GEVOEL_WOORD as any)[(s as any).gevoel || ''] || []
    woorden.forEach((w: string) => { woordenCount[w] = (woordenCount[w] ?? 0) + 1 })
  }
  const topWoorden = Object.entries(woordenCount)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3).map(([w]) => w)
  while (topWoorden.length < 3) {
    const extra = FICTIEVE_WOORDEN.find(w => !topWoorden.includes(w))
    if (extra) topWoorden.push(extra); else break
  }

  const totaleMinuten = sessiesDezeWeek.reduce((a, s) => a + Math.floor((s.duur || 0) / 60), 0) + 187

  const alleStudentenCombined: Array<Student & { fictief?: boolean }> = [
    ...alleStudenten,
    ...FICTIEVE_STUDENTEN.filter(f => !alleStudenten.some(s => s.id === f.id)),
  ]

  const schooldagen: Date[] = []
  const cursor = new Date()
  while (schooldagen.length < 10) {
    cursor.setDate(cursor.getDate() - 1)
    const dag = cursor.getDay()
    if (dag !== 0 && dag !== 6) schooldagen.unshift(new Date(cursor))
  }
  const dagMetSessieSet = new Set(
    sessiesDezeWeek.map(s => new Date(s.created_at).toDateString())
  )

  const geselecteerdeStudent = geselecteerdeStudentId
    ? (alleStudentenCombined.find(s => s.id === geselecteerdeStudentId) ?? null)
    : null

  return (
    <main style={{ backgroundColor: '#0D1B2A', minHeight: '100dvh', paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>

      {modus === 'feed' ? (
        <>
          {/* Feed landing: header */}
          <div style={{ paddingTop: 'calc(env(safe-area-inset-top, 16px) + 20px)' }} className="px-5">
            <h1 className="font-apercu font-bold" style={{ fontSize: 32, color: '#0766C6', marginBottom: 16 }}>
              Klasgroep
            </h1>

            {/* Two large pill buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{
                flex: 1, borderRadius: 999, padding: '14px 0', textAlign: 'center',
                backgroundColor: '#0766C6', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 14, color: '#fff',
              }}>
                Activiteiten bekijken
              </div>
              <button
                onClick={() => setModus('classview')}
                style={{
                  flex: 1, borderRadius: 999, padding: '14px 0', textAlign: 'center',
                  backgroundColor: '#FF560D', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 14, color: '#fff',
                }}
              >
                Classview →
              </button>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8FA3B8" strokeWidth="2"
                strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Zoek activiteiten..."
                value={zoektermFeed}
                onChange={e => setZoektermFeed(e.target.value)}
                className="font-apercu"
                style={{
                  width: '100%', padding: '12px 16px 12px 40px', borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 20, paddingBottom: 4 }}>
              {(['all', ...klassen.map(k => k.naam), 'Nieuwste'] as string[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setActieveFeedFilter(filter)}
                  className="font-apercu"
                  style={{
                    flexShrink: 0, borderRadius: 999, padding: '8px 16px',
                    backgroundColor: actieveFeedFilter === filter ? '#FF560D' : 'rgba(255,255,255,0.08)',
                    color: actieveFeedFilter === filter ? '#fff' : '#8FA3B8',
                    border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  }}
                >
                  {filter === 'all' ? 'Alles' : filter}
                </button>
              ))}
            </div>
          </div>

          {/* Feed cards */}
          <div className="px-5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Lesmateriaal kaarten — ORANJE of GEEL (opname) */}
            {leraarFeed.map(item => {
              const kleur = item.isOpname ? '#FFD100' : '#FF560D'
              const kleurBg = item.isOpname ? 'rgba(255,209,0,0.1)' : 'rgba(255,86,13,0.1)'
              const inter = feedInteractie[item.id] ?? { gelikt: false, opgeslagen: false, commentOpen: false }
              const toggle = (key: keyof FeedInteractie) => setFeedInteractie(prev => ({
                ...prev, [item.id]: { ...(prev[item.id] ?? { gelikt: false, opgeslagen: false, commentOpen: false }), [key]: !inter[key] }
              }))
              return (
                <div key={item.id} style={{ borderRadius: 16, overflow: 'hidden', borderLeft: `4px solid ${kleur}` }}>
                  {/* Header strip */}
                  <div style={{ backgroundColor: kleurBg, padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.isOpname ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth="2.5" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                      <span className="font-apercu font-bold" style={{ fontSize: 10, color: kleur, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        {item.isOpname ? 'Opname · Lesmateriaal' : 'Lesmateriaal'}
                      </span>
                    </div>
                    {item.isOpname && (
                      <span className="font-apercu font-bold" style={{ fontSize: 10, color: kleur, backgroundColor: 'rgba(255,209,0,0.2)', borderRadius: 20, padding: '2px 8px' }}>
                        Opname
                      </span>
                    )}
                  </div>

                  <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Info rij */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: kleur, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.isOpname ? (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-apercu" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                          {item.leraarNaam} · Klas {item.klasNaam} · {item.datum.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="font-apercu font-bold" style={{ fontSize: 14, color: '#fff', margin: '4px 0 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          &ldquo;{item.titel}&rdquo;
                          {item.componist && <span style={{ fontWeight: 500, fontStyle: 'normal', color: 'rgba(255,255,255,0.6)' }}> {item.componist}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Actie knoppen: Opslaan, Liken, Commenten, Bewerken */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {/* Opslaan */}
                        <button onClick={() => toggle('opgeslagen')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: inter.opgeslagen ? 'rgba(255,209,0,0.12)' : 'transparent' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={inter.opgeslagen ? '#FFD100' : 'none'} stroke={inter.opgeslagen ? '#FFD100' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="font-apercu font-bold" style={{ fontSize: 11, color: inter.opgeslagen ? '#FFD100' : 'rgba(255,255,255,0.5)' }}>Opslaan</span>
                        </button>
                        {/* Liken */}
                        <button onClick={() => toggle('gelikt')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: inter.gelikt ? 'rgba(255,86,13,0.12)' : 'transparent' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={inter.gelikt ? '#FF560D' : 'none'} stroke={inter.gelikt ? '#FF560D' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                        {/* Commenten */}
                        <button onClick={() => toggle('commentOpen')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: inter.commentOpen ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="font-apercu font-bold" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Reageren</span>
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* Bewerken */}
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span className="font-apercu font-bold" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Bewerken</span>
                        </button>
                        {/* Verwijderen — enkel voor eigen lesmateriaal */}
                        {item.isEigen && (
                          <button
                            onClick={() => setVerwijderBevestig(verwijderBevestig === item.id ? null : item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: verwijderBevestig === item.id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={verwijderBevestig === item.id ? '#EF4444' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                            <span className="font-apercu font-bold" style={{ fontSize: 11, color: verwijderBevestig === item.id ? '#EF4444' : 'rgba(255,255,255,0.5)' }}>
                              Verwijderen
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bevestiging verwijderen */}
                    {verwijderBevestig === item.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="font-apercu" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', flex: 1 }}>
                          Lesmateriaal verwijderen?
                        </span>
                        <button
                          onClick={() => { setLeraarFeed(prev => prev.filter(f => f.id !== item.id)); setVerwijderBevestig(null) }}
                          style={{ backgroundColor: '#EF4444', border: 'none', cursor: 'pointer', borderRadius: 16, padding: '6px 14px', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: '#fff' }}
                        >
                          Ja
                        </button>
                        <button
                          onClick={() => setVerwijderBevestig(null)}
                          style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', borderRadius: 16, padding: '6px 14px', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}
                        >
                          Nee
                        </button>
                      </div>
                    )}

                    {/* Comment input */}
                    {inter.commentOpen && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <input
                          type="text"
                          placeholder="Schrijf een reactie..."
                          value={feedCommentTekst[item.id] ?? ''}
                          onChange={e => setFeedCommentTekst(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { setFeedCommentTekst(prev => ({ ...prev, [item.id]: '' })); toggle('commentOpen') } }}
                          autoFocus
                          style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '8px 14px', fontFamily: 'var(--font-apercu)', fontSize: 13, color: '#fff' }}
                        />
                        <button
                          onClick={() => { setFeedCommentTekst(prev => ({ ...prev, [item.id]: '' })); toggle('commentOpen') }}
                          style={{ backgroundColor: kleur, border: 'none', cursor: 'pointer', borderRadius: 20, padding: '8px 16px', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: item.isOpname ? '#0D1B2A' : '#fff', flexShrink: 0 }}
                        >
                          Stuur
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Echte studentsessies — BLAUW */}
            {sessiesFeed.slice(0, 5).map(sessie => {
              const student = profielMap[sessie.student_id]
              const naam = student?.naam ?? 'Student'
              const datum = new Date(sessie.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
              const duurStr = formatDuur(sessie.duur || 0)
              const inter = feedInteractie[sessie.id] ?? { gelikt: false, opgeslagen: false, commentOpen: false }
              const toggle = (key: keyof FeedInteractie) => setFeedInteractie(prev => ({
                ...prev, [sessie.id]: { ...(prev[sessie.id] ?? { gelikt: false, opgeslagen: false, commentOpen: false }), [key]: !inter[key] }
              }))
              return (
                <div key={sessie.id} style={{ borderRadius: 16, overflow: 'hidden', borderLeft: '4px solid #0766C6' }}>
                  <div style={{ backgroundColor: 'rgba(7,102,198,0.12)', padding: '8px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0766C6" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                    <span className="font-apercu font-bold" style={{ fontSize: 10, color: '#0766C6', letterSpacing: 0.5, textTransform: 'uppercase' }}>Oefensessie</span>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#0766C6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                          <circle cx="12" cy="8" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-apercu font-bold" style={{ fontSize: 13, color: '#fff', margin: 0 }}>{naam}</p>
                        <p className="font-apercu" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{datum} · {duurStr}</p>
                        {sessie.partituren?.titel && (
                          <p className="font-apercu font-bold" style={{ fontSize: 14, color: '#fff', margin: '4px 0 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            &ldquo;{sessie.partituren.titel}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={() => router.push(`/sessies/${sessie.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: 'rgba(7,102,198,0.15)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0766C6" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="font-apercu font-bold" style={{ fontSize: 11, color: '#0766C6' }}>Bekijken</span>
                      </button>
                      <button onClick={() => toggle('gelikt')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: inter.gelikt ? 'rgba(255,86,13,0.12)' : 'transparent' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={inter.gelikt ? '#FF560D' : 'none'} stroke={inter.gelikt ? '#FF560D' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                      <button onClick={() => toggle('commentOpen')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: inter.commentOpen ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className="font-apercu font-bold" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Reageren</span>
                      </button>
                    </div>
                    {inter.commentOpen && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <input
                          type="text"
                          placeholder="Schrijf een reactie..."
                          value={feedCommentTekst[sessie.id] ?? ''}
                          onChange={e => setFeedCommentTekst(prev => ({ ...prev, [sessie.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { setFeedCommentTekst(prev => ({ ...prev, [sessie.id]: '' })); toggle('commentOpen') } }}
                          autoFocus
                          style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '8px 14px', fontFamily: 'var(--font-apercu)', fontSize: 13, color: '#fff' }}
                        />
                        <button
                          onClick={() => { setFeedCommentTekst(prev => ({ ...prev, [sessie.id]: '' })); toggle('commentOpen') }}
                          style={{ backgroundColor: '#0766C6', border: 'none', cursor: 'pointer', borderRadius: 20, padding: '8px 16px', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}
                        >
                          Stuur
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Fictieve studentsessies — BLAUW */}
            {sessiesFeed.length === 0 && FICTIEVE_STUDENT_SESSIES.map((f, i) => {
              const id = `fict-student-${i}`
              const inter = feedInteractie[id] ?? { gelikt: false, opgeslagen: false, commentOpen: false }
              const toggle = (key: keyof FeedInteractie) => setFeedInteractie(prev => ({
                ...prev, [id]: { ...(prev[id] ?? { gelikt: false, opgeslagen: false, commentOpen: false }), [key]: !inter[key] }
              }))
              return (
                <div key={id} style={{ borderRadius: 16, overflow: 'hidden', borderLeft: '4px solid #0766C6' }}>
                  <div style={{ backgroundColor: 'rgba(7,102,198,0.12)', padding: '8px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0766C6" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                    <span className="font-apercu font-bold" style={{ fontSize: 10, color: '#0766C6', letterSpacing: 0.5, textTransform: 'uppercase' }}>Oefensessie</span>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: f.kleur, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                          <circle cx="12" cy="8" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-apercu font-bold" style={{ fontSize: 13, color: '#fff', margin: 0 }}>{f.naam}</p>
                        <p className="font-apercu" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{f.datum} · {f.duur}</p>
                        <p className="font-apercu font-bold" style={{ fontSize: 14, color: '#fff', margin: '4px 0 0', fontStyle: 'italic' }}>&ldquo;{f.stuk}&rdquo;</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: 'rgba(7,102,198,0.15)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0766C6" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="font-apercu font-bold" style={{ fontSize: 11, color: '#0766C6' }}>Bekijken</span>
                      </button>
                      <button onClick={() => toggle('gelikt')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: inter.gelikt ? 'rgba(255,86,13,0.12)' : 'transparent' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={inter.gelikt ? '#FF560D' : 'none'} stroke={inter.gelikt ? '#FF560D' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                      <button onClick={() => toggle('commentOpen')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: inter.commentOpen ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        <span className="font-apercu font-bold" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Reageren</span>
                      </button>
                    </div>
                    {inter.commentOpen && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <input
                          type="text"
                          placeholder="Schrijf een reactie..."
                          value={feedCommentTekst[id] ?? ''}
                          onChange={e => setFeedCommentTekst(prev => ({ ...prev, [id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { setFeedCommentTekst(prev => ({ ...prev, [id]: '' })); toggle('commentOpen') } }}
                          autoFocus
                          style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '8px 14px', fontFamily: 'var(--font-apercu)', fontSize: 13, color: '#fff' }}
                        />
                        <button
                          onClick={() => { setFeedCommentTekst(prev => ({ ...prev, [id]: '' })); toggle('commentOpen') }}
                          style={{ backgroundColor: '#0766C6', border: 'none', cursor: 'pointer', borderRadius: 20, padding: '8px 16px', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}
                        >
                          Stuur
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

          </div>
        </>
      ) : (
        <>
          {/* Classview: header with back button */}
          <div style={{ backgroundColor: '#0D1B2A', paddingTop: 'calc(env(safe-area-inset-top, 16px) + 8px)', paddingBottom: 0 }}>
            <div className="px-5">
              <div className="flex items-center justify-between mb-1">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => setModus('feed')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8FA3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                    </svg>
                  </button>
                  <div>
                    <p className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>Academie Borgerhout</p>
                    <h1 className="font-apercu font-bold text-display-sm text-white">Klasgroep 2A</h1>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex mt-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {([
                  { key: 'overzicht', label: 'Overzicht' },
                  { key: 'profielen', label: 'Profielen' },
                  { key: 'klassen', label: 'Klassen' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActieveTab(key)}
                    className="flex-1 py-3 font-apercu font-bold text-body-sm relative"
                    style={{ color: actieveTab === key ? '#FF560D' : 'rgba(255,255,255,0.4)' }}
                  >
                    {label}
                    {actieveTab === key && (
                      <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ backgroundColor: '#FF560D' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 pt-5">

            {/* ── OVERZICHT ── */}
            {actieveTab === 'overzicht' && (
              <div className="flex flex-col gap-5">

                <p className="font-apercu font-bold text-white text-body-md">
                  Highlights {new Date().toLocaleDateString('nl-BE', { month: 'long' })} — Klasgroep 2A
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ backgroundColor: '#0766C6' }}>
                    <p className="font-apercu font-bold text-white" style={{ fontSize: 28, lineHeight: 1 }}>
                      {alleStudenten.length > 0 ? percentActief : 90}%
                    </p>
                    <p className="font-apercu text-caption leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Van de studenten oefende deze week
                    </p>
                  </div>
                  <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ backgroundColor: '#FF560D' }}>
                    <p className="font-apercu font-bold text-white" style={{ fontSize: 28, lineHeight: 1 }}>
                      {totaleMinuten}
                    </p>
                    <p className="font-apercu text-caption leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      Min. geoefend in totaal
                    </p>
                  </div>
                  <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p className="font-apercu font-bold text-white" style={{ fontSize: 28, lineHeight: 1 }}>
                      {sessiesDezeWeek.length + 22}
                    </p>
                    <p className="font-apercu text-caption leading-snug" style={{ color: '#8FA3B8' }}>
                      Oefenmomenten verdeeld
                    </p>
                  </div>
                </div>

                {/* Woorden van de week */}
                <div className="rounded-2xl p-4 flex gap-4 items-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex-shrink-0">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                      <circle cx="32" cy="32" r="24" fill="none" stroke="#FF560D" strokeWidth="12"
                        strokeDasharray="60 90" strokeLinecap="round"
                        style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }} />
                      <circle cx="32" cy="32" r="24" fill="none" stroke="#0766C6" strokeWidth="12"
                        strokeDasharray="35 115" strokeLinecap="round"
                        strokeDashoffset="-60"
                        style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }} />
                    </svg>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="font-apercu font-bold text-white text-body-sm">Woorden van de week</p>
                    {topWoorden.map((w, i) => (
                      <p key={w} className="font-apercu text-body-sm" style={{ color: i === 0 ? '#FF560D' : i === 1 ? '#0766C6' : 'rgba(255,255,255,0.5)' }}>
                        {w}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Schooldagen kalender */}
                <div>
                  <p className="font-apercu font-bold text-white text-body-sm mb-3">Afgelopen schooldagen</p>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
                    {schooldagen.map((dag, i) => {
                      const heeftSessie = dagMetSessieSet.has(dag.toDateString())
                      const bg = heeftSessie ? '#0766C6' : '#FF560D'
                      const dagNaam = dag.toLocaleDateString('nl-BE', { weekday: 'short' })
                      const datumStr = `${dag.getDate()}/${dag.getMonth() + 1}`
                      return (
                        <div key={i} className="flex-shrink-0 rounded-2xl flex flex-col items-center justify-center gap-1"
                          style={{ width: 72, height: 88, backgroundColor: bg }}>
                          <span className="font-apercu font-bold text-white" style={{ opacity: 0.7, fontSize: 10, textTransform: 'uppercase' }}>
                            {dagNaam}
                          </span>
                          <span className="font-apercu font-bold text-white" style={{ fontSize: 18, lineHeight: 1 }}>
                            {datumStr}
                          </span>
                          {heeftSessie && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.6)' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#FF560D' }} />
                      <span className="font-apercu text-caption" style={{ color: '#8FA3B8', fontSize: 10 }}>Lesdag</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0766C6' }} />
                      <span className="font-apercu text-caption" style={{ color: '#8FA3B8', fontSize: 10 }}>Oefendag</span>
                    </div>
                  </div>
                </div>

                {/* Recente activiteiten */}
                <div>
                  <p className="font-apercu font-bold text-white text-body-sm mb-3">Recente activiteiten</p>
                  <div className="flex flex-col gap-3">
                    {sessiesFeed.slice(0, 5).map(sessie => {
                      const student = profielMap[sessie.student_id]
                      const naam = student?.naam ?? 'Student'
                      const datum = new Date(sessie.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
                      return (
                        <div key={sessie.id} className="flex items-center gap-3 rounded-2xl p-3"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-apercu font-bold text-white text-body-sm flex-shrink-0"
                            style={{ backgroundColor: '#FF560D' }}>
                            {naam.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-apercu text-body-sm text-white truncate">
                              <span className="font-bold">{naam}</span>
                              {sessie.partituren?.titel && ` · "${sessie.partituren.titel}"`}
                            </p>
                            <p className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>{datum}</p>
                          </div>
                        </div>
                      )
                    })}
                    {[
                      { naam: 'Lukas D\'hondt', stuk: 'Knockin\' On Heaven\'s Door', datum: '12/09', kleur: '#0766C6' },
                      { naam: 'H. Jacobs', stuk: 'Friday I\'m In Love', datum: '12/09', kleur: '#FFD100' },
                    ].map((f, i) => (
                      <div key={`fict-${i}`} className="flex items-center gap-3 rounded-2xl p-3"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-apercu font-bold text-white text-body-sm flex-shrink-0"
                          style={{ backgroundColor: f.kleur }}>
                          {f.naam.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-apercu text-body-sm text-white truncate">
                            <span className="font-bold">{f.naam}</span>
                            {` · "${f.stuk}"`}
                          </p>
                          <p className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>{f.datum}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── PROFIELEN ── */}
            {actieveTab === 'profielen' && (
              <div className="flex flex-col gap-5">
                <p className="font-apercu font-bold text-white text-body-md">Muzikale profielen — Klasgroep 2A</p>

                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4, margin: '0 -20px', padding: '0 20px 4px' }}>
                  {alleStudentenCombined.map((student, idx) => {
                    const kleur = STUDENT_KLEUREN[idx % STUDENT_KLEUREN.length]
                    const isFictief = (student as any).fictief === true
                    const sessieCount = isFictief
                      ? (FICTIEVE_SESSIE_COUNT[student.id] ?? 0)
                      : sessiesDezeWeek.filter(s => s.student_id === student.id).length
                    const isActief = isFictief ? sessieCount > 0 : actiefDezeWeek.has(student.id)
                    const isGeselecteerd = geselecteerdeStudentId === student.id

                    return (
                      <button
                        key={student.id}
                        onClick={() => setGeselecteerdeStudentId(isGeselecteerd ? null : student.id)}
                        className="flex-shrink-0 flex flex-col items-center gap-2 active:scale-95 transition-transform duration-100"
                        style={{ minWidth: 72 }}
                      >
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center font-apercu font-bold text-white text-body-lg"
                            style={{
                              backgroundColor: kleur,
                              outline: isGeselecteerd ? '3px solid #FF560D' : '3px solid transparent',
                              outlineOffset: 2,
                            }}>
                            {student.naam?.slice(0, 1) ?? '?'}
                          </div>
                          {isActief && (
                            <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: '#22C55E', fontSize: 9 }}>
                              {sessieCount}
                            </div>
                          )}
                        </div>
                        <p className="font-apercu font-bold text-white text-center" style={{ fontSize: 11, maxWidth: 72 }}>
                          {student.naam?.split(' ')[0] ?? '?'}
                        </p>
                        <p className="font-apercu text-center" style={{ color: '#8FA3B8', fontSize: 10, marginTop: -4 }}>
                          {student.instrument ?? '—'}
                        </p>
                      </button>
                    )
                  })}
                </div>

                {/* Student profile panel */}
                {geselecteerdeStudent && (() => {
                  const idx = alleStudentenCombined.findIndex(s => s.id === geselecteerdeStudentId)
                  const kleur = STUDENT_KLEUREN[idx % STUDENT_KLEUREN.length]
                  const isFictief = (geselecteerdeStudent as any).fictief === true
                  const sessieCount = isFictief
                    ? (FICTIEVE_SESSIE_COUNT[geselecteerdeStudentId!] ?? 0)
                    : sessiesDezeWeek.filter(s => s.student_id === geselecteerdeStudentId).length
                  const laatsGeoefend = isFictief
                    ? (FICTIEVE_LAAST[geselecteerdeStudentId!] ?? '—')
                    : (sessiesDezeWeek.filter(s => s.student_id === geselecteerdeStudentId)[0]
                        ? new Date(sessiesDezeWeek.filter(s => s.student_id === geselecteerdeStudentId)[0].created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })
                        : 'Nog niet geoefend')
                  const stuk = isFictief
                    ? (FICTIEVE_STUK[geselecteerdeStudentId!] ?? '—')
                    : (sessiesFeed.find(s => s.student_id === geselecteerdeStudentId)?.partituren?.titel ?? '—')
                  const totalMin = isFictief
                    ? sessieCount * 18
                    : sessiesFeed.filter(s => s.student_id === geselecteerdeStudentId).reduce((a, s) => a + Math.floor((s.duur || 0) / 60), 0)

                  return (
                    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)' }}>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center font-apercu font-bold text-white text-display-sm flex-shrink-0"
                          style={{ backgroundColor: kleur }}>
                          {geselecteerdeStudent.naam?.slice(0, 1) ?? '?'}
                        </div>
                        <div className="flex-1">
                          <h2 className="font-apercu font-bold text-white text-heading-md">{geselecteerdeStudent.naam}</h2>
                          <p className="font-apercu text-body-sm" style={{ color: '#8FA3B8' }}>{geselecteerdeStudent.instrument ?? 'Instrument onbekend'}</p>
                          <p className="font-apercu text-caption" style={{ color: '#FF560D' }}>Klas 2A</p>
                        </div>
                        <button
                          onClick={() => setGeselecteerdeStudentId(null)}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                          <p className="font-apercu font-bold text-white text-heading-sm">{sessieCount}</p>
                          <p className="font-apercu text-caption" style={{ color: '#8FA3B8', fontSize: 10 }}>Sessies</p>
                        </div>
                        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                          <p className="font-apercu font-bold text-white text-heading-sm">{totalMin}</p>
                          <p className="font-apercu text-caption" style={{ color: '#8FA3B8', fontSize: 10 }}>Minuten</p>
                        </div>
                        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                          <p className="font-apercu font-bold text-white text-heading-sm">🔥</p>
                          <p className="font-apercu text-caption" style={{ color: '#8FA3B8', fontSize: 10 }}>Streak</p>
                        </div>
                      </div>

                      <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,86,13,0.1)', border: '1px solid rgba(255,86,13,0.2)' }}>
                        <p className="font-apercu text-caption" style={{ color: '#FF560D' }}>Huidig stuk</p>
                        <p className="font-apercu font-bold italic text-white text-body-sm mt-0.5">&ldquo;{stuk}&rdquo;</p>
                        <p className="font-apercu text-caption mt-1" style={{ color: '#8FA3B8' }}>Laatst geoefend: {laatsGeoefend}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/venster/student/${geselecteerdeStudentId}`)}
                          className="flex-1 py-3 rounded-xl font-apercu font-bold text-white text-body-sm active:scale-95 transition-transform duration-100"
                          style={{ backgroundColor: '#FF560D' }}
                        >
                          Volledig profiel →
                        </button>
                        <button
                          className="flex-1 py-3 rounded-xl font-apercu font-bold text-white text-body-sm active:scale-95 transition-transform duration-100"
                          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                        >
                          Reactie sturen
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ── KLASSEN BEHEER ── */}
            {actieveTab === 'klassen' && (
              <div className="flex flex-col gap-4">

                <div className="flex items-center justify-between">
                  <p className="font-apercu text-caption font-bold uppercase tracking-wide" style={{ color: '#8FA3B8' }}>
                    {klassen.length} klas{klassen.length !== 1 ? 'sen' : ''}
                  </p>
                  <button onClick={() => setToonKlasForm(v => !v)}
                    className="px-4 py-2 rounded-xl font-apercu font-bold text-body-sm text-white"
                    style={{ backgroundColor: '#0766C6' }}>
                    + Nieuwe klas
                  </button>
                </div>

                {toonKlasForm && (
                  <div className="rounded-2xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p className="font-apercu font-bold text-white text-body-sm mb-3">Nieuwe klas aanmaken</p>
                    <input type="text" placeholder="Naam van de klas (bijv. 1A, Gitaar 2)" value={nieuweKlasNaam}
                      onChange={e => setNieuweKlasNaam(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && maakKlasAan()} autoFocus
                      className="w-full px-4 py-3 rounded-xl outline-none font-apercu text-body-sm mb-3"
                      style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }} />
                    <div className="flex gap-2">
                      <button onClick={maakKlasAan} disabled={!nieuweKlasNaam.trim()}
                        className="flex-1 py-2.5 rounded-xl font-apercu font-bold text-white text-body-sm"
                        style={{ backgroundColor: nieuweKlasNaam.trim() ? '#0766C6' : 'rgba(255,255,255,0.1)' }}>
                        Aanmaken
                      </button>
                      <button onClick={() => { setToonKlasForm(false); setNieuweKlasNaam('') }}
                        className="flex-1 py-2.5 rounded-xl font-apercu text-body-sm"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8FA3B8' }}>
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}

                {klassen.length === 0 && !toonKlasForm ? (
                  <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <p className="text-4xl mb-3">🎓</p>
                    <p className="font-apercu font-bold text-white text-body-md mb-1">Nog geen klassen</p>
                    <p className="font-apercu text-body-sm" style={{ color: '#8FA3B8' }}>Klik op "+ Nieuwe klas" om te beginnen.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {klassen.map(klas => {
                      const studenten = studentenPerKlas[klas.id] || []
                      const actiefInKlas = studenten.filter(s => actiefDezeWeek.has(s.id)).length
                      const pct = studenten.length > 0 ? Math.round((actiefInKlas / studenten.length) * 100) : 0

                      return (
                        <div key={klas.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <div className="px-5 py-4 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <div>
                              <p className="font-apercu font-bold text-white text-body-md">{klas.naam}</p>
                              <p className="font-apercu text-caption mt-0.5" style={{ color: '#8FA3B8' }}>
                                {studenten.length} student{studenten.length !== 1 ? 'en' : ''}
                                {studenten.length > 0 && ` · ${pct}% actief deze week`}
                              </p>
                            </div>
                            <div className="w-11 h-11 rounded-full flex items-center justify-center font-apercu font-bold text-caption"
                              style={{
                                backgroundColor: pct >= 70 ? '#0766C6' : pct >= 40 ? '#FF560D' : 'rgba(255,255,255,0.08)',
                                color: pct >= 40 ? '#fff' : '#8FA3B8',
                              }}>
                              {studenten.length > 0 ? `${pct}%` : '—'}
                            </div>
                          </div>

                          <div className="p-5">
                            {studenten.length === 0 ? (
                              <p className="font-apercu text-body-sm text-center py-2 mb-4" style={{ color: '#8FA3B8' }}>
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
                                        className="flex-1 flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.98] transition-transform duration-100"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-apercu font-bold text-body-sm flex-shrink-0"
                                          style={{ backgroundColor: actief ? '#0766C6' : 'rgba(255,255,255,0.15)' }}>
                                          {student.naam?.slice(0, 1)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-apercu font-bold text-white text-body-sm truncate">{student.naam}</p>
                                          <p className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>
                                            {student.instrument || '—'}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          <div className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: actief ? '#22C55E' : 'rgba(255,255,255,0.15)' }} />
                                          <span className="font-apercu text-caption" style={{ color: actief ? '#22C55E' : '#8FA3B8' }}>
                                            {actief ? `${aantalSessies}× deze week` : 'Inactief'}
                                          </span>
                                        </div>
                                      </button>
                                      <button onClick={() => verwijderStudent(klas.id, student.id)}
                                        title="Verwijder uit klas"
                                        className="w-9 h-9 rounded-xl flex items-center justify-center font-apercu text-body-sm flex-shrink-0"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#8FA3B8' }}>
                                        ✕
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {toonStudentKeuze === klas.id ? (
                              <div>
                                <p className="font-apercu font-bold text-caption mb-2" style={{ color: '#8FA3B8' }}>
                                  Student toevoegen aan {klas.naam}
                                </p>
                                {beschikbareStudenten.length === 0 ? (
                                  <p className="font-apercu text-caption py-2 text-center" style={{ color: '#8FA3B8' }}>
                                    Alle geregistreerde studenten zijn al toegevoegd.
                                  </p>
                                ) : (
                                  <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto mb-3">
                                    {beschikbareStudenten.map(s => (
                                      <button key={s.id} onClick={() => voegStudentToe(klas.id, s)}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl active:scale-[0.98] transition-transform duration-100"
                                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-apercu font-bold text-caption flex-shrink-0"
                                          style={{ backgroundColor: '#0766C6' }}>
                                          {s.naam?.slice(0, 1)}
                                        </div>
                                        <div>
                                          <span className="font-apercu font-bold text-body-sm text-white">{s.naam}</span>
                                          {s.instrument && (
                                            <span className="font-apercu text-caption ml-2" style={{ color: '#8FA3B8' }}>{s.instrument}</span>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <button onClick={() => setToonStudentKeuze(null)}
                                  className="font-apercu text-caption font-bold" style={{ color: '#8FA3B8' }}>
                                  Sluiten
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => laadBeschikbareStudenten(klas.id)}
                                className="w-full py-2.5 rounded-xl font-apercu font-bold text-body-sm"
                                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#0766C6' }}>
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
        </>
      )}

      <BottomNav />
    </main>
  )
}
