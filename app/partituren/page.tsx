'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

type Partituur = {
  id: string
  titel: string
  componist: string | null
  leraar_id: string
  klas_id: string | null
  created_at: string
}

export default function PartiturenLijst() {
  const [partituren, setPartituren] = useState<Partituur[]>([])
  const [uploaders, setUploaders] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [rol, setRol] = useState('')
  const [userId, setUserId] = useState('')
  const [laastGeoefendId, setLaastGeoefendId] = useState<string | null>(null)
  const [alleZichtbaar, setAlleZichtbaar] = useState(false)

  // Leraar state
  const [zoekterm, setZoekterm] = useState('')
  const [zoektermOpgeslagen, setZoektermOpgeslagen] = useState('')
  const [sorteerRichting, setSorteerRichting] = useState<'desc' | 'asc'>('desc')
  const [selecteerModus, setSelecteerModus] = useState(false)
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set())
  const [toonDeelModal, setToonDeelModal] = useState(false)
  const [klassen, setKlassen] = useState<{ id: string; naam: string }[]>([])
  const [gekozenKlasId, setGekozenKlasId] = useState<string | null>(null)
  const [deelBezig, setDeelBezig] = useState(false)
  const [opgeslagenIds, setOpgeslagenIds] = useState<Set<string>>(new Set())
  const [opgeslagenPartituren, setOpgeslagenPartituren] = useState<Partituur[]>([])
  const [filterUploader, setFilterUploader] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profiel } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const gevondenRol = profiel?.role || ''
      setRol(gevondenRol)

      let lijst: Partituur[] = []

      if (gevondenRol === 'leraar') {
        const [{ data: partData }, { data: klasData }, { data: opsData }] = await Promise.all([
          supabase.from('partituren').select('*').eq('leraar_id', user.id)
            .order('created_at', { ascending: false }),
          supabase.from('klassen').select('id, naam').eq('leraar_id', user.id).order('naam'),
          supabase.from('annotaties').select('partituur_id')
            .eq('auteur_id', user.id).eq('type', 'opgeslagen'),
        ])
        lijst = partData || []
        setKlassen(klasData || [])

        const opsIds = new Set((opsData || []).map((a: any) => a.partituur_id as string))
        setOpgeslagenIds(opsIds)
        setOpgeslagenPartituren(lijst.filter(p => opsIds.has(p.id)))
      } else {
        const { data: ksData } = await supabase
          .from('klas_studenten').select('klas_id').eq('student_id', user.id)
        const klasIds = (ksData || []).map((k: any) => k.klas_id)

        if (klasIds.length > 0) {
          const { data: toegewezen } = await supabase
            .from('partituren').select('*').in('klas_id', klasIds)
            .order('created_at', { ascending: false })
          const { data: algemeen } = await supabase
            .from('partituren').select('*').is('klas_id', null)
            .order('created_at', { ascending: false })
          const alle = [...(toegewezen || []), ...(algemeen || [])]
          lijst = alle.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
        } else {
          const { data } = await supabase
            .from('partituren').select('*').is('klas_id', null)
            .order('created_at', { ascending: false })
          lijst = data || []
        }

        const { data: sessie } = await supabase
          .from('oefensessies').select('partituur_id').eq('student_id', user.id)
          .order('created_at', { ascending: false }).limit(1).single()
        if (sessie?.partituur_id) setLaastGeoefendId(sessie.partituur_id)
      }

      setPartituren(lijst)

      const leraarIds = [...new Set(lijst.map(p => p.leraar_id).filter(Boolean))]
      if (leraarIds.length > 0) {
        const { data: profielen } = await supabase
          .from('profiles').select('id, naam').in('id', leraarIds)
        const map: Record<string, string> = {}
        profielen?.forEach((p: any) => { map[p.id] = p.naam })
        setUploaders(map)
      }

      setLoading(false)
    }
    haalOp()
  }, [router])

  const toggleSelecteer = (id: string) => {
    setGeselecteerd(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const toggleOpslaan = async (e: React.MouseEvent, partituurId: string) => {
    e.stopPropagation()
    if (opgeslagenIds.has(partituurId)) {
      await supabase.from('annotaties').delete()
        .eq('auteur_id', userId).eq('partituur_id', partituurId).eq('type', 'opgeslagen')
      setOpgeslagenIds(prev => { const s = new Set(prev); s.delete(partituurId); return s })
      setOpgeslagenPartituren(prev => prev.filter(p => p.id !== partituurId))
    } else {
      await supabase.from('annotaties').insert({
        auteur_id: userId, partituur_id: partituurId, type: 'opgeslagen', inhoud: ''
      })
      setOpgeslagenIds(prev => new Set([...prev, partituurId]))
      const gevonden = partituren.find(p => p.id === partituurId)
      if (gevonden) setOpgeslagenPartituren(prev => [...prev, gevonden])
    }
  }

  const deelMetKlas = async () => {
    if (!gekozenKlasId || geselecteerd.size === 0) return
    setDeelBezig(true)
    await Promise.all(
      [...geselecteerd].map(id =>
        supabase.from('partituren').update({ klas_id: gekozenKlasId }).eq('id', id)
      )
    )
    setPartituren(prev => prev.map(p => geselecteerd.has(p.id) ? { ...p, klas_id: gekozenKlasId } : p))
    setOpgeslagenPartituren(prev => prev.map(p => geselecteerd.has(p.id) ? { ...p, klas_id: gekozenKlasId } : p))
    setGeselecteerd(new Set())
    setSelecteerModus(false)
    setToonDeelModal(false)
    setGekozenKlasId(null)
    setDeelBezig(false)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  // ===== LERAAR VIEW =====
  if (rol === 'leraar') {
    const sorteer = (a: Partituur, b: Partituur) => sorteerRichting === 'desc'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

    const zoekFilter = (p: Partituur) => {
      if (!zoekterm) return true
      const z = zoekterm.toLowerCase()
      return p.titel.toLowerCase().includes(z) || (p.componist?.toLowerCase().includes(z) ?? false)
    }

    const gefilterdeMijn = partituren.filter(zoekFilter).sort(sorteer)

    const uniekUploaders = [...new Set(opgeslagenPartituren.map(p => p.leraar_id))]
    const zoekFilterOpgeslagen = (p: Partituur) => {
      if (!zoektermOpgeslagen) return true
      const z = zoektermOpgeslagen.toLowerCase()
      return p.titel.toLowerCase().includes(z) || (p.componist?.toLowerCase().includes(z) ?? false)
    }

    const gefilterdOpgeslagen = opgeslagenPartituren
      .filter(p => zoekFilterOpgeslagen(p) && (!filterUploader || p.leraar_id === filterUploader))
      .sort(sorteer)

    return (
      <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>

        {/* Blauwe header */}
        <div style={{ backgroundColor: '#0766C6' }}>
          <div className="max-w-lg mx-auto px-6 pt-10 pb-6">
            <h1 className="text-2xl font-bold text-white">Partituren</h1>
            <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>
              {partituren.length} {partituren.length === 1 ? 'stuk' : 'stukken'} geüpload
            </p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-6 mt-5 flex flex-col gap-5">

          {/* Nieuwe partituur widget */}
          <button
            onClick={() => router.push('/partituren/nieuw')}
            className="w-full rounded-2xl overflow-hidden shadow-sm text-left transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: '#FF560D' }}>
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                  style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Lesmateriaal
                </p>
                <p className="text-white font-bold text-lg leading-tight">Nieuwe partituur aanmaken</p>
                <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  PDF uploaden · AI herkent titel en componist
                </p>
              </div>
              <span className="text-4xl opacity-80">🎼</span>
            </div>
          </button>

          {/* Zoek + sorteer balk */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#bbb' }}>🔍</span>
              <input
                type="text"
                placeholder="Zoek op naam of componist..."
                value={zoekterm}
                onChange={e => setZoekterm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: '#fff', color: '#333' }}
              />
            </div>
            <button
              onClick={() => setSorteerRichting(r => r === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold flex-shrink-0 whitespace-nowrap"
              style={{ backgroundColor: '#fff', color: '#0766C6' }}>
              {sorteerRichting === 'desc' ? '↓ Nieuwste' : '↑ Oudste'}
            </button>
          </div>

          {/* ── Twee kolommen: Mijn partituren | Opgeslagen ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>

            {/* Kolom 1 — Mijn partituren */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
                  Mijn{zoekterm ? ` (${gefilterdeMijn.length})` : ` · ${partituren.length}`}
                </p>
                <button
                  onClick={() => { setSelecteerModus(v => !v); setGeselecteerd(new Set()) }}
                  className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: selecteerModus ? '#0766C6' : '#F3E7DD',
                    color: selecteerModus ? '#fff' : '#0766C6',
                  }}>
                  {selecteerModus ? '✕' : 'Kies'}
                </button>
              </div>

              {gefilterdeMijn.length === 0 ? (
                <div className="rounded-2xl p-5 flex flex-col items-center gap-2 text-center"
                  style={{ backgroundColor: '#fff' }}>
                  <span className="text-2xl">{zoekterm ? '🔍' : '🎵'}</span>
                  <p className="text-xs font-semibold" style={{ color: '#333' }}>
                    {zoekterm ? 'Geen resultaten' : 'Nog geen partituren'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {gefilterdeMijn.map(p => (
                    <div key={p.id}
                      onClick={() => selecteerModus ? toggleSelecteer(p.id) : router.push(`/partituren/${p.id}`)}
                      className="rounded-2xl overflow-hidden shadow-sm transition-transform hover:scale-[1.01] cursor-pointer"
                      style={{
                        backgroundColor: '#fff',
                        outline: geselecteerd.has(p.id) ? '2.5px solid #0766C6' : 'none',
                      }}>
                      <div className="h-0.5 w-full" style={{ backgroundColor: '#0766C6' }} />
                      <div className="p-3">
                        <div className="flex items-start gap-2 mb-2">
                          {selecteerModus && (
                            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{
                                borderColor: geselecteerd.has(p.id) ? '#0766C6' : '#ddd',
                                backgroundColor: geselecteerd.has(p.id) ? '#0766C6' : 'transparent',
                              }}>
                              {geselecteerd.has(p.id) && (
                                <span className="text-white font-bold" style={{ fontSize: '9px' }}>✓</span>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate leading-snug" style={{ color: '#0766C6' }}>{p.titel}</p>
                            {p.componist && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: '#555' }}>{p.componist}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {p.klas_id && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                                style={{ backgroundColor: '#FF560D', color: '#fff' }}>
                                👥
                              </span>
                            )}
                            <span className="text-xs truncate" style={{ color: '#bbb' }}>
                              {new Date(p.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          {!selecteerModus && (
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={e => toggleOpslaan(e, p.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                title={opgeslagenIds.has(p.id) ? 'Verwijder uit opgeslagen' : 'Opslaan'}
                                style={{ backgroundColor: opgeslagenIds.has(p.id) ? '#FFF8E1' : '#F3E7DD', fontSize: '13px' }}>
                                {opgeslagenIds.has(p.id) ? '🔖' : '🏷️'}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); router.push(`/partituren/${p.id}/bewerken`) }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: '#F3E7DD', fontSize: '13px' }}>
                                ✏️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Kolom 2 — Opgeslagen */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
                  Opgeslagen · {gefilterdOpgeslagen.length}
                </p>
                {uniekUploaders.length > 1 && (
                  <button
                    onClick={() => setFilterUploader(filterUploader ? null : uniekUploaders[0])}
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                    Filter
                  </button>
                )}
              </div>

              {/* Zoekbalk opgeslagen */}
              <div className="relative mb-2">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#bbb' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Zoek..."
                  value={zoektermOpgeslagen}
                  onChange={e => setZoektermOpgeslagen(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl text-xs outline-none"
                  style={{ backgroundColor: '#fff', color: '#333' }}
                />
              </div>

              {uniekUploaders.length > 1 && filterUploader !== null && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <button onClick={() => setFilterUploader(null)}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: '#fff', color: '#666' }}>
                    Alle
                  </button>
                  {uniekUploaders.map(lid => (
                    <button key={lid} onClick={() => setFilterUploader(lid)}
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: filterUploader === lid ? '#0766C6' : '#fff',
                        color: filterUploader === lid ? '#fff' : '#666',
                      }}>
                      {uploaders[lid] || 'Onbekend'}
                    </button>
                  ))}
                </div>
              )}

              {gefilterdOpgeslagen.length === 0 ? (
                <div className="rounded-2xl p-5 flex flex-col items-center gap-2 text-center"
                  style={{ backgroundColor: '#fff' }}>
                  <span className="text-2xl">🔖</span>
                  <p className="text-xs font-semibold" style={{ color: '#333' }}>
                    {zoekterm ? 'Geen resultaten' : 'Nog niets opgeslagen'}
                  </p>
                  <p className="text-xs" style={{ color: '#888' }}>
                    Gebruik 🏷️ om op te slaan
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {gefilterdOpgeslagen.map(p => (
                    <div key={p.id}
                      onClick={() => router.push(`/partituren/${p.id}`)}
                      className="rounded-2xl overflow-hidden shadow-sm transition-transform hover:scale-[1.01] cursor-pointer"
                      style={{ backgroundColor: '#fff' }}>
                      <div className="h-0.5 w-full" style={{ backgroundColor: '#FFD100' }} />
                      <div className="p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate leading-snug" style={{ color: '#0766C6' }}>{p.titel}</p>
                            {p.componist && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: '#555' }}>{p.componist}</p>
                            )}
                          </div>
                          <button
                            onClick={e => toggleOpslaan(e, p.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            title="Verwijder uit opgeslagen"
                            style={{ backgroundColor: '#FFF8E1', fontSize: '13px' }}>
                            🔖
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {p.klas_id && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: '#FF560D', color: '#fff' }}>
                              👥
                            </span>
                          )}
                          <span className="text-xs" style={{ color: '#bbb' }}>
                            {new Date(p.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Floating selecteer-balk */}
        {selecteerModus && geselecteerd.size > 0 && (
          <div className="fixed bottom-24 left-0 right-0 px-6 z-40">
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => setToonDeelModal(true)}
                className="w-full py-4 rounded-2xl font-bold text-base shadow-lg transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: '#0766C6', color: '#fff' }}>
                {geselecteerd.size} geselecteerd — Delen met klas →
              </button>
            </div>
          </div>
        )}

        {/* Deel-modal */}
        {toonDeelModal && (
          <div className="fixed inset-0 z-50 flex items-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            onClick={() => setToonDeelModal(false)}>
            <div className="w-full max-w-lg mx-auto rounded-t-3xl p-6 pb-12"
              style={{ backgroundColor: '#fff' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: '#e5e7eb' }} />
              <p className="font-bold text-lg mb-1" style={{ color: '#333' }}>Deel met klas</p>
              <p className="text-sm mb-5" style={{ color: '#888' }}>
                {geselecteerd.size} partituur{geselecteerd.size !== 1 ? 'en' : ''} worden gedeeld
              </p>
              {klassen.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: '#bbb' }}>
                  Nog geen klassen aangemaakt. Ga naar Classview → Klassen om klassen te maken.
                </p>
              ) : (
                <div className="flex flex-col gap-2 mb-5">
                  {klassen.map(k => (
                    <button key={k.id}
                      onClick={() => setGekozenKlasId(k.id)}
                      className="w-full py-3.5 px-4 rounded-xl text-left font-semibold text-sm transition-colors"
                      style={{
                        backgroundColor: gekozenKlasId === k.id ? '#0766C6' : '#F3E7DD',
                        color: gekozenKlasId === k.id ? '#fff' : '#333',
                      }}>
                      {k.naam}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={deelMetKlas}
                disabled={!gekozenKlasId || deelBezig}
                className="w-full py-3.5 rounded-xl font-bold text-base text-white transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: gekozenKlasId ? '#FF560D' : '#e5e7eb' }}>
                {deelBezig ? 'Bezig...' : 'Bevestig delen'}
              </button>
            </div>
          </div>
        )}

        <BottomNav />
      </main>
    )
  }

  // ===== STUDENT VIEW — OEFENLAUNCHER =====
  const gesorteerd = [...partituren].sort((a, b) => {
    if (a.id === laastGeoefendId) return -1
    if (b.id === laastGeoefendId) return 1
    return 0
  })
  const hoofdPartituur = gesorteerd[0] || null
  const overigePartituren = gesorteerd.slice(1)
  const zichtbareOverige = alleZichtbaar ? overigePartituren : overigePartituren.slice(0, 3)

  if (partituren.length === 0) {
    return (
      <main className="min-h-screen px-6 py-10 pb-28 flex flex-col items-center justify-center"
        style={{ backgroundColor: '#F3E7DD' }}>
        <span className="text-5xl mb-4">🎼</span>
        <p className="font-semibold text-lg mb-2" style={{ color: '#333' }}>Nog geen partituren</p>
        <p className="text-sm text-center" style={{ color: '#888' }}>
          Je leraar heeft nog geen partituren gedeeld.
        </p>
        <BottomNav />
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#F3E7DD' }}>

      {/* Header */}
      <div className="px-6 pt-10 pb-6" style={{ backgroundColor: '#0766C6' }}>
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white">Oefenen</h1>
          <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>
            {partituren.length} stuk{partituren.length !== 1 ? 'ken' : ''} beschikbaar
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 mt-5 flex flex-col gap-4">

        {/* Quickstart — nieuwe oefensessie */}
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#0766C6' }}>
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: 'rgba(255,255,255,0.6)' }}>
              Quickstart
            </p>
            <p className="text-white font-bold text-xl mb-1">Nieuwe oefensessie</p>
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Kies een stuk en begin direct
            </p>
            <div className="flex flex-col gap-2">
              {partituren.slice(0, 3).map(p => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/studio/${p.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-transform hover:scale-[1.01]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                    ♪
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{p.titel}</p>
                    {p.componist && (
                      <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{p.componist}</p>
                    )}
                  </div>
                  <span className="text-white text-lg flex-shrink-0">▶</span>
                </button>
              ))}
              {partituren.length > 3 && (
                <button
                  onClick={() => setAlleZichtbaar(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}>
                  Alle {partituren.length} stukken bekijken ↓
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Verdergaan — laatste sessie */}
        {laastGeoefendId && partituren.find(p => p.id === laastGeoefendId) && (() => {
          const p = partituren.find(pp => pp.id === laastGeoefendId)!
          return (
            <div className="rounded-2xl overflow-hidden shadow-sm" style={{ backgroundColor: '#FF560D' }}>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1"
                  style={{ color: 'rgba(255,255,255,0.65)' }}>
                  ↩ Ga verder waar je was
                </p>
                <p className="text-white font-bold text-xl leading-tight mb-0.5">{p.titel}</p>
                {p.componist && (
                  <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.75)' }}>{p.componist}</p>
                )}
                {!p.componist && <div className="mb-4" />}
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/studio/${p.id}`)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm"
                    style={{ backgroundColor: '#fff', color: '#FF560D' }}>
                    ▶ Ga verder
                  </button>
                  <button
                    onClick={() => router.push(`/partituren/${p.id}`)}
                    className="px-4 py-3 rounded-xl font-medium text-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                    Info
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Overige partituren */}
        {overigePartituren.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3 px-1"
              style={{ color: '#888' }}>
              Andere stukken
            </p>
            <div className="flex flex-col gap-3">
              {zichtbareOverige.map(p => (
                <div key={p.id} className="rounded-2xl overflow-hidden shadow-sm"
                  style={{ backgroundColor: '#fff' }}>
                  <div className="h-1 w-full" style={{ backgroundColor: '#0766C6' }} />
                  <div className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base truncate" style={{ color: '#0766C6' }}>
                        {p.titel}
                      </p>
                      {p.componist && (
                        <p className="text-sm truncate mt-0.5" style={{ color: '#666' }}>
                          {p.componist}
                        </p>
                      )}
                      {uploaders[p.leraar_id] && (
                        <p className="text-xs mt-1" style={{ color: '#aaa' }}>
                          ✦ {uploaders[p.leraar_id]}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => router.push(`/studio/${p.id}`)}
                        className="px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-transform hover:scale-[1.02]"
                        style={{ backgroundColor: '#FF560D' }}>
                        ▶ Start
                      </button>
                      <button
                        onClick={() => router.push(`/partituren/${p.id}`)}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-center"
                        style={{ backgroundColor: '#F3E7DD', color: '#888' }}>
                        Info
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {overigePartituren.length > 3 && !alleZichtbaar && (
              <button
                onClick={() => setAlleZichtbaar(true)}
                className="w-full mt-3 py-3.5 rounded-2xl text-sm font-semibold"
                style={{ backgroundColor: '#fff', color: '#0766C6' }}>
                Alle {overigePartituren.length} stukken bekijken ↓
              </button>
            )}
          </div>
        )}

      </div>
      <BottomNav />
    </main>
  )
}
