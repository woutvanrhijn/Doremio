'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

// ── Arc-carousel constanten ──────────────────────────────────────
const RADIUS = 340         // straal kaartcirkel
const HOEK_STAP = 40       // graden tussen kaarten
const PX_PER_GRAAD = (2 * Math.PI * RADIUS) / 360  // ~5.93 px/graad
const CENTER_OFFSET = 120  // px dat het cirkelcentrum ONDER de carousel-onderkant zit

function berekenActWeek(sessies: any[]): { act: number; week: number } {
  if (sessies.length === 0) return { act: 1, week: 1 }
  const vroegste = new Date(sessies[sessies.length - 1]?.created_at || Date.now())
  const weken = Math.max(1, Math.floor((Date.now() - vroegste.getTime()) / (7 * 86400000)) + 1)
  return { act: Math.ceil(weken / 4), week: ((weken - 1) % 4) + 1 }
}

// Positie van een kaart op de cirkel (center onderaan, actieve kaart bovenaan arc)
function arcPositie(hoek: number) {
  const rad = (hoek * Math.PI) / 180
  const x = RADIUS * Math.sin(rad)
  // y positief = zijkaarten zakken OMLAAG t.o.v. actieve kaart (vinyl/heuvel effect)
  const y = RADIUS * (1 - Math.cos(rad))
  const schaal = Math.max(0.75, 1 - Math.abs(hoek) / 120)
  const doorschijn = Math.max(0.45, 1 - Math.abs(hoek) / 100)
  return { x, y, schaal, doorschijn }
}

const KAART_KLEUREN = ['#22C55E', '#FF560D', '#0766C6', '#1A2E45', '#8FA3B8']

export default function PracticeStudioPage() {
  const router = useRouter()
  const [partituren, setPartituren] = useState<any[]>([])
  const [laasteSessie, setLaatsteSessie] = useState<any>(null)
  const [leraarMap, setLeraarMap] = useState<Record<string, string>>({})
  const [sessieAantallen, setSessieAantallen] = useState<Record<string, number>>({})
  const [actWeek, setActWeek] = useState({ act: 1, week: 1 })
  const [loading, setLoading] = useState(true)

  // Carousel state
  const [actieveIndex, setActieveIndex] = useState(0)
  const [hoekOffset, setHoekOffset] = useState(0)   // real-time drag offset in graden
  const [animeren, setAnimeren] = useState(true)
  const startXRef = useRef(0)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const [{ data: partsData }, { data: sessiesData }, { data: telData }] = await Promise.all([
        supabase.from('partituren').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('oefensessies')
          .select('id, created_at, partituur_id, partituren(id, titel, componist, leraar_id)')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('oefensessies')
          .select('partituur_id')
          .eq('student_id', user.id)
          .not('partituur_id', 'is', null),
      ])

      const parts = partsData || []
      const sessies = (sessiesData as any[]) || []
      setPartituren(parts)
      setLaatsteSessie(sessies[0] || null)
      setActWeek(berekenActWeek(sessies))

      // Sessieteller per partituur
      const aantallen: Record<string, number> = {}
      telData?.forEach((s: any) => {
        if (s.partituur_id) aantallen[s.partituur_id] = (aantallen[s.partituur_id] || 0) + 1
      })
      setSessieAantallen(aantallen)

      const leraarIds = [...new Set(parts.map((p: any) => p.leraar_id).filter(Boolean))] as string[]
      if (leraarIds.length > 0) {
        const { data: profielen } = await supabase.from('profiles').select('id, naam').in('id', leraarIds)
        const map: Record<string, string> = {}
        profielen?.forEach((p: any) => { map[p.id] = p.naam })
        setLeraarMap(map)
      }

      setLoading(false)
    }
    haalOp()
  }, [router])

  // ── Touch / drag handlers ────────────────────────────────────────
  function onDragStart(clientX: number) {
    isDraggingRef.current = true
    startXRef.current = clientX
    setAnimeren(false)
  }

  function onDragMove(clientX: number) {
    if (!isDraggingRef.current) return
    const deltaPx = startXRef.current - clientX       // negatief = swipe rechts
    const deltaHoek = deltaPx / PX_PER_GRAAD
    setHoekOffset(deltaHoek)
  }

  function onDragEnd(clientX: number) {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    const deltaPx = startXRef.current - clientX
    const deltaHoek = deltaPx / PX_PER_GRAAD

    // Snap naar dichtstbijzijnde kaart
    const stapDelta = Math.round(deltaHoek / HOEK_STAP)
    const nieuwIndex = Math.max(0, Math.min(partituren.length - 1, actieveIndex + stapDelta))
    setActieveIndex(nieuwIndex)
    setHoekOffset(0)
    setAnimeren(true)
  }

  if (loading) return (
    <main className="min-h-dvh bg-warm-white flex items-center justify-center">
      <p className="font-apercu text-body-md" style={{ color: '#0766C6' }}>Laden…</p>
    </main>
  )

  const laastePart = (laasteSessie as any)?.partituren
  const leraarNaam = laastePart?.leraar_id ? leraarMap[laastePart.leraar_id] : ''

  return (
    <main
      className="flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 16px)', paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', backgroundColor: '#F3E7DD' }}
    >
      {/* ── Warm-white topgedeelte ── */}
      <div className="flex-shrink-0 px-5 pt-3 pb-4">
        <button onClick={() => router.back()} className="mb-5 active:opacity-70">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0D1B2A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => {
            if (laastePart) {
              try { localStorage.setItem('quickplay_partituur_id', laastePart.id) } catch {}
            }
            router.push('/quickplay')
          }}
          className="w-full flex items-center gap-4 rounded-full px-5 mb-4 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: '#0766C6', height: 64 }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5M10 8l4 4-4 4" />
            </svg>
          </div>
          <span className="font-apercu font-bold text-white text-heading-md">
            Hervat laatste oefensessie
          </span>
        </button>

        {laastePart && (
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: '#0D1B2A' }}>
            {leraarNaam && (
              <p className="font-apercu text-caption mb-0.5" style={{ color: '#8FA3B8' }}>{leraarNaam}</p>
            )}
            <p className="font-apercu font-bold text-white text-body-lg leading-snug">
              "{laastePart.titel}"{laastePart.componist ? ` – ${laastePart.componist}` : ''}
            </p>
            <div className="flex gap-4 mt-1 flex-wrap">
              {['C-Mineur', '4/4', '70 BPM', 'Track'].map(t => (
                <span key={t} className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Navy ondergedeelte ── */}
      <div style={{ backgroundColor: '#0D1B2A', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>

        {/* Header tekst */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between mb-2">
            <h2 className="font-kiro text-display-md text-white">Practice Studio:</h2>
            <div className="text-right flex-shrink-0 ml-3 pt-1">
              <p className="font-apercu font-bold text-body-sm" style={{ color: '#FFD100' }}>ACT {actWeek.act}</p>
              <p className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>week {actWeek.week}</p>
            </div>
          </div>
          <p className="font-apercu text-body-sm" style={{ color: '#8FA3B8' }}>
            Selecteer je oefensessie naar keuze en je gewenste ondersteuning, of herhaal een vorige sessie!
          </p>
          <p className="font-apercu font-bold text-body-sm mt-1" style={{ color: '#8FA3B8' }}>
            Ready, set, go!
          </p>
        </div>

        {/* ── Arc carousel ── */}
        <div
          className="relative select-none"
          style={{ height: 340, cursor: 'grab' }}
          onTouchStart={e => onDragStart(e.touches[0].clientX)}
          onTouchMove={e => onDragMove(e.touches[0].clientX)}
          onTouchEnd={e => onDragEnd(e.changedTouches[0].clientX)}
          onMouseDown={e => onDragStart(e.clientX)}
          onMouseMove={e => onDragMove(e.clientX)}
          onMouseUp={e => onDragEnd(e.clientX)}
          onMouseLeave={e => { if (isDraggingRef.current) onDragEnd(e.clientX) }}
        >
          {/* Decoratieve bogen */}
          {[1200, 1000, 800].map((size, i) => (
            <div key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: size, height: size,
                border: `${[20, 17, 14][i]}px solid #0766C6`,
                opacity: [0.22, 0.16, 0.10][i],
                bottom: -(CENTER_OFFSET + size / 2),
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          ))}

          {/* Kaarten gepositioneerd langs de arc */}
          <div
            className="absolute"
            style={{ bottom: -CENTER_OFFSET, left: '50%', width: 0, height: 0 }}
          >
            {partituren.map((p, i) => {
              const relatieveIndex = i - actieveIndex
              const hoek = relatieveIndex * HOEK_STAP - hoekOffset
              const { x, y, schaal, doorschijn } = arcPositie(hoek)
              const isActief = i === actieveIndex && Math.abs(hoekOffset) < HOEK_STAP / 2
              const isVergrendeld = i >= 3
              const kleur = isVergrendeld ? '#1A2E45' : KAART_KLEUREN[i % 3]
              const breedte = isActief ? 170 : 148
              const hoogte = isActief ? 210 : 185

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isVergrendeld && Math.abs(hoekOffset) < 5) {
                      try { localStorage.setItem('quickplay_partituur_id', p.id) } catch {}
                      router.push('/quickplay')
                    }
                  }}
                  style={{
                    position: 'absolute',
                    width: breedte, height: hoogte,
                    transform: `translateX(calc(${x}px - ${breedte / 2}px)) translateY(calc(${y - RADIUS}px - ${hoogte}px)) scale(${schaal})`,
                    transition: animeren ? 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.35s ease' : 'none',
                    opacity: doorschijn,
                    zIndex: Math.round(schaal * 10),
                    borderRadius: 24,
                    backgroundColor: kleur,
                    cursor: isVergrendeld ? 'default' : 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: isActief ? 18 : 14, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 'auto', paddingBottom: 12 }}>
                      {i === 0 && (
                        <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFD100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="28" height="28" viewBox="0 0 43 43" fill="none">
                            <path d="M35.481 35.5H35.5M35.481 35.5C34.2356 36.735 31.9786 36.4274 30.3959 36.4274C28.453 36.4274 27.5174 36.8074 26.1309 38.194C24.9502 39.3747 23.3675 41.5 21.5 41.5C19.6326 41.5 18.0498 39.3748 16.8691 38.194C15.4826 36.8074 14.547 36.4274 12.6041 36.4274C11.0214 36.4274 8.76437 36.735 7.51898 35.5C6.26362 34.2551 6.57256 31.9888 6.57256 30.3958C6.57256 28.3828 6.13231 27.4572 4.69876 26.0237C2.56627 23.8912 1.50003 22.8249 1.5 21.5C1.50002 20.175 2.56625 19.1088 4.69871 16.9763C5.9784 15.6966 6.57256 14.4286 6.57256 12.6041C6.57256 11.0213 6.26499 8.76429 7.5 7.51889C8.74485 6.26357 11.0112 6.57251 12.6042 6.57251C14.4285 6.57251 15.6966 5.97841 16.9763 4.69874C19.1088 2.56625 20.175 1.5 21.5 1.5C22.825 1.5 23.8912 2.56625 26.0237 4.69874C27.3031 5.97813 28.5709 6.57251 30.3958 6.57251C31.9787 6.57251 34.2357 6.26494 35.4811 7.5C36.7364 8.74486 36.4274 11.0112 36.4274 12.6041C36.4274 14.6172 36.8677 15.5427 38.3013 16.9763C40.4338 19.1088 41.5 20.175 41.5 21.5C41.5 22.8249 40.4337 23.8912 38.3012 26.0237C36.8677 27.4572 36.4274 28.3829 36.4274 30.3958C36.4274 31.9888 36.7364 34.2551 35.481 35.5Z" stroke="#0D1B2A" strokeWidth="2.8"/>
                            <path d="M15.5 23.2857C15.5 23.2857 17.9 24.5893 19.1 26.5C19.1 26.5 22.7 19 27.5 16.5" stroke="#0D1B2A" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                      {i === 1 && (
                        <svg width={isActief ? 46 : 34} height={isActief ? 46 : 34} viewBox="0 0 54 54" fill="none">
                          <path d="M14.25 20.6251C14.25 24.1459 11.3958 27.0001 7.875 27.0001C4.35418 27.0001 1.5 24.1459 1.5 20.6251C1.5 17.1043 4.35418 14.2501 7.875 14.2501C11.3958 14.2501 14.25 17.1043 14.25 20.6251ZM14.25 20.6251V1.50012C15.1 2.77512 15.78 8.13012 21.9 9.15012" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="23.175" cy="46.1251" r="6.375" stroke="white" strokeWidth="3"/>
                          <circle cx="47.4" cy="42.3001" r="5.1" stroke="white" strokeWidth="3"/>
                          <path d="M29.55 46.1251L29.55 23.3501C29.55 21.5137 29.55 20.5956 30.0628 20.0253C30.5755 19.455 31.5655 19.3495 33.5453 19.1385C42.1138 18.2255 48.2356 14.5774 51.2434 12.5621C51.7989 12.1898 52.0767 12.0037 52.2884 12.1167C52.5001 12.2296 52.5001 12.5617 52.5001 13.2257V42.1112" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M29.55 29.5501C41.7901 29.5501 49.9501 23.6001 52.5001 21.9001" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {i >= 2 && (
                        <svg width="26" height="34" viewBox="0 0 57 57" fill="none" style={{ opacity: isVergrendeld ? 0.45 : 0.9 }}>
                          <path d="M28.5 39.1875V34.4375" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                          <path d="M10.136 44.756C10.67 48.723 13.956 51.831 17.954 52.015C21.319 52.169 24.736 52.25 28.5 52.25C32.264 52.25 35.681 52.169 39.046 52.015C43.044 51.831 46.33 48.723 46.864 44.756C47.212 42.167 47.5 39.514 47.5 36.813C47.5 34.111 47.212 31.458 46.864 28.869C46.33 24.902 43.044 21.794 39.046 21.61C35.681 21.456 32.264 21.375 28.5 21.375C24.736 21.375 21.319 21.456 17.954 21.61C13.956 21.794 10.67 24.902 10.136 28.869C9.787 31.458 9.5 34.111 9.5 36.813C9.5 39.514 9.787 42.167 10.136 44.756Z" stroke="white" strokeWidth="3"/>
                          <path d="M17.8125 21.375V15.4375C17.8125 9.535 22.5975 4.75 28.5 4.75C34.4026 4.75 39.1875 9.535 39.1875 15.4375V21.375" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    <div>
                      <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: isActief ? 13 : 11, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        "{p.titel}"
                      </p>
                      {leraarMap[p.leraar_id] && (
                        <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {leraarMap[p.leraar_id]}
                        </p>
                      )}
                      <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontSize: isActief ? 11 : 10, marginTop: 4 }}>
                        {sessieAantallen[p.id] ? `${sessieAantallen[p.id]}× gespeeld` : 'Nog niet gespeeld'}
                      </p>
                      <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>
                        {new Date(p.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Puntjesindicator */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 pointer-events-none">
            {partituren.map((_, i) => (
              <div key={i} style={{
                width: i === actieveIndex ? 20 : 6,
                height: 6, borderRadius: 3,
                backgroundColor: i === actieveIndex ? '#FF560D' : 'rgba(255,255,255,0.3)',
                transition: 'width 0.3s ease, background-color 0.3s ease',
              }} />
            ))}
          </div>
        </div>

        {/* Alle oefensessies knop */}
        <div className="px-5 pt-4 pb-6">
          <button
            onClick={() => router.push('/sessies')}
            className="w-full rounded-full font-apercu font-bold text-white text-body-lg active:scale-95 transition-transform"
            style={{ backgroundColor: '#FF560D', height: 52 }}
          >
            Alle oefensessies
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
