'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

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

export default function PartituurBewerken() {
  const router = useRouter()
  const params = useParams()

  const [loading, setLoading] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [fout, setFout] = useState('')
  const [userId, setUserId] = useState('')

  // Partituur velden
  const [titel, setTitel] = useState('')
  const [componist, setComponist] = useState('')
  const [huidigMediaUrl, setHuidigMediaUrl] = useState<string | null>(null)
  const [referenties, setReferenties] = useState<any[]>([])
  const [loadingRef, setLoadingRef] = useState(false)

  // Instructies
  const [instructies, setInstructies] = useState<{ id: string; inhoud: string }[]>([])
  const [nieuweInstructie, setNieuweInstructie] = useState('')
  const [bewerkId, setBewerkId] = useState<string | null>(null)
  const [bewerkTekst, setBewerkTekst] = useState('')

  // Audio/video modus
  const [audioModus, setAudioModus] = useState<'behoud' | 'opname' | 'upload' | 'verwijder'>('behoud')
  const [opnameActief, setOpnameActief] = useState(false)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  const [opnameTijd, setOpnameTijd] = useState(0)
  const [nieuwMediaBlob, setNieuwMediaBlob] = useState<Blob | null>(null)
  const [nieuwMediaUrl, setNieuwMediaUrl] = useState<string | null>(null)
  const [isVideo, setIsVideo] = useState(false)
  const [audioDuur, setAudioDuur] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [trimBezig, setTrimBezig] = useState(false)

  // Camera
  const [cameraActief, setCameraActief] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const bestandInput = useRef<HTMLInputElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const formatTijd = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`

  useEffect(() => {
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

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: p } = await supabase.from('partituren').select('*').eq('id', params.id).single()
      if (!p || p.leraar_id !== user.id) { router.push(`/partituren/${params.id}`); return }

      setTitel(p.titel || '')
      setComponist(p.componist || '')
      setHuidigMediaUrl(p.leraar_audio_url || null)
      if (p.referentie_url) {
        try { setReferenties(JSON.parse(p.referentie_url)) } catch { /* leeg */ }
      }

      const { data: ann } = await supabase.from('annotaties').select('id, inhoud')
        .eq('partituur_id', params.id).eq('type', 'leraar').order('created_at', { ascending: true })
      setInstructies(ann?.map((a: any) => ({ id: a.id, inhoud: a.inhoud })) || [])
      setLoading(false)
    }
    haalOp()
  }, [params.id, router])

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
        setNieuwMediaBlob(blob)
        setNieuwMediaUrl(URL.createObjectURL(blob))
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
    setAudioModus('behoud')
  }

  const opnieuwOpnemen = () => {
    setNieuwMediaBlob(null); setNieuwMediaUrl(null); setIsVideo(false)
    setOpnameTijd(0); setAudioDuur(0); setTrimStart(0); setTrimEnd(0)
  }

  const handleBestand = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setNieuwMediaBlob(f); setNieuwMediaUrl(URL.createObjectURL(f)); setIsVideo(false)
  }

  const handleAudioGeladen = () => {
    const d = audioRef.current?.duration
    if (d && isFinite(d)) { setAudioDuur(d); setTrimStart(0); setTrimEnd(Math.floor(d)) }
  }

  const pasTrimToe = async () => {
    if (!nieuwMediaBlob || trimStart >= trimEnd) return
    setTrimBezig(true)
    try {
      const ctx = new AudioContext()
      const buf = await ctx.decodeAudioData(await nieuwMediaBlob.arrayBuffer())
      await ctx.close()
      const dur = trimEnd - trimStart
      const off = new OfflineAudioContext(buf.numberOfChannels, Math.ceil(buf.sampleRate * dur), buf.sampleRate)
      const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination)
      src.start(0, trimStart, dur)
      const wav = audioBufferNaarWav(await off.startRendering())
      setNieuwMediaBlob(wav); setNieuwMediaUrl(URL.createObjectURL(wav))
      setAudioDuur(dur); setTrimStart(0); setTrimEnd(Math.floor(dur))
    } catch { /* stille fout */ }
    setTrimBezig(false)
  }

  const voegInstructieToe = async () => {
    if (!nieuweInstructie.trim()) return
    const { data, error } = await supabase.from('annotaties').insert({
      partituur_id: params.id, auteur_id: userId, inhoud: nieuweInstructie, type: 'leraar'
    }).select('id, inhoud').single()
    if (error || !data) return
    setInstructies(prev => [...prev, { id: data.id, inhoud: data.inhoud }])
    setNieuweInstructie('')
  }

  const verwijderInstructie = async (id: string) => {
    await supabase.from('annotaties').delete().eq('id', id)
    setInstructies(prev => prev.filter(i => i.id !== id))
  }

  const slaInstructieBewerkingOp = async () => {
    if (!bewerkId || !bewerkTekst.trim()) return
    await supabase.from('annotaties').update({ inhoud: bewerkTekst }).eq('id', bewerkId)
    setInstructies(prev => prev.map(i => i.id === bewerkId ? { ...i, inhoud: bewerkTekst } : i))
    setBewerkId(null); setBewerkTekst('')
  }

  const vernieuwReferenties = async () => {
    if (!titel) return
    setLoadingRef(true)
    try {
      const res = await fetch('/api/zoek-referenties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel, componist })
      })
      const data = await res.json()
      setReferenties(data.links || [])
    } catch { /* stille fout */ }
    setLoadingRef(false)
  }

  const slaOp = async () => {
    if (!titel) return
    setOpslaan(true); setFout('')
    try {
      let nieuweMediaUrl = huidigMediaUrl

      if (audioModus === 'verwijder') {
        nieuweMediaUrl = null
      } else if ((audioModus === 'opname' || audioModus === 'upload') && nieuwMediaBlob) {
        const ext = nieuwMediaBlob.type.includes('mp4') ? 'mp4' : nieuwMediaBlob.type.includes('wav') ? 'wav' : 'webm'
        const naam = `leraar_${Date.now()}_${userId}.${ext}`
        const { error: ae } = await supabase.storage.from('partituren').upload(naam, nieuwMediaBlob, { contentType: nieuwMediaBlob.type })
        if (!ae) {
          const { data: au } = supabase.storage.from('partituren').getPublicUrl(naam)
          nieuweMediaUrl = au.publicUrl
        }
      }

      const { error } = await supabase.from('partituren').update({
        titel, componist,
        leraar_audio_url: nieuweMediaUrl,
        referentie_url: referenties.length > 0 ? JSON.stringify(referenties) : null
      }).eq('id', params.id)

      if (error) throw error
      router.push(`/partituren/${params.id}`)
    } catch (e: any) { setFout(e.message); setOpslaan(false) }
  }

  const isGewijzigd = audioDuur > 0 && (trimStart > 0 || trimEnd < Math.floor(audioDuur))

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-lg mx-auto">

        <button onClick={() => router.back()} className="mb-6 text-sm flex items-center gap-2" style={{ color: '#0766C6' }}>← Terug</button>
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#0766C6' }}>Partituur bewerken</h1>
        <p className="text-sm mb-8" style={{ color: '#666' }}>Wijzig de gegevens en sla op</p>

        {/* Basisgegevens */}
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#fff' }}>
          <h2 className="font-semibold mb-3" style={{ color: '#333' }}>📝 Basisgegevens</h2>
          <div className="flex flex-col gap-3">
            <input type="text" placeholder="Titel" value={titel} onChange={(e) => setTitel(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base outline-none" style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
            <input type="text" placeholder="Componist" value={componist} onChange={(e) => setComponist(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base outline-none" style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
          </div>
        </div>

        {/* Referentie-opname */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ backgroundColor: '#fff' }}>

          <div className="px-5 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3E7DD' }}>
            <div>
              <h2 className="font-semibold" style={{ color: '#333' }}>🎙 Referentie-opname</h2>
              <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                {cameraActief ? 'Video + audio voor de student' : 'Audio voor de student'}
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

            {/* Huidige opname */}
            {huidigMediaUrl && audioModus === 'behoud' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: '#888' }}>Huidige opname</p>
                  <video controls src={huidigMediaUrl} className="w-full rounded-lg"
                    style={{ maxHeight: '180px', backgroundColor: '#000' }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setAudioModus('opname'); opnieuwOpnemen() }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#0766C6' }}>
                    ↺ Vervangen
                  </button>
                  <button onClick={() => setAudioModus('verwijder')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F3E7DD', color: '#FF560D' }}>
                    ✕ Verwijderen
                  </button>
                </div>
              </div>
            )}

            {/* Geen opname */}
            {!huidigMediaUrl && audioModus === 'behoud' && (
              <div className="flex gap-3">
                <button onClick={() => setAudioModus('opname')}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: '#FF560D' }}>● Opnemen</button>
                <button onClick={() => { setAudioModus('upload'); bestandInput.current?.click() }}
                  className="flex-1 py-3 rounded-xl font-medium text-sm transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>📁 Upload bestand</button>
              </div>
            )}

            {/* Verwijder bevestiging */}
            {audioModus === 'verwijder' && (
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#FFF3F0' }}>
                <p className="text-sm font-medium mb-2" style={{ color: '#FF560D' }}>Opname wordt verwijderd bij opslaan.</p>
                <button onClick={() => setAudioModus('behoud')} className="text-xs" style={{ color: '#666' }}>↺ Ongedaan maken</button>
              </div>
            )}

            {/* Upload modus */}
            {audioModus === 'upload' && !nieuwMediaBlob && (
              <div className="flex flex-col gap-3">
                <button onClick={() => bestandInput.current?.click()}
                  className="w-full py-4 rounded-xl font-medium text-sm"
                  style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>📁 Kies audiobestand</button>
                <button onClick={() => setAudioModus('behoud')} className="text-xs text-center" style={{ color: '#aaa' }}>Annuleren</button>
              </div>
            )}

            <input ref={bestandInput} type="file" accept="audio/*" onChange={handleBestand} className="hidden" />

            {/* Opname modus — nog geen blob */}
            {audioModus === 'opname' && !nieuwMediaBlob && (
              <div className="flex flex-col gap-3">
                {!opnameActief ? (
                  <button onClick={startOpname}
                    className="w-full py-4 rounded-xl text-white font-semibold transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: '#FF560D' }}>● Start opname</button>
                ) : (
                  <div className="flex flex-col gap-3">
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
                {!opnameActief && (
                  <button onClick={() => setAudioModus('behoud')} className="text-xs text-center" style={{ color: '#aaa' }}>Annuleren</button>
                )}
              </div>
            )}

            {/* Opname klaar */}
            {nieuwMediaBlob && nieuwMediaUrl && (
              <div className="flex flex-col gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: '#0766C6' }}>
                    ✓ {isVideo ? '📹 Video + audio' : 'Opname'} klaar
                  </p>
                  {isVideo ? (
                    <video controls src={nieuwMediaUrl} className="w-full rounded-lg"
                      style={{ maxHeight: '220px', backgroundColor: '#000' }} />
                  ) : (
                    <audio ref={audioRef} controls src={nieuwMediaUrl} className="w-full" onLoadedMetadata={handleAudioGeladen} />
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

        {/* Leraar instructies */}
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#fff' }}>
          <h2 className="font-semibold mb-3" style={{ color: '#333' }}>🎯 Instructies voor studenten</h2>

          {instructies.length === 0 && (
            <p className="text-sm mb-3" style={{ color: '#aaa' }}>Nog geen instructies toegevoegd.</p>
          )}

          <div className="flex flex-col gap-2 mb-4">
            {instructies.map((inst) => (
              <div key={inst.id}>
                {bewerkId === inst.id ? (
                  <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                    <textarea value={bewerkTekst} onChange={(e) => setBewerkTekst(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
                      style={{ backgroundColor: '#fff', color: '#333' }} />
                    <div className="flex gap-2">
                      <button onClick={slaInstructieBewerkingOp}
                        className="flex-1 py-2 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: '#0766C6' }}>Opslaan</button>
                      <button onClick={() => { setBewerkId(null); setBewerkTekst('') }}
                        className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: '#fff', color: '#666' }}>Annuleren</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                    <p className="flex-1 text-sm leading-relaxed" style={{ color: '#333' }}>{inst.inhoud}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setBewerkId(inst.id); setBewerkTekst(inst.inhoud) }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                        style={{ backgroundColor: '#fff', color: '#0766C6' }}>✏️</button>
                      <button onClick={() => verwijderInstructie(inst.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                        style={{ backgroundColor: '#fff', color: '#FF560D' }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input type="text" placeholder="Nieuwe instructie toevoegen..."
              value={nieuweInstructie} onChange={(e) => setNieuweInstructie(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && voegInstructieToe()}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
            <button onClick={voegInstructieToe} disabled={!nieuweInstructie.trim()}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-medium"
              style={{ backgroundColor: nieuweInstructie.trim() ? '#0766C6' : '#ccc' }}>+ Voeg toe</button>
          </div>
        </div>

        {/* YouTube referenties */}
        <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: '#fff' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold" style={{ color: '#333' }}>🎼 YouTube referenties</h2>
            <button onClick={vernieuwReferenties} disabled={loadingRef || !titel}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
              {loadingRef ? 'Zoeken...' : '↻ Vernieuwen'}
            </button>
          </div>
          {referenties.length === 0 ? (
            <p className="text-sm" style={{ color: '#aaa' }}>Klik op vernieuwen om referenties op te zoeken.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {referenties.map((ref: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                  {ref.thumbnail && <img src={ref.thumbnail} alt={ref.titel} className="w-14 h-10 rounded-lg object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: '#333' }}>{ref.titel}</p>
                    <p className="text-xs" style={{ color: '#888' }}>
                      {ref.categorie === 'short' ? '⚡ Short' : '🎼 Uitvoering'} · {ref.kanaal}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {fout && <p className="text-sm mb-4" style={{ color: '#FF560D' }}>{fout}</p>}

        <button onClick={slaOp} disabled={opslaan || !titel}
          className="w-full py-4 rounded-2xl text-white font-semibold text-lg mb-3"
          style={{ backgroundColor: opslaan || !titel ? '#999' : '#0766C6' }}>
          {opslaan ? 'Opslaan...' : 'Wijzigingen opslaan'}
        </button>
        <button onClick={() => router.back()} className="w-full py-3 rounded-2xl text-sm font-medium"
          style={{ backgroundColor: '#fff', color: '#666' }}>Annuleren</button>
      </div>
    </main>
  )
}
