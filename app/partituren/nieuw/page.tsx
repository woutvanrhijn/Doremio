'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import BottomNav from '@/components/BottomNav'

function audioBufferNaarWav(buffer: AudioBuffer): Blob {
  const k = buffer.numberOfChannels, sr = buffer.sampleRate, ds = buffer.length * k * 2
  const ab = new ArrayBuffer(44 + ds); const v = new DataView(ab)
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); v.setUint32(4, 36 + ds, true); ws(8, 'WAVE')
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
  v.setUint16(22, k, true); v.setUint32(24, sr, true); v.setUint32(28, sr * k * 2, true)
  v.setUint16(32, k * 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, ds, true)
  let o = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < k; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]))
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

type Stap = 'keuze' | 'verwerken' | 'formulier' | 'audio' | 'overzicht' | 'gelukt'
type AudioTab = 'metronoom' | 'partituur' | 'track' | 'aanwijzingen'
type Doelstelling = { id: string; naam: string; duur: string; beschrijving: string; aangevinkt: boolean }

const WIZARD_STAPPEN: Array<Exclude<Stap, 'keuze' | 'verwerken'>> = ['formulier', 'audio', 'overzicht']

const GOLF = [4, 7, 12, 20, 28, 22, 16, 10, 18, 32, 26, 15, 10, 22, 30, 20, 14, 26, 36, 28, 18, 12, 20, 28, 22, 14, 8, 16, 24, 18, 12, 8, 10, 18, 14]
const MAX_GOLF = 36

function Golfvorm({ split = 0.5, hoogte = 56 }: { split?: number; hoogte?: number }) {
  const barW = 5, gap = 3, total = GOLF.length
  const svgW = total * (barW + gap)
  const splitX = svgW * split
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 40, padding: '8px 16px', overflow: 'hidden' }}>
      <svg width="100%" viewBox={`0 0 ${svgW} ${hoogte}`} style={{ display: 'block' }} preserveAspectRatio="none">
        {GOLF.map((h, i) => {
          const x = i * (barW + gap)
          const barH = (h / MAX_GOLF) * hoogte * 0.85
          const y = (hoogte - barH) / 2
          const kleur = x < splitX ? '#0766C6' : '#FF560D'
          return <rect key={i} x={x} y={y} width={barW} height={barH} rx={2.5} fill={kleur} />
        })}
        <line x1={splitX} y1={0} x2={splitX} y2={hoogte} stroke="#FF560D" strokeWidth={2} />
      </svg>
    </div>
  )
}

const DONKER: React.CSSProperties = { backgroundColor: '#0D1B2A', minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 16px)', paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }
const INPUT_STIJL: React.CSSProperties = { backgroundColor: 'rgba(255,255,255,0.07)', border: '1.5px solid #FF560D', borderRadius: 12, color: '#fff', padding: '11px 14px', width: '100%', outline: 'none', fontFamily: 'inherit', fontSize: 14 }
const LABEL_STIJL: React.CSSProperties = { color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 6, display: 'block' }

export default function NieuwePartituur() {
  const [stap, setStap] = useState<Stap>('keuze')
  const [nieuwId, setNieuwId] = useState<string | null>(null)
  const [zichtbaar, setZichtbaar] = useState(false)
  const [bestand, setBestand] = useState<File | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [titel, setTitel] = useState('')
  const [componist, setComponist] = useState('')
  const [annotatie, setAnnotatie] = useState('')
  const [referenties, setReferenties] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fout, setFout] = useState('')
  const [klassen, setKlassen] = useState<{ id: string; naam: string }[]>([])
  const [geselecteerdeKlas, setGeselecteerdeKlas] = useState<string>('')
  const [doelstellingen, setDoelstellingen] = useState<Doelstelling[]>([
    { id: '1', naam: 'Akkoorden Progressie', duur: '5 min', beschrijving: 'Overgang akkoorden oefenen in eigen tempo', aangevinkt: false },
    { id: '2', naam: 'Doorspelen Repetitie', duur: '10 min', beschrijving: 'Overgang akkoorden oefenen in eigen tempo', aangevinkt: false },
  ])
  const [actieveAudioTab, setActieveAudioTab] = useState<AudioTab>('track')

  // Opname
  const [opnameActief, setOpnameActief] = useState(false)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  const [opnameTijd, setOpnameTijd] = useState(0)
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [isVideo, setIsVideo] = useState(false)
  const [cameraActief, setCameraActief] = useState(false)

  // Trim
  const [audioDuur, setAudioDuur] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [trimBezig, setTrimBezig] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const audioBestandInput = useRef<HTMLInputElement>(null)
  const bestandInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('klassen').select('id, naam').eq('leraar_id', user.id).order('naam')
        .then(({ data }) => setKlassen(data || []))
    })
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      cameraStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => {
    if (stap === 'gelukt') {
      setZichtbaar(false)
      const t = setTimeout(() => setZichtbaar(true), 50)
      return () => clearTimeout(t)
    }
  }, [stap])

  const volgende = () => {
    const i = WIZARD_STAPPEN.indexOf(stap as any)
    if (i >= 0 && i < WIZARD_STAPPEN.length - 1) setStap(WIZARD_STAPPEN[i + 1])
  }

  const vorige = () => {
    const i = WIZARD_STAPPEN.indexOf(stap as any)
    if (i > 0) setStap(WIZARD_STAPPEN[i - 1])
    else setStap('keuze')
  }

  const formatTijdLang = (s: number) =>
    `00:${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`

  const toggleCamera = async () => {
    if (cameraActief) {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setCameraActief(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        cameraStreamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
        setCameraActief(true)
      } catch { alert('Camera toegang geweigerd.') }
    }
  }

  const startOpname = async () => {
    try {
      let stream: MediaStream
      if (cameraActief && cameraStreamRef.current) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const tracks = [...cameraStreamRef.current.getVideoTracks(), ...audioStream.getAudioTracks()]
        stream = new MediaStream(tracks)
        audioStreamRef.current = audioStream
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioStreamRef.current = stream
      }
      const videoMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
      const audioMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const heeftVideo = cameraActief && stream.getVideoTracks().length > 0
      const mime = heeftVideo ? videoMime : audioMime
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setMediaBlob(blob); setMediaUrl(URL.createObjectURL(blob)); setIsVideo(heeftVideo)
        stream.getTracks().forEach(t => t.stop())
        audioStreamRef.current = null
      }
      recorderRef.current = rec; rec.start(100)
      setOpnameTijd(0); timerRef.current = setInterval(() => setOpnameTijd(t => t + 1), 1000)
      setOpnameActief(true); setGepauzeerd(false)
    } catch { alert('Microfoon toegang geweigerd.') }
  }

  const pauzeerOpname = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause()
      if (timerRef.current) clearInterval(timerRef.current)
      setGepauzeerd(true)
    }
  }

  const hervatOpname = () => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume()
      timerRef.current = setInterval(() => setOpnameTijd(t => t + 1), 1000)
      setGepauzeerd(false)
    }
  }

  const stopOpname = () => {
    recorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setOpnameActief(false); setGepauzeerd(false)
  }

  const opnieuwOpnemen = () => {
    setMediaBlob(null); setMediaUrl(null); setIsVideo(false)
    setOpnameTijd(0); setAudioDuur(0); setTrimStart(0); setTrimEnd(0)
  }

  const handleAudioBestand = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setMediaBlob(f); setMediaUrl(URL.createObjectURL(f)); setIsVideo(false)
  }

  const handleAudioGeladen = () => {
    const d = audioRef.current?.duration
    if (d && isFinite(d)) { setAudioDuur(d); setTrimStart(0); setTrimEnd(Math.floor(d)) }
  }

  const pasTrimToe = async () => {
    if (!mediaBlob || trimStart >= trimEnd) return
    setTrimBezig(true)
    try {
      const ctx = new AudioContext()
      const buf = await ctx.decodeAudioData(await mediaBlob.arrayBuffer())
      await ctx.close()
      const dur = trimEnd - trimStart
      const off = new OfflineAudioContext(buf.numberOfChannels, Math.ceil(buf.sampleRate * dur), buf.sampleRate)
      const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination)
      src.start(0, trimStart, dur)
      const wav = audioBufferNaarWav(await off.startRendering())
      setMediaBlob(wav); setMediaUrl(URL.createObjectURL(wav))
      setAudioDuur(dur); setTrimStart(0); setTrimEnd(Math.floor(dur))
    } catch (e) { console.error('Trim fout:', e) }
    setTrimBezig(false)
  }

  const verwerkBestand = async (file: File) => {
    setBestand(file); setIsPdf(file.type === 'application/pdf'); setStap('verwerken')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      try {
        const hr = await fetch('/api/herken-partituur', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bestand: base64, type: file.type })
        })
        const hd = await hr.json()
        setTitel(hd.titel || ''); setComponist(hd.componist || '')
        if (hd.titel) {
          const rr = await fetch('/api/zoek-referenties', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titel: hd.titel, componist: hd.componist })
          })
          setReferenties((await rr.json()).links || [])
        }
      } catch { /* stille fout */ }
      setStap('formulier')
    }
    reader.readAsDataURL(file)
  }

  const handleBestandKeuze = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) verwerkBestand(f)
  }

  const voegDoelstellingToe = () => {
    setDoelstellingen(prev => [...prev, { id: Date.now().toString(), naam: '', duur: '5 min', beschrijving: '', aangevinkt: false }])
  }

  const updateDoelstelling = (id: string, veld: keyof Doelstelling, waarde: string) => {
    setDoelstellingen(prev => prev.map(d => d.id === id ? { ...d, [veld]: waarde } : d))
  }

  const verwijderDoelstelling = (id: string) => {
    setDoelstellingen(prev => prev.filter(d => d.id !== id))
  }

  const toggleDoelstelling = (id: string) => {
    setDoelstellingen(prev => prev.map(d => d.id === id ? { ...d, aangevinkt: !d.aangevinkt } : d))
  }

  const uploaden = async () => {
    if (!bestand || !titel) return
    setLoading(true); setFout('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const bn = `${Date.now()}_${bestand.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: ue } = await supabase.storage.from('partituren').upload(bn, bestand)
      if (ue) throw ue
      const { data: ud } = supabase.storage.from('partituren').getPublicUrl(bn)

      let mediaOpgeslagenUrl = null
      if (mediaBlob) {
        const ext = mediaBlob.type.includes('mp4') ? 'mp4' : mediaBlob.type.includes('wav') ? 'wav' : 'webm'
        const mn = `leraar_${Date.now()}_${user.id}.${ext}`
        const { error: me } = await supabase.storage.from('partituren').upload(mn, mediaBlob, { contentType: mediaBlob.type })
        if (!me) {
          const { data: mu } = supabase.storage.from('partituren').getPublicUrl(mn)
          mediaOpgeslagenUrl = mu.publicUrl
        }
      }

      const { data: p, error: de } = await supabase.from('partituren').insert({
        titel, componist, bestand_url: ud.publicUrl, leraar_id: user.id,
        referentie_url: referenties.length > 0 ? JSON.stringify(referenties) : null,
        leraar_audio_url: mediaOpgeslagenUrl,
        klas_id: geselecteerdeKlas || null,
      }).select().single()
      if (de) throw de

      const annotaties = []
      if (annotatie.trim()) {
        annotaties.push({ partituur_id: p.id, auteur_id: user.id, inhoud: annotatie, type: 'leraar' })
      }
      if (doelstellingen.length > 0) {
        annotaties.push({ partituur_id: p.id, auteur_id: user.id, inhoud: JSON.stringify(doelstellingen), type: 'doelstellingen' })
      }
      if (annotaties.length > 0) await supabase.from('annotaties').insert(annotaties)

      setNieuwId(p.id); setStap('gelukt')
    } catch (e: any) { setFout(e.message); setLoading(false) }
  }

  const isGewijzigd = audioDuur > 0 && (trimStart > 0 || trimEnd < Math.floor(audioDuur))
  const vandaag = new Date().toLocaleDateString('nl-BE', { day: 'numeric', month: 'numeric' })

  // ── KEUZE ──────────────────────────────────────────────────────────────
  if (stap === 'keuze') {
    return (
      <main className="page px-page flex flex-col">
        <div className="flex justify-center pt-6 pb-8">
          <Image src="/images/doremio-logo2.png" alt="Doremio" width={100} height={73} priority />
        </div>
        <button onClick={() => router.back()} className="mb-6 font-apercu font-bold text-body-lg" style={{ color: '#0766C6' }}>←</button>
        <h1 className="font-apercu font-bold text-display-md mb-8" style={{ color: '#0766C6' }}>
          Nieuw lesmateriaal toevoegen:
        </h1>
        <div className="flex flex-col gap-4">
          <button onClick={() => bestandInput.current?.click()}
            className="w-full py-5 rounded-full font-apercu font-bold text-white text-body-lg active:scale-95 transition-transform duration-100"
            style={{ backgroundColor: '#0766C6' }}>
            Bestanden Uploaden
          </button>
          <button onClick={() => cameraInput.current?.click()}
            className="w-full py-5 rounded-full font-apercu font-bold text-white text-body-lg active:scale-95 transition-transform duration-100"
            style={{ backgroundColor: '#FF560D' }}>
            Lesmaterial inscannen
          </button>
          <input ref={bestandInput} type="file" accept=".pdf,image/*" onChange={handleBestandKeuze} className="hidden" />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={handleBestandKeuze} className="hidden" />
        </div>
        <p className="font-apercu text-body-sm text-center mt-6" style={{ color: '#8FA3B8' }}>
          Ik heb hulp nodig met lesmateriaal toe te voegen
        </p>
        <BottomNav />
      </main>
    )
  }

  if (stap === 'gelukt') {
    return (
      <main style={{ backgroundColor: '#0D1B2A', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <style>{`
          @keyframes cirkelPop {
            from { transform: scale(0); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 400 }}>
          <p
            className="font-kiro"
            style={{
              color: '#fff',
              fontSize: 36,
              textAlign: 'center',
              marginBottom: 32,
              opacity: zichtbaar ? 1 : 0,
              transform: zichtbaar ? 'translateY(0)' : 'translateY(-12px)',
              transition: 'opacity 0.4s ease 0.4s, transform 0.4s ease 0.4s',
            }}
          >
            Geüpload!
          </p>

          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              backgroundColor: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'cirkelPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }}
          >
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          <p
            className="font-apercu"
            style={{
              color: '#8FA3B8',
              fontSize: 14,
              textAlign: 'center',
              marginTop: 24,
              opacity: zichtbaar ? 1 : 0,
              transform: zichtbaar ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 0.4s ease 0.4s, transform 0.4s ease 0.4s',
            }}
          >
            Je lesmateriaal staat klaar voor je studenten.
          </p>

          <div
            style={{
              marginTop: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              width: '100%',
              opacity: zichtbaar ? 1 : 0,
              transform: zichtbaar ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 0.4s ease 0.5s, transform 0.4s ease 0.5s',
            }}
          >
            <button
              onClick={() => router.push(`/partituren/${nieuwId}`)}
              className="font-apercu font-bold"
              style={{ backgroundColor: '#FF560D', borderRadius: 9999, padding: '16px 0', color: '#fff', width: '100%', fontSize: 16 }}
            >
              Lesmateriaal bekijken
            </button>
            <button
              onClick={() => router.push('/partituren')}
              className="font-apercu font-bold"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 9999, padding: '16px 0', color: '#fff', width: '100%', fontSize: 16 }}
            >
              Terug naar overzicht
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── DONKERE WIZARD ─────────────────────────────────────────────────────
  return (
    <main style={DONKER} className="px-5">

      {/* ── VERWERKEN ── */}
      {stap === 'verwerken' && (
        <div className="flex flex-col items-center justify-center gap-6" style={{ minHeight: '80vh' }}>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF560D', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <p className="font-apercu font-bold text-white text-body-lg">Lesmateriaal wordt verwerkt…</p>
          <p className="font-apercu text-body-sm" style={{ color: '#8FA3B8' }}>AI herkent titel en componist</p>
        </div>
      )}

      {/* ── FORMULIER (Screen 1) ── */}
      {stap === 'formulier' && (
        <div className="flex flex-col gap-5 pt-4">
          {/* Terug + Heading */}
          <button onClick={vorige} className="font-apercu font-bold text-white text-body-lg">←</button>
          <h1 className="font-apercu font-bold text-display-md text-white -mt-2">
            Nieuw lesmateriaal toevoegen
          </h1>

          {/* PDF preview + velden */}
          <div className="flex gap-4 items-start">
            {/* PDF preview */}
            <div className="flex-shrink-0 flex items-center justify-center rounded-2xl"
              style={{ width: 100, height: 120, backgroundColor: '#fff' }}>
              {isPdf ? (
                <div className="flex flex-col items-center gap-1">
                  <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                    <rect x="1" y="1" width="26" height="34" rx="4" stroke="#E5E5E5" strokeWidth="1.5" fill="#FAFAFA" />
                    <path d="M7 1v9h-6" stroke="#E5E5E5" strokeWidth="1.5" fill="none" />
                    <path d="M5 18h18M5 23h14M5 28h18" stroke="#E5E5E5" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="font-apercu font-bold text-body-sm" style={{ color: '#FF560D' }}>PDF</span>
                </div>
              ) : bestand ? (
                <img src={URL.createObjectURL(bestand)} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="font-apercu text-body-sm" style={{ color: '#ccc' }}>?</span>
              )}
            </div>

            {/* Naam + Componist */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div>
                <label style={LABEL_STIJL}>Naam</label>
                <input
                  style={INPUT_STIJL}
                  placeholder="Titel van het stuk"
                  value={titel}
                  onChange={e => setTitel(e.target.value)}
                />
              </div>
              <div>
                <label style={LABEL_STIJL}>Componist</label>
                <input
                  style={INPUT_STIJL}
                  placeholder="Componist"
                  value={componist}
                  onChange={e => setComponist(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Instructies */}
          <div>
            <p className="font-apercu font-bold text-white text-heading-sm mb-2">
              Instructies &amp; aanwijzingen toevoegen?
            </p>
            <textarea
              style={{ ...INPUT_STIJL, resize: 'none' }}
              rows={3}
              placeholder="Let goed op bij het kiezen van je begintempo, begin langzaam..."
              value={annotatie}
              onChange={e => setAnnotatie(e.target.value)}
            />
          </div>

          {/* Doelstellingen */}
          <div>
            <p className="font-apercu font-bold text-white text-heading-sm mb-3">
              Doelstellingen toevoegen?
            </p>
            <div className="flex flex-col gap-2">
              {doelstellingen.map((d, i) => (
                <div
                  key={d.id}
                  style={{ border: `1.5px solid ${i % 2 === 0 ? '#FF560D' : '#FFD100'}`, borderRadius: 12, padding: '12px 14px' }}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleDoelstelling(d.id)}
                      className="flex-shrink-0 w-5 h-5 rounded mt-0.5 flex items-center justify-center active:scale-90 transition-transform duration-100 flex-shrink-0"
                      style={{
                        border: d.aangevinkt ? 'none' : '1.5px solid rgba(255,255,255,0.35)',
                        backgroundColor: d.aangevinkt ? '#FF560D' : 'transparent',
                      }}
                    >
                      {d.aangevinkt && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <input
                        style={{ ...INPUT_STIJL, border: 'none', backgroundColor: 'transparent', padding: '0', fontSize: 13, fontWeight: 700 }}
                        placeholder="Naam doelstelling"
                        value={d.naam}
                        onChange={e => updateDoelstelling(d.id, 'naam', e.target.value)}
                      />
                      <input
                        style={{ ...INPUT_STIJL, border: 'none', backgroundColor: 'transparent', padding: '2px 0 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
                        placeholder="Beschrijving (optioneel)"
                        value={d.beschrijving}
                        onChange={e => updateDoelstelling(d.id, 'beschrijving', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        style={{ ...INPUT_STIJL, border: 'none', backgroundColor: 'transparent', padding: '0', fontSize: 12, width: 60, textAlign: 'right', color: '#FF560D', fontWeight: 700 }}
                        placeholder="5 min"
                        value={d.duur}
                        onChange={e => updateDoelstelling(d.id, 'duur', e.target.value)}
                      />
                      <button onClick={() => verwijderDoelstelling(d.id)} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* + knop */}
            <div className="flex justify-center mt-4">
              <button
                onClick={voegDoelstellingToe}
                className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform duration-100"
                style={{ backgroundColor: '#FF560D' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Volgende knop */}
          <div className="flex justify-end mt-2 mb-4">
            <button
              onClick={volgende}
              disabled={!titel}
              className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform duration-100"
              style={{ backgroundColor: titel ? '#FF560D' : '#555' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── AUDIO (Screen 2) ── */}
      {stap === 'audio' && (
        <div className="flex flex-col gap-5 pt-4">
          <button onClick={vorige} className="font-apercu font-bold text-white text-body-lg">←</button>
          <h1 className="font-apercu font-bold text-display-md text-white -mt-2">
            Referentie audio toevoegen?
          </h1>

          {/* Naam + Componist (readonly display) */}
          <div className="flex flex-col gap-3">
            <div>
              <label style={LABEL_STIJL}>Naam</label>
              <div style={{ ...INPUT_STIJL, color: 'rgba(255,255,255,0.8)' }}>{titel || '—'}</div>
            </div>
            <div>
              <label style={LABEL_STIJL}>Componist</label>
              <div style={{ ...INPUT_STIJL, color: 'rgba(255,255,255,0.8)' }}>{componist || '—'}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex justify-between gap-2">
            {([
              { id: 'metronoom', label: 'Metronoom', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="5" y1="4" x2="5" y2="20" /><line x1="9" y1="6" x2="9" y2="20" />
                  <line x1="13" y1="9" x2="13" y2="20" /><line x1="17" y1="4" x2="17" y2="20" />
                </svg>
              )},
              { id: 'partituur', label: 'Partituur', icon: (
                <svg width="22" height="16" viewBox="0 0 32 22" fill="none">
                  <line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="0" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="0" y1="13" x2="22" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="0" y1="18" x2="22" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="27" cy="18" r="3" fill="currentColor" />
                  <line x1="30" y1="18" x2="30" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )},
              { id: 'track', label: 'Track', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" /><path d="M6 20v-2a6 6 0 0 1 12 0v2" />
                  <circle cx="12" cy="8" r="8" strokeOpacity="0.3" />
                </svg>
              )},
              { id: 'aanwijzingen', label: 'Aanwijzingen', icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              )},
            ] as { id: AudioTab; label: string; icon: React.ReactNode }[]).map(tab => {
              const actief = actieveAudioTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActieveAudioTab(tab.id)}
                  className="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-xl active:scale-95 transition-transform duration-100"
                  style={{ backgroundColor: actief ? '#FF560D' : 'rgba(255,255,255,0.06)', color: actief ? '#fff' : '#8FA3B8' }}
                >
                  {tab.icon}
                  <span className="font-apercu text-caption font-bold">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab content — Track */}
          {actieveAudioTab === 'track' && (
            <div className="flex flex-col gap-4">
              {/* Timer */}
              <p className="font-apercu font-bold text-white text-center" style={{ fontSize: 36, letterSpacing: 2 }}>
                {formatTijdLang(opnameTijd)}
              </p>

              {/* Camera preview */}
              {cameraActief && (
                <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', backgroundColor: '#000' }}>
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                </div>
              )}

              {/* Golfvorm — alleen zichtbaar zonder camera */}
              {!cameraActief && (
                (opnameActief || mediaBlob) ? (
                  <Golfvorm split={opnameActief ? 0.5 : (opnameTijd / Math.max(audioDuur, 1))} />
                ) : (
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 40, padding: '20px 16px', textAlign: 'center' }}>
                    <p className="font-apercu text-body-sm" style={{ color: '#8FA3B8' }}>
                      Start de opname of upload een bestand
                    </p>
                  </div>
                )
              )}

              {/* Controls */}
              {!mediaBlob ? (
                <div className="flex justify-center items-center gap-6 mt-2">
                  {/* Camera toggle — alleen tonen als niet aan het opnemen */}
                  {!opnameActief && (
                    <button
                      onClick={toggleCamera}
                      className="w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform duration-100"
                      style={{ backgroundColor: cameraActief ? '#0766C6' : 'rgba(255,255,255,0.1)', border: `2px solid ${cameraActief ? '#0766C6' : 'rgba(255,255,255,0.25)'}` }}
                    >
                      {cameraActief ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 7 16 12l7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 7 16 12l7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                          <line x1="1" y1="1" x2="23" y2="23" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
                        </svg>
                      )}
                    </button>
                  )}

                  {opnameActief ? (
                    <>
                      <button
                        onClick={gepauzeerd ? hervatOpname : pauzeerOpname}
                        className="w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform duration-100"
                        style={{ backgroundColor: '#FF560D', border: '3px solid #0766C6' }}
                      >
                        {gepauzeerd ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <polygon points="5,3 19,12 5,21" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                            <line x1="6" y1="4" x2="6" y2="20" /><line x1="18" y1="4" x2="18" y2="20" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={stopOpname}
                        className="w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform duration-100"
                        style={{ backgroundColor: '#FF560D', border: '3px solid #0766C6' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startOpname}
                      className="w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform duration-100"
                      style={{ backgroundColor: '#FF560D', border: '3px solid #0766C6' }}
                    >
                      <div className="w-5 h-5 rounded-full" style={{ backgroundColor: 'white' }} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <audio ref={audioRef} controls src={mediaUrl!} className="w-full" onLoadedMetadata={handleAudioGeladen}
                    style={{ borderRadius: 12 }} />
                  {/* Trim */}
                  {audioDuur > 0 && (
                    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                          <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
                          <line x1="8.12" y1="8.12" x2="12" y2="12"/>
                        </svg>
                        <p className="font-apercu font-bold text-white text-body-sm">Bijknippen (optioneel)</p>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>Begin</span>
                          <span className="font-apercu text-caption font-bold text-white">{formatTijdLang(trimStart)}</span>
                        </div>
                        <input type="range" min={0} max={Math.max(0, Math.floor(audioDuur) - 1)} step={1}
                          value={trimStart} onChange={e => { const v = Number(e.target.value); if (v < trimEnd) setTrimStart(v) }}
                          className="w-full" style={{ accentColor: '#FF560D' }} />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>Einde</span>
                          <span className="font-apercu text-caption font-bold text-white">{formatTijdLang(trimEnd)}</span>
                        </div>
                        <input type="range" min={1} max={Math.floor(audioDuur)} step={1}
                          value={trimEnd} onChange={e => { const v = Number(e.target.value); if (v > trimStart) setTrimEnd(v) }}
                          className="w-full" style={{ accentColor: '#FF560D' }} />
                      </div>
                      <button onClick={pasTrimToe} disabled={trimBezig || !(audioDuur > 0 && (trimStart > 0 || trimEnd < Math.floor(audioDuur)))}
                        className="w-full py-2.5 rounded-xl font-apercu font-bold text-white text-body-sm flex items-center justify-center gap-2"
                        style={{ backgroundColor: trimBezig ? '#555' : '#FF560D' }}>
                        {!trimBezig && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                            <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
                            <line x1="8.12" y1="8.12" x2="12" y2="12"/>
                          </svg>
                        )}
                        {trimBezig ? 'Bezig...' : 'Trim toepassen'}
                      </button>
                    </div>
                  )}
                  <button onClick={opnieuwOpnemen} className="font-apercu text-body-sm text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    ↺ Opnieuw opnemen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab content — Aanwijzingen */}
          {actieveAudioTab === 'aanwijzingen' && (
            <div>
              <label style={LABEL_STIJL}>Instructies &amp; aanwijzingen</label>
              <textarea
                style={{ ...INPUT_STIJL, resize: 'none' }}
                rows={5}
                placeholder="Bijv. let op het tempo in maat 12-16..."
                value={annotatie}
                onChange={e => setAnnotatie(e.target.value)}
              />
            </div>
          )}

          {/* Tab content — Metronoom / Partituur placeholder */}
          {(actieveAudioTab === 'metronoom' || actieveAudioTab === 'partituur') && (
            <div className="flex flex-col items-center gap-3 py-8" style={{ color: '#8FA3B8' }}>
              <p className="font-apercu text-body-sm text-center">
                {actieveAudioTab === 'metronoom' ? 'Metronoom functie binnenkort beschikbaar' : 'Partituur bekijken binnenkort beschikbaar'}
              </p>
            </div>
          )}

          <input ref={audioBestandInput} type="file" accept="audio/*" onChange={handleAudioBestand} className="hidden" />

          {/* Bottom knoppen */}
          <div className="flex gap-3 mt-2 mb-4">
            <button
              onClick={() => audioBestandInput.current?.click()}
              className="flex-1 py-4 rounded-full font-apercu font-bold text-white text-body-md active:scale-95 transition-transform duration-100"
              style={{ backgroundColor: '#FF560D' }}
            >
              Externe referentie audio zoeken
            </button>
            <button
              onClick={volgende}
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform duration-100"
              style={{ backgroundColor: '#FF560D' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── OVERZICHT (Screen 3) ── */}
      {stap === 'overzicht' && (
        <div className="flex flex-col gap-5 pt-4">
          <button onClick={vorige} className="font-apercu font-bold text-white text-body-lg">←</button>
          <h1 className="font-apercu font-bold text-display-md text-white -mt-2">
            Overzicht &ldquo;{titel}&rdquo; {vandaag}
          </h1>

          {/* Naam gecombineerd */}
          <div>
            <label style={LABEL_STIJL}>Naam</label>
            <input
              style={INPUT_STIJL}
              value={`${titel}${componist ? ` — ${componist}` : ''}`}
              onChange={e => {
                const parts = e.target.value.split(' — ')
                setTitel(parts[0] || '')
                setComponist(parts[1] || '')
              }}
            />
          </div>

          {/* Instructies */}
          <div>
            <label style={LABEL_STIJL}>Instructies &amp; aanwijzingen</label>
            <div style={{ ...INPUT_STIJL, minHeight: 60, color: annotatie ? '#fff' : 'rgba(255,255,255,0.35)' }}>
              {annotatie || 'Geen instructies toegevoegd'}
            </div>
          </div>

          {/* Doelstellingen */}
          {doelstellingen.length > 0 && (
            <div>
              <label style={LABEL_STIJL}>Doelstellingen</label>
              <div className="flex flex-col gap-2">
                {doelstellingen.map((d, i) => (
                  <div key={d.id} style={{ border: `1.5px solid ${i % 2 === 0 ? '#FF560D' : '#FFD100'}`, borderRadius: 12, padding: '12px 14px' }}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleDoelstelling(d.id)}
                        className="flex-shrink-0 w-5 h-5 rounded mt-0.5 flex items-center justify-center active:scale-90 transition-transform duration-100 flex-shrink-0"
                        style={{
                          border: d.aangevinkt ? 'none' : '1.5px solid rgba(255,255,255,0.35)',
                          backgroundColor: d.aangevinkt ? '#FF560D' : 'transparent',
                        }}
                      >
                        {d.aangevinkt && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-apercu font-bold text-white text-body-sm">{d.naam || '—'}</p>
                          <p className="font-apercu text-body-sm flex-shrink-0 ml-2" style={{ color: '#FF560D' }}>{d.duur}</p>
                        </div>
                        {d.beschrijving && (
                          <p className="font-apercu text-caption mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{d.beschrijving}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audio player */}
          {mediaBlob && mediaUrl && (
            <div>
              <label style={LABEL_STIJL}>Referentie audio</label>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-apercu text-caption" style={{ color: '#8FA3B8' }}>00:00:00</span>
                <span className="font-apercu text-caption ml-auto" style={{ color: '#8FA3B8' }}>{formatTijdLang(Math.floor(audioDuur))}</span>
              </div>
              <div className="flex items-center gap-3">
                <audio ref={audioRef} src={mediaUrl} onLoadedMetadata={handleAudioGeladen} className="hidden" />
                <button
                  onClick={() => { if (audioRef.current) { audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause() } }}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '2px solid rgba(255,255,255,0.3)', backgroundColor: 'transparent' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </button>
                <div className="flex-1">
                  <Golfvorm split={0.1} hoogte={44} />
                </div>
              </div>
            </div>
          )}

          {/* Klas selectie */}
          <div>
            <label style={LABEL_STIJL}>Selecteer je klasgroep</label>
            <select
              value={geselecteerdeKlas}
              onChange={e => setGeselecteerdeKlas(e.target.value)}
              style={{ ...INPUT_STIJL, border: '1.5px solid #0766C6', appearance: 'none' }}
            >
              <option value="">Alle studenten (geen klas)</option>
              {klassen.map(k => <option key={k.id} value={k.id}>{k.naam}</option>)}
            </select>
          </div>

          {fout && <p className="font-apercu text-body-sm" style={{ color: '#FF560D' }}>{fout}</p>}

          {/* Opslaan */}
          <button
            onClick={uploaden}
            disabled={loading || !titel}
            className="flex items-center justify-between w-full py-4 px-6 rounded-full font-apercu font-bold text-white text-body-lg active:scale-95 transition-transform duration-100 mb-4"
            style={{ backgroundColor: loading || !titel ? '#555' : '#FF560D' }}
          >
            <span>{loading ? 'Uploaden...' : 'Oefensessie delen'}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      <BottomNav />
    </main>
  )
}
