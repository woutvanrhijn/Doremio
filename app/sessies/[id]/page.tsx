'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

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
  opname_url: string | null
  status: string
  notities: string | null
  challenges: any[] | null
  created_at: string
  partituren: { id: string; titel: string; componist: string | null } | null
}

type AiFeedback = {
  tops?: string | string[]
  tips?: string | string[]
  motivatie?: string
  niveau_delta?: number
  nieuw_niveau?: number
}

type TijdAnnotatie = {
  tijdstip: number
  inhoud: string
}

type LeraarReactie = {
  id: string
  inhoud: string
  created_at: string
}

const GEVOEL_MAP: Record<string, { emoji: string; kleur: string }> = {
  'Super goed!': { emoji: '🔥', kleur: '#FF560D' },
  'Goed bezig': { emoji: '😊', kleur: '#0766C6' },
  'Oké': { emoji: '😐', kleur: '#888' },
  'Moeilijk': { emoji: '😓', kleur: '#FFD100' },
}

function formatDuur(seconden: number): string {
  const u = Math.floor(seconden / 3600)
  const m = Math.floor((seconden % 3600) / 60)
  const s = seconden % 60
  if (u > 0) return `${u}u ${m}min`
  if (m > 0) return `${m}min${s > 0 ? ` ${s}s` : ''}`
  return `${s}s`
}

function formatTijdstip(seconden: number): string {
  const m = Math.floor(seconden / 60)
  const s = seconden % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function SessieDetailPage() {
  const [sessie, setSessie] = useState<Sessie | null>(null)
  const [leraarReacties, setLeraarReacties] = useState<LeraarReactie[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { id } = useParams()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase
        .from('oefensessies')
        .select('*, partituren(id, titel, componist)')
        .eq('id', id)
        .eq('student_id', user.id)
        .single()

      if (!data) { router.push('/sessies'); return }
      setSessie(data)

      // Leraar reacties ophalen
      const { data: reactiesData } = await supabase
        .from('feedback')
        .select('id, inhoud, created_at')
        .eq('sessie_id', id)
        .eq('type', 'leraar_reactie')
        .order('created_at', { ascending: true })
      setLeraarReacties(reactiesData || [])

      setLoading(false)
    }
    haalOp()
  }, [id, router])

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )
  if (!sessie) return null

  const titel = sessie.partituren?.titel || 'Onbekende partituur'
  const componist = sessie.partituren?.componist
  const datum = new Date(sessie.created_at).toLocaleDateString('nl-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const tijd = new Date(sessie.created_at).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })

  let aiFeedback: AiFeedback | null = null
  try { if (sessie.ai_feedback) aiFeedback = JSON.parse(sessie.ai_feedback) } catch {}

  let tijdAnnotaties: TijdAnnotatie[] = []
  try { if (sessie.notities) tijdAnnotaties = JSON.parse(sessie.notities) } catch {}

  const gevoel = sessie.gevoel ? GEVOEL_MAP[sessie.gevoel] : null

  // Normalize challenges: studio slaat string[] op, oudere data kan { challenge: string }[] zijn
  const challenges: string[] = (sessie.challenges || []).map((c: any) =>
    typeof c === 'string' ? c : (c.challenge ?? '')
  ).filter(Boolean)

  // Normalize aiFeedback: tops/tips kunnen string of string[] zijn
  const feedbackTops: string[] = aiFeedback?.tops
    ? Array.isArray(aiFeedback.tops) ? aiFeedback.tops : [aiFeedback.tops]
    : []
  const feedbackTips: string[] = aiFeedback?.tips
    ? Array.isArray(aiFeedback.tips) ? aiFeedback.tips : [aiFeedback.tips]
    : []

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>

      {/* Blauwe header */}
      <div className="px-6 pt-10 pb-8" style={{ backgroundColor: '#0766C6' }}>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => router.push('/sessies')}
            className="mb-4 flex items-center gap-2 text-sm font-medium"
            style={{ color: '#93c5fd' }}>
            ← Logboek
          </button>
          <p className="text-sm mb-1" style={{ color: '#93c5fd' }}>
            {datum} · {tijd}
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight">{titel}</h1>
          {componist && <p className="text-sm mt-1" style={{ color: '#bfdbfe' }}>{componist}</p>}

          <div className="flex flex-wrap items-center gap-2 mt-5">
            <span className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              ⏱ {formatDuur(sessie.duur || 0)}
            </span>
            {sessie.bpm && (
              <span className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                ♩ {sessie.bpm} BPM
              </span>
            )}
            {sessie.opname_url && (
              <span className="text-sm px-3 py-1.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                🎙 Opname
              </span>
            )}
            {gevoel && (
              <span className="text-sm px-3 py-1.5 rounded-full font-semibold"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                {gevoel.emoji} {sessie.gevoel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 mt-6 flex flex-col gap-5">

        {/* Leraar reacties */}
        {leraarReacties.length > 0 && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#333' }}>
              💬 Van je leraar
            </p>
            <div className="flex flex-col gap-2">
              {leraarReacties.map(r => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#F3E7DD' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: '#0766C6' }}>
                    L
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#333' }}>{r.inhoud}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#bbb' }}>
                      {new Date(r.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opname */}
        {sessie.opname_url && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#333' }}>
              🎙 Jouw opname
            </p>
            <audio controls src={sessie.opname_url} className="w-full" />

            {tijdAnnotaties.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#888' }}>
                  Tijdnotities
                </p>
                {tijdAnnotaties.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: '#F3E7DD' }}>
                    <span className="text-xs font-mono font-bold flex-shrink-0 mt-0.5"
                      style={{ color: '#0766C6' }}>
                      {formatTijdstip(a.tijdstip)}
                    </span>
                    <p className="text-sm" style={{ color: '#444' }}>{a.inhoud}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Challenges van deze sessie */}
        {challenges.length > 0 && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#333' }}>
              🎯 Challenges van deze sessie
            </p>
            <div className="flex flex-col gap-2">
              {challenges.map((tekst, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#F3E7DD' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: '#FF560D' }}>
                    {i + 1}
                  </span>
                  <p className="text-sm" style={{ color: '#444' }}>{tekst}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reflectie */}
        {(sessie.tops || sessie.tips) && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: '#333' }}>Jouw reflectie</p>
            <div className="flex flex-col gap-3">
              {sessie.tops && (
                <div className="p-4 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: '#0766C6' }}>
                    Wat ging goed
                  </p>
                  <p className="text-sm" style={{ color: '#444' }}>{sessie.tops}</p>
                </div>
              )}
              {sessie.tips && (
                <div className="p-4 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: '#FF560D' }}>
                    Wat kan beter
                  </p>
                  <p className="text-sm" style={{ color: '#444' }}>{sessie.tips}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Feedback */}
        {aiFeedback && (
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#0766C6' }}>
            <p className="text-sm font-semibold mb-4 text-white">✦ AI Feedback</p>

            {feedbackTops.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: '#93c5fd' }}>
                  Tops
                </p>
                <div className="flex flex-col gap-2">
                  {feedbackTops.map((top, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="flex-shrink-0 mt-0.5" style={{ color: '#86efac' }}>✓</span>
                      <p className="text-sm text-white">{top}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {feedbackTips.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: '#93c5fd' }}>
                  Tips
                </p>
                <div className="flex flex-col gap-2">
                  {feedbackTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="flex-shrink-0 mt-0.5" style={{ color: '#fbbf24' }}>→</span>
                      <p className="text-sm text-white">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aiFeedback.motivatie && (
              <div className="mt-2 p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <p className="text-sm text-white italic">{aiFeedback.motivatie}</p>
              </div>
            )}
          </div>
        )}

        {/* Naar partituur */}
        {sessie.partituren && (
          <button
            onClick={() => router.push(`/partituren/${sessie.partituur_id}`)}
            className="w-full py-4 rounded-2xl font-semibold text-sm transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: '#fff', color: '#0766C6' }}>
            Partituur openen →
          </button>
        )}

        <button
          onClick={() => router.push(`/studio/${sessie.partituur_id}`)}
          className="w-full py-4 rounded-2xl text-white font-semibold text-sm transition-transform hover:scale-[1.01]"
          style={{ backgroundColor: '#FF560D' }}>
          Opnieuw oefenen →
        </button>

      </div>
      <BottomNav />
    </main>
  )
}
