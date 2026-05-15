'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type SessieItem = {
  id: string
  student_id: string
  duur: number
  gevoel: string | null
  tops: string | null
  opname_url: string | null
  bpm: number | null
  created_at: string
  partituren: { titel: string; componist: string | null } | null
  isEigen: boolean
  studentNaam: string
  klasId: string | null
}

type Interactie = {
  id: string
  sessie_id: string
  auteur_id: string
  inhoud: string
  type: string
  created_at: string
  auteurNaam: string
}

type Klas = { id: string; naam: string }

const GEVOEL_EMOJI: Record<string, string> = {
  'Super goed!': '🔥', 'Goed bezig': '😊', 'Oké': '😐', 'Moeilijk': '😓',
}

function formatDuur(seconden: number): string {
  const u = Math.floor(seconden / 3600)
  const m = Math.floor((seconden % 3600) / 60)
  const s = seconden % 60
  if (u > 0) return `${u}u ${m}min`
  if (m > 0) return `${m}min`
  return `${s}s`
}

function formatTotaal(seconden: number): string {
  const u = Math.floor(seconden / 3600)
  const m = Math.floor((seconden % 3600) / 60)
  if (u > 0) return `${u}u ${m}min`
  return `${m}min`
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

function tijdGeleden(datum: string): string {
  const diff = Math.floor((Date.now() - new Date(datum).getTime()) / 1000)
  if (diff < 3600) return `${Math.floor(diff / 60)}min geleden`
  if (diff < 86400) return `${Math.floor(diff / 3600)}u geleden`
  const d = Math.floor(diff / 86400)
  return d === 1 ? 'gisteren' : `${d}d geleden`
}

function datumLabel(datum: string): string {
  const vandaag = new Date().toISOString().slice(0, 10)
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (datum === vandaag) return 'Vandaag'
  if (datum === gisteren) return 'Gisteren'
  return new Date(datum).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function SessiesPage() {
  const [userId, setUserId] = useState('')
  const [eigenSessies, setEigenSessies] = useState<SessieItem[]>([])
  const [groepSessies, setGroepSessies] = useState<SessieItem[]>([])
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [interacties, setInteracties] = useState<Interactie[]>([])
  const [profielNaamMap, setProfielNaamMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState<'eigen' | 'alles' | string>('eigen')
  const [periodeFilter, setPeriodeFilter] = useState<'week' | 'maand' | 'alles'>('maand')

  const [reactieTekst, setReactieTekst] = useState<Record<string, string>>({})
  const [reactieBezig, setReactieBezig] = useState(false)
  const [toonReactieInput, setToonReactieInput] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      // Eigen profiel naam
      const { data: eigenProfiel } = await supabase
        .from('profiles').select('naam').eq('id', user.id).single()
      const eigenNaam = eigenProfiel?.naam || 'Jij'

      // Eigen sessies (alles)
      const { data: eigenData } = await supabase
        .from('oefensessies')
        .select('id, student_id, duur, gevoel, tops, opname_url, bpm, created_at, partituren(titel, componist)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })

      const eigenItems: SessieItem[] = (eigenData || []).map((s: any) => ({
        ...s, isEigen: true, studentNaam: eigenNaam, klasId: null,
      }))
      setEigenSessies(eigenItems)

      // Klassen ophalen
      const { data: ksData } = await supabase
        .from('klas_studenten').select('klas_id').eq('student_id', user.id)
      const klasIds = (ksData || []).map((k: any) => k.klas_id)

      let alleGroepSessies: SessieItem[] = []
      let naamMap: Record<string, string> = {}

      if (klasIds.length > 0) {
        const { data: klassenData } = await supabase
          .from('klassen').select('id, naam').in('id', klasIds).order('naam')
        setKlassen(klassenData || [])

        // Alle student-IDs uit klassen ophalen
        const { data: alleKsData } = await supabase
          .from('klas_studenten').select('klas_id, student_id').in('klas_id', klasIds)

        const klasgenootIds = [...new Set(
          (alleKsData || []).map((k: any) => k.student_id).filter((id: string) => id !== user.id)
        )]

        if (klasgenootIds.length > 0) {
          // Profielen ophalen
          const { data: profielen } = await supabase
            .from('profiles').select('id, naam').in('id', klasgenootIds)
          profielen?.forEach((p: any) => { naamMap[p.id] = p.naam })

          // klas_id per student-ID (neem de eerste klas)
          const studentKlasMap: Record<string, string> = {}
          for (const ks of (alleKsData || [])) {
            if (!studentKlasMap[(ks as any).student_id]) {
              studentKlasMap[(ks as any).student_id] = (ks as any).klas_id
            }
          }

          // Sessies van klasgenoten (laatste 30 dagen)
          const maandGeleden = new Date(Date.now() - 30 * 86400000).toISOString()
          const { data: groepData } = await supabase
            .from('oefensessies')
            .select('id, student_id, duur, gevoel, tops, opname_url, bpm, created_at, partituren(titel, componist)')
            .in('student_id', klasgenootIds)
            .gte('created_at', maandGeleden)
            .order('created_at', { ascending: false })
            .limit(100)

          alleGroepSessies = (groepData || []).map((s: any) => ({
            ...s,
            isEigen: false,
            studentNaam: naamMap[s.student_id] || 'Klasgenoot',
            klasId: studentKlasMap[s.student_id] || null,
          }))
          setGroepSessies(alleGroepSessies)
        }
      }

      // Interacties ophalen voor eigen sessies + groepssessies
      setProfielNaamMap({ ...naamMap, [user.id]: eigenNaam })
      const alleIds = [
        ...eigenItems.map(s => s.id),
        ...alleGroepSessies.map(s => s.id),
      ]
      if (alleIds.length > 0) {
        const { data: feedbackData } = await supabase
          .from('feedback')
          .select('id, sessie_id, auteur_id, inhoud, type, created_at')
          .in('sessie_id', alleIds)

        const auteurIds = [...new Set((feedbackData || []).map((f: any) => f.auteur_id))]
        let auteurNaamMap: Record<string, string> = { ...naamMap, [user.id]: eigenNaam }
        if (auteurIds.filter(id => !auteurNaamMap[id]).length > 0) {
          const { data: auteurProfielen } = await supabase
            .from('profiles').select('id, naam').in('id', auteurIds)
          auteurProfielen?.forEach((p: any) => { auteurNaamMap[p.id] = p.naam })
        }

        setInteracties((feedbackData || []).map((f: any) => ({
          ...f, auteurNaam: auteurNaamMap[f.auteur_id] || 'Iemand',
        })))
        setProfielNaamMap(auteurNaamMap)
      }

      setLoading(false)
    }
    haalOp()
  }, [router])

  const geefReactie = async (sessieId: string, inhoud: string, type: string) => {
    if (!inhoud.trim()) return
    setReactieBezig(true)
    const { data } = await supabase
      .from('feedback')
      .insert({ sessie_id: sessieId, auteur_id: userId, inhoud: inhoud.trim(), type })
      .select('id, sessie_id, auteur_id, inhoud, type, created_at')
      .single()
    if (data) {
      setInteracties(prev => [...prev, { ...data, auteurNaam: profielNaamMap[userId] || 'Jij' }])
    }
    setReactieTekst(prev => ({ ...prev, [sessieId]: '' }))
    setToonReactieInput(null)
    setReactieBezig(false)
  }

  const heeftReactie = (sessieId: string, type: string) =>
    interacties.some(i => i.sessie_id === sessieId && i.auteur_id === userId && i.type === type)

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  const totaalTijd = eigenSessies.reduce((a, s) => a + (s.duur || 0), 0)
  const streak = berekenStreak(eigenSessies)

  // Periode grens bepalen
  const periodeGrens = periodeFilter === 'week'
    ? new Date(Date.now() - 7 * 86400000).toISOString()
    : periodeFilter === 'maand'
    ? new Date(Date.now() - 30 * 86400000).toISOString()
    : null

  // Feed samenstellen op basis van actieve filter
  let feedItems: SessieItem[] = []
  if (filter === 'eigen') {
    feedItems = periodeGrens
      ? eigenSessies.filter(s => s.created_at >= periodeGrens)
      : eigenSessies
  } else if (filter === 'alles') {
    const groepGefilterd = periodeGrens
      ? groepSessies.filter(s => s.created_at >= periodeGrens)
      : groepSessies
    const eigenGefilterd = periodeGrens
      ? eigenSessies.filter(s => s.created_at >= periodeGrens)
      : eigenSessies
    feedItems = [...eigenGefilterd, ...groepGefilterd]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else {
    // Filter op klasId
    const groepGefilterd = groepSessies.filter(s => s.klasId === filter &&
      (!periodeGrens || s.created_at >= periodeGrens))
    const eigenGefilterd = periodeGrens
      ? eigenSessies.filter(s => s.created_at >= periodeGrens)
      : eigenSessies
    feedItems = [...eigenGefilterd, ...groepGefilterd]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  // Groepeer op datum
  const groepen: Record<string, SessieItem[]> = {}
  for (const s of feedItems) {
    const dag = s.created_at.slice(0, 10)
    if (!groepen[dag]) groepen[dag] = []
    groepen[dag].push(s)
  }
  const gesorteerdeData = Object.keys(groepen).sort().reverse()

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>

      {/* Header */}
      <div style={{ backgroundColor: '#0766C6' }}>
        <div className="max-w-2xl mx-auto px-6 pt-10 pb-5">
          <h1 className="text-2xl font-bold text-white">Logboek</h1>
          <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>Jouw oefenactiviteit</p>

          {/* Activiteitsfilter — mijn / alles */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'eigen', label: 'Mijn sessies' },
              ...(groepSessies.length > 0 ? [{ id: 'alles', label: 'Alle activiteit' }] : []),
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id as any)}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: (filter === f.id || (f.id === 'alles' && filter !== 'eigen' && klassen.some(k => k.id === filter))) ? '#fff' : 'rgba(255,255,255,0.18)',
                  color: (filter === f.id || (f.id === 'alles' && filter !== 'eigen' && klassen.some(k => k.id === filter))) ? '#0766C6' : 'rgba(255,255,255,0.85)',
                }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Groepsfilter — per klas (enkel zichtbaar als groepen beschikbaar zijn) */}
          {klassen.length > 0 && filter !== 'eigen' && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <button onClick={() => setFilter('alles')}
                className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  backgroundColor: filter === 'alles' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)',
                  color: filter === 'alles' ? '#fff' : 'rgba(255,255,255,0.6)',
                  border: filter === 'alles' ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.2)',
                }}>
                Alle groepen
              </button>
              {klassen.map(k => (
                <button key={k.id} onClick={() => setFilter(k.id)}
                  className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor: filter === k.id ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)',
                    color: filter === k.id ? '#fff' : 'rgba(255,255,255,0.6)',
                    border: filter === k.id ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.2)',
                  }}>
                  {k.naam}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-5 flex flex-col gap-4">

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#0766C6' }}>
            <p className="text-2xl font-bold text-white">{eigenSessies.length}</p>
            <p className="text-xs mt-1" style={{ color: '#93c5fd' }}>Sessies</p>
          </div>
          <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: '#fff' }}>
            <p className="text-xl font-bold" style={{ color: '#0766C6' }}>{formatTotaal(totaalTijd)}</p>
            <p className="text-xs mt-1" style={{ color: '#888' }}>Totaal</p>
          </div>
          <div className="rounded-2xl p-4 text-center"
            style={{ backgroundColor: streak > 0 ? '#FF560D' : '#fff' }}>
            <p className="text-2xl font-bold" style={{ color: streak > 0 ? '#fff' : '#bbb' }}>
              {streak > 0 ? `🔥 ${streak}` : '—'}
            </p>
            <p className="text-xs mt-1" style={{ color: streak > 0 ? '#ffd0b5' : '#bbb' }}>Streak</p>
          </div>
        </div>

        {/* Periode filter */}
        <div className="flex gap-2">
          {([['week', 'Deze week'], ['maand', 'Deze maand'], ['alles', 'Alles']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setPeriodeFilter(val)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                backgroundColor: periodeFilter === val ? '#333' : '#fff',
                color: periodeFilter === val ? '#fff' : '#888',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Feed */}
        {feedItems.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#fff' }}>
            <p className="text-4xl mb-3">🎵</p>
            <p className="font-semibold" style={{ color: '#333' }}>
              {filter === 'eigen' ? 'Nog geen sessies' : 'Geen activiteit gevonden'}
            </p>
            <p className="text-sm mt-1" style={{ color: '#888' }}>
              {filter === 'eigen'
                ? 'Start je eerste oefensessie vanuit het Oefenen-tabblad.'
                : 'Geen activiteit in deze periode of groep.'}
            </p>
            {filter === 'eigen' && (
              <button onClick={() => router.push('/partituren')}
                className="mt-4 px-6 py-3 rounded-2xl text-white font-semibold text-sm"
                style={{ backgroundColor: '#0766C6' }}>
                Naar oefenen
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {gesorteerdeData.map(dag => (
              <div key={dag}>
                {/* Datum scheiding */}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide flex-shrink-0"
                    style={{ color: '#888' }}>
                    {datumLabel(dag)}
                  </p>
                  <div className="flex-1 h-px" style={{ backgroundColor: '#e5e5e5' }} />
                  <p className="text-xs flex-shrink-0" style={{ color: '#bbb' }}>
                    {formatTotaal(groepen[dag].filter(s => s.isEigen).reduce((a, s) => a + (s.duur || 0), 0))}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {groepen[dag].map(sessie => {
                    const sessieInteracties = interacties.filter(i => i.sessie_id === sessie.id)
                    const kudos = sessieInteracties.filter(i => i.type === 'student_kudo')
                    const boosts = sessieInteracties.filter(i => i.type === 'student_boost')
                    const comments = sessieInteracties.filter(
                      i => i.type === 'student_reactie' || i.type === 'leraar_reactie'
                    )
                    const heeftKudo = heeftReactie(sessie.id, 'student_kudo')
                    const heeftBoost = heeftReactie(sessie.id, 'student_boost')
                    const laat = toonReactieInput === sessie.id

                    return (
                      <div key={sessie.id} className="rounded-2xl overflow-hidden shadow-sm"
                        style={{ backgroundColor: '#fff' }}>

                        {/* Gekleurde rand */}
                        <div className="h-1 w-full"
                          style={{ backgroundColor: sessie.isEigen ? '#FF560D' : '#0766C6' }} />

                        <div className="p-4">
                          {/* Student naam (als niet eigen) */}
                          {!sessie.isEigen && (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: '#0766C6' }}>
                                {sessie.studentNaam.slice(0, 1)}
                              </div>
                              <p className="text-xs font-bold" style={{ color: '#0766C6' }}>
                                {sessie.studentNaam}
                              </p>
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate"
                                style={{ color: sessie.isEigen ? '#FF560D' : '#0766C6' }}>
                                {sessie.partituren?.titel || 'Vrije sessie'}
                              </p>
                              {sessie.partituren?.componist && (
                                <p className="text-xs mt-0.5 truncate" style={{ color: '#888' }}>
                                  {sessie.partituren.componist}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {sessie.gevoel && (
                                <span className="text-lg">{GEVOEL_EMOJI[sessie.gevoel] || '🎵'}</span>
                              )}
                              <p className="text-xs" style={{ color: '#bbb' }}>
                                {new Date(sessie.created_at).toLocaleTimeString('nl-BE', {
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Chips */}
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                              ⏱ {formatDuur(sessie.duur || 0)}
                            </span>
                            {sessie.bpm && (
                              <span className="text-xs px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: '#F3E7DD', color: '#666' }}>
                                ♩ {sessie.bpm} BPM
                              </span>
                            )}
                            {sessie.opname_url && (
                              <span className="text-xs px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: '#F3E7DD', color: '#888' }}>
                                🎙 Opname
                              </span>
                            )}
                          </div>

                          {/* Tops quote */}
                          {sessie.tops && (
                            <p className="text-xs mt-2 italic leading-relaxed" style={{ color: '#555' }}>
                              "{sessie.tops.slice(0, 100)}{sessie.tops.length > 100 ? '…' : ''}"
                            </p>
                          )}
                        </div>

                        {/* Interacties — bestaande reacties */}
                        {(kudos.length > 0 || boosts.length > 0 || comments.length > 0) && (
                          <div className="px-4 pb-3 flex flex-col gap-2"
                            style={{ borderTop: '1px solid #F3E7DD' }}>
                            {/* Kudos + boosts tellers */}
                            {(kudos.length > 0 || boosts.length > 0) && (
                              <div className="flex gap-2 pt-3">
                                {kudos.length > 0 && (
                                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                                    style={{ backgroundColor: '#F3E7DD', color: '#555' }}>
                                    👍 {kudos.length}
                                    {kudos.length <= 3 && (
                                      <span className="ml-1" style={{ color: '#bbb' }}>
                                        {kudos.slice(0, 2).map(k => k.auteurNaam.split(' ')[0]).join(', ')}
                                      </span>
                                    )}
                                  </span>
                                )}
                                {boosts.length > 0 && (
                                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                                    style={{ backgroundColor: '#FFF0EB', color: '#FF560D' }}>
                                    🔥 {boosts.length}
                                    {boosts.length <= 3 && (
                                      <span className="ml-1" style={{ color: '#bbb' }}>
                                        {boosts.slice(0, 2).map(k => k.auteurNaam.split(' ')[0]).join(', ')}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Tekstcomments */}
                            {comments.map(c => (
                              <div key={c.id} className="flex items-start gap-2 pt-1">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: c.type === 'leraar_reactie' ? '#FF560D' : '#0766C6' }}>
                                  {c.auteurNaam.slice(0, 1)}
                                </div>
                                <div>
                                  <span className="text-xs font-semibold" style={{ color: '#333' }}>
                                    {c.auteurNaam.split(' ')[0]}
                                    {c.type === 'leraar_reactie' && (
                                      <span className="ml-1 text-xs font-normal" style={{ color: '#FF560D' }}>
                                        (leraar)
                                      </span>
                                    )}
                                  </span>
                                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#555' }}>
                                    {c.inhoud}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Interactie-acties */}
                        <div className="px-4 py-3 flex items-center gap-2"
                          style={{ borderTop: '1px solid #F3E7DD' }}>
                          {/* Kudo */}
                          <button
                            onClick={() => !heeftKudo && geefReactie(sessie.id, '👍', 'student_kudo')}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                            style={{
                              backgroundColor: heeftKudo ? '#0766C6' : '#F3E7DD',
                              color: heeftKudo ? '#fff' : '#555',
                            }}>
                            👍 {heeftKudo ? 'Gegeven' : 'Kudo'}
                          </button>

                          {/* Boost */}
                          <button
                            onClick={() => !heeftBoost && geefReactie(sessie.id, '🔥', 'student_boost')}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                            style={{
                              backgroundColor: heeftBoost ? '#FF560D' : '#F3E7DD',
                              color: heeftBoost ? '#fff' : '#555',
                            }}>
                            🔥 {heeftBoost ? 'Geboosted' : 'Boost'}
                          </button>

                          {/* Reactie toggle */}
                          <button
                            onClick={() => setToonReactieInput(laat ? null : sessie.id)}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                            style={{ backgroundColor: '#F3E7DD', color: '#555' }}>
                            💬
                          </button>

                          {/* Naar detail (eigen) */}
                          {sessie.isEigen && (
                            <button onClick={() => router.push(`/sessies/${sessie.id}`)}
                              className="ml-auto text-xs font-medium flex-shrink-0"
                              style={{ color: '#0766C6' }}>
                              Details →
                            </button>
                          )}
                        </div>

                        {/* Reactie input */}
                        {laat && (
                          <div className="px-4 pb-4 flex gap-2">
                            <input
                              type="text"
                              placeholder="Schrijf een reactie..."
                              value={reactieTekst[sessie.id] || ''}
                              onChange={e => setReactieTekst(prev => ({ ...prev, [sessie.id]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && reactieTekst[sessie.id]?.trim()) {
                                  geefReactie(sessie.id, reactieTekst[sessie.id], 'student_reactie')
                                }
                              }}
                              autoFocus
                              className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                              style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
                            <button
                              onClick={() => geefReactie(sessie.id, reactieTekst[sessie.id] || '', 'student_reactie')}
                              disabled={!reactieTekst[sessie.id]?.trim() || reactieBezig}
                              className="px-3 py-2 rounded-xl text-xs font-medium text-white"
                              style={{
                                backgroundColor: reactieTekst[sessie.id]?.trim() ? '#0766C6' : '#ccc',
                              }}>
                              Stuur
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
