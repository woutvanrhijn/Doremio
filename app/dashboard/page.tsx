'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import BottomNav from '@/components/BottomNav'

type Sessie = {
  id: string
  duur: number
  created_at: string
  partituur_id: string | null
  partituren: { titel: string; componist: string | null } | null
}

type Partituur = {
  id: string
  titel: string
  componist: string | null
  leraar_id: string
  created_at: string
}

const DAGLETTERS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']

export default function Dashboard() {
  const [profiel, setProfiel] = useState<any>(null)
  const [recentePartituren, setRecentePartituren] = useState<Partituur[]>([])
  const [recenteSessies, setRecenteSessies] = useState<Sessie[]>([])
  const [uploaders, setUploaders] = useState<Record<string, string>>({})
  const [aantalSessies, setAantalSessies] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profielData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfiel(profielData)

      const rol = profielData?.role

      if (rol === 'leraar') {
        const { data: partiturenData } = await supabase
          .from('partituren')
          .select('*')
          .eq('leraar_id', user.id)
          .order('created_at', { ascending: false })
          .limit(4)
        setRecentePartituren(partiturenData || [])
      } else {
        const [{ data: partiturenData }, { data: sessiesData }, { count }] = await Promise.all([
          supabase.from('partituren').select('*').order('created_at', { ascending: false }).limit(4),
          supabase.from('oefensessies')
            .select('id, duur, created_at, partituur_id, partituren(titel, componist)')
            .eq('student_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.from('oefensessies').select('*', { count: 'exact', head: true }).eq('student_id', user.id),
        ])
        setRecentePartituren(partiturenData || [])
        setRecenteSessies((sessiesData as any) || [])
        setAantalSessies(count || 0)

        const leraarIds = [...new Set((partiturenData || []).map((p: any) => p.leraar_id).filter(Boolean))]
        if (leraarIds.length > 0) {
          const { data: profielen } = await supabase.from('profiles').select('id, naam').in('id', leraarIds)
          const map: Record<string, string> = {}
          profielen?.forEach((p: any) => { map[p.id] = p.naam })
          setUploaders(map)
        }
      }

      setLoading(false)
    }
    haalOp()
  }, [router])

  if (loading) return (
    <main className="min-h-dvh flex items-center justify-center bg-warm-white">
      <p className="font-apercu text-body-md" style={{ color: '#0766C6' }}>Laden…</p>
    </main>
  )

  const voornaam = profiel?.naam?.split(' ')[0] || 'jou'
  const rol = profiel?.role
  const vandaag = new Date().toISOString().slice(0, 10)
  const geoefendeDagen = new Set(recenteSessies.map(s => s.created_at.slice(0, 10)))

  const kalenderDagen = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 2 + i)
    const iso = d.toISOString().slice(0, 10)
    return {
      iso,
      letter: DAGLETTERS[d.getDay()],
      nr: d.getDate(),
      isVandaag: iso === vandaag,
      geoefend: geoefendeDagen.has(iso),
    }
  })

  // ===== LERAAR VIEW =====
  if (rol === 'leraar') {
    return (
      <main className="page px-page">

        {/* Logo */}
        <div className="flex justify-center pt-6 pb-5">
          <Image src="/images/doremio-logo2.png" alt="Doremio" width={120} height={87} priority />
        </div>

        {/* Begroeting */}
        <div className="mb-6 text-right">
          <p className="font-apercu font-bold text-heading-xl" style={{ color: '#0766C6' }}>
            Welkom terug,
          </p>
          <p className="font-kiro text-display-xl" style={{ color: '#FF560D' }}>
            {voornaam}
          </p>
        </div>

        {/* CTA knoppen */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={() => router.push('/partituren/nieuw')}
            className="w-full rounded-full py-4 px-6 font-apercu font-bold text-white text-body-lg active:scale-95 transition-transform duration-100"
            style={{ backgroundColor: '#0766C6' }}
          >
            Nieuw lesmateriaal toevoegen
          </button>
          <button
            onClick={() => router.push('/venster')}
            className="w-full rounded-full py-4 px-6 font-apercu font-bold text-white text-body-lg active:scale-95 transition-transform duration-100"
            style={{ backgroundColor: '#FF560D' }}
          >
            Classview openen
          </button>
        </div>

        {/* Lesmateriaal — eigen + collega's in één rij */}
        <section className="mb-6">
          <h2 className="section-title mb-3">Lesmateriaal</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">

            {/* Eigen partituren */}
            {recentePartituren.length === 0 ? (
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: 160, height: 180, backgroundColor: '#0D1B2A', borderRadius: 20, borderLeft: '5px solid #FF560D' }}
              >
                <p className="font-apercu text-caption text-center px-4" style={{ color: '#8FA3B8' }}>
                  Nog geen lesmateriaal
                </p>
              </div>
            ) : (
              recentePartituren.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/partituren/${p.id}`)}
                  className="flex-shrink-0 overflow-hidden active:scale-95 transition-transform duration-100 text-left"
                  style={{ width: 160, height: 180, backgroundColor: '#0D1B2A', position: 'relative', borderRadius: 20, borderLeft: '5px solid #FF560D' }}
                >
                  <div className="absolute inset-0 flex flex-col justify-end p-4">
                    <div style={{ marginBottom: 12 }}>
                      <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
                        <line x1="0" y1="4"  x2="22" y2="4"  stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                        <line x1="0" y1="9"  x2="22" y2="9"  stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                        <line x1="0" y1="14" x2="22" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                        <line x1="0" y1="19" x2="22" y2="19" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                        <circle cx="27" cy="19" r="3" fill="white" />
                        <line x1="30" y1="19" x2="30" y2="4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="font-apercu font-bold italic text-white text-body-sm leading-snug line-clamp-2">
                      &ldquo;{p.titel}&rdquo;
                    </p>
                    {p.componist && (
                      <p className="font-apercu text-caption mt-0.5 line-clamp-1" style={{ color: '#8FA3B8' }}>
                        {p.componist}
                      </p>
                    )}
                    <p className="font-apercu text-caption mt-0.5" style={{ color: '#FF560D' }}>
                      Mijn materiaal
                    </p>
                  </div>
                </button>
              ))
            )}

            {/* Lesmateriaal van collega's */}
            {[
              { id: 'c-1', titel: "Knockin' On Heaven's Door", componist: 'Bob Dylan', leraarNaam: "Lukas D'hondt", isOpname: false },
              { id: 'c-2', titel: 'Nocturne Op. 9 No. 2', componist: 'Frédéric Chopin', leraarNaam: 'H. Jacobs', isOpname: true },
              { id: 'c-3', titel: "Friday I'm In Love", componist: 'The Cure', leraarNaam: 'G. Jansen', isOpname: false },
            ].map(item => {
              const kleur = item.isOpname ? '#FFD100' : '#0766C6'
              return (
                <div
                  key={item.id}
                  className="flex-shrink-0 overflow-hidden"
                  style={{ width: 160, height: 180, backgroundColor: '#0D1B2A', borderRadius: 20, borderLeft: `5px solid ${kleur}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16 }}
                >
                  {item.isOpname ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth="1.8" strokeLinecap="round" style={{ marginBottom: 10 }}>
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  ) : (
                    <svg width="32" height="22" viewBox="0 0 32 22" fill="none" style={{ marginBottom: 10 }}>
                      <line x1="0" y1="4" x2="22" y2="4" stroke={kleur} strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
                      <line x1="0" y1="9" x2="22" y2="9" stroke={kleur} strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
                      <line x1="0" y1="14" x2="22" y2="14" stroke={kleur} strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
                      <circle cx="27" cy="19" r="3" fill={kleur} />
                      <line x1="30" y1="19" x2="30" y2="4" stroke={kleur} strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  )}
                  <p className="font-apercu font-bold italic text-white text-body-sm leading-snug line-clamp-2">
                    &ldquo;{item.titel}&rdquo;
                  </p>
                  <p className="font-apercu text-caption mt-0.5 line-clamp-1" style={{ color: '#8FA3B8' }}>
                    {item.componist}
                  </p>
                  <p className="font-apercu text-caption mt-0.5" style={{ color: kleur }}>
                    {item.leraarNaam}
                  </p>
                </div>
              )
            })}

          </div>
        </section>

        {/* Kalender */}
        <section className="mb-6">
          <h2 className="section-title mb-3">Kalender</h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {kalenderDagen.map((dag) => {
              const bgColor = dag.isVandaag ? '#FFD100' : '#0766C6'
              const tekstKleur = dag.isVandaag ? '#0D1B2A' : 'white'
              return (
                <div
                  key={dag.iso}
                  className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl"
                  style={{ width: 64, height: 72, backgroundColor: bgColor, color: tekstKleur }}
                >
                  <span className="font-apercu text-caption font-bold uppercase tracking-wide">{dag.letter}</span>
                  <span className="font-apercu font-bold text-heading-md mt-0.5">{dag.nr}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Bottom 2-kolom */}
        <section className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => router.push('/venster')}
            className="rounded-3xl overflow-hidden active:scale-95 transition-transform duration-100 text-left"
            style={{ backgroundColor: '#FF560D', minHeight: 120 }}
          >
            <div className="p-4 h-full flex flex-col justify-between">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <div>
                <p className="font-apercu font-bold text-white text-body-lg">Recent</p>
                <p className="font-apercu text-caption" style={{ color: 'rgba(255,255,255,0.75)' }}>Geopend</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/partituren')}
            className="rounded-3xl active:scale-95 transition-transform duration-100 text-left"
            style={{ backgroundColor: '#FFD100', minHeight: 120 }}
          >
            <div className="p-4 h-full flex flex-col justify-between">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0D1B2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <div>
                <p className="font-apercu font-bold text-body-lg" style={{ color: '#0D1B2A' }}>{recentePartituren.length}</p>
                <p className="font-apercu text-caption" style={{ color: '#0D1B2A' }}>Mijn lesmateriaal</p>
              </div>
            </div>
          </button>
        </section>

        <BottomNav />
      </main>
    )
  }

  // ===== STUDENT VIEW =====
  const huidigStuk = recenteSessies.find(s => s.partituur_id && s.partituren)

  return (
    <main className="page px-page">

      {/* Logo */}
      <div className="flex justify-center pt-6 pb-5">
        <Image src="/images/doremio-logo2.png" alt="Doremio" width={120} height={87} priority />
      </div>

      {/* Begroeting */}
      <div className="mb-6">
        <p className="font-apercu font-bold text-heading-xl" style={{ color: '#0766C6' }}>
          Welkom terug,
        </p>
        <p className="font-kiro text-display-xl" style={{ color: '#FF560D' }}>
          {voornaam}
        </p>
      </div>

      {/* Primaire CTA-rij */}
      <div className="flex gap-3 mb-3">
        <button
          onClick={() => router.push('/quickplay')}
          className="flex items-center gap-3 flex-1 rounded-full py-4 px-5 active:scale-95 transition-transform duration-100"
          style={{ backgroundColor: '#0766C6' }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <span className="font-apercu font-bold text-white text-body-lg leading-tight">
            Start mijn oefensessie
          </span>
        </button>

        <button
          onClick={() => router.push('/sessies')}
          className="rounded-full py-4 px-5 font-apercu font-bold text-white text-body-md active:scale-95 transition-transform duration-100 flex-shrink-0"
          style={{ backgroundColor: '#FF560D' }}
        >
          Oefenen{'\n'}& Sessies
        </button>
      </div>

      {/* Huidig stuk tag */}
      {huidigStuk && (
        <div className="flex items-center gap-2 mb-6">
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{ backgroundColor: '#0D1B2A' }}
          >
            <span className="font-apercu font-bold text-white text-body-sm truncate max-w-[160px]">
              &ldquo;{huidigStuk.partituren!.titel}&rdquo;
              {huidigStuk.partituren!.componist ? ` – ${huidigStuk.partituren!.componist}` : ''}
            </span>
            {uploaders[recentePartituren[0]?.leraar_id] && (
              <span className="font-apercu text-caption flex-shrink-0" style={{ color: '#8FA3B8' }}>
                {uploaders[recentePartituren[0].leraar_id]}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Nieuw voor jou */}
      <section className="mb-6">
        <h2 className="section-title mb-3">Nieuw voor jou</h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5">

          {/* Fictieve medestudenten sessies — vooraan */}
          {[
            { naam: 'Zoë D.', stuk: 'Nocturne Op. 9', duur: '24 min', kleur: '#0766C6' },
            { naam: 'Noah J.', stuk: 'Canon in D', duur: '18 min', kleur: '#FFD100' },
          ].map((s) => (
            <div
              key={s.naam}
              className="flex-shrink-0 flex flex-col justify-end p-4"
              style={{ width: 160, height: 180, backgroundColor: '#0D1B2A', borderRadius: 20, borderLeft: `5px solid ${s.kleur}` }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: s.kleur }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.kleur === '#FFD100' ? '#0D1B2A' : 'white'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
              <p className="font-apercu font-bold text-white text-body-sm leading-snug line-clamp-2 italic">
                &ldquo;{s.stuk}&rdquo;
              </p>
              <p className="font-apercu text-caption mt-1" style={{ color: '#8FA3B8' }}>{s.naam} · {s.duur}</p>
              <p className="font-apercu text-caption mt-0.5" style={{ color: s.kleur }}>Zojuist geoefend</p>
            </div>
          ))}

          {/* Lesmateriaal van de leraar */}
          {recentePartituren.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/partituren/${p.id}`)}
              className="flex-shrink-0 overflow-hidden active:scale-95 transition-transform duration-100"
              style={{ width: 160, height: 180, backgroundColor: '#0D1B2A', position: 'relative', borderRadius: 20, borderLeft: '5px solid #FF560D' }}
            >
              <div className="absolute inset-0 flex flex-col justify-end p-4 text-left">
                <div style={{ marginBottom: 12 }}>
                  <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
                    <line x1="0" y1="4"  x2="22" y2="4"  stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                    <line x1="0" y1="9"  x2="22" y2="9"  stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                    <line x1="0" y1="14" x2="22" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                    <line x1="0" y1="19" x2="22" y2="19" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                    <circle cx="27" cy="19" r="3" fill="white" />
                    <line x1="30" y1="19" x2="30" y2="4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="font-apercu font-bold italic text-white text-body-sm leading-snug line-clamp-2">
                  &ldquo;{p.titel}&rdquo;
                </p>
                {p.componist && (
                  <p className="font-apercu text-caption mt-0.5 line-clamp-1" style={{ color: '#8FA3B8' }}>
                    {p.componist}
                  </p>
                )}
                {uploaders[p.leraar_id] && (
                  <p className="font-apercu text-caption mt-0.5" style={{ color: '#8FA3B8' }}>
                    {uploaders[p.leraar_id]}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Kalender */}
      <section className="mb-6">
        <h2 className="section-title mb-3">Kalender</h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {kalenderDagen.map((dag) => {
            const isVandaag = dag.isVandaag
            const bgColor = isVandaag ? '#FFD100' : '#0766C6'
            const tekstKleur = isVandaag ? '#0D1B2A' : 'white'

            return (
              <div
                key={dag.iso}
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl"
                style={{
                  width: 64,
                  height: 72,
                  backgroundColor: bgColor,
                  color: tekstKleur,
                }}
              >
                <span className="font-apercu text-caption font-bold uppercase tracking-wide">
                  {dag.letter}
                </span>
                <span className="font-apercu font-bold text-heading-md mt-0.5">
                  {dag.nr}
                </span>
                {dag.geoefend && (
                  <div className="w-1.5 h-1.5 rounded-full mt-1"
                    style={{ backgroundColor: isVandaag ? 'rgba(13,27,42,0.4)' : 'rgba(255,255,255,0.6)' }} />
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Partituren + Sessies - 2 kolommen */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => router.push('/partituren')}
          className="rounded-3xl overflow-hidden active:scale-95 transition-transform duration-100 text-left"
          style={{ backgroundColor: '#FF560D', minHeight: 120 }}
        >
          <div className="p-4 h-full flex flex-col justify-between">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div>
              <p className="font-apercu font-bold text-white text-body-lg">{recentePartituren.length}</p>
              <p className="font-apercu text-caption" style={{ color: 'rgba(255,255,255,0.75)' }}>Lesmateriaal</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push('/sessies')}
          className="rounded-3xl active:scale-95 transition-transform duration-100 text-left"
          style={{ backgroundColor: '#FFD100', minHeight: 120 }}
        >
          <div className="p-4 h-full flex flex-col justify-between">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0D1B2A" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <div>
              <p className="font-apercu font-bold text-navy text-body-lg">{aantalSessies}</p>
              <p className="font-apercu text-caption" style={{ color: '#0D1B2A' }}>Mijn Sessies</p>
            </div>
          </div>
        </button>
      </section>

      <BottomNav />
    </main>
  )
}
