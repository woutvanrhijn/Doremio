'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

const OEFENINGEN = [
  { id: 'herhalen',   label: 'Akkoorden Herhalen',   beschrijving: 'Basisakkoorden overlopen in verschillende volgorde',     duur: 5  },
  { id: 'progressie', label: 'Akkoorden Progressie',  beschrijving: 'Overgang akkoorden oefenen in eigen tempo',              duur: 5  },
  { id: 'doorspeel',  label: 'Doorspeel Repetitie',   beschrijving: 'Speel doorlopend het stuk gedurende 10 volledige minuten', duur: 10 },
]

export default function QuickPlayPage() {
  const router = useRouter()
  const [partituur, setPartituur] = useState<any>(null)
  const [leraarNaam, setLeraarNaam] = useState('')
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // Gebruik partituur_id van practice-studio als die gezet is
      let voorkeursId: string | null = null
      try { voorkeursId = localStorage.getItem('quickplay_partituur_id'); localStorage.removeItem('quickplay_partituur_id') } catch {}

      if (voorkeursId) {
        const { data: voorkeursPartituur } = await supabase.from('partituren').select('*').eq('id', voorkeursId).single()
        if (voorkeursPartituur) {
          setPartituur(voorkeursPartituur)
          if (voorkeursPartituur.leraar_id) {
            const { data: leraar } = await supabase.from('profiles').select('naam').eq('id', voorkeursPartituur.leraar_id).single()
            setLeraarNaam(leraar?.naam || '')
          }
          setLoading(false)
          return
        }
      }

      const { data: sessie } = await supabase
        .from('oefensessies')
        .select('partituur_id, partituren(id, titel, componist, leraar_id)')
        .eq('student_id', user.id)
        .not('partituur_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const part = (sessie as any)?.partituren
      if (part) {
        setPartituur(part)
        if (part.leraar_id) {
          const { data: leraar } = await supabase.from('profiles').select('naam').eq('id', part.leraar_id).single()
          setLeraarNaam(leraar?.naam || '')
        }
      } else {
        const { data: eerste } = await supabase.from('partituren').select('*').limit(1).single()
        setPartituur(eerste)
      }
      setLoading(false)
    }
    haalOp()
  }, [router])

  function toggle(id: string) {
    setGeselecteerd(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  if (loading) return (
    <main style={{ minHeight: '100dvh', backgroundColor: '#0766C6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="font-apercu text-white">Laden…</p>
    </main>
  )

  const totaleDuur = OEFENINGEN.filter(o => geselecteerd.has(o.id)).reduce((s, o) => s + o.duur, 0)

  return (
    <main
      className="flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 16px)' }}
    >
      {/* ── Blauwe bovensectie ── */}
      <div
        className="flex-shrink-0 px-5 pt-4 pb-12"
        style={{ backgroundColor: '#0766C6' }}
      >
        <button onClick={() => router.back()} className="mb-6 active:opacity-70">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 className="font-kiro text-display-lg text-white mb-4">
          Start Oefensessie:
        </h1>

        <p className="font-apercu text-body-md text-white mb-3" style={{ opacity: 0.88 }}>
          <em>"Practice makes perfect"</em>, toch? Goed oefenen is de beste manier om te verbeteren
          en jouw favoriete stukken onder de knie te krijgen! Maar, wat is nu goed oefenen?
          Om samen te oefenen vind je hieronder een gepersonaliseerd oefenplan met jouw opdrachten en doelstellingen.
        </p>

        <p className="font-apercu text-body-md text-white italic" style={{ opacity: 0.92 }}>
          Maak je klaar voor een echte jam sessie!
        </p>
      </div>

      {/* ── Witte ondersectie ── */}
      <div
        className="flex-1 flex flex-col -mt-6 px-5 pt-6"
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        <h2 className="font-apercu font-bold text-heading-lg text-navy mb-4">
          Playing now:
        </h2>

        {/* Stuk-kaart */}
        {partituur && (
          <div className="rounded-2xl p-4 mb-6 flex items-center gap-4" style={{ backgroundColor: '#0D1B2A' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ border: '2px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              {leraarNaam && (
                <p className="font-apercu text-caption mb-0.5" style={{ color: '#8FA3B8' }}>{leraarNaam}</p>
              )}
              <p className="font-apercu font-bold text-white text-body-lg leading-snug truncate">
                "{partituur.titel}"{partituur.componist ? ` – ${partituur.componist}` : ''}
              </p>
              <div className="flex gap-3 mt-1">
                {['C-Mineur', '4/4', '76 BPM', 'Track'].map(t => (
                  <span key={t} className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Oefeningen */}
        <div className="flex flex-col gap-3 mb-6 flex-1">
          {OEFENINGEN.map(o => {
            const aan = geselecteerd.has(o.id)
            return (
              <button
                key={o.id}
                onClick={() => toggle(o.id)}
                className="w-full flex items-start gap-4 rounded-2xl px-4 py-4 active:scale-[0.98] transition-transform text-left"
                style={{
                  border: `2px solid ${aan ? '#0766C6' : '#FF560D'}`,
                  backgroundColor: aan ? 'rgba(7,102,198,0.04)' : 'white',
                }}
              >
                {/* Checkbox */}
                <div
                  className="w-6 h-6 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center"
                  style={{
                    border: `2px solid ${aan ? '#0766C6' : '#D1D5DB'}`,
                    backgroundColor: aan ? '#0766C6' : 'transparent',
                  }}
                >
                  {aan && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-apercu font-bold text-body-md text-navy">{o.label}</p>
                    <span className="font-apercu font-bold text-caption flex-shrink-0" style={{ color: '#8FA3B8' }}>
                      {o.duur} min
                    </span>
                  </div>
                  <p className="font-apercu text-body-sm mt-0.5" style={{ color: '#8FA3B8' }}>
                    {o.beschrijving}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Knoppen */}
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => router.push('/practice-studio')}
            className="rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{ backgroundColor: '#0766C6', width: 64, height: 56, flexShrink: 0 }}
            aria-label="Alle sessies"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M17 14v6M14 17h6" />
            </svg>
          </button>

          <button
            onClick={() => {
            if (!partituur) return
            try { localStorage.setItem('geselecteerdeEx', JSON.stringify([...geselecteerd])) } catch {}
            router.push(`/studio/${partituur.id}`)
          }}
            className="flex-1 rounded-full font-apercu font-bold text-white text-heading-md active:scale-95 transition-transform"
            style={{ backgroundColor: '#FF560D', height: 56 }}
          >
            {geselecteerd.size > 0 ? `START · ${totaleDuur} min` : 'START'}
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
