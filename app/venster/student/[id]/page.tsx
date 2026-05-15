'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Sessie = {
  id: string
  student_id: string
  partituur_id: string
  duur: number
  bpm: number | null
  tops: string | null
  tips: string | null
  gevoel: string | null
  ai_feedback: string | null
  created_at: string
  partituren: { titel: string; componist: string | null } | null
}

type Reactie = {
  id: string
  sessie_id: string
  inhoud: string
  created_at: string
}

function berekenStreak(sessies: Sessie[]): number {
  if (sessies.length === 0) return 0
  const dagen = [...new Set(sessies.map(s => s.created_at.slice(0, 10)))].sort().reverse()
  const vandaag = new Date().toISOString().slice(0, 10)
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dagen[0] !== vandaag && dagen[0] !== gisteren) return 0
  let streak = 1
  for (let i = 1; i < dagen.length; i++) {
    const diff = Math.round(
      (new Date(dagen[i - 1]).getTime() - new Date(dagen[i]).getTime()) / 86400000
    )
    if (diff === 1) streak++
    else break
  }
  return streak
}

function formatDuur(seconden: number): string {
  const m = Math.floor(seconden / 60)
  const s = seconden % 60
  if (m === 0) return `${s}s`
  return `${m}min`
}

export default function VensterStudentPage() {
  const [student, setStudent] = useState<any>(null)
  const [sessies, setSessies] = useState<Sessie[]>([])
  const [reacties, setReacties] = useState<Reactie[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [reactieTekst, setReactieTekst] = useState<Record<string, string>>({})
  const [verstuurBezig, setVerstuurBezig] = useState(false)
  const [oefenprofiel, setOefenprofiel] = useState<string | null>(null)
  const [profielLaden, setProfielLaden] = useState(false)

  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profiel } = await supabase
        .from('profiles').select('*').eq('id', id).single()
      if (!profiel) { router.push('/venster'); return }
      setStudent(profiel)

      const { data: sessiesData } = await supabase
        .from('oefensessies')
        .select('id, student_id, partituur_id, duur, bpm, tops, tips, gevoel, ai_feedback, created_at, partituren(titel, componist)')
        .eq('student_id', id)
        .order('created_at', { ascending: false })
      const sessies = (sessiesData as any) || []
      setSessies(sessies)

      const sessieIds = sessies.map((s: Sessie) => s.id)
      if (sessieIds.length > 0) {
        const { data: reactiesData } = await supabase
          .from('feedback')
          .select('id, sessie_id, inhoud, created_at')
          .in('sessie_id', sessieIds)
          .eq('auteur_id', user.id)
        setReacties(reactiesData || [])
      }

      // Auto-genereer oefenprofiel als er sessies zijn
      if (sessies.length > 0) {
        setProfielLaden(true)
        try {
          const res = await fetch('/api/oefenprofiel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              naam: profiel.naam,
              instrument: profiel.instrument,
              niveau: profiel.niveau || 3,
              sessies: sessies.map((s: Sessie) => ({ duur: s.duur, tops: s.tops, tips: s.tips, gevoel: s.gevoel }))
            })
          })
          const profielData = await res.json()
          setOefenprofiel(profielData.profiel)
        } catch {
          setOefenprofiel(null)
        }
        setProfielLaden(false)
      }

      setLoading(false)
    }
    haalOp()
  }, [id, router])

  const stuurReactie = async (sessieId: string, type: 'duim' | 'tekst') => {
    const inhoud = type === 'duim' ? '👍' : reactieTekst[sessieId]
    if (!inhoud?.trim()) return
    setVerstuurBezig(true)
    const { data } = await supabase.from('feedback').insert({
      sessie_id: sessieId, auteur_id: userId,
      inhoud: inhoud.trim(), type: 'leraar_reactie'
    }).select('id, sessie_id, inhoud, created_at').single()
    if (data) setReacties(prev => [...prev, data])
    setReactieTekst(prev => ({ ...prev, [sessieId]: '' }))
    setVerstuurBezig(false)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )
  if (!student) return null

  const streak = berekenStreak(sessies)

  // 4-weken kalender (28 dagen, 4 rijen van 7)
  const vierWeken = Array.from({ length: 28 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (27 - i))
    return d.toISOString().slice(0, 10)
  })
  const geoefendeDagen = new Set(sessies.map(s => s.created_at.slice(0, 10)))
  const weken = Array.from({ length: 4 }, (_, w) => vierWeken.slice(w * 7, w * 7 + 7))
  const dagLabels = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

  return (
    <main className="min-h-screen pb-12" style={{ backgroundColor: '#F3E7DD' }}>

      {/* Blauwe header */}
      <div className="px-6 pt-10 pb-8" style={{ backgroundColor: '#0766C6' }}>
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.push('/venster')}
            className="mb-4 text-sm font-medium" style={{ color: '#93c5fd' }}>
            ← Venster
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              {student.naam?.slice(0, 1) || '?'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{student.naam}</h1>
              <p className="text-sm" style={{ color: '#bfdbfe' }}>
                {student.instrument || 'Instrument onbekend'}
                {streak > 0 && (
                  <span className="ml-2">· 🔥 {streak} dag{streak !== 1 ? 'en' : ''} op rij</span>
                )}
              </p>
            </div>
          </div>

          {/* Snelle stats */}
          <div className="flex gap-3 mt-5">
            <div className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              {sessies.length} sessies totaal
            </div>
            <div className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              {Math.round(sessies.reduce((a, s) => a + (s.duur || 0), 0) / 60)}min totaal
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-6 flex flex-col gap-5">

        {/* Oefenprofiel */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#333' }}>✦ AI Oefenprofiel</p>
          <p className="text-xs mb-3" style={{ color: '#888' }}>Gegenereerd op basis van alle sessiedata</p>
          {profielLaden ? (
            <p className="text-sm" style={{ color: '#bbb' }}>Profiel wordt opgesteld...</p>
          ) : oefenprofiel ? (
            <p className="text-sm leading-relaxed" style={{ color: '#444' }}>{oefenprofiel}</p>
          ) : (
            <p className="text-sm" style={{ color: '#bbb' }}>Nog geen sessies om te analyseren.</p>
          )}
        </div>

        {/* 4-weken activiteitskalender */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#333' }}>Activiteit — afgelopen 4 weken</p>

          {/* Dag-labels */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            {dagLabels.map(l => (
              <div key={l} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#bbb', fontWeight: 500 }}>
                {l}
              </div>
            ))}
          </div>

          {/* Weken */}
          <div className="flex flex-col gap-1">
            {weken.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', gap: '4px' }}>
                {week.map(dag => {
                  const geoefend = geoefendeDagen.has(dag)
                  const isVandaag = dag === new Date().toISOString().slice(0, 10)
                  return (
                    <div key={dag} style={{
                      flex: 1, aspectRatio: '1', borderRadius: '6px',
                      backgroundColor: geoefend ? '#0766C6' : '#F3E7DD',
                      border: isVandaag ? '2px solid #0766C6' : '2px solid transparent',
                      transition: 'background-color 0.15s',
                    }} title={dag} />
                  )
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#F3E7DD' }} />
              <span style={{ fontSize: '11px', color: '#bbb' }}>Niet geoefend</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#0766C6' }} />
              <span style={{ fontSize: '11px', color: '#bbb' }}>Geoefend</span>
            </div>
          </div>
        </div>

        {/* Sessies */}
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
          Sessies ({sessies.length})
        </p>

        {sessies.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#fff' }}>
            <p className="text-sm" style={{ color: '#888' }}>Nog geen sessies.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessies.map(sessie => {
              const sessieReacties = reacties.filter(r => r.sessie_id === sessie.id)
              const heeftDuim = sessieReacties.some(r => r.inhoud === '👍')
              const datum = new Date(sessie.created_at).toLocaleDateString('nl-BE', {
                day: 'numeric', month: 'short', year: 'numeric'
              })

              let aiFeedback: any = null
              try { if (sessie.ai_feedback) aiFeedback = JSON.parse(sessie.ai_feedback) } catch {}

              return (
                <div key={sessie.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                  <div className="flex">
                    <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: '#0766C6' }} />
                    <div className="flex-1 p-4">

                      {/* Sessie header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="font-bold text-sm" style={{ color: '#0766C6' }}>
                            {sessie.partituren?.titel || 'Vrije sessie'}
                          </p>
                          {sessie.partituren?.componist && (
                            <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                              {sessie.partituren.componist}
                            </p>
                          )}
                        </div>
                        <p className="text-xs flex-shrink-0" style={{ color: '#bbb' }}>{datum}</p>
                      </div>

                      {/* Chips */}
                      <div className="flex gap-2 mb-3">
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
                      </div>

                      {/* Tops van student */}
                      {sessie.tops && (
                        <p className="text-xs italic mb-3" style={{ color: '#555' }}>
                          "{sessie.tops.slice(0, 120)}{sessie.tops.length > 120 ? '…' : ''}"
                        </p>
                      )}

                      {/* AI motivatie preview */}
                      {aiFeedback?.motivatie && (
                        <div className="p-3 rounded-xl mb-3" style={{ backgroundColor: '#F3E7DD' }}>
                          <p className="text-xs" style={{ color: '#555' }}>
                            <span className="font-semibold" style={{ color: '#0766C6' }}>✦ AI — </span>
                            {aiFeedback.motivatie.slice(0, 100)}{aiFeedback.motivatie.length > 100 ? '…' : ''}
                          </p>
                        </div>
                      )}

                      {/* Bestaande reacties van leraar */}
                      {sessieReacties.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {sessieReacties.map(r => (
                            <span key={r.id} className="text-xs px-2.5 py-1 rounded-full font-medium"
                              style={{ backgroundColor: '#0766C6', color: '#fff' }}>
                              {r.inhoud}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Sessie bekijken */}
                      <div className="mb-3">
                        <button
                          onClick={() => router.push(`/sessies/${sessie.id}`)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-transform hover:scale-[1.02]"
                          style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                          Volledige sessie bekijken →
                        </button>
                      </div>

                      {/* Reactie controls */}
                      <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid #F3E7DD' }}>
                        <button
                          onClick={() => !heeftDuim && stuurReactie(sessie.id, 'duim')}
                          title={heeftDuim ? 'Al geliked' : 'Duim omhoog sturen'}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all flex-shrink-0"
                          style={{
                            backgroundColor: heeftDuim ? '#0766C6' : '#F3E7DD',
                            opacity: heeftDuim ? 1 : 0.8,
                          }}>
                          👍
                        </button>
                        <input type="text"
                          placeholder="Reactie sturen..."
                          value={reactieTekst[sessie.id] || ''}
                          onChange={(e) => setReactieTekst(prev => ({ ...prev, [sessie.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && stuurReactie(sessie.id, 'tekst')}
                          className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                          style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
                        <button
                          onClick={() => stuurReactie(sessie.id, 'tekst')}
                          disabled={!reactieTekst[sessie.id]?.trim() || verstuurBezig}
                          className="px-3 py-2 rounded-xl text-white text-xs font-medium flex-shrink-0"
                          style={{ backgroundColor: reactieTekst[sessie.id]?.trim() ? '#0766C6' : '#ccc' }}>
                          Stuur
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
