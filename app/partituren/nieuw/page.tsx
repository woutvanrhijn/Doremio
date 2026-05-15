'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

type Stap = 'keuze' | 'verwerken' | 'gegevens' | 'klas' | 'leraar_track' | 'instructies' | 'opslaan'

const WIZARD_STAPPEN: Array<Exclude<Stap, 'keuze' | 'verwerken'>> = [
  'gegevens', 'klas', 'leraar_track', 'instructies', 'opslaan'
]

const WIZARD_LABELS: Record<string, string> = {
  gegevens: 'Gegevens',
  klas: 'Klas',
  leraar_track: 'Opname',
  instructies: 'Content',
  opslaan: 'Opslaan',
}

export default function NieuwePartituur() {
  const [stap, setStap] = useState<Stap>('keuze')
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
  const audioStreamRef = useRef<MediaStream | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
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
    if (cameraActief && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current
      cameraVideoRef.current.play().catch(() => {})
    }
  }, [cameraActief])

  const wizardIndex = WIZARD_STAPPEN.indexOf(stap as any)
  const isWizardStap = wizardIndex >= 0

  const volgende = () => {
    const i = WIZARD_STAPPEN.indexOf(stap as any)
    if (i >= 0 && i < WIZARD_STAPPEN.length - 1) setStap(WIZARD_STAPPEN[i + 1])
  }

  const vorige = () => {
    const i = WIZARD_STAPPEN.indexOf(stap as any)
    if (i > 0) setStap(WIZARD_STAPPEN[i - 1])
    else setStap('keuze')
  }

  const formatTijd = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`

  const toggleCamera = async () => {
    if (cameraActief) {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
      setCameraActief(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        cameraStreamRef.current = stream
        setCameraActief(true)
      } catch {
        alert('Camera toegang geweigerd. Controleer je browserinstellingen.')
      }
    }
  }

  const startOpname = async () => {
    try {
      const videoOpname = cameraActief
      cameraStreamRef.current?.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null

      const constraints = videoOpname ? { audio: true, video: true } : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      audioStreamRef.current = stream

      if (videoOpname) {
        cameraStreamRef.current = stream
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          cameraVideoRef.current.play().catch(() => {})
        }
      }

      let mime = ''
      if (videoOpname) {
        mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm'
          : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : ''
      } else {
        mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      }

      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || (videoOpname ? 'video/webm' : 'audio/webm') })
        setMediaBlob(blob)
        setMediaUrl(URL.createObjectURL(blob))
        setIsVideo(videoOpname)
        stream.getTracks().forEach(t => t.stop())
        audioStreamRef.current = null
        cameraStreamRef.current = null
        if (videoOpname) setCameraActief(false)
      }
      recorderRef.current = rec
      rec.start(100)
      setOpnameTijd(0)
      timerRef.current = setInterval(() => setOpnameTijd(t => t + 1), 1000)
      setOpnameActief(true)
      setGepauzeerd(false)
    } catch {
      alert('Microfoon/camera toegang geweigerd.')
    }
  }

  const annuleerOpname = () => {
    if (recorderRef.current) {
      recorderRef.current.onstop = () => {}
      recorderRef.current.stop()
    }
    audioStreamRef.current?.getTracks().forEach(t => t.stop())
    audioStreamRef.current = null
    cameraStreamRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    if (cameraActief) setCameraActief(false)
    setOpnameActief(false); setGepauzeerd(false); setOpnameTijd(0)
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
    setOpnameActief(false)
    setGepauzeerd(false)
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
      setStap('gegevens')
    }
    reader.readAsDataURL(file)
  }

  const handleBestandKeuze = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) verwerkBestand(f)
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

      if (annotatie.trim()) {
        await supabase.from('annotaties').insert({ partituur_id: p.id, auteur_id: user.id, inhoud: annotatie, type: 'leraar' })
      }
      router.push(`/partituren/${p.id}`)
    } catch (e: any) { setFout(e.message); setLoading(false) }
  }

  const isGewijzigd = audioDuur > 0 && (trimStart > 0 || trimEnd < Math.floor(audioDuur))

  return (
    <main className="min-h-screen px-6 py-10 pb-16" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-lg mx-auto">

        {/* Terugknop */}
        <button
          onClick={isWizardStap ? vorige : () => router.back()}
          className="mb-6 text-sm flex items-center gap-2"
          style={{ color: '#0766C6' }}>
          ← {isWizardStap && wizardIndex === 0 ? 'Terug' : isWizardStap ? 'Vorige stap' : 'Terug'}
        </button>

        <h1 className="text-3xl font-bold mb-2" style={{ color: '#0766C6' }}>Nieuwe partituur</h1>

        {/* Wizard voortgangsbalk */}
        {isWizardStap && (
          <div className="mb-8 mt-5">
            <div className="flex items-center gap-1">
              {WIZARD_STAPPEN.map((s, i) => (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full h-1 rounded-full transition-all"
                      style={{
                        backgroundColor: i <= wizardIndex ? '#0766C6' : '#D4C5BB',
                      }}
                    />
                    <span
                      className="text-xs whitespace-nowrap"
                      style={{
                        color: i === wizardIndex ? '#0766C6' : i < wizardIndex ? '#888' : '#C0B0A8',
                        fontWeight: i === wizardIndex ? 700 : 400,
                        fontSize: '9px',
                      }}>
                      {WIZARD_LABELS[s]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stap: keuze */}
        {stap === 'keuze' && (
          <div className="flex flex-col gap-4 mt-6">
            <p className="text-sm mb-2" style={{ color: '#666' }}>Upload een PDF of maak een foto van je partituur</p>
            <button onClick={() => bestandInput.current?.click()}
              className="w-full py-6 px-6 rounded-2xl text-left transition-transform hover:scale-105" style={{ backgroundColor: '#0766C6' }}>
              <p className="text-white font-bold text-lg">📄 PDF uploaden</p>
              <p className="text-blue-200 text-sm">Upload een bestaand PDF bestand</p>
            </button>
            <button onClick={() => cameraInput.current?.click()}
              className="w-full py-6 px-6 rounded-2xl text-left transition-transform hover:scale-105" style={{ backgroundColor: '#FF560D' }}>
              <p className="text-white font-bold text-lg">📷 Foto nemen</p>
              <p className="text-orange-200 text-sm">Scan een papieren partituur met je camera</p>
            </button>
            <input ref={bestandInput} type="file" accept=".pdf,image/*" onChange={handleBestandKeuze} className="hidden" />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={handleBestandKeuze} className="hidden" />
          </div>
        )}

        {/* Stap: verwerken */}
        {stap === 'verwerken' && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse" style={{ backgroundColor: '#0766C6' }}>
              <span className="text-white text-3xl">♪</span>
            </div>
            <p className="font-semibold" style={{ color: '#0766C6' }}>Partituur wordt herkend...</p>
            <p className="text-sm text-center" style={{ color: '#888' }}>We zoeken de titel, componist en referentie-audio op</p>
          </div>
        )}

        {/* Stap 1: Gegevens bevestigen */}
        {stap === 'gegevens' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: '#666' }}>Controleer de herkende gegevens en pas ze aan indien nodig.</p>

            {/* Document preview */}
            {isPdf ? (
              <div className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: '#fff' }}>
                <span className="text-4xl">📄</span>
                <div>
                  <p className="font-semibold" style={{ color: '#333' }}>{bestand?.name}</p>
                  <p className="text-sm" style={{ color: '#888' }}>PDF partituur</p>
                </div>
              </div>
            ) : bestand && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                <img src={URL.createObjectURL(bestand)} alt="Voorvertoning" className="w-full object-contain max-h-52" />
              </div>
            )}

            <input type="text" placeholder="Titel van het stuk" value={titel} onChange={(e) => setTitel(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base" style={{ backgroundColor: '#fff' }} />
            <input type="text" placeholder="Componist" value={componist} onChange={(e) => setComponist(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base" style={{ backgroundColor: '#fff' }} />

            {/* YouTube referenties — compact badge */}
            {referenties.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: '#fff' }}>
                <span className="text-base">▶</span>
                <p className="text-sm flex-1" style={{ color: '#555' }}>
                  <span className="font-semibold" style={{ color: '#0766C6' }}>{referenties.length} YouTube</span>
                  {' '}referenties gevonden — je beheert ze in de Content stap
                </p>
              </div>
            )}

            <button
              onClick={volgende}
              disabled={!titel}
              className="w-full py-4 rounded-2xl text-white font-semibold text-base mt-2"
              style={{ backgroundColor: !titel ? '#bbb' : '#0766C6' }}>
              Volgende →
            </button>
          </div>
        )}

        {/* Stap 2: Klas toewijzen */}
        {stap === 'klas' && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-semibold text-lg mb-1" style={{ color: '#333' }}>{titel}</p>
              {componist && <p className="text-sm" style={{ color: '#888' }}>{componist}</p>}
            </div>

            <p className="text-sm mt-1" style={{ color: '#666' }}>
              Aan wie wil je deze partituur toewijzen?
            </p>

            <div className="flex flex-col gap-2 mt-1">
              <button
                onClick={() => setGeselecteerdeKlas('')}
                className="w-full text-left px-5 py-4 rounded-2xl transition-all"
                style={{
                  backgroundColor: geselecteerdeKlas === '' ? '#0766C6' : '#fff',
                  color: geselecteerdeKlas === '' ? '#fff' : '#333',
                  border: geselecteerdeKlas === '' ? 'none' : '2px solid transparent',
                }}>
                <p className="font-semibold">Alle studenten</p>
                <p className="text-xs mt-0.5" style={{ color: geselecteerdeKlas === '' ? '#93c5fd' : '#888' }}>
                  Zichtbaar voor iedereen, geen klas vereist
                </p>
              </button>

              {klassen.length === 0 && (
                <div className="px-5 py-4 rounded-2xl" style={{ backgroundColor: '#fff' }}>
                  <p className="text-sm" style={{ color: '#bbb' }}>Je hebt nog geen klassen aangemaakt.</p>
                </div>
              )}

              {klassen.map(klas => (
                <button
                  key={klas.id}
                  onClick={() => setGeselecteerdeKlas(klas.id)}
                  className="w-full text-left px-5 py-4 rounded-2xl transition-all"
                  style={{
                    backgroundColor: geselecteerdeKlas === klas.id ? '#0766C6' : '#fff',
                    color: geselecteerdeKlas === klas.id ? '#fff' : '#333',
                  }}>
                  <p className="font-semibold">👥 {klas.naam}</p>
                  <p className="text-xs mt-0.5" style={{ color: geselecteerdeKlas === klas.id ? '#93c5fd' : '#888' }}>
                    Enkel zichtbaar voor studenten in deze klas
                  </p>
                </button>
              ))}
            </div>

            <button onClick={volgende} className="w-full py-4 rounded-2xl text-white font-semibold text-base mt-2"
              style={{ backgroundColor: '#0766C6' }}>
              Volgende →
            </button>
          </div>
        )}

        {/* Stap 3: Referentie-opname */}
        {stap === 'leraar_track' && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-semibold text-lg mb-0.5" style={{ color: '#333' }}>{titel}</p>
              <p className="text-sm" style={{ color: '#666' }}>
                Neem optioneel een referentie-opname op voor de student — audio of video.
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
              {/* Camera toggle */}
              <div className="px-5 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F3E7DD' }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#333' }}>
                    {cameraActief ? '📹 Video + audio' : '🎙 Audio'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                    {cameraActief ? 'Camera is aan — student ziet jou spelen' : 'Enkel audio — student hoort jou spelen'}
                  </p>
                </div>
                <button onClick={toggleCamera}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ backgroundColor: cameraActief ? '#0766C6' : '#F3E7DD', color: cameraActief ? '#fff' : '#666' }}>
                  📷 {cameraActief ? 'Camera uit' : 'Camera aan'}
                </button>
              </div>

              {cameraActief && (
                <div className="px-5 pt-4">
                  <video ref={cameraVideoRef} autoPlay muted playsInline
                    className="w-full rounded-xl object-cover"
                    style={{ maxHeight: '200px', backgroundColor: '#000' }} />
                </div>
              )}

              <div className="p-5">
                {!mediaBlob && !opnameActief && (
                  <div className="flex gap-3">
                    <button onClick={startOpname}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-transform hover:scale-[1.02]"
                      style={{ backgroundColor: '#FF560D' }}>
                      ● Start opname
                    </button>
                    <button onClick={() => audioBestandInput.current?.click()}
                      className="flex-1 py-3 rounded-xl font-medium text-sm transition-transform hover:scale-[1.02]"
                      style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                      📁 Upload bestand
                    </button>
                  </div>
                )}
                <input ref={audioBestandInput} type="file" accept="audio/*" onChange={handleAudioBestand} className="hidden" />

                {opnameActief && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-center gap-3 py-4 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: gepauzeerd ? '#bbb' : '#FF560D', animation: gepauzeerd ? 'none' : 'pulse 1s infinite' }} />
                      <span className="text-3xl font-mono font-bold" style={{ color: gepauzeerd ? '#888' : '#333' }}>
                        {formatTijd(opnameTijd)}
                      </span>
                      <span className="text-xs font-medium" style={{ color: gepauzeerd ? '#aaa' : '#FF560D' }}>
                        {gepauzeerd ? 'gepauzeerd' : cameraActief ? '📹 video + audio' : 'opname bezig'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {!gepauzeerd ? (
                        <button onClick={pauzeerOpname}
                          className="py-3 rounded-xl font-medium text-sm flex flex-col items-center gap-1"
                          style={{ backgroundColor: '#F3E7DD', color: '#333' }}>
                          <span className="text-lg">⏸</span><span>Pauze</span>
                        </button>
                      ) : (
                        <button onClick={hervatOpname}
                          className="py-3 rounded-xl font-medium text-sm flex flex-col items-center gap-1"
                          style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                          <span className="text-lg">▶</span><span>Hervat</span>
                        </button>
                      )}
                      <button onClick={stopOpname}
                        className="py-3 rounded-xl text-white font-medium text-sm flex flex-col items-center gap-1"
                        style={{ backgroundColor: '#333' }}>
                        <span className="text-lg">■</span><span>Stop</span>
                      </button>
                      <button onClick={annuleerOpname}
                        className="py-3 rounded-xl font-medium text-sm flex flex-col items-center gap-1"
                        style={{ backgroundColor: '#F3E7DD', color: '#FF560D' }}>
                        <span className="text-lg">✕</span><span>Annuleer</span>
                      </button>
                    </div>
                  </div>
                )}

                {mediaBlob && mediaUrl && !opnameActief && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: '#0766C6' }}>
                        ✓ {isVideo ? '📹 Video + audio' : 'Opname'} klaar
                      </p>
                      {isVideo ? (
                        <video controls src={mediaUrl} className="w-full rounded-xl"
                          style={{ maxHeight: '220px', backgroundColor: '#000' }} />
                      ) : (
                        <audio ref={audioRef} controls src={mediaUrl} className="w-full" onLoadedMetadata={handleAudioGeladen} />
                      )}
                    </div>

                    {/* Trim — alleen voor audio */}
                    {!isVideo && audioDuur > 0 && (
                      <div className="rounded-xl p-4" style={{ backgroundColor: '#F3E7DD' }}>
                        <p className="text-xs font-semibold mb-4" style={{ color: '#333' }}>✂️ Begin en einde bijknippen</p>

                        <div className="mb-4">
                          <div className="flex justify-between mb-1">
                            <label className="text-xs font-medium" style={{ color: '#555' }}>Begin</label>
                            <span className="text-xs font-mono font-bold" style={{ color: '#0766C6' }}>{formatTijd(trimStart)}</span>
                          </div>
                          <input type="range" min={0} max={Math.max(0, Math.floor(audioDuur) - 1)} step={1}
                            value={trimStart} onChange={(e) => { const v = Number(e.target.value); if (v < trimEnd) setTrimStart(v) }}
                            className="w-full" style={{ accentColor: '#0766C6' }} />
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between mb-1">
                            <label className="text-xs font-medium" style={{ color: '#555' }}>Einde</label>
                            <span className="text-xs font-mono font-bold" style={{ color: '#0766C6' }}>{formatTijd(trimEnd)}</span>
                          </div>
                          <input type="range" min={1} max={Math.floor(audioDuur)} step={1}
                            value={trimEnd} onChange={(e) => { const v = Number(e.target.value); if (v > trimStart) setTrimEnd(v) }}
                            className="w-full" style={{ accentColor: '#0766C6' }} />
                        </div>

                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs" style={{ color: '#888' }}>
                            Selectie: <span className="font-mono font-semibold" style={{ color: '#333' }}>{formatTijd(trimEnd - trimStart)}</span>
                            {' '}van {formatTijd(Math.floor(audioDuur))}
                          </span>
                        </div>

                        <button onClick={pasTrimToe} disabled={trimBezig || !isGewijzigd}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                          style={{ backgroundColor: trimBezig ? '#999' : !isGewijzigd ? '#ccc' : '#0766C6' }}>
                          {trimBezig ? '⏳ Knippen...' : '✂️ Trim toepassen'}
                        </button>
                      </div>
                    )}

                    <button onClick={opnieuwOpnemen} className="text-xs text-center py-1" style={{ color: '#FF560D' }}>
                      ↺ Opnieuw opnemen
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={volgende}
              disabled={opnameActief}
              className="w-full py-4 rounded-2xl font-semibold text-base mt-2"
              style={{
                backgroundColor: opnameActief ? '#bbb' : mediaBlob ? '#0766C6' : '#fff',
                color: opnameActief ? '#fff' : mediaBlob ? '#fff' : '#0766C6',
                border: mediaBlob ? 'none' : '2px solid #0766C6',
              }}>
              {mediaBlob ? 'Volgende →' : 'Overslaan →'}
            </button>
          </div>
        )}

        {/* Stap 4: Content (referenties + instructies) */}
        {stap === 'instructies' && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-semibold text-lg mb-0.5" style={{ color: '#333' }}>{titel}</p>
              <p className="text-sm" style={{ color: '#666' }}>
                Kies welke YouTube referenties je meestuurt en voeg instructies toe.
              </p>
            </div>

            {/* YouTube referenties beheren */}
            {referenties.length > 0 ? (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                <div className="px-5 pt-5 pb-3 flex items-center justify-between"
                  style={{ borderBottom: '1px solid #F3E7DD' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#333' }}>
                      ▶ YouTube referenties
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                      {referenties.length} gevonden — verwijder wat je niet wil meesturen
                    </p>
                  </div>
                </div>
                <div className="flex flex-col">
                  {referenties.map((ref: any, i: number) => (
                    <div key={i} className="px-5 py-4" style={{ borderBottom: '1px solid #F3E7DD' }}>
                      {/* Ref header */}
                      <div className="flex items-center gap-3">
                        {ref.thumbnail && (
                          <img src={ref.thumbnail} alt={ref.titel}
                            className="w-16 h-11 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: '#333' }}>
                            {ref.titel}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                            {ref.kanaal}
                            {ref.duur && <span> · {ref.duur}</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => setReferenties(prev => prev.filter((_, j) => j !== i))}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: '#F3E7DD', color: '#bbb' }}
                          title="Verwijder">
                          ✕
                        </button>
                      </div>
                      {/* Duiding input */}
                      <input
                        type="text"
                        placeholder="Duiding toevoegen — bijv. 'Let op het tempo in de brug'..."
                        value={ref.duiding || ''}
                        onChange={(e) => setReferenties(prev =>
                          prev.map((r, j) => j === i ? { ...r, duiding: e.target.value } : r)
                        )}
                        className="w-full mt-3 px-3 py-2 rounded-xl text-xs outline-none"
                        style={{ backgroundColor: '#F3E7DD', color: '#333' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: '#fff' }}>
                <span style={{ color: '#bbb' }}>▶</span>
                <p className="text-sm" style={{ color: '#bbb' }}>
                  Geen YouTube referenties gevonden voor dit stuk.
                </p>
              </div>
            )}

            {/* Instructies textarea */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
              <div className="px-5 pt-5 pb-2">
                <p className="text-xs font-semibold" style={{ color: '#888' }}>
                  INSTRUCTIES VOOR DE STUDENT
                </p>
              </div>
              <div className="px-5 pb-5">
                <textarea
                  placeholder="Bijv. Let op de dynamiek in maat 12-16. Oefen eerst de linkerhand apart, daarna samen..."
                  value={annotatie}
                  onChange={(e) => setAnnotatie(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl text-base resize-none mt-2"
                  style={{ backgroundColor: '#F3E7DD', border: 'none', outline: 'none' }}
                />
              </div>
            </div>

            <button onClick={volgende} className="w-full py-4 rounded-2xl font-semibold text-base mt-2"
              style={{
                backgroundColor: (annotatie.trim() || referenties.length > 0) ? '#0766C6' : '#fff',
                color: (annotatie.trim() || referenties.length > 0) ? '#fff' : '#0766C6',
                border: (annotatie.trim() || referenties.length > 0) ? 'none' : '2px solid #0766C6',
              }}>
              Volgende →
            </button>
          </div>
        )}

        {/* Stap 5: Samenvatting + opslaan */}
        {stap === 'opslaan' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: '#666' }}>
              Alles in orde? Sla de partituur op.
            </p>

            {/* Samenvatting */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
              <div className="h-1 w-full" style={{ backgroundColor: '#0766C6' }} />
              <div className="p-5 flex flex-col gap-3">

                {/* Document */}
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{isPdf ? '📄' : '🖼️'}</span>
                  <div>
                    <p className="font-bold" style={{ color: '#0766C6' }}>{titel}</p>
                    {componist && <p className="text-sm" style={{ color: '#555' }}>{componist}</p>}
                  </div>
                </div>

                <div className="h-px" style={{ backgroundColor: '#F3E7DD' }} />

                {/* Klas */}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#888' }}>Toewijzing</span>
                  <span className="text-sm font-semibold" style={{ color: '#333' }}>
                    {geselecteerdeKlas
                      ? `👥 ${klassen.find(k => k.id === geselecteerdeKlas)?.naam || 'Klas'}`
                      : 'Alle studenten'}
                  </span>
                </div>

                {/* Opname */}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#888' }}>Referentie-opname</span>
                  <span className="text-sm font-semibold" style={{ color: '#333' }}>
                    {mediaBlob ? (isVideo ? '📹 Video aanwezig' : '🎙 Audio aanwezig') : 'Geen'}
                  </span>
                </div>

                {/* Instructies */}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#888' }}>Instructies</span>
                  <span className="text-sm font-semibold" style={{ color: '#333' }}>
                    {annotatie.trim() ? `${annotatie.length} tekens` : 'Geen'}
                  </span>
                </div>

                {/* Referenties */}
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#888' }}>YouTube referenties</span>
                  <span className="text-sm font-semibold" style={{ color: '#333' }}>
                    {referenties.length > 0 ? `${referenties.length} geselecteerd` : 'Geen'}
                  </span>
                </div>
              </div>
            </div>

            {fout && <p className="text-sm px-1" style={{ color: '#FF560D' }}>{fout}</p>}

            <button
              onClick={uploaden}
              disabled={loading || !titel}
              className="w-full py-4 rounded-2xl text-white font-semibold text-lg mt-2"
              style={{ backgroundColor: loading || !titel ? '#999' : '#0766C6' }}>
              {loading ? 'Uploaden...' : 'Partituur opslaan'}
            </button>
          </div>
        )}

      </div>
    </main>
  )
}
