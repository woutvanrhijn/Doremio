'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type Sessie = {
  id: string
  duur: number
  created_at: string
  partituur_id: string | null
  partituren: { titel: string; componist: string | null } | null
}

function berekenStreak(sessies: Sessie[]): number {
  if (sessies.length === 0) return 0
  const dagen = [...new Set(sessies.map(s => s.created_at.slice(0, 10)))].sort().reverse()
  const vandaag = new Date().toISOString().slice(0, 10)
  const gisteren = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dagen[0] !== vandaag && dagen[0] !== gisteren) return 0
  let streak = 1
  for (let i = 1; i < dagen.length; i++) {
    const prev = new Date(dagen[i - 1])
    const curr = new Date(dagen[i])
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
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

export default function Dashboard() {
  const [gebruiker, setGebruiker] = useState<any>(null)
  const [profiel, setProfiel] = useState<any>(null)
  const [aantalPartituren, setAantalPartituren] = useState(0)
  const [aantalSessies, setAantalSessies] = useState(0)
  const [recentePartituren, setRecentePartituren] = useState<any[]>([])
  const [recenteSessies, setRecenteSessies] = useState<Sessie[]>([])
  const [uploaders, setUploaders] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setGebruiker(user)

      const { data: profielData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfiel(profielData)

      const rol = profielData?.role
      let partituren: any[] = []

      if (rol === 'leraar') {
        const { data } = await supabase
          .from('partituren')
          .select('*')
          .eq('leraar_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3)
        partituren = data || []

        const { count } = await supabase
          .from('partituren')
          .select('*', { count: 'exact', head: true })
          .eq('leraar_id', user.id)
        setAantalPartituren(count || 0)

      } else {
        const { data } = await supabase
          .from('partituren')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3)
        partituren = data || []

        const { count: countP } = await supabase
          .from('partituren')
          .select('*', { count: 'exact', head: true })
        setAantalPartituren(countP || 0)

        const { count: countS } = await supabase
          .from('oefensessies')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user.id)
        setAantalSessies(countS || 0)

        // Recente sessies voor logboek preview
        const { data: sessiesData } = await supabase
          .from('oefensessies')
          .select('id, duur, created_at, partituur_id, partituren(titel, componist)')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        setRecenteSessies((sessiesData as any) || [])
      }

      setRecentePartituren(partituren)

      const leraarIds = [...new Set(partituren.map((p: any) => p.leraar_id).filter(Boolean))]
      if (leraarIds.length > 0) {
        const { data: profielen } = await supabase
          .from('profiles')
          .select('id, naam')
          .in('id', leraarIds)
        const uploaderMap: Record<string, string> = {}
        profielen?.forEach((p: any) => { uploaderMap[p.id] = p.naam })
        setUploaders(uploaderMap)
      }

      setLoading(false)
    }
    haalOp()
  }, [router])

  const uitloggen = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  const rol = profiel?.role
  const naam = profiel?.naam || gebruiker?.email
  const streak = berekenStreak(recenteSessies)

  // Weekkalender: laatste 7 dagen
  const weekDagen = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
  const geoefendeDagen = new Set(recenteSessies.map(s => s.created_at.slice(0, 10)))
  const vandaag = new Date().toISOString().slice(0, 10)
  const vandaagGeoefend = geoefendeDagen.has(vandaag)

  return (
    <main className="min-h-screen px-6 py-10 pb-28" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/profiel')}
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform hover:scale-[1.05]"
              style={{ backgroundColor: '#0766C6' }}>
              <span className="text-white text-2xl">♪</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#0766C6' }}>
                Doremio
              </h1>
              <p className="text-sm" style={{ color: '#666' }}>
                {naam} · {rol === 'leraar' ? 'Leraar' : 'Student'}
              </p>
            </div>
          </div>
          <button onClick={uitloggen}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#fff', color: '#666' }}>
            Uitloggen
          </button>
        </div>

        {/* Statistieken */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => router.push('/partituren')}
            className="rounded-2xl p-6 text-left transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#0766C6' }}>
            <p className="text-blue-200 text-sm mb-1">Partituren</p>
            <p className="text-white text-3xl font-bold">{aantalPartituren}</p>
            <p className="text-blue-200 text-xs mt-2">Bekijk alle →</p>
          </button>

          <button
            onClick={() => rol !== 'leraar' ? router.push('/sessies') : undefined}
            className="rounded-2xl p-6 text-left transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#FF560D' }}>
            <p className="text-orange-200 text-sm mb-1">Oefensessies</p>
            <p className="text-white text-3xl font-bold">{aantalSessies}</p>
            <p className="text-orange-200 text-xs mt-2">
              {rol === 'leraar' ? 'Van studenten' : 'Logboek bekijken →'}
            </p>
          </button>
        </div>

        {/* Start oefenen widget — alleen voor student */}
        {rol !== 'leraar' && (() => {
          const laatstePart = recenteSessies.find(s => s.partituur_id && s.partituren)
          return (
            <div className="rounded-2xl overflow-hidden mb-4 shadow-sm"
              style={{ backgroundColor: '#FF560D' }}>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                  style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {vandaagGeoefend
                    ? '✓ Vandaag al geoefend'
                    : streak > 0 ? `🔥 ${streak} dagen op rij — ga door!` : 'Klaar om te oefenen?'}
                </p>
                {laatstePart ? (
                  <>
                    <p className="text-white font-bold text-xl leading-tight mb-0.5">
                      {laatstePart.partituren!.titel}
                    </p>
                    {laatstePart.partituren!.componist && (
                      <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {laatstePart.partituren!.componist}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/studio/${laatstePart.partituur_id}`)}
                        className="flex-1 py-3 rounded-xl font-bold text-sm"
                        style={{ backgroundColor: '#fff', color: '#FF560D' }}>
                        ▶ Ga verder
                      </button>
                      <button
                        onClick={() => router.push('/partituren')}
                        className="px-4 py-3 rounded-xl font-medium text-sm"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                        Ander stuk
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-white font-bold text-xl mb-3">Start je eerste sessie</p>
                    <button
                      onClick={() => router.push('/partituren')}
                      className="w-full py-3 rounded-xl font-bold text-sm"
                      style={{ backgroundColor: '#fff', color: '#FF560D' }}>
                      Kies een partituur →
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })()}

        {/* Start oefensessie — los widget */}
        {rol !== 'leraar' && (
          <button
            onClick={() => router.push('/partituren')}
            className="w-full rounded-2xl overflow-hidden mb-4 shadow-sm text-left transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: '#0766C6' }}>
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-base">Start oefensessie</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Kies een stuk en begin →
                </p>
              </div>
              <span className="text-3xl text-white opacity-80">▶</span>
            </div>
          </button>
        )}

        {/* Weekkalender + streak — alleen voor student */}
        {rol !== 'leraar' && (() => {
          const weekGeleden = new Date(Date.now() - 7 * 86400000).toISOString()
          const sessiesDezeWeek = recenteSessies.filter(s => s.created_at >= weekGeleden)
          const totaalSecDezeWeek = sessiesDezeWeek.reduce((a, s) => a + (s.duur || 0), 0)
          const totaalMinDezeWeek = Math.floor(totaalSecDezeWeek / 60)
          const aantalDagenGeoefend = weekDagen.filter(d => geoefendeDagen.has(d)).length

          return (
            <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#fff' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold" style={{ color: '#333' }}>Deze week</p>
                {streak > 0 ? (
                  <span className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: '#FF560D', color: '#fff' }}>
                    🔥 {streak} dag{streak !== 1 ? 'en' : ''} op rij
                  </span>
                ) : (
                  <span className="text-sm px-3 py-1 rounded-full"
                    style={{ backgroundColor: '#F3E7DD', color: '#888' }}>
                    Nog geen streak
                  </span>
                )}
              </div>

              {/* Dag-cirkels */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
                {weekDagen.map((dag) => {
                  const geoefend = geoefendeDagen.has(dag)
                  const isVandaag = dag === new Date().toISOString().slice(0, 10)
                  const dagNr = new Date(dag).getDay()
                  const label = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][dagNr]
                  return (
                    <div key={dag} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <span style={{ fontSize: '11px', color: '#bbb', fontWeight: 500 }}>{label}</span>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        backgroundColor: geoefend ? '#0766C6' : '#F3E7DD',
                        border: isVandaag && !geoefend ? '2px solid #0766C6' : '2px solid transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: geoefend ? '#fff' : '#bbb',
                        fontSize: geoefend ? '14px' : '11px',
                        fontWeight: 'bold',
                      }}>
                        {geoefend ? '✓' : new Date(dag).getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Week stats */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid #F3E7DD' }}>
                <div className="text-center">
                  <p className="text-xl font-bold" style={{ color: '#0766C6' }}>{aantalDagenGeoefend}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#888' }}>Dag{aantalDagenGeoefend !== 1 ? 'en' : ''} geoefend</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold" style={{ color: '#FF560D' }}>{sessiesDezeWeek.length}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#888' }}>Sessies</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold" style={{ color: '#333' }}>
                    {totaalMinDezeWeek >= 60
                      ? `${Math.floor(totaalMinDezeWeek / 60)}u${totaalMinDezeWeek % 60 > 0 ? `${totaalMinDezeWeek % 60}m` : ''}`
                      : `${totaalMinDezeWeek}min`}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#888' }}>Oefentijd</p>
                </div>
              </div>

              {/* Parcours link */}
              <button
                onClick={() => router.push('/parcours')}
                className="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold"
                style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                Bekijk je volledige parcours →
              </button>
            </div>
          )
        })()}

        {/* Recente sessies preview — alleen voor student */}
        {rol !== 'leraar' && recenteSessies.length > 0 && (
          <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#fff' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm" style={{ color: '#333' }}>Recente sessies</h2>
              <button onClick={() => router.push('/sessies')} className="text-sm" style={{ color: '#0766C6' }}>
                Alle bekijken →
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {recenteSessies.slice(0, 3).map(sessie => {
                const titel = sessie.partituren?.titel || 'Onbekende partituur'
                const tijd = new Date(sessie.created_at).toLocaleDateString('nl-BE', {
                  day: 'numeric', month: 'short'
                })
                return (
                  <button
                    key={sessie.id}
                    onClick={() => router.push(`/sessies/${sessie.id}`)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl transition-transform hover:scale-[1.01]"
                    style={{ backgroundColor: '#F3E7DD' }}>
                    <div className="w-1 self-stretch rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#0766C6' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#0766C6' }}>{titel}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#888' }}>{formatDuur(sessie.duur || 0)}</p>
                    </div>
                    <p className="text-xs flex-shrink-0" style={{ color: '#bbb' }}>{tijd}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Recente partituren */}
        <div className="rounded-2xl p-6 mb-4" style={{ backgroundColor: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#333' }}>
              Recente partituren
            </h2>
            <button
              onClick={() => router.push('/partituren')}
              className="text-sm"
              style={{ color: '#0766C6' }}>
              Alle bekijken →
            </button>
          </div>

          {recentePartituren.length === 0 ? (
            <p className="text-sm" style={{ color: '#888' }}>
              Nog geen partituren beschikbaar.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentePartituren.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/partituren/${p.id}`)}
                  className="w-full text-left rounded-2xl overflow-hidden transition-transform hover:scale-[1.01] shadow-sm"
                  style={{ backgroundColor: '#F3E7DD' }}>
                  <div className="h-1 w-full" style={{ backgroundColor: '#0766C6' }} />
                  <div className="p-4">
                    <p className="font-bold text-sm truncate" style={{ color: '#0766C6' }}>
                      {p.titel}
                    </p>
                    {p.componist && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#555' }}>
                        {p.componist}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {uploaders[p.leraar_id] && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#fff', color: '#0766C6' }}>
                          ✦ {uploaders[p.leraar_id]}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: '#bbb' }}>
                        {new Date(p.created_at).toLocaleDateString('nl-BE', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Snelle acties */}
        <div className="flex flex-col gap-3">
          {rol === 'leraar' && (
            <>
              <button
                onClick={() => router.push('/venster')}
                className="w-full py-4 rounded-2xl text-white font-semibold transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: '#FF560D' }}>
                Classview — oefenactiviteit studenten →
              </button>
              <button
                onClick={() => router.push('/partituren/nieuw')}
                className="w-full py-4 rounded-2xl text-white font-semibold transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: '#0766C6' }}>
                + Nieuwe partituur uploaden
              </button>
            </>
          )}
        </div>

      </div>
      <BottomNav />
    </main>
  )
}
