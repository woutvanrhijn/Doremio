'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import BottomNav from '@/components/BottomNav'

type Sessie = {
  id: string
  student_id: string
  duur: number
  created_at: string
  gevoel: string | null
  partituren: { titel: string; componist?: string | null } | null
}
type Klas = { id: string; naam: string; leraarNaam: string }
type LeraarKlas = { id: string; naam: string; aantalStudenten: number }
type LeraarPartituur = { id: string; titel: string; componist: string | null; created_at: string }
type Klasgenoot = { id: string; naam: string }

const NIVEAU_LABELS = ['Beginner', 'Gevorderd beginner', 'Intermediate', 'Gevorderd', 'Expert']

const MAAND_NAMEN = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
]
const DAG_NAMEN = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

const BANDLID_KLEUREN = [
  '#0766C6', '#FF560D', '#FFD100', '#0D1B2A', '#7C3AED', '#059669', '#DC2626',
]

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

function checkMijlpaal(m: typeof MIJLPALEN[0], sessies: any[], maxStreak: number): boolean {
  const [huidig, doel] = m.doel(sessies, maxStreak)
  return huidig >= doel
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

function dagKleur(datum: string, heeftSessie: boolean, vandaag: string): { bg: string; text: string } {
  if (datum === vandaag) return { bg: '#FFD100', text: '#0D1B2A' }
  if (heeftSessie) return { bg: '#0766C6', text: 'white' }
  const dagVdWeek = new Date(datum).getDay() // 0=Zo, 1=Ma, 3=Wo
  const isLesdag = dagVdWeek === 1 || dagVdWeek === 3 // Ma + Wo
  if (isLesdag && datum < vandaag) return { bg: '#FF560D', text: 'white' }
  if (datum > vandaag) return { bg: 'rgba(13,27,42,0.06)', text: 'rgba(13,27,42,0.28)' }
  return { bg: '#0D1B2A', text: 'white' }
}

// Build a calendar month grid: returns array of 6 weeks × 7 days (null = padding)
function bouwMaandKalender(jaar: number, maand: number): (string | null)[][] {
  const eerstedag = new Date(jaar, maand, 1)
  // getDay(): 0=Sun,1=Mon... convert to Mon-first: (d+6)%7
  const startOffset = (eerstedag.getDay() + 6) % 7
  const aantalDagen = new Date(jaar, maand + 1, 0).getDate()
  const cellen: (string | null)[] = []
  for (let i = 0; i < startOffset; i++) cellen.push(null)
  for (let d = 1; d <= aantalDagen; d++) {
    const datum = `${jaar}-${String(maand + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cellen.push(datum)
  }
  while (cellen.length % 7 !== 0) cellen.push(null)
  const weken: (string | null)[][] = []
  for (let i = 0; i < cellen.length; i += 7) weken.push(cellen.slice(i, i + 7))
  return weken
}

function PersonAvatar() {
  return (
    <div style={{
      width: 70,
      height: 70,
      backgroundColor: 'white',
      borderRadius: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0766C6" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      </svg>
    </div>
  )
}

export default function ProfielPagina() {
  const [userId, setUserId] = useState('')
  const [profiel, setProfiel] = useState<any>(null)
  const [eigenSessies, setEigenSessies] = useState<Sessie[]>([])
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [actieveTab, setActieveTab] = useState<'profiel' | 'traject'>('profiel')
  const [actieveChallenges, setActieveChallenges] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [bandleden, setBandleden] = useState<Klasgenoot[]>([])
  const [klasSessiesCount, setKlasSessiesCount] = useState(0)

  // Traject calendar state
  const now = new Date()
  const [kalenderJaar, setKalenderJaar] = useState(now.getFullYear())
  const [kalenderMaand, setKalenderMaand] = useState(now.getMonth())

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

      // ===== STUDENT data =====
      const { data: sessiesData } = await supabase
        .from('oefensessies')
        .select('id, student_id, duur, gevoel, created_at, partituren(titel, componist), challenges')
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

        // Bandleden ophalen (klasgenoten excl. zichzelf)
        const { data: alleKsData } = await supabase
          .from('klas_studenten').select('student_id').in('klas_id', klasIds)
        const andereStudentIds = [...new Set((alleKsData || [])
          .map((k: any) => k.student_id)
          .filter((id: string) => id !== user.id)
        )]
        if (andereStudentIds.length > 0) {
          const { data: bandledenData } = await supabase
            .from('profiles').select('id, naam').in('id', andereStudentIds)
          setBandleden((bandledenData as any) || [])

          // Sessies van klasgenoten afgelopen 7 dagen
          const zevenDagenGeleden = new Date(Date.now() - 7 * 86400000).toISOString()
          const { count } = await supabase
            .from('oefensessies')
            .select('id', { count: 'exact', head: true })
            .in('student_id', andereStudentIds)
            .gte('created_at', zevenDagenGeleden)
          setKlasSessiesCount(count || 0)
        }
      }

      setLoading(false)
    }
    haalOp()
  }, [router])

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6', fontFamily: 'var(--font-apercu)' }}>Laden...</p>
    </main>
  )

  // ===== LERAAR VIEW =====
  if (profiel?.role === 'leraar') {
    const bio: string = profiel?.bio || ''
    return (
      <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>
        <div style={{ backgroundColor: '#0766C6' }}>
          <div className="max-w-[430px] mx-auto px-6 pt-14 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-kiro)' }}>
                  {profiel?.naam?.slice(0, 1)?.toUpperCase() || '?'}
                </div>
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'white', fontFamily: 'var(--font-kiro)' }}>
                    {profiel?.naam}
                  </h1>
                  <p className="text-sm mt-0.5" style={{ color: '#93c5fd', fontFamily: 'var(--font-apercu)' }}>
                    {profiel?.instrument ? `${profiel.instrument}` : 'Instrumentleraar'}
                    {profiel?.academie ? ` · ${profiel.academie}` : ''}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[
                      `${leraarPartituren.length} partituren`,
                      `${leraarKlassen.length} klas${leraarKlassen.length !== 1 ? 'sen' : ''}`,
                      `${leraarKlassen.reduce((a, k) => a + k.aantalStudenten, 0)} studenten`,
                    ].map(label => (
                      <span key={label} className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff', fontFamily: 'var(--font-apercu)' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => router.push('/profiel/bewerken')}
                className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium mt-1"
                style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff', fontFamily: 'var(--font-apercu)' }}>
                ✏️
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[430px] mx-auto px-4 mt-5 flex flex-col gap-5">
          {bio ? (
            <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color: '#888', fontFamily: 'var(--font-apercu)' }}>
                Over mij
              </p>
              <p className="text-sm leading-relaxed italic"
                style={{ color: '#444', fontFamily: 'var(--font-apercu)' }}>
                "{bio}"
              </p>
            </div>
          ) : (
            <button onClick={() => router.push('/profiel/bewerken')}
              className="w-full rounded-2xl p-5 text-left"
              style={{ backgroundColor: '#fff', border: '2px dashed #D4C5BB' }}>
              <p className="font-semibold text-sm mb-0.5"
                style={{ color: '#888', fontFamily: 'var(--font-apercu)' }}>
                Vertel wie jij bent als leraar
              </p>
              <p className="text-xs" style={{ color: '#bbb', fontFamily: 'var(--font-apercu)' }}>Voeg een bio toe →</p>
            </button>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#888', fontFamily: 'var(--font-apercu)' }}>
                Lesmateriaal
              </p>
              <button onClick={() => router.push('/partituren')}
                className="text-xs font-medium" style={{ color: '#0766C6', fontFamily: 'var(--font-apercu)' }}>
                Alle bekijken →
              </button>
            </div>
            {leraarPartituren.length === 0 ? (
              <div className="px-5 pb-5">
                <p className="text-sm" style={{ color: '#bbb', fontFamily: 'var(--font-apercu)' }}>
                  Nog geen partituren geüpload.
                </p>
                <button onClick={() => router.push('/partituren/nieuw')}
                  className="mt-3 px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ backgroundColor: '#0766C6', fontFamily: 'var(--font-apercu)' }}>
                  + Partituur uploaden
                </button>
              </div>
            ) : (
              <div className="px-5 pb-5 flex flex-col gap-2">
                {leraarPartituren.map(p => (
                  <button key={p.id} onClick={() => router.push(`/partituren/${p.id}`)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F3E7DD' }}>
                    <div className="w-1 self-stretch rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#0766C6' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate"
                        style={{ color: '#0766C6', fontFamily: 'var(--font-apercu)' }}>
                        {p.titel}
                      </p>
                      {p.componist && (
                        <p className="text-xs mt-0.5 truncate"
                          style={{ color: '#888', fontFamily: 'var(--font-apercu)' }}>
                          {p.componist}
                        </p>
                      )}
                    </div>
                    <p className="text-xs flex-shrink-0"
                      style={{ color: '#bbb', fontFamily: 'var(--font-apercu)' }}>
                      {new Date(p.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: '#888', fontFamily: 'var(--font-apercu)' }}>
                Mijn klassen
              </p>
              <button onClick={() => router.push('/venster')}
                className="text-xs font-medium" style={{ color: '#0766C6', fontFamily: 'var(--font-apercu)' }}>
                Beheren →
              </button>
            </div>
            {leraarKlassen.length === 0 ? (
              <div className="px-5 pb-5">
                <p className="text-sm" style={{ color: '#bbb', fontFamily: 'var(--font-apercu)' }}>
                  Nog geen klassen aangemaakt.
                </p>
              </div>
            ) : (
              <div className="px-5 pb-5 flex flex-col gap-2">
                {leraarKlassen.map(klas => (
                  <div key={klas.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F3E7DD' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: '#0766C6', fontFamily: 'var(--font-kiro)' }}>
                      {klas.naam.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold"
                        style={{ color: '#333', fontFamily: 'var(--font-apercu)' }}>
                        {klas.naam}
                      </p>
                      <p className="text-xs" style={{ color: '#888', fontFamily: 'var(--font-apercu)' }}>
                        {klas.aantalStudenten} student{klas.aantalStudenten !== 1 ? 'en' : ''}
                      </p>
                    </div>
                    <button onClick={() => router.push('/venster')}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ backgroundColor: '#fff', color: '#0766C6', fontFamily: 'var(--font-apercu)' }}>
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

  // ===== STUDENT calculations =====
  const streak = berekenStreak(eigenSessies)
  const maxStreak = berekenMaxStreak(eigenSessies)
  const behaaldeMijlpalen = MIJLPALEN.filter(m => checkMijlpaal(m, eigenSessies, maxStreak))
  const genres: string[] = profiel?.favoriete_genres || []
  const bio: string = profiel?.bio || ''

  const minutenPerDag: Record<string, number> = {}
  for (const s of eigenSessies) {
    const dag = s.created_at.slice(0, 10)
    minutenPerDag[dag] = (minutenPerDag[dag] || 0) + Math.floor((s.duur || 0) / 60)
  }

  const vandaagStr = new Date().toISOString().slice(0, 10)
  const kalenderWeken = bouwMaandKalender(kalenderJaar, kalenderMaand)

  const recenteSessie = eigenSessies[0] || null

  // Shared top section
  const gedeeldHoofd = (
    <div style={{ backgroundColor: '#0766C6', paddingBottom: 24 }}>
      {/* Tab pills */}
      <div style={{ paddingTop: 'env(safe-area-inset-top, 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 0 }}>
        <div className="flex gap-2 pt-4 pb-4">
          <button
            onClick={() => setActieveTab('profiel')}
            style={{
              backgroundColor: actieveTab === 'profiel' ? '#FF560D' : 'rgba(0,0,0,0.25)',
              color: 'white',
              borderRadius: 999,
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-apercu)',
              border: 'none',
              cursor: 'pointer',
            }}>
            Profiel
          </button>
          <button
            onClick={() => setActieveTab('traject')}
            style={{
              backgroundColor: actieveTab === 'traject' ? '#FF560D' : 'rgba(0,0,0,0.25)',
              color: 'white',
              borderRadius: 999,
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-apercu)',
              border: 'none',
              cursor: 'pointer',
            }}>
            Mijn Traject
          </button>
        </div>
      </div>

      {/* Profile card */}
      <div className="mx-4 mt-0 flex items-start gap-4">
        <PersonAvatar />
        <div className="flex-1 min-w-0">
          <h2 style={{
            fontFamily: 'var(--font-kiro)',
            fontSize: 22,
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.2,
            margin: 0,
          }}>
            {profiel?.naam}
          </h2>
          {profiel?.instrument && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-apercu)', marginTop: 2 }}>
              {profiel.instrument}
            </p>
          )}
          {profiel?.academie && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-apercu)', marginTop: 1 }}>
              {profiel.academie}
            </p>
          )}
          {bio && (
            <p style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'var(--font-apercu)',
              fontStyle: 'italic',
              marginTop: 6,
              lineHeight: 1.4,
            }}>
              "{bio}"
            </p>
          )}
          {/* Tag pills: klassen + genres */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {klassen.map(k => (
              <span key={k.id} style={{
                backgroundColor: 'rgba(0,0,0,0.25)',
                color: 'white',
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 11,
                fontFamily: 'var(--font-apercu)',
                fontWeight: 500,
              }}>
                klas {k.naam}
              </span>
            ))}
            {genres.map(g => (
              <span key={g} style={{
                backgroundColor: 'rgba(0,0,0,0.25)',
                color: 'white',
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 11,
                fontFamily: 'var(--font-apercu)',
                fontWeight: 500,
              }}>
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stat rechthoeken */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, margin: '20px 16px 0' }}>
        {[
          { waarde: streak,                   label: 'Streak',    sub: 'dagen' },
          { waarde: eigenSessies.length,       label: 'Sessies',   sub: 'totaal' },
          { waarde: behaaldeMijlpalen.length,  label: 'Badges',    sub: 'behaald' },
          { waarde: bandleden.length,          label: 'Bandleden', sub: '' },
        ].map(stat => (
          <div key={stat.label} style={{
            backgroundColor: 'rgba(0,0,0,0.22)',
            borderRadius: 14,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}>
            <span style={{ fontFamily: 'var(--font-kiro)', fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1 }}>
              {stat.waarde}
            </span>
            <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.2 }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bandleden als gekleurde rechthoeken */}
      {bandleden.length > 0 && (
        <div style={{ marginTop: 20, paddingLeft: 16, paddingRight: 16 }}>
          <p style={{ fontFamily: 'var(--font-apercu)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Bandleden
          </p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {bandleden.map((lid, i) => (
              <div key={lid.id} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 72,
                  height: 92,
                  borderRadius: 16,
                  backgroundColor: BANDLID_KLEUREN[i % BANDLID_KLEUREN.length],
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 10,
                }}>
                  <span style={{ fontFamily: 'var(--font-kiro)', fontSize: 28, fontWeight: 700, color: 'white' }}>
                    {lid.naam?.slice(0, 1)?.toUpperCase() || '?'}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 10, color: 'rgba(255,255,255,0.8)', maxWidth: 72, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lid.naam?.split(' ')[0] || 'Lid'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ===== STUDENT VIEW =====
  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-[430px] mx-auto">

        {gedeeldHoofd}

        {/* ===== TAB: PROFIEL ===== */}
        {actieveTab === 'profiel' && (
          <div className="flex flex-col gap-4 px-4 mt-5">

            {/* Two action buttons */}
            <div className="flex gap-3">
              {/* New classmate sessions */}
              <button
                onClick={() => router.push('/sessies')}
                className="flex-1 rounded-2xl p-4 text-left flex flex-col justify-end"
                style={{ backgroundColor: '#0766C6', minHeight: 80 }}>
                <p style={{
                  fontFamily: 'var(--font-kiro)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'white',
                  lineHeight: 1,
                  margin: 0,
                }}>
                  {klasSessiesCount} nieuwe oefensessies
                </p>
              </button>
              {/* Mijn Band */}
              <button
                onClick={() => router.push('/sessies')}
                className="flex-1 rounded-2xl p-4 text-left flex flex-col justify-end"
                style={{ backgroundColor: '#FF560D', minHeight: 80 }}>
                <p style={{
                  fontFamily: 'var(--font-kiro)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'white',
                  lineHeight: 1,
                  margin: 0,
                }}>
                  Mijn Band →
                </p>
              </button>
            </div>

            {/* Recent activity card */}
            {recenteSessie && (
              <button
                onClick={() => router.push(`/sessies/${recenteSessie.id}`)}
                className="w-full rounded-2xl p-4 text-left flex items-center gap-4"
                style={{ backgroundColor: '#0D1B2A' }}>
                {/* Play button circle */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0D1B2A">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{
                    fontFamily: 'var(--font-apercu)',
                    fontSize: 14,
                    fontWeight: 700,
                    fontStyle: 'italic',
                    color: 'white',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    "{recenteSessie.partituren?.titel || 'Vrije sessie'}"
                    {recenteSessie.partituren?.componist ? (
                      <span style={{ fontWeight: 400, fontStyle: 'normal', color: 'rgba(255,255,255,0.75)' }}>
                        {' '}{recenteSessie.partituren.componist}
                      </span>
                    ) : null}
                  </p>
                  {klassen.length > 0 && (
                    <p style={{
                      fontFamily: 'var(--font-apercu)',
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.5)',
                      marginTop: 3,
                    }}>
                      Klas {klassen[0].naam} · {klassen[0].leraarNaam}
                    </p>
                  )}
                </div>
              </button>
            )}

            {/* Badges en Trofeën */}
            <div>
              <p style={{
                fontFamily: 'var(--font-kiro)',
                fontSize: 18,
                fontWeight: 700,
                color: '#0766C6',
                marginBottom: 10,
              }}>
                Badges en Trofeën
              </p>
              <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingBottom: 4 }}>
                {MIJLPALEN.map(m => {
                  const unlocked = checkMijlpaal(m, eigenSessies, maxStreak)
                  return (
                    <div key={m.id} className="flex-shrink-0 flex flex-col items-center gap-2">
                      <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 14,
                        backgroundColor: '#0D1B2A',
                        border: unlocked ? '2px solid #FFD100' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: unlocked ? 1 : 0.35,
                      }}>
                        {unlocked ? (
                          <svg width="36" height="36" viewBox="0 0 43 43" fill="none">
                            <path d="M35.481 35.5H35.5M35.481 35.5C34.2356 36.735 31.9786 36.4274 30.3959 36.4274C28.453 36.4274 27.5174 36.8074 26.1309 38.194C24.9502 39.3747 23.3675 41.5 21.5 41.5C19.6326 41.5 18.0498 39.3748 16.8691 38.194C15.4826 36.8074 14.547 36.4274 12.6041 36.4274C11.0214 36.4274 8.76437 36.735 7.51898 35.5C6.26362 34.2551 6.57256 31.9888 6.57256 30.3958C6.57256 28.3828 6.13231 27.4572 4.69876 26.0237C2.56627 23.8912 1.50003 22.8249 1.5 21.5C1.50002 20.175 2.56625 19.1088 4.69871 16.9763C5.9784 15.6966 6.57256 14.4286 6.57256 12.6041C6.57256 11.0213 6.26499 8.76429 7.5 7.51889C8.74485 6.26357 11.0112 6.57251 12.6042 6.57251C14.4285 6.57251 15.6966 5.97841 16.9763 4.69874C19.1088 2.56625 20.175 1.5 21.5 1.5C22.825 1.5 23.8912 2.56625 26.0237 4.69874C27.3031 5.97813 28.5709 6.57251 30.3958 6.57251C31.9787 6.57251 34.2357 6.26494 35.4811 7.5C36.7364 8.74486 36.4274 11.0112 36.4274 12.6041C36.4274 14.6172 36.8677 15.5427 38.3013 16.9763C40.4338 19.1088 41.5 20.175 41.5 21.5C41.5 22.8249 40.4337 23.8912 38.3012 26.0237C36.8677 27.4572 36.4274 28.3829 36.4274 30.3958C36.4274 31.9888 36.7364 34.2551 35.481 35.5Z" fill="#FFD100" stroke="#E6BC00" strokeWidth="1.5" />
                            <path d="M15.5 23.2857C15.5 23.2857 17.9 24.5893 19.1 26.5C19.1 26.5 22.7 19 27.5 16.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="36" height="36" viewBox="0 0 43 43" fill="none">
                            <path d="M35.481 35.5H35.5M35.481 35.5C34.2356 36.735 31.9786 36.4274 30.3959 36.4274C28.453 36.4274 27.5174 36.8074 26.1309 38.194C24.9502 39.3747 23.3675 41.5 21.5 41.5C19.6326 41.5 18.0498 39.3748 16.8691 38.194C15.4826 36.8074 14.547 36.4274 12.6041 36.4274C11.0214 36.4274 8.76437 36.735 7.51898 35.5C6.26362 34.2551 6.57256 31.9888 6.57256 30.3958C6.57256 28.3828 6.13231 27.4572 4.69876 26.0237C2.56627 23.8912 1.50003 22.8249 1.5 21.5C1.50002 20.175 2.56625 19.1088 4.69871 16.9763C5.9784 15.6966 6.57256 14.4286 6.57256 12.6041C6.57256 11.0213 6.26499 8.76429 7.5 7.51889C8.74485 6.26357 11.0112 6.57251 12.6042 6.57251C14.4285 6.57251 15.6966 5.97841 16.9763 4.69874C19.1088 2.56625 20.175 1.5 21.5 1.5C22.825 1.5 23.8912 2.56625 26.0237 4.69874C27.3031 5.97813 28.5709 6.57251 30.3958 6.57251C31.9787 6.57251 34.2357 6.26494 35.4811 7.5C36.7364 8.74486 36.4274 11.0112 36.4274 12.6041C36.4274 14.6172 36.8677 15.5427 38.3013 16.9763C40.4338 19.1088 41.5 20.175 41.5 21.5C41.5 22.8249 40.4337 23.8912 38.3012 26.0237C36.8677 27.4572 36.4274 28.3829 36.4274 30.3958C36.4274 31.9888 36.7364 34.2551 35.481 35.5Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                          </svg>
                        )}
                      </div>
                      <p style={{
                        fontFamily: 'var(--font-apercu)',
                        fontSize: 10,
                        color: unlocked ? '#0D1B2A' : '#aaa',
                        maxWidth: 64,
                        textAlign: 'center',
                        lineHeight: 1.2,
                      }}>
                        {m.label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* ===== TAB: MIJN TRAJECT ===== */}
        {actieveTab === 'traject' && (
          <div className="flex flex-col gap-4 px-4 mt-5">

            {/* Search bar */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: 999,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 14, color: '#bbb' }}>
                Zoek in traject...
              </span>
            </div>

            {/* Calendar */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: 20,
              padding: 16,
            }}>
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    if (kalenderMaand === 0) {
                      setKalenderMaand(11)
                      setKalenderJaar(y => y - 1)
                    } else {
                      setKalenderMaand(m => m - 1)
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: 18,
                    color: '#0D1B2A',
                  }}>
                  ←
                </button>
                <p style={{
                  fontFamily: 'var(--font-kiro)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#0D1B2A',
                }}>
                  {MAAND_NAMEN[kalenderMaand]} {kalenderJaar}
                </p>
                <button
                  onClick={() => {
                    if (kalenderMaand === 11) {
                      setKalenderMaand(0)
                      setKalenderJaar(y => y + 1)
                    } else {
                      setKalenderMaand(m => m + 1)
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: 18,
                    color: '#0D1B2A',
                  }}>
                  →
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAG_NAMEN.map(d => (
                  <div key={d} style={{
                    textAlign: 'center',
                    fontFamily: 'var(--font-apercu)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'rgba(13,27,42,0.4)',
                    paddingBottom: 4,
                  }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              {kalenderWeken.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                  {week.map((datum, di) => {
                    if (!datum) {
                      return <div key={di} style={{ height: 40 }} />
                    }
                    const heeftSessie = !!(minutenPerDag[datum] && minutenPerDag[datum] > 0)
                    const kleur = dagKleur(datum, heeftSessie, vandaagStr)
                    return (
                      <div key={datum} style={{
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: kleur.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-apercu)',
                          fontSize: 13,
                          fontWeight: datum === vandaagStr ? 700 : 400,
                          color: kleur.text,
                        }}>
                          {parseInt(datum.slice(8))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Stat cards horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingBottom: 4 }}>
              {/* Streak card */}
              <div className="flex-shrink-0 rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: '#0D1B2A', minWidth: 140 }}>
                <Image src="/icons/streak.svg" alt="streak" width={28} height={28} />
                <div>
                  <p style={{
                    fontFamily: 'var(--font-kiro)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'white',
                    lineHeight: 1,
                  }}>
                    {streak}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-apercu)',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.55)',
                    marginTop: 2,
                  }}>
                    Streak
                  </p>
                </div>
              </div>

              {/* Trofeeën card */}
              <div className="flex-shrink-0 rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: '#0D1B2A', minWidth: 140, border: '2px solid #FF560D' }}>
                <Image src="/icons/Medaille.svg" alt="medaille" width={28} height={28} />
                <div>
                  <p style={{
                    fontFamily: 'var(--font-kiro)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'white',
                    lineHeight: 1,
                  }}>
                    {behaaldeMijlpalen.length}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-apercu)',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.55)',
                    marginTop: 2,
                  }}>
                    Trofeën
                  </p>
                </div>
              </div>

              {/* Sessies count */}
              <div className="flex-shrink-0 rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: '#0D1B2A', minWidth: 140 }}>
                <Image src="/icons/Oefensessie.svg" alt="sessies" width={28} height={28} />
                <div>
                  <p style={{
                    fontFamily: 'var(--font-kiro)',
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'white',
                    lineHeight: 1,
                  }}>
                    {eigenSessies.length}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-apercu)',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.55)',
                    marginTop: 2,
                  }}>
                    Sessies
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation button cards */}
            <button
              onClick={() => router.push('/partituren')}
              className="w-full rounded-2xl p-5 text-left"
              style={{ backgroundColor: '#FF560D' }}>
              <p style={{
                fontFamily: 'var(--font-kiro)',
                fontSize: 18,
                fontWeight: 700,
                color: 'white',
              }}>
                Partituren
              </p>
              <p style={{
                fontFamily: 'var(--font-apercu)',
                fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
                marginTop: 4,
              }}>
                Bekijk al je bladmuziek →
              </p>
            </button>

            <button
              onClick={() => router.push('/sessies')}
              className="w-full rounded-2xl p-5 text-left"
              style={{ backgroundColor: '#FFD100' }}>
              <p style={{
                fontFamily: 'var(--font-kiro)',
                fontSize: 18,
                fontWeight: 700,
                color: '#0D1B2A',
              }}>
                Mijn Sessies
              </p>
              <p style={{
                fontFamily: 'var(--font-apercu)',
                fontSize: 13,
                color: 'rgba(13,27,42,0.55)',
                marginTop: 4,
              }}>
                Bekijk je oefenlogboek →
              </p>
            </button>

          </div>
        )}

      </div>
      <BottomNav />
    </main>
  )
}
