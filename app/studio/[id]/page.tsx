'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

type Stap = 'briefing' | 'toggles' | 'sessie' | 'reflectie' | 'analyse'
type AnnotatieItem = { tijdstip: number; inhoud: string }

export default function Studio() {
  const router = useRouter()
  const params = useParams()

  const [partituur, setPartituur] = useState<any>(null)
  const [leraarInstructies, setLeraarInstructies] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  const [stap, setStap] = useState<Stap>('briefing')
  const [bpm, setBpm] = useState(80)

  const [toonPartituur, setToonPartituur] = useState(false)
  const [toonMetronoom, setToonMetronoom] = useState(true)
  const [toonLeraarTrack, setToonLeraarTrack] = useState(false)
  const [toonOpmerkingen, setToonOpmerkingen] = useState(true)

  const [timerActief, setTimerActief] = useState(false)
  const [seconden, setSeconden] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [metronomActief, setMetronomActief] = useState(false)
  const [beat, setBeat] = useState(false)
  const metronomRef = useRef<NodeJS.Timeout | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const [opnameActief, setOpnameActief] = useState(false)
  const [gepauzeerd, setGepauzeerd] = useState(false)
  const [opnameUrl, setOpnameUrl] = useState<string | null>(null)
  const [opnameBlob, setOpnameBlob] = useState<Blob | null>(null)
  const [isVideoOpname, setIsVideoOpname] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)

  const [annotaties, setAnnotaties] = useState<AnnotatieItem[]>([])
  const [nieuweAnnotatie, setNieuweAnnotatie] = useState('')

  const [antwoorden, setAntwoorden] = useState({ tops: '', tips: '', gevoel: '' })
  const [aiFeedback, setAiFeedback] = useState<any>(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)

  const [niveau, setNiveau] = useState(3)
  const [challenges, setChallenges] = useState<string[]>([])
  const [challengesLaden, setChallengesLaden] = useState(true)

  // Leraar track controls
  const [leraarLoop, setLeraarLoop] = useState(false)
  const [leraarSnelheid, setLeraarSnelheid] = useState(1)
  const leraarAudioRef = useRef<HTMLAudioElement | null>(null)

  // Camera
  const [cameraActief, setCameraActief] = useState(false)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => {
    if (cameraActief && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current
      cameraVideoRef.current.play().catch(() => {})
    }
  }, [cameraActief])

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
        setCameraActief(true) // useEffect zet srcObject na render
      } catch {
        alert('Camera toegang geweigerd. Controleer je browserinstellingen.')
      }
    }
  }

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data } = await supabase.from('partituren').select('*').eq('id', params.id).single()
      if (data) {
        setPartituur(data)
        const { data: annotatieData } = await supabase
          .from('annotaties').select('inhoud')
          .eq('partituur_id', params.id).eq('type', 'leraar').order('created_at', { ascending: true })
        setLeraarInstructies(annotatieData?.map((a: any) => a.inhoud) || [])

        // Student profiel + recente sessies voor challenge generatie
        const { data: profiel } = await supabase
          .from('profiles').select('niveau, instrument').eq('id', user.id).single()
        const studentNiveau = profiel?.niveau || 3
        setNiveau(studentNiveau)

        const { data: recenteSessies } = await supabase
          .from('oefensessies').select('tops, tips, gevoel')
          .eq('student_id', user.id).order('created_at', { ascending: false }).limit(3)

        try {
          const res = await fetch('/api/genereer-challenges', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instrument: profiel?.instrument || 'onbekend',
              niveau: studentNiveau,
              recenteSessies: recenteSessies || [],
              partituurTitel: data.titel,
              partituurComponist: data.componist,
            })
          })
          const challengesData = await res.json()
          setChallenges(challengesData.map((c: any) => c.challenge))
        } catch {
          setChallenges([
            'Speel het stuk van begin tot einde zonder te stoppen.',
            'Kies één moeilijk fragment en oefen het vijf keer langzaam.',
          ])
        }
        setChallengesLaden(false)
      }
      setLoading(false)
    }
    haalOp()
  }, [params.id, router])

  useEffect(() => {
    if (timerActief) {
      timerRef.current = setInterval(() => setSeconden(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerActief])

  const formatTijd = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const tikMetronoom = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const ctx = audioCtxRef.current
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain); gain.connect(ctx.destination)
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    oscillator.start(ctx.currentTime); oscillator.stop(ctx.currentTime + 0.1)
    setBeat(true); setTimeout(() => setBeat(false), 100)
  }

  const stopMetronoom = () => {
    if (metronomRef.current) clearInterval(metronomRef.current)
    setMetronomActief(false)
  }

  const toggleMetronoom = () => {
    if (metronomActief) {
      stopMetronoom()
    } else {
      tikMetronoom()
      metronomRef.current = setInterval(tikMetronoom, (60 / bpm) * 1000)
      setMetronomActief(true)
    }
  }

  useEffect(() => {
    if (metronomActief) {
      if (metronomRef.current) clearInterval(metronomRef.current)
      metronomRef.current = setInterval(tikMetronoom, (60 / bpm) * 1000)
    }
    return () => { if (metronomRef.current) clearInterval(metronomRef.current) }
  }, [bpm])

  const startOpname = async () => {
    try {
      const videoOpname = cameraActief

      // Stop bestaande preview stream zodat we één gecombineerde stream kunnen starten
      cameraStreamRef.current?.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null

      const constraints = videoOpname ? { audio: true, video: true } : { audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      audioStreamRef.current = stream
      streamRef.current = stream

      // Zet nieuwe gecombineerde stream ook als camerapreview
      if (videoOpname) {
        cameraStreamRef.current = stream
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          cameraVideoRef.current.play().catch(() => {})
        }
      }

      let mimeType = ''
      if (videoOpname) {
        mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm'
          : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : ''
      } else {
        mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || (videoOpname ? 'video/webm' : 'audio/webm') })
        setOpnameBlob(blob); setOpnameUrl(URL.createObjectURL(blob))
        setIsVideoOpname(videoOpname)
        stream.getTracks().forEach(t => t.stop())
        audioStreamRef.current = null
        streamRef.current = null
        cameraStreamRef.current = null
        if (videoOpname) setCameraActief(false)
      }
      mediaRecorderRef.current = recorder; recorder.start(100)
      setOpnameActief(true); setGepauzeerd(false); setTimerActief(true)
    } catch {
      alert('Microfoon/camera toegang geweigerd. Geef toestemming in je browser.')
    }
  }

  const annuleerOpname = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {}
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioStreamRef.current?.getTracks().forEach(t => t.stop())
    audioStreamRef.current = null
    streamRef.current = null
    cameraStreamRef.current = null
    if (cameraActief) setCameraActief(false)
    setOpnameActief(false); setGepauzeerd(false)
  }

  const pauzeerOpname = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause(); setGepauzeerd(true); setTimerActief(false)
    }
  }

  const hervat = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume(); setGepauzeerd(false); setTimerActief(true)
    }
  }

  const stopOpname = () => {
    mediaRecorderRef.current?.stop()
    setOpnameActief(false); setGepauzeerd(false); setTimerActief(false)
  }

  const rondeAf = () => {
    if (opnameActief) stopOpname()
    stopMetronoom()
    setTimerActief(false)
    if (leraarAudioRef.current) {
      leraarAudioRef.current.pause(); leraarAudioRef.current.currentTime = 0
    }
    setStap('reflectie')
  }

  const voegAnnotatieToe = () => {
    if (!nieuweAnnotatie.trim() || !audioPlayerRef.current) return
    const tijdstip = Math.floor(audioPlayerRef.current.currentTime)
    setAnnotaties(prev => [...prev, { tijdstip, inhoud: nieuweAnnotatie }])
    setNieuweAnnotatie('')
  }

  const slaSessionOp = async () => {
    if (!userId || !partituur) return
    setLoadingFeedback(true)

    let feedback = null
    try {
      const res = await fetch('/api/studio-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel: partituur.titel, componist: partituur.componist, duur: seconden, bpm, antwoorden, studentId: userId, huidigNiveau: niveau })
      })
      feedback = await res.json()
      setAiFeedback(feedback)
    } catch { console.error('Feedback fout') }

    let opnameOpgeslagenUrl = null
    if (opnameBlob) {
      const extensie = opnameBlob.type.includes('mp4') ? 'mp4' : 'webm'
      const naam = `opname_${Date.now()}_${userId}.${extensie}`
      const { error: uploadError } = await supabase.storage.from('opnames').upload(naam, opnameBlob, { contentType: opnameBlob.type })
      if (uploadError) {
        console.error('Opname upload fout:', uploadError)
      } else {
        const { data: urlData } = supabase.storage.from('opnames').getPublicUrl(naam)
        opnameOpgeslagenUrl = urlData.publicUrl
      }
    }

    const { error: insertError } = await supabase.from('oefensessies').insert({
      student_id: userId, partituur_id: partituur.id, duur: seconden, bpm,
      tops: antwoorden.tops, tips: antwoorden.tips, gevoel: antwoorden.gevoel,
      ai_feedback: JSON.stringify(feedback), challenges: challenges,
      opname_url: opnameOpgeslagenUrl, status: 'afgerond', notities: JSON.stringify(annotaties)
    })

    if (insertError) {
      console.error('Sessie opslaan fout:', insertError)
      alert(`Sessie kon niet opgeslagen worden: ${insertError.message}`)
      setLoadingFeedback(false)
      return
    }

    if (annotaties.length > 0 && opnameOpgeslagenUrl) {
      await supabase.from('opname_annotaties').insert(
        annotaties.map(a => ({
          opname_url: opnameOpgeslagenUrl, auteur_id: userId,
          partituur_id: partituur.id, tijdstip: a.tijdstip, inhoud: a.inhoud
        }))
      )
    }

    setLoadingFeedback(false); setStap('analyse')
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  if (!partituur) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#666' }}>Partituur niet gevonden</p>
    </main>
  )

  // Toggle-chips die tijdens de sessie zichtbaar zijn
  const toggleChips = [
    { icon: '📄', naam: 'Partituur', waarde: toonPartituur, stel: setToonPartituur, toon: !!partituur.bestand_url },
    { icon: '🥁', naam: 'Metronoom', waarde: toonMetronoom, stel: setToonMetronoom, toon: true },
    { icon: '🎵', naam: 'Track', waarde: toonLeraarTrack, stel: setToonLeraarTrack, toon: !!partituur.leraar_audio_url },
    { icon: '💬', naam: 'Tips', waarde: toonOpmerkingen, stel: setToonOpmerkingen, toon: leraarInstructies.length > 0 },
  ].filter(t => t.toon)

  return (
    <main className="min-h-screen px-4 py-8" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-lg mx-auto">

        {/* ===== STAP 1: BRIEFING ===== */}
        {stap === 'briefing' && (
          <div className="flex flex-col gap-4">
            <button onClick={() => router.back()} className="text-sm flex items-center gap-2 mb-2"
              style={{ color: '#0766C6' }}>← Terug</button>

            <div className="rounded-2xl p-6" style={{ backgroundColor: '#0766C6' }}>
              <p className="text-blue-200 text-sm mb-1">Oefensessie</p>
              <h1 className="text-2xl font-bold text-white">{partituur.titel}</h1>
              {partituur.componist && <p className="text-blue-200 mt-1">{partituur.componist}</p>}
            </div>

            <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
              <h2 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#FF560D' }}>
                🎯 Jouw challenges voor deze sessie
              </h2>
              {challengesLaden ? (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#FF560D', opacity: 0.4, animation: 'pulse 1.2s infinite' }} />
                  <p className="text-sm" style={{ color: '#888' }}>Challenges worden gegenereerd...</p>
                </div>
              ) : (
                challenges.map((challenge, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl mb-2 last:mb-0"
                    style={{ backgroundColor: '#F3E7DD' }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                      style={{ backgroundColor: '#FF560D' }}>{i + 1}</span>
                    <p className="text-sm leading-relaxed" style={{ color: '#333' }}>{challenge}</p>
                  </div>
                ))
              )}
            </div>

            {partituur.leraar_audio_url && (
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
                <h2 className="font-semibold mb-3" style={{ color: '#333' }}>🎙 Referentie-opname leraar</h2>
                <audio controls src={partituur.leraar_audio_url} className="w-full" />
              </div>
            )}

            <button onClick={() => setStap('toggles')}
              className="w-full py-5 rounded-2xl text-white font-bold text-xl transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: '#FF560D' }}>Verder →</button>
          </div>
        )}

        {/* ===== STAP 1B: TOGGLES ===== */}
        {stap === 'toggles' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-6" style={{ backgroundColor: '#0766C6' }}>
              <p className="text-blue-200 text-sm">Personaliseer je sessie</p>
              <h1 className="text-2xl font-bold text-white mt-1">Wat wil je zien?</h1>
              <p className="text-blue-200 text-sm mt-1">Je kan dit ook aanpassen tijdens de sessie</p>
            </div>

            <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
              <p className="text-xs mb-4 pb-3" style={{ color: '#888', borderBottom: '1px solid #F3E7DD' }}>
                ⏱ Timer · 🎙 Opname · 🎯 Challenges staan altijd aan
              </p>
              <div className="flex flex-col gap-4">
                {[
                  { label: '📄 Partituur', sub: 'Toon de PDF tijdens het oefenen', value: toonPartituur, set: setToonPartituur },
                  { label: '🥁 Metronoom', sub: 'Visuele en auditieve metronoom', value: toonMetronoom, set: setToonMetronoom },
                  { label: '🎵 Track leraar', sub: 'Referentie-opname van je leraar', value: toonLeraarTrack, set: setToonLeraarTrack },
                  { label: '💬 Opmerkingen', sub: 'Instructies en tips van je leraar', value: toonOpmerkingen, set: setToonOpmerkingen },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2"
                    style={{ borderBottom: '1px solid #F3E7DD' }}>
                    <div>
                      <p className="font-medium text-sm" style={{ color: '#333' }}>{item.label}</p>
                      <p className="text-xs" style={{ color: '#888' }}>{item.sub}</p>
                    </div>
                    <button onClick={() => item.set(!item.value)}
                      className="w-12 h-6 rounded-full flex items-center px-1 transition-colors"
                      style={{ backgroundColor: item.value ? '#0766C6' : '#ddd' }}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${item.value ? 'ml-auto' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setStap('sessie')}
              className="w-full py-5 rounded-2xl text-white font-bold text-xl transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: '#FF560D' }}>🎵 Start oefensessie</button>
          </div>
        )}

        {/* ===== STAP 2: SESSIE ACTIEF ===== */}
        {stap === 'sessie' && (
          <div className="flex flex-col gap-4">

            {/* Header met timer */}
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#0766C6' }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-blue-200 text-xs">Nu aan het oefenen</p>
                  <p className="text-white font-bold truncate">{partituur.titel}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white text-2xl font-bold font-mono">{formatTijd(seconden)}</p>
                  <p className="text-blue-200 text-xs">{bpm} BPM</p>
                </div>
              </div>
            </div>

            {/* Snelle toggles — aanpasbaar tijdens sessie */}
            {toggleChips.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {toggleChips.map(t => (
                  <button key={t.naam} onClick={() => t.stel(!t.waarde)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      backgroundColor: t.waarde ? '#0766C6' : '#fff',
                      color: t.waarde ? '#fff' : '#888'
                    }}>
                    <span>{t.icon}</span>
                    <span>{t.naam}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Challenges */}
            {challenges.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#fff' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#FF560D' }}>🎯 Challenges</p>
                {challenges.map((challenge, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1 last:mb-0">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white mt-0.5"
                      style={{ backgroundColor: '#FF560D' }}>{i + 1}</span>
                    <p className="text-xs leading-relaxed" style={{ color: '#333' }}>{challenge}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Opname */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>

              {/* Header met camera toggle */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3E7DD' }}>
                <h2 className="font-semibold" style={{ color: '#333' }}>🎙 Opname</h2>
                <button onClick={toggleCamera}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ backgroundColor: cameraActief ? '#0766C6' : '#F3E7DD', color: cameraActief ? '#fff' : '#666' }}>
                  📷 {cameraActief ? 'Camera uit' : 'Camera aan'}
                </button>
              </div>

              {/* Camera preview */}
              {cameraActief && (
                <div className="px-5 pt-4">
                  <video ref={cameraVideoRef} autoPlay muted playsInline
                    className="w-full rounded-xl object-cover"
                    style={{ maxHeight: '200px', backgroundColor: '#000' }} />
                </div>
              )}

              <div className="p-5">

                {/* Nog geen opname */}
                {!opnameActief && !opnameUrl && (
                  <button onClick={startOpname}
                    className="w-full py-4 rounded-xl text-white font-semibold text-lg transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: '#FF560D' }}>● Start opname</button>
                )}

                {/* Opname bezig */}
                {opnameActief && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-3 py-4 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                      <div className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: gepauzeerd ? '#bbb' : '#FF560D', animation: gepauzeerd ? 'none' : 'pulse 1s infinite' }} />
                      <span className="text-3xl font-mono font-bold" style={{ color: gepauzeerd ? '#888' : '#333' }}>
                        {formatTijd(seconden)}
                      </span>
                      <span className="text-xs font-medium" style={{ color: gepauzeerd ? '#aaa' : '#FF560D' }}>
                        {gepauzeerd ? 'gepauzeerd' : 'opname bezig'}
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
                        <button onClick={hervat}
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

                {/* Opname klaar */}
                {opnameUrl && !opnameActief && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-medium" style={{ color: '#0766C6' }}>
                      ✓ {isVideoOpname ? '📹 Video + audio' : 'Opname'} klaar — beluister en voeg notities toe
                    </p>
                    {isVideoOpname ? (
                      <video controls src={opnameUrl} className="w-full rounded-xl"
                        style={{ maxHeight: '220px', backgroundColor: '#000' }} />
                    ) : (
                      <audio ref={audioPlayerRef} controls src={opnameUrl} className="w-full" preload="auto" />
                    )}

                    <div className="p-3 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                      <p className="text-xs font-medium mb-2" style={{ color: '#666' }}>📝 Notitie op huidig tijdstip</p>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Bijv: hier gaat de overgang fout..."
                          value={nieuweAnnotatie} onChange={(e) => setNieuweAnnotatie(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && voegAnnotatieToe()}
                          className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                          style={{ backgroundColor: '#fff', color: '#333' }} />
                        <button onClick={voegAnnotatieToe}
                          className="px-3 py-2 rounded-lg text-white text-xs font-medium"
                          style={{ backgroundColor: '#0766C6' }}>+</button>
                      </div>
                    </div>

                    {annotaties.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {[...annotaties].sort((a, b) => a.tijdstip - b.tijdstip).map((a, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: '#F3E7DD' }}>
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ backgroundColor: '#0766C6', color: '#fff' }}>{formatTijd(a.tijdstip)}</span>
                            <p className="text-xs" style={{ color: '#333' }}>{a.inhoud}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={startOpname}
                        className="flex-1 py-2 rounded-xl text-sm font-medium"
                        style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>↺ Opnieuw opnemen</button>
                      <button onClick={() => { setOpnameUrl(null); setOpnameBlob(null); setAnnotaties([]) }}
                        className="flex-1 py-2 rounded-xl text-sm font-medium"
                        style={{ backgroundColor: '#F3E7DD', color: '#FF560D' }}>✕ Verwijder opname</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Metronoom */}
            {toonMetronoom && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold" style={{ color: '#333' }}>🥁 Metronoom</h2>
                  <button onClick={toggleMetronoom}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-transform hover:scale-105"
                    style={{ backgroundColor: metronomActief ? '#FF560D' : '#0766C6' }}>
                    {metronomActief ? '■ Stop' : '▶ Start'}
                  </button>
                </div>
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 rounded-full"
                    style={{
                      backgroundColor: beat ? '#0766C6' : '#F3E7DD',
                      transform: beat ? 'scale(1.08)' : 'scale(1)',
                      transitionDuration: beat ? '60ms' : '300ms',
                      transitionTimingFunction: 'ease-out',
                      transitionProperty: 'all',
                      boxShadow: beat ? '0 0 12px rgba(7,102,198,0.25)' : 'none'
                    }} />
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setBpm(b => Math.max(40, b - 5))}
                    className="w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center"
                    style={{ backgroundColor: '#0766C6' }}>−</button>
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold" style={{ color: '#0766C6' }}>{bpm}</p>
                    <p className="text-xs" style={{ color: '#888' }}>BPM</p>
                  </div>
                  <button onClick={() => setBpm(b => Math.min(220, b + 5))}
                    className="w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center"
                    style={{ backgroundColor: '#0766C6' }}>+</button>
                </div>
                <input type="range" min={40} max={220} value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))} className="w-full mt-3" />
              </div>
            )}

            {/* Partituur */}
            {toonPartituur && partituur.bestand_url && (
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                <p className="px-5 py-3 text-sm font-medium" style={{ color: '#0766C6' }}>📄 Partituur</p>
                <div style={{ height: '400px' }}>
                  <iframe src={`${partituur.bestand_url}#toolbar=0`} className="w-full h-full" title={partituur.titel} />
                </div>
              </div>
            )}

            {/* Leraar track met loop + snelheid */}
            {toonLeraarTrack && partituur.leraar_audio_url && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
                <h2 className="font-semibold mb-3" style={{ color: '#333' }}>🎵 Track leraar</h2>
                <audio
                  ref={leraarAudioRef}
                  controls
                  src={partituur.leraar_audio_url}
                  className="w-full"
                  loop={leraarLoop}
                />
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {/* Loop toggle */}
                  <button
                    onClick={() => {
                      const nieuw = !leraarLoop
                      setLeraarLoop(nieuw)
                      if (leraarAudioRef.current) leraarAudioRef.current.loop = nieuw
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                    style={{
                      backgroundColor: leraarLoop ? '#0766C6' : '#F3E7DD',
                      color: leraarLoop ? '#fff' : '#666'
                    }}>
                    🔁 Loop {leraarLoop ? 'aan' : 'uit'}
                  </button>

                  {/* Afspeelsnelheid slider */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs" style={{ color: '#888' }}>Snelheid</p>
                      <span className="text-xs font-bold" style={{ color: '#FF560D' }}>{leraarSnelheid}×</span>
                    </div>
                    <input
                      type="range" min={0.25} max={1} step={0.25} value={leraarSnelheid}
                      onChange={(e) => {
                        const speed = Number(e.target.value)
                        setLeraarSnelheid(speed)
                        if (leraarAudioRef.current) leraarAudioRef.current.playbackRate = speed
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between mt-0.5">
                      {[0.25, 0.5, 0.75, 1].map(s => (
                        <span key={s} className="text-xs" style={{ color: leraarSnelheid === s ? '#FF560D' : '#bbb' }}>
                          {s}×
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Opmerkingen */}
            {toonOpmerkingen && leraarInstructies.length > 0 && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#fff' }}>
                <h2 className="font-semibold mb-3" style={{ color: '#333' }}>💬 Opmerkingen leraar</h2>
                {leraarInstructies.map((instructie, i) => (
                  <p key={i} className="text-sm p-3 rounded-xl mb-2 last:mb-0"
                    style={{ backgroundColor: '#F3E7DD', color: '#333' }}>{instructie}</p>
                ))}
              </div>
            )}

            <button onClick={rondeAf}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: '#333' }}>Sessie afronden →</button>
          </div>
        )}

        {/* ===== STAP 3: REFLECTIE ===== */}
        {stap === 'reflectie' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-6" style={{ backgroundColor: '#0766C6' }}>
              <p className="text-blue-200 text-sm">Sessie afgerond ✓</p>
              <h1 className="text-2xl font-bold text-white mt-1">Hoe ging het?</h1>
              <p className="text-blue-200 text-sm mt-1">{formatTijd(seconden)} geoefend · {bpm} BPM</p>
            </div>

            <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: '#FFD100' }}>1</span>
                <h2 className="font-semibold" style={{ color: '#333' }}>Wat ging er goed vandaag? 🌟</h2>
              </div>
              <textarea placeholder="Bijv: De overgang in maat 8 zat er eindelijk in..."
                value={antwoorden.tops} onChange={(e) => setAntwoorden(a => ({ ...a, tops: e.target.value }))}
                rows={3} className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
            </div>

            <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: '#0766C6' }}>2</span>
                <h2 className="font-semibold" style={{ color: '#333' }}>Wat wil je volgende keer verbeteren? 🎯</h2>
              </div>
              <textarea placeholder="Bijv: Het tempo in het tweede deel was nog te snel..."
                value={antwoorden.tips} onChange={(e) => setAntwoorden(a => ({ ...a, tips: e.target.value }))}
                rows={3} className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
            </div>

            <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: '#FF560D' }}>3</span>
                <h2 className="font-semibold" style={{ color: '#333' }}>Hoe voelde deze sessie aan? 💭</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: '🔥', label: 'Super goed!' },
                  { emoji: '😊', label: 'Goed bezig' },
                  { emoji: '😐', label: 'Oké' },
                  { emoji: '😓', label: 'Moeilijk' }
                ].map((optie) => (
                  <button key={optie.label}
                    onClick={() => setAntwoorden(a => ({ ...a, gevoel: optie.label }))}
                    className="py-3 px-4 rounded-xl text-sm font-medium transition-transform hover:scale-[1.02] flex items-center gap-2"
                    style={{
                      backgroundColor: antwoorden.gevoel === optie.label ? '#0766C6' : '#F3E7DD',
                      color: antwoorden.gevoel === optie.label ? '#fff' : '#333'
                    }}>
                    <span>{optie.emoji}</span><span>{optie.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={slaSessionOp}
              disabled={!antwoorden.tops || !antwoorden.tips || !antwoorden.gevoel || loadingFeedback}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: (!antwoorden.tops || !antwoorden.tips || !antwoorden.gevoel) ? '#ccc' : '#FF560D' }}>
              {loadingFeedback ? '⏳ Analyse bezig...' : 'Sessie opslaan & analyseren →'}
            </button>
          </div>
        )}

        {/* ===== STAP 4: ANALYSE ===== */}
        {stap === 'analyse' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-6" style={{ backgroundColor: '#0766C6' }}>
              <p className="text-blue-200 text-sm">Sessie opgeslagen ✓</p>
              <h1 className="text-2xl font-bold text-white mt-1">Jouw analyse</h1>
              <p className="text-blue-200 text-sm mt-1">{formatTijd(seconden)} · {bpm} BPM · {partituur.titel}</p>
            </div>

            {aiFeedback && (
              <>
                <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🌟</span>
                    <h2 className="font-semibold" style={{ color: '#333' }}>Tops</h2>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#444' }}>{aiFeedback.tops}</p>
                </div>

                <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🎯</span>
                    <h2 className="font-semibold" style={{ color: '#333' }}>Tips voor volgende keer</h2>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#444' }}>{aiFeedback.tips}</p>
                </div>

                <div className="rounded-2xl p-6" style={{ backgroundColor: '#FF560D' }}>
                  <p className="text-white font-semibold text-lg leading-relaxed">💪 {aiFeedback.motivatie}</p>
                </div>
              </>
            )}

            {opnameUrl && (
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#fff' }}>
                <h2 className="font-semibold mb-3" style={{ color: '#333' }}>
                  {isVideoOpname ? '📹 Jouw video' : '🎙 Jouw opname'}
                </h2>
                {isVideoOpname ? (
                  <video controls src={opnameUrl} className="w-full rounded-xl"
                    style={{ maxHeight: '220px', backgroundColor: '#000' }} />
                ) : (
                  <audio controls src={opnameUrl} className="w-full" preload="auto" />
                )}
                {annotaties.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1">
                    <p className="text-xs font-medium mb-1" style={{ color: '#888' }}>Jouw notities</p>
                    {[...annotaties].sort((a, b) => a.tijdstip - b.tijdstip).map((a, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: '#F3E7DD' }}>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ backgroundColor: '#0766C6', color: '#fff' }}>{formatTijd(a.tijdstip)}</span>
                        <p className="text-xs" style={{ color: '#333' }}>{a.inhoud}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => router.push(`/partituren/${partituur.id}`)}
                className="py-4 rounded-2xl font-semibold text-sm"
                style={{ backgroundColor: '#fff', color: '#0766C6' }}>← Partituur</button>
              <button onClick={() => router.push('/dashboard')}
                className="py-4 rounded-2xl text-white font-semibold text-sm"
                style={{ backgroundColor: '#0766C6' }}>Dashboard →</button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
   