'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type Sessie = { id: string; student_id: string; duur: number; created_at: string; gevoel: string | null; partituren: { titel: string } | null }
type Klas = { id: string; naam: string; leraarNaam: string }
type LeraarKlas = { id: string; naam: string; aantalStudenten: number }
type LeraarPartituur = { id: string; titel: string; componist: string | null; created_at: string }

const NIVEAU_LABELS = ['Beginner', 'Gevorderd beginner', 'Intermediate', 'Gevorderd', 'Expert']

const GEVOEL_EMOJI: Record<string, string> = {
  'Super goed!': '🔥', 'Goed bezig': '😊', 'Oké': '😐', 'Moeilijk': '😓',
}

function berekenStreak(sessies: { created_at: string }[]): number {
  if (sessies.length === 0) return 0
  const dagen = [...new Set(sessies.map(s => s.created_at.slice(0, 10)))].sort().reverse()
  const vandaag = new Date().toISOString().slice(0, 10)
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dagen[0] !== vandaag && dagen[0] !== gisteren) return 0
  let streak = 1
  for (let i = 1; i < dagen.length; i++) {
    const diff = Math.round((new Date(dagen[i - 1]).getTime() - new Date(dagen[i]).getTime()) / 86400000)
    if (diff === 1) streak++
    else break
  }
  return streak
}

function berekenMaxStreak(sessies: { created_at: string }[]): number {
  if (sessies.length === 0) return 0
  const dagen = [...new Set(sessies.map(s => s.created_at.slice(0, 10)))].sort()
  let max = 1, huidig = 1
  for (let i = 1; i < dagen.length; i++) {
    const diff = Math.round((new Date(dagen[i]).getTime() - new Date(dagen[i - 1]).getTime()) / 86400000)
    if (diff === 1) { huidig++; max = Math.max(max, huidig) }
    else huidig = 1
  }
  return max
}

function formatDuur(s: number) {
  const m = Math.floor(s / 60)
  return m === 0 ? `${s}s` : `${m}min`
}

function tijdGeleden(datum: string): string {
  const diff = Math.floor((Date.now() - new Date(datum).getTime()) / 1000)
  if (diff < 3600) return `${Math.floor(diff / 60)}min geleden`
  if (diff < 86400) return `${Math.floor(diff / 3600)}u geleden`
  const dagen = Math.floor(diff / 86400)
  return dagen === 1 ? 'gisteren' : `${dagen}d geleden`
}

function dagIntensiteit(min: number): string {
  if (min === 0) return '#F3E7DD'
  if (min < 15) return '#bfdbfe'
  if (min < 30) return '#60a5fa'
  return '#0766C6'
}

const MIJLPALEN = [
  { id: 'eerste_sessie', label: 'Eerste stap', omschrijving: 'Eerste oefensessie', icon: '🎵', doel: (s: any[], ms: number) => [s.length, 1] as [number, number] },
  { id: 'drie_op_rij', label: '3 op een rij', omschrijving: '3 dagen achter elkaar', icon: '🔥', doel: (s: any[], ms: number) => [ms, 3] as [number, number] },
  { id: 'uur_totaal', label: 'Eerste uur', omschrijving: '1 uur geoefend', icon: '⏱️', doel: (s: any[], ms: number) => [Math.floor(s.reduce((a, x) => a + (x.duur || 0), 0) / 60), 60] as [number, number] },
  { id: 'tien_sessies', label: '10 sessies', omschrijving: '10 sessies afgerond', icon: '🎯', doel: (s: any[], ms: number) => [s.length, 10] as [number, number] },
  { id: 'week_op_rij', label: 'Weekkampioen', omschrijving: '7 dagen achter elkaar', icon: '💪', doel: (s: any[], ms: number) => [ms, 7] as [number, number] },
  { id: 'vijf_uur', label: '5 uur club', omschrijving: '5 uur geoefend', icon: '🌟', doel: (s: any[], ms: number) => [Math.floor(s.reduce((a, x) => a + (x.duur || 0), 0) / 60), 300] as [number, number] },
  { id: 'vijfentwintig', label: '25 sessies', omschrijving: '25 sessies afgerond', icon: '🏆', doel: (s: any[], ms: number) => [s.length, 25] as [number, number] },
  { id: 'tien_uur', label: '10 uur meester', omschrijving: '10 uur geoefend', icon: '💎', doel: (s: any[], ms: number) => [Math.floor(s.reduce((a, x) => a + (x.duur || 0), 0) / 60), 600] as [number, number] },
]

function checkMijlpaal(m: typeof MIJLPALEN[0], sessies: any[], maxStreak: number): boolean {
  const [huidig, doel] = m.doel(sessies, maxStreak)
  return huidig >= doel
}

export default function ProfielPagina() {
  const [userId, setUserId] = useState('')
  const [profiel, setProfiel] = useState<any>(null)
  const [eigenSessies, setEigenSessies] = useState<Sessie[]>([])
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [actieveTab, setActieveTab] = useState<'ik' | 'traject'>('ik')
  const [activeFilter, setActiveFilter] = useState<'eigen' | string>('eigen')
  const [klasSessies, setKlasSessies] = useState<Record<string, Sessie[]>>({})
  const [klasgenootMap, setKlasgenootMap] = useState<Record<string, string>>({})
  const [klasLaden, setKlasLaden] = useState(false)
  const [actieveChallenges, setActieveChallenges] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  // Leraar-specifiek
  const [leraarKlassen, setLeraarKlassen] = useState<LeraarKlas[]>([])
  const [leraarPartituren, setLeraarPartituren] = useState<LeraarPartituur[]>([])
  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profielData } = await supabase
        .from('profiles')
        .select('naam, instrument, academie, niveau, bio, favoriete_genres, role')
        .eq('id', user.id).single()
      setProfiel(profielData)

      // ===== LERAAR-specifieke data =====
      if (profielData?.role === 'leraar') {
        const [{ data: klassenData }, { data: partiturenData }] = await Promise.all([
          supabase.from('klassen').select('id, naam').eq('leraar_id', user.id).order('naam'),
          supabase.from('partituren').select('id, titel, componist, created_at')
            .eq('leraar_id', user.id).order('created_at', { ascending: false }).limit(6),
        ])
        const klasIds = (klassenData || []).map((k: any) => k.id)
        let aantallenMap: Record<string, number> = {}
        if (klasIds.length > 0) {
          const { data: ksData } = await supabase
            .from('klas_studenten').select('klas_id').in('klas_id', klasIds)
          for (const ks of (ksData || [])) {
            aantallenMap[(ks as any).klas_id] = (aantallenMap[(ks as any).klas_id] || 0) + 1
          }
        }
        setLeraarKlassen((klassenData || []).map((k: any) => ({
          id: k.id, naam: k.naam, aantalStudenten: aantallenMap[k.id] || 0
        })))
        setLeraarPartituren((partiturenData as any) || [])
        setLoading(false)
        return
      }

      const { data: sessiesData } = await supabase
        .from('oefensessies')
        .select('id, student_id, duur, gevoel, created_at, partituren(titel), challenges')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
      const sessies = (sessiesData as any) || []
      setEigenSessies(sessies)

      // Actieve challenges van meest recente sessie
      if (sessies.length > 0 && sessies[0].challenges) {
        try {
          const raw = typeof sessies[0].challenges === 'string'
            ? JSON.parse(sessies[0].challenges)
            : sessies[0].challenges
          // Normalize: studio slaat string[] op, oudere data kan { challenge: string }[] zijn
          const normalized: string[] = (raw || []).map((c: any) =>
            typeof c === 'string' ? c : (c.challenge ?? '')
          ).filter(Boolean)
          setActieveChallenges(normalized)
        } catch { /* stille fout */ }
      }

      // Klassen ophalen met leraar naam
      const { data: ksData } = await supabase
        .from('klas_studenten').select('klas_id').eq('student_id', user.id)
      const klasIds = (ksData || []).map((k: any) => k.klas_id)
      if (klasIds.length > 0) {
        const { data: klassenData } = await supabase
          .from('klassen').select('id, naam, leraar_id').in('id', klasIds).order('naam')
        const leraarIds = [...new Set((klassenData || []).map((k: any) => k.leraar_id).filter(Boolean))]
        let leraarMap: Record<string, string> = {}
        if (leraarIds.length > 0) {
          const { data: leraarProfielen } = await supabase
            .from('profiles').select('id, naam').in('id', leraarIds)
          leraarProfielen?.forEach((p: any) => { leraarMap[p.id] = p.naam })
        }
        setKlassen((klassenData || []).map((k: any) => ({
          id: k.id, naam: k.naam, leraarNaam: leraarMap[k.leraar_id] || 'Leraar'
        })))
      }

      setLoading(false)
    }
    haalOp()
  }, [router])

  const laadKlasSessies = async (klasId: string) => {
    if (klasSessies[klasId]) return
    setKlasLaden(true)
    const { data: ksData } = await supabase
      .from('klas_studenten').select('student_id').eq('klas_id', klasId)
    const studentIds = (ksData || []).map((k: any) => k.student_id)
    const { data: profielen } = await supabase
      .from('profiles').select('id, naam').in('id', studentIds)
    const pMap: Record<string, string> = {}
    profielen?.forEach((p: any) => { pMap[p.id] = p.naam })
    setKlasgenootMap(prev => ({ ...prev, ...pMap }))
    const { data: sessiesData } = await supabase
      .from('oefensessies')
      .select('id, student_id, duur, created_at, partituren(titel)')
      .in('student_id', studentIds)
      .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(40)
    setKlasSessies(prev => ({ ...prev, [klasId]: (sessiesData as any) || [] }))
    setKlasLaden(false)
  }

  const selecteerFilter = (filter: 'eigen' | string) => {
    setActiveFilter(filter)
    if (filter !== 'eigen') laadKlasSessies(filter)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  // ===== LERAAR VIEW =====
  if (profiel?.role === 'leraar') {
    const bio: string = profiel?.bio || ''
    return (
      <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>
        {/* Blauwe header */}
        <div style={{ backgroundColor: '#0766C6' }}>
          <div className="max-w-2xl mx-auto px-6 pt-10 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  {profiel?.naam?.slice(0, 1)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{profiel?.naam}</h1>
                  <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>
                    {profiel?.instrument ? `${profiel.instrument}` : 'Instrumentleraar'}
                    {profiel?.academie ? ` · ${profiel.academie}` : ''}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff' }}>
                      {leraarPartituren.length} partituren
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff' }}>
                      {leraarKlassen.length} klas{leraarKlassen.length !== 1 ? 'sen' : ''}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff' }}>
                      {leraarKlassen.reduce((a, k) => a + k.aantalStudenten, 0)} studenten
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => router.push('/profiel/bewerken')}
                className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium mt-1"
                style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff' }}>
                ✏️
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 mt-5 flex flex-col gap-5">

          {/* Bio */}
          {bio ? (
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#888' }}>Over mij</p>
              <p className="text-sm leading-relaxed italic" style={{ color: '#444' }}>"{bio}"</p>
            </div>
          ) : (
            <button onClick={() => router.push('/profiel/bewerken')}
              className="w-full rounded-2xl p-5 text-left"
              style={{ backgroundColor: '#fff', border: '2px dashed #D4C5BB' }}>
              <p className="font-semibold text-sm mb-0.5" style={{ color: '#888' }}>Vertel wie jij bent als leraar</p>
              <p className="text-xs" style={{ color: '#bbb' }}>Voeg een bio toe →</p>
            </button>
          )}

          {/* Lesmateriaal */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>Lesmateriaal</p>
              <button onClick={() => router.push('/partituren')}
                className="text-xs font-medium" style={{ color: '#0766C6' }}>
                Alle bekijken →
              </button>
            </div>
            {leraarPartituren.length === 0 ? (
              <div className="px-5 pb-5">
                <p className="text-sm" style={{ color: '#bbb' }}>Nog geen partituren geüpload.</p>
                <button onClick={() => router.push('/partituren/nieuw')}
                  className="mt-3 px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ backgroundColor: '#0766C6' }}>
                  + Partituur uploaden
                </button>
              </div>
            ) : (
              <div className="px-5 pb-5 flex flex-col gap-2">
                {leraarPartituren.map(p => (
                  <button key={p.id} onClick={() => router.push(`/partituren/${p.id}`)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl transition-transform hover:scale-[1.01]"
                    style={{ backgroundColor: '#F3E7DD' }}>
                    <div className="w-1 self-stretch rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#0766C6' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#0766C6' }}>{p.titel}</p>
                      {p.componist && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#888' }}>{p.componist}</p>
                      )}
                    </div>
                    <p className="text-xs flex-shrink-0" style={{ color: '#bbb' }}>
                      {new Date(p.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mijn klassen */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>Mijn klassen</p>
              <button onClick={() => router.push('/venster')}
                className="text-xs font-medium" style={{ color: '#0766C6' }}>
                Beheren →
              </button>
            </div>
            {leraarKlassen.length === 0 ? (
              <div className="px-5 pb-5">
                <p className="text-sm" style={{ color: '#bbb' }}>Nog geen klassen aangemaakt.</p>
              </div>
            ) : (
              <div className="px-5 pb-5 flex flex-col gap-2">
                {leraarKlassen.map(klas => (
                  <div key={klas.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F3E7DD' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: '#0766C6' }}>
                      {klas.naam.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#333' }}>{klas.naam}</p>
                      <p className="text-xs" style={{ color: '#888' }}>
                        {klas.aantalStudenten} student{klas.aantalStudenten !== 1 ? 'en' : ''}
                      </p>
                    </div>
                    <button onClick={() => router.push('/venster')}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ backgroundColor: '#fff', color: '#0766C6' }}>
                      Bekijk →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        <BottomNav />
      </main>
    )
  }

  const niveau = profiel?.niveau || 3
  const streak = berekenStreak(eigenSessies)
  const maxStreak = berekenMaxStreak(eigenSessies)
  const totaalSeconden = eigenSessies.reduce((a, s) => a + (s.duur || 0), 0)
  const totaalMinuten = Math.floor(totaalSeconden / 60)
  const totaalUur = Math.floor(totaalMinuten / 60)
  const restMinuten = totaalMinuten % 60

  const minutenPerDag: Record<string, number> = {}
  for (const s of eigenSessies) {
    const dag = s.created_at.slice(0, 10)
    minutenPerDag[dag] = (minutenPerDag[dag] || 0) + Math.floor((s.duur || 0) / 60)
  }
  const dagen84 = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (83 - i)); return d.toISOString().slice(0, 10)
  })
  const weken12 = Array.from({ length: 12 }, (_, w) => dagen84.slice(w * 7, w * 7 + 7))

  const volgendeMijlpaal = MIJLPALEN.find(m => !checkMijlpaal(m, eigenSessies, maxStreak))
  const volgendeMijlpaalProgress = volgendeMijlpaal
    ? volgendeMijlpaal.doel(eigenSessies, maxStreak)
    : null

  const feedSessies: (Sessie & { isEigen: boolean })[] = activeFilter === 'eigen'
    ? eigenSessies.slice(0, 20).map(s => ({ ...s, isEigen: true }))
    : (klasSessies[activeFilter] || []).map(s => ({ ...s, isEigen: s.student_id === userId }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const behaaldeMijlpalen = MIJLPALEN.filter(m => checkMijlpaal(m, eigenSessies, maxStreak))
  const genres: string[] = profiel?.favoriete_genres || []
  const bio: string = profiel?.bio || ''

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>

      {/* Header — enkel tab-navigatie, geen herhaalde profielinfo */}
      <div style={{ backgroundColor: '#0766C6' }}>
        <div className="max-w-2xl mx-auto px-6 pt-10 pb-4">
          <div className="flex gap-1"
            style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '14px', padding: '3px' }}>
            {([['ik', 'Ik'], ['traject', 'Mijn traject']] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActieveTab(tab)}
                className="flex-1 py-2 text-sm font-semibold rounded-xl transition-all"
                style={{
                  backgroundColor: actieveTab === tab ? '#fff' : 'transparent',
                  color: actieveTab === tab ? '#0766C6' : 'rgba(255,255,255,0.7)',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-5 flex flex-col gap-4">

        {/* ===== TAB: IK ===== */}
        {actieveTab === 'ik' && (
          <>
            {/* Profiel kaart — avatar, bio, info */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
              <div className="flex items-start gap-4 p-5">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0766C6 0%, #1e90ff 100%)' }}>
                  {profiel?.naam?.slice(0, 1)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold leading-tight" style={{ color: '#222' }}>
                    {profiel?.naam}
                  </h2>
                  {profiel?.instrument && (
                    <p className="text-sm mt-0.5" style={{ color: '#555' }}>{profiel.instrument}</p>
                  )}
                  {profiel?.academie && (
                    <p className="text-xs mt-0.5" style={{ color: '#aaa' }}>{profiel.academie}</p>
                  )}
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: '#0766C6', color: '#fff' }}>
                      {NIVEAU_LABELS[(profiel?.niveau || 3) - 1]}
                    </span>
                    {streak > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: '#FF560D', color: '#fff' }}>
                        🔥 {streak}d op rij
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => router.push('/profiel/bewerken')}
                  className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm mt-0.5"
                  style={{ backgroundColor: '#F3E7DD', color: '#888' }}>
                  ✏️
                </button>
              </div>

              {/* Bio */}
              {bio ? (
                <div className="px-5 pb-4" style={{ borderTop: '1px solid #F3E7DD' }}>
                  <p className="text-sm leading-relaxed italic pt-4" style={{ color: '#555' }}>"{bio}"</p>
                </div>
              ) : (
                <div className="px-5 pb-4" style={{ borderTop: '1px solid #F3E7DD' }}>
                  <button onClick={() => router.push('/profiel/bewerken')}
                    className="text-xs pt-3 block" style={{ color: '#bbb' }}>
                    + Voeg een bio toe →
                  </button>
                </div>
              )}

              {/* Favoriete genres */}
              {genres.length > 0 && (
                <div className="px-5 pb-5" style={{ borderTop: '1px solid #F3E7DD' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mt-4 mb-2.5" style={{ color: '#bbb' }}>
                    Muziekstijlen
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {genres.map(g => (
                      <span key={g} className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mini statistieken */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#0766C6' }}>
                <p className="text-2xl font-bold text-white">{eigenSessies.length}</p>
                <p className="text-xs mt-1" style={{ color: '#93c5fd' }}>Sessies</p>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#fff' }}>
                <p className="text-xl font-bold" style={{ color: '#0766C6' }}>
                  {totaalUur > 0 ? `${totaalUur}u${restMinuten > 0 ? ` ${restMinuten}m` : ''}` : `${totaalMinuten}m`}
                </p>
                <p className="text-xs mt-1" style={{ color: '#888' }}>Geoefend</p>
              </div>
              <div className="rounded-2xl p-4 text-center"
                style={{ backgroundColor: streak > 0 ? '#FF560D' : '#fff' }}>
                <p className="text-2xl font-bold"
                  style={{ color: streak > 0 ? '#fff' : '#bbb' }}>
                  {streak > 0 ? `🔥 ${streak}` : '—'}
                </p>
                <p className="text-xs mt-1"
                  style={{ color: streak > 0 ? '#ffd0b5' : '#bbb' }}>Streak</p>
              </div>
            </div>

            {/* Groepen */}
            {klassen.length > 0 ? (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#888' }}>
                    Mijn groepen
                  </p>
                  <div className="flex flex-col gap-2">
                    {klassen.map(klas => (
                      <div key={klas.id} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ backgroundColor: '#F3E7DD' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: '#0766C6' }}>
                          {klas.naam.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#333' }}>{klas.naam}</p>
                          <p className="text-xs" style={{ color: '#888' }}>Leraar: {klas.leraarNaam}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff', border: '2px dashed #D4C5BB' }}>
                <p className="text-sm font-semibold mb-0.5" style={{ color: '#888' }}>Nog geen groepen</p>
                <p className="text-xs" style={{ color: '#bbb' }}>Je leraar voegt jou toe aan een klas.</p>
              </div>
            )}

            {/* Laatste behaalde badges */}
            {behaaldeMijlpalen.length > 0 ? (
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
                    Behaalde badges
                  </p>
                  <button onClick={() => setActieveTab('traject')}
                    className="text-xs font-medium" style={{ color: '#0766C6' }}>
                    Alle {behaaldeMijlpalen.length} →
                  </button>
                </div>
                <div className="flex gap-3">
                  {[...behaaldeMijlpalen].reverse().slice(0, 3).map(m => (
                    <div key={m.id} className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl"
                      style={{ backgroundColor: '#F3E7DD' }}>
                      <span style={{ fontSize: '26px' }}>{m.icon}</span>
                      <p className="text-xs font-semibold text-center leading-tight"
                        style={{ color: '#0766C6' }}>
                        {m.label}
                      </p>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 3 - behaaldeMijlpalen.length) }).map((_, i) => (
                    <div key={`leeg-${i}`} className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl"
                      style={{ backgroundColor: '#F3E7DD', opacity: 0.35 }}>
                      <span style={{ fontSize: '26px', filter: 'grayscale(1)' }}>🏆</span>
                      <p className="text-xs text-center leading-tight" style={{ color: '#bbb' }}>Nog te halen</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <button onClick={() => setActieveTab('traject')}
                className="w-full rounded-2xl p-5 text-left"
                style={{ backgroundColor: '#fff', border: '2px dashed #D4C5BB' }}>
                <p className="font-semibold text-sm mb-0.5" style={{ color: '#888' }}>
                  Nog geen badges behaald
                </p>
                <p className="text-xs" style={{ color: '#bbb' }}>
                  Start je eerste oefensessie om badges te verdienen →
                </p>
              </button>
            )}
          </>
        )}

        {/* ===== TAB: MIJN TRAJECT ===== */}
        {actieveTab === 'traject' && (
          <>

            {/* ── Laatste oefensessie ── */}
            {eigenSessies.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                <div className="h-1" style={{ backgroundColor: '#FF560D' }} />
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                    style={{ color: '#aaa', letterSpacing: '0.05em' }}>
                    Laatste sessie
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base truncate" style={{ color: '#222' }}>
                        {eigenSessies[0].partituren?.titel || 'Vrije sessie'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: '#F3E7DD', color: '#555' }}>
                          ⏱ {formatDuur(eigenSessies[0].duur || 0)}
                        </span>
                        <span className="text-xs" style={{ color: '#bbb' }}>
                          {tijdGeleden(eigenSessies[0].created_at)}
                        </span>
                      </div>
                    </div>
                    {eigenSessies[0].gevoel
                      ? <span className="text-3xl flex-shrink-0">{GEVOEL_EMOJI[eigenSessies[0].gevoel] || '🎵'}</span>
                      : <span className="text-2xl flex-shrink-0">🎵</span>
                    }
                  </div>
                  <button onClick={() => router.push(`/sessies/${eigenSessies[0].id}`)}
                    className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: '#FF560D' }}>
                    Bekijk sessie →
                  </button>
                </div>
              </div>
            )}

            {/* ── Niveau + Volgende mijlpaal — gecombineerd ── */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
              {/* Niveau */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: '#aaa', letterSpacing: '0.05em' }}>
                    Niveau
                  </p>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: '#0766C6', color: '#fff' }}>
                    {NIVEAU_LABELS[niveau - 1]}
                  </span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} style={{
                      flex: 1, height: '8px', borderRadius: '4px',
                      backgroundColor: n <= niveau ? '#0766C6' : '#F3E7DD',
                    }} />
                  ))}
                </div>
              </div>

              {/* Scheiding */}
              {volgendeMijlpaal && volgendeMijlpaalProgress && (
                <>
                  <div style={{ height: '1px', backgroundColor: '#F3E7DD', margin: '0 20px' }} />

                  {/* Volgende mijlpaal */}
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                      style={{ color: '#aaa', letterSpacing: '0.05em' }}>
                      Volgende mijlpaal
                    </p>
                    <div className="flex items-center gap-3 mb-3">
                      <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>
                        {volgendeMijlpaal.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: '#222' }}>
                          {volgendeMijlpaal.label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                          {volgendeMijlpaal.omschrijving}
                        </p>
                      </div>
                      <p className="text-lg font-bold flex-shrink-0" style={{ color: '#0766C6' }}>
                        {Math.min(volgendeMijlpaalProgress[0], volgendeMijlpaalProgress[1])}
                        <span className="text-sm font-normal" style={{ color: '#bbb' }}>
                          /{volgendeMijlpaalProgress[1]}
                        </span>
                      </p>
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F3E7DD' }}>
                      <div className="h-full rounded-full"
                        style={{
                          backgroundColor: '#0766C6',
                          width: `${Math.min(100, (volgendeMijlpaalProgress[0] / volgendeMijlpaalProgress[1]) * 100)}%`,
                        }} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Actieve challenges ── */}
            {actieveChallenges.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                <div className="p-5 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: '#aaa', letterSpacing: '0.05em' }}>
                    Actieve challenges
                  </p>
                </div>
                <div className="px-5 pb-5 flex flex-col gap-2">
                  {actieveChallenges.map((tekst, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ backgroundColor: '#F3E7DD' }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: '#FF560D' }}>
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: '#444' }}>{tekst}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Oefenkalender ── */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
              <div className="p-5 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wide mb-4"
                  style={{ color: '#aaa', letterSpacing: '0.05em' }}>
                  Afgelopen 12 weken
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'flex', gap: '3px', minWidth: 'max-content', paddingBottom: '2px' }}>
                    {weken12.map((week, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {week.map(dag => {
                          const min = minutenPerDag[dag] || 0
                          const isVandaag = dag === new Date().toISOString().slice(0, 10)
                          return (
                            <div key={dag} title={min > 0 ? `${dag}: ${min}min` : dag} style={{
                              width: '15px', height: '15px', borderRadius: '3px',
                              backgroundColor: dagIntensiteit(min),
                              outline: isVandaag ? '2px solid #0766C6' : 'none',
                              outlineOffset: '1px',
                            }} />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 flex-wrap">
                  {([['#F3E7DD', 'Geen'], ['#bfdbfe', '< 15m'], ['#60a5fa', '15–30m'], ['#0766C6', '30m+']] as const).map(([kleur, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div style={{
                        width: 11, height: 11, borderRadius: 3,
                        backgroundColor: kleur,
                        border: kleur === '#F3E7DD' ? '1px solid #ddd' : 'none',
                      }} />
                      <span className="text-xs" style={{ color: '#aaa' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Mijlpalen — grid ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: '#aaa', letterSpacing: '0.05em' }}>
                  Mijlpalen
                </p>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#0766C6', color: '#fff' }}>
                  {behaaldeMijlpalen.length} / {MIJLPALEN.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {MIJLPALEN.map(m => {
                  const unlocked = checkMijlpaal(m, eigenSessies, maxStreak)
                  const [huidig, doel] = m.doel(eigenSessies, maxStreak)
                  const pct = Math.min(100, Math.round((huidig / doel) * 100))
                  return (
                    <div key={m.id} className="rounded-2xl p-4"
                      style={{ backgroundColor: unlocked ? '#fff' : '#F3E7DD', opacity: unlocked ? 1 : 0.65 }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ fontSize: '22px', filter: unlocked ? 'none' : 'grayscale(1)' }}>
                          {m.icon}
                        </span>
                        {unlocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: '#0766C6', color: '#fff' }}>✓</span>
                        )}
                      </div>
                      <p className="font-bold text-sm leading-tight mb-1"
                        style={{ color: unlocked ? '#0766C6' : '#bbb' }}>
                        {m.label}
                      </p>
                      <p className="text-xs leading-snug" style={{ color: unlocked ? '#666' : '#bbb' }}>
                        {m.omschrijving}
                      </p>
                      {!unlocked && (
                        <div className="w-full h-1.5 rounded-full overflow-hidden mt-2.5"
                          style={{ backgroundColor: '#D4C5BB' }}>
                          <div className="h-full rounded-full"
                            style={{ backgroundColor: '#0766C6', width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Activiteitsfeed ── */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
              <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid #F3E7DD' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                  style={{ color: '#aaa', letterSpacing: '0.05em' }}>
                  Activiteit
                </p>
                <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {[{ id: 'eigen', label: 'Mijn sessies' }, ...klassen.map(k => ({ id: k.id, label: k.naam }))].map(f => (
                    <button key={f.id} onClick={() => selecteerFilter(f.id as any)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: activeFilter === f.id ? '#0766C6' : '#F3E7DD',
                        color: activeFilter === f.id ? '#fff' : '#666',
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 flex flex-col gap-2">
                {klasLaden ? (
                  <p className="text-sm text-center py-6" style={{ color: '#bbb' }}>Laden...</p>
                ) : feedSessies.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: '#bbb' }}>
                    {activeFilter === 'eigen' ? 'Nog geen sessies.' : 'Nog geen activiteit in deze klas.'}
                  </p>
                ) : (
                  feedSessies.map(sessie => (
                    <button key={sessie.id}
                      onClick={() => sessie.isEigen ? router.push(`/sessies/${sessie.id}`) : undefined}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: '#F3E7DD', cursor: sessie.isEigen ? 'pointer' : 'default' }}>
                      <div className="w-1 self-stretch rounded-full flex-shrink-0"
                        style={{ backgroundColor: sessie.isEigen ? '#FF560D' : '#0766C6' }} />
                      <div className="flex-1 min-w-0">
                        {activeFilter !== 'eigen' && !sessie.isEigen && (
                          <p className="text-xs font-bold mb-0.5" style={{ color: '#0766C6' }}>
                            {klasgenootMap[sessie.student_id]?.split(' ')[0] || 'Klasgenoot'}
                          </p>
                        )}
                        <p className="text-sm font-semibold truncate" style={{ color: '#333' }}>
                          {sessie.partituren?.titel || 'Vrije sessie'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                          {formatDuur(sessie.duur || 0)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="text-xs" style={{ color: '#bbb' }}>{tijdGeleden(sessie.created_at)}</p>
                        {sessie.isEigen && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: '#FF560D', color: '#fff' }}>jij</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

          </>
        )}

      </div>
      <BottomNav />
    </main>
  )
}
