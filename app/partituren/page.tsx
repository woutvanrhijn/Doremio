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
  bestand_url: string | null
  leraar_audio_url: string | null
}

const FICTIEVE_PARTITUREN: Array<{
  id: string; titel: string; componist: string | null
  leraarNaam: string; klasNaam: string | null; datum: string; isOpname: boolean
}> = [
  { id: 'fict-1', titel: 'Knockin\' On Heaven\'s Door', componist: 'Bob Dylan', leraarNaam: 'Lukas D\'hondt', klasNaam: '2A', datum: new Date(Date.now() - 5 * 86400000).toISOString(), isOpname: false },
  { id: 'fict-2', titel: 'Friday I\'m In Love', componist: 'The Cure', leraarNaam: 'G. Jansen', klasNaam: '3C', datum: new Date(Date.now() - 10 * 86400000).toISOString(), isOpname: false },
  { id: 'fict-3', titel: 'Nocturne Op. 9 No. 2', componist: 'Frédéric Chopin', leraarNaam: 'H. Jacobs', klasNaam: '1A', datum: new Date(Date.now() - 14 * 86400000).toISOString(), isOpname: true },
  { id: 'fict-4', titel: 'Say It Ain\'t So', componist: 'Weezer', leraarNaam: 'K. Lemmens', klasNaam: '2B', datum: new Date(Date.now() - 20 * 86400000).toISOString(), isOpname: false },
]

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
  const [modusLeraar, setModusLeraar] = useState<'bekijken' | 'bewerken'>('bekijken')
  const [actieveFilter, setActieveFilter] = useState<'all' | string>('all')
  const [feedGelikt, setFeedGelikt] = useState<Set<string>>(new Set())
  const [fictOpgeslagen, setFictOpgeslagen] = useState<Set<string>>(new Set())
  const [feedCommentOpen, setFeedCommentOpen] = useState<string | null>(null)
  const [feedCommentTekst, setFeedCommentTekst] = useState<Record<string, string>>({})
  const [verwijderBevestig, setVerwijderBevestig] = useState<string | null>(null)

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

  const verwijderPartituur = async (id: string) => {
    const res = await fetch('/api/verwijder-partituur', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partituurId: id, leraarId: userId }),
    })
    if (!res.ok) {
      const { error } = await res.json()
      console.error('Verwijderen mislukt:', error)
      return
    }
    setPartituren(prev => prev.filter(p => p.id !== id))
    setOpgeslagenPartituren(prev => prev.filter(p => p.id !== id))
    setVerwijderBevestig(null)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  // ===== LERAAR VIEW =====
  if (rol === 'leraar') {
    const sorteer = (a: Partituur, b: Partituur) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

    const zoekFilter = (p: Partituur) => {
      if (!zoekterm) return true
      const z = zoekterm.toLowerCase()
      return p.titel.toLowerCase().includes(z) || (p.componist?.toLowerCase().includes(z) ?? false)
    }

    const feedPartituren = (() => {
      let lijst = partituren
      if (actieveFilter === 'opgeslagen') lijst = opgeslagenPartituren
      else if (actieveFilter !== 'all') lijst = partituren.filter(p => p.klas_id === actieveFilter)
      return lijst.filter(zoekFilter).sort(sorteer)
    })()

    // Combine real + fictitious, sorted by date
    type FeedItem =
      | (Partituur & { fictief: false })
      | { id: string; titel: string; componist: string | null; leraarNaam: string; klasNaam: string | null; datum: string; fictief: true; created_at: string; isOpname: boolean }

    const combineerFeed: FeedItem[] = [
      ...feedPartituren.map(p => ({ ...p, fictief: false as const })),
      ...FICTIEVE_PARTITUREN.map(f => ({ ...f, fictief: true as const, created_at: f.datum })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // ─── BEKIJKEN modus ───
    if (modusLeraar === 'bekijken') {
      return (
        <main style={{ backgroundColor: '#0D1B2A', minHeight: '100dvh', paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
          {/* Header */}
          <div style={{ paddingTop: 'calc(env(safe-area-inset-top, 16px) + 20px)', paddingLeft: 20, paddingRight: 20, paddingBottom: 0 }}>
            <h1 className="font-apercu font-bold" style={{ fontSize: 32, color: '#fff', marginBottom: 16 }}>
              Lesmateriaal
            </h1>

            {/* Segment tabs */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, borderRadius: 999, padding: '14px 0', textAlign: 'center', backgroundColor: '#0766C6', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 14, color: '#fff' }}>
                Bekijken
              </div>
              <button
                onClick={() => setModusLeraar('bewerken')}
                style={{ flex: 1, borderRadius: 999, padding: '14px 0', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.6)' }}
              >
                Bewerken
              </button>
            </div>

            {/* Zoekbalk */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8FA3B8" strokeWidth="2" strokeLinecap="round"
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Zoek lesmateriaal..."
                value={zoekterm}
                onChange={e => setZoekterm(e.target.value)}
                className="font-apercu"
                style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
              />
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' as const, scrollbarWidth: 'none' as const, marginBottom: 20, paddingBottom: 4 }}>
              {[{ key: 'all', label: 'Alles' }, ...klassen.map(k => ({ key: k.id, label: k.naam })), { key: 'opgeslagen', label: 'Opgeslagen' }].map(f => (
                <button key={f.key} onClick={() => setActieveFilter(f.key)} className="font-apercu"
                  style={{ flexShrink: 0, borderRadius: 999, padding: '8px 16px', backgroundColor: actieveFilter === f.key ? '#FF560D' : 'rgba(255,255,255,0.08)', color: actieveFilter === f.key ? '#fff' : '#8FA3B8', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feed */}
          <div style={{ paddingLeft: 20, paddingRight: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {combineerFeed.length === 0 ? (
              <div style={{ borderRadius: 16, padding: '40px 24px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <p className="font-apercu font-bold" style={{ fontSize: 16, color: '#fff', margin: '0 0 8px' }}>
                  {zoekterm ? 'Geen resultaten' : 'Nog geen lesmateriaal'}
                </p>
                <button onClick={() => router.push('/partituren/nieuw')} className="font-apercu font-bold"
                  style={{ backgroundColor: '#0766C6', border: 'none', cursor: 'pointer', borderRadius: 999, padding: '10px 20px', color: '#fff', fontSize: 14, marginTop: 8 }}>
                  Nieuw toevoegen
                </button>
              </div>
            ) : combineerFeed.map(item => {
              const isEigen = item.fictief === false
              const isOpname = item.fictief ? (item as any).isOpname : false
              const kleur = isOpname ? '#FFD100' : '#FF560D'
              const kleurBg = isOpname ? 'rgba(255,209,0,0.1)' : 'rgba(255,86,13,0.1)'
              const gelikt = feedGelikt.has(item.id)
              const opgeslaanActief = isEigen ? opgeslagenIds.has(item.id) : fictOpgeslagen.has(item.id)
              const commentOpen = feedCommentOpen === item.id
              const leraarNaam = item.fictief ? (item as any).leraarNaam : (uploaders[(item as any).leraar_id] ?? 'Jij')
              const klasNaam = item.fictief ? (item as any).klasNaam : (klassen.find(k => k.id === (item as any).klas_id)?.naam ?? null)

              const handleOpslaan = (e: React.MouseEvent) => {
                e.stopPropagation()
                if (isEigen) {
                  toggleOpslaan(e, item.id)
                } else {
                  setFictOpgeslagen(prev => {
                    const s = new Set(prev)
                    if (s.has(item.id)) s.delete(item.id); else s.add(item.id)
                    return s
                  })
                }
              }

              return (
                <div key={item.id} style={{ borderRadius: 16, overflow: 'hidden', borderLeft: `4px solid ${kleur}` }}>
                  {/* Header strip */}
                  <div style={{ backgroundColor: kleurBg, padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isOpname ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth="2.5" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                      <span className="font-apercu font-bold" style={{ fontSize: 10, color: kleur, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>
                        {isOpname ? 'Opname · Lesmateriaal' : isEigen ? 'Mijn lesmateriaal' : 'Lesmateriaal collega'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isOpname && (
                        <span className="font-apercu font-bold" style={{ fontSize: 10, color: kleur, backgroundColor: 'rgba(255,209,0,0.2)', borderRadius: 20, padding: '2px 8px' }}>
                          Opname
                        </span>
                      )}
                      {!item.fictief && (
                        <span className="font-apercu font-bold" style={{ fontSize: 10, color: '#0766C6', backgroundColor: 'rgba(7,102,198,0.2)', borderRadius: 20, padding: '2px 8px' }}>
                          Eigen
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: kleur, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isOpname ? (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                          </svg>
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="font-apercu" style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                          {leraarNaam} {klasNaam ? `· Klas ${klasNaam}` : ''} · {new Date(item.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="font-apercu font-bold" style={{ fontSize: 14, color: '#fff', margin: '4px 0 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          &ldquo;{item.titel}&rdquo;
                          {item.componist && <span style={{ fontWeight: 500, fontStyle: 'normal', color: 'rgba(255,255,255,0.6)' }}> {item.componist}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Actie knoppen */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {/* Opslaan */}
                        <button onClick={handleOpslaan} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: opgeslaanActief ? 'rgba(255,209,0,0.12)' : 'transparent' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={opgeslaanActief ? '#FFD100' : 'none'} stroke={opgeslaanActief ? '#FFD100' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="font-apercu font-bold" style={{ fontSize: 11, color: opgeslaanActief ? '#FFD100' : 'rgba(255,255,255,0.5)' }}>Opslaan</span>
                        </button>
                        {/* Liken */}
                        <button onClick={() => setFeedGelikt(prev => { const s = new Set(prev); if (s.has(item.id)) s.delete(item.id); else s.add(item.id); return s })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: gelikt ? 'rgba(255,86,13,0.12)' : 'transparent' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={gelikt ? '#FF560D' : 'none'} stroke={gelikt ? '#FF560D' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                        {/* Reageren */}
                        <button onClick={() => setFeedCommentOpen(commentOpen ? null : item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: commentOpen ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="font-apercu font-bold" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Reageren</span>
                        </button>
                      </div>

                      {/* Bewerken + Verwijderen alleen voor eigen items */}
                      {isEigen && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={e => { e.stopPropagation(); router.push(`/partituren/${item.id}/bewerken`) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span className="font-apercu font-bold" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Bewerken</span>
                          </button>
                          <button onClick={() => setVerwijderBevestig(verwijderBevestig === item.id ? null : item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, backgroundColor: verwijderBevestig === item.id ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={verwijderBevestig === item.id ? '#EF4444' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                            <span className="font-apercu font-bold" style={{ fontSize: 11, color: verwijderBevestig === item.id ? '#EF4444' : 'rgba(255,255,255,0.5)' }}>Verwijderen</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Verwijder bevestiging */}
                    {isEigen && verwijderBevestig === item.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span className="font-apercu" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', flex: 1 }}>Lesmateriaal verwijderen?</span>
                        <button onClick={() => verwijderPartituur(item.id)}
                          style={{ backgroundColor: '#EF4444', border: 'none', cursor: 'pointer', borderRadius: 16, padding: '6px 14px', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: '#fff' }}>
                          Ja
                        </button>
                        <button onClick={() => setVerwijderBevestig(null)}
                          style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', borderRadius: 16, padding: '6px 14px', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                          Nee
                        </button>
                      </div>
                    )}

                    {/* Comment input */}
                    {commentOpen && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <input
                          type="text"
                          placeholder="Schrijf een reactie..."
                          value={feedCommentTekst[item.id] ?? ''}
                          onChange={e => setFeedCommentTekst(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { setFeedCommentTekst(prev => ({ ...prev, [item.id]: '' })); setFeedCommentOpen(null) } }}
                          autoFocus
                          style={{ flex: 1, border: 'none', outline: 'none', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '8px 14px', fontFamily: 'var(--font-apercu)', fontSize: 13, color: '#fff' }}
                        />
                        <button onClick={() => { setFeedCommentTekst(prev => ({ ...prev, [item.id]: '' })); setFeedCommentOpen(null) }}
                          style={{ backgroundColor: kleur, border: 'none', cursor: 'pointer', borderRadius: 20, padding: '8px 16px', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: isOpname ? '#0D1B2A' : '#fff', flexShrink: 0 }}>
                          Stuur
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* FAB: nieuw toevoegen */}
          <button
            onClick={() => router.push('/partituren/nieuw')}
            style={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))', right: 20, width: 56, height: 56, borderRadius: 999, backgroundColor: '#0766C6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(7,102,198,0.4)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <BottomNav />
        </main>
      )
    }

    // ─── BEWERKEN modus ───
    const gefilterdeMijn = partituren.filter(p => {
      if (!zoekterm) return true
      const z = zoekterm.toLowerCase()
      return p.titel.toLowerCase().includes(z) || (p.componist?.toLowerCase().includes(z) ?? false)
    }).sort(sorteer)

    return (
      <main className="page px-page">

        {/* Header */}
        <div className="pt-6 pb-2">
          <h1 className="font-apercu font-bold text-display-md" style={{ color: '#0766C6' }}>
            Lesmateriaal
          </h1>
        </div>

        {/* Segment tabs */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setModusLeraar('bekijken')}
            className="flex-1 py-3 rounded-full font-apercu font-bold text-body-md text-white active:scale-95 transition-transform duration-100"
            style={{ backgroundColor: '#0766C6' }}
          >
            Lesmateriaal bekijken
          </button>
          <button
            className="flex-1 py-3 rounded-full font-apercu font-bold text-body-md text-white active:scale-95 transition-transform duration-100"
            style={{ backgroundColor: '#FF560D' }}
          >
            Lesmateriaal bewerken
          </button>
        </div>

        {/* Zoek + selecteer */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Zoek op naam of componist..."
              value={zoekterm}
              onChange={e => setZoekterm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-full font-apercu text-body-md outline-none"
              style={{ backgroundColor: '#fff', color: '#333' }}
            />
          </div>
          <button
            onClick={() => { setSelecteerModus(v => !v); setGeselecteerd(new Set()) }}
            className="px-4 py-3 rounded-full font-apercu font-bold text-body-sm flex-shrink-0"
            style={{
              backgroundColor: selecteerModus ? '#0766C6' : '#fff',
              color: selecteerModus ? '#fff' : '#0766C6',
            }}>
            {selecteerModus ? 'Annuleer' : 'Selecteer'}
          </button>
        </div>

        {/* Lijst */}
        <div className="flex flex-col gap-3 mb-6">
          {gefilterdeMijn.length === 0 ? (
            <div className="rounded-2xl p-8 flex flex-col items-center gap-2 text-center"
              style={{ backgroundColor: '#fff' }}>
              <p className="font-apercu font-bold text-body-md" style={{ color: '#333' }}>
                {zoekterm ? 'Geen resultaten' : 'Nog geen lesmateriaal'}
              </p>
            </div>
          ) : (
            gefilterdeMijn.map(p => {
              const klasNaam = klassen.find(k => k.id === p.klas_id)?.naam
              return (
                <div key={p.id}
                  onClick={() => selecteerModus ? toggleSelecteer(p.id) : router.push(`/partituren/${p.id}`)}
                  className="flex items-stretch gap-3 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform duration-100"
                  style={{
                    backgroundColor: '#fff',
                    borderLeft: '4px solid #FF560D',
                    outline: geselecteerd.has(p.id) ? '2.5px solid #0766C6' : 'none',
                  }}>
                  <div className="flex-shrink-0 flex items-center justify-center"
                    style={{ width: 64, minHeight: 80, backgroundColor: '#F3E7DD' }}>
                    {selecteerModus ? (
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                        style={{
                          borderColor: geselecteerd.has(p.id) ? '#0766C6' : '#ccc',
                          backgroundColor: geselecteerd.has(p.id) ? '#0766C6' : 'transparent',
                        }}>
                        {geselecteerd.has(p.id) && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    ) : (
                      <svg width="28" height="20" viewBox="0 0 32 22" fill="none">
                        <line x1="0" y1="4"  x2="22" y2="4"  stroke="#0766C6" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                        <line x1="0" y1="9"  x2="22" y2="9"  stroke="#0766C6" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                        <line x1="0" y1="14" x2="22" y2="14" stroke="#0766C6" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                        <line x1="0" y1="19" x2="22" y2="19" stroke="#0766C6" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
                        <circle cx="27" cy="19" r="3" fill="#0766C6" />
                        <line x1="30" y1="19" x2="30" y2="4" stroke="#0766C6" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 py-3 pr-3 min-w-0">
                    <p className="font-apercu font-bold italic text-body-md line-clamp-1" style={{ color: '#0D1B2A' }}>
                      &ldquo;{p.titel}&rdquo;
                    </p>
                    {p.componist && (
                      <p className="font-apercu text-body-sm mt-0.5 line-clamp-1" style={{ color: '#555' }}>{p.componist}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="font-apercu text-caption" style={{ color: '#aaa' }}>
                        {new Date(p.created_at).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                      </span>
                      {klasNaam && (
                        <span className="font-apercu font-bold text-caption px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#FF560D', color: '#fff' }}>
                          klas {klasNaam}
                        </span>
                      )}
                    </div>
                  </div>
                  {!selecteerModus && (
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/partituren/${p.id}/bewerken`) }}
                      className="flex-shrink-0 flex items-center justify-center px-4"
                      style={{ color: '#0766C6' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Floating selecteer-balk */}
        {selecteerModus && geselecteerd.size > 0 && (
          <div className="fixed bottom-24 left-0 right-0 px-5 z-40">
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => setToonDeelModal(true)}
                className="w-full py-4 rounded-full font-apercu font-bold text-base shadow-lg"
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
              <p className="font-apercu font-bold text-heading-lg mb-1" style={{ color: '#333' }}>Deel met klas</p>
              <p className="font-apercu text-body-sm mb-5" style={{ color: '#888' }}>
                {geselecteerd.size} stuk{geselecteerd.size !== 1 ? 'ken' : ''} worden gedeeld
              </p>
              {klassen.length === 0 ? (
                <p className="font-apercu text-body-sm text-center py-4" style={{ color: '#bbb' }}>
                  Nog geen klassen aangemaakt. Ga naar Classview → Klassen om klassen te maken.
                </p>
              ) : (
                <div className="flex flex-col gap-2 mb-5">
                  {klassen.map(k => (
                    <button key={k.id}
                      onClick={() => setGekozenKlasId(k.id)}
                      className="w-full py-3.5 px-4 rounded-2xl text-left font-apercu font-bold text-body-md"
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
                className="w-full py-4 rounded-full font-apercu font-bold text-body-lg text-white"
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
