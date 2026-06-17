'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'

type Stap = 'pre-speel' | 'toggles' | 'sessie' | 'voltooiing' | 'activiteit' | 'reflectie' | 'analyse'
type AnnotatieItem = { tijdstip: number; inhoud: string }

const OEFENINGEN = [
  { id: 'herhalen',   label: 'Akkoorden Herhalen',  beschrijving: 'Basisakkoorden overlopen in verschillende volgorde', duur: 5  },
  { id: 'progressie', label: 'Akkoorden Progressie', beschrijving: 'Overgang akkoorden oefenen in eigen tempo',          duur: 5  },
  { id: 'doorspeel',  label: 'Doorspeel Repetitie',  beschrijving: 'Speel doorlopend het stuk gedurende 10 volledige minuten', duur: 10 },
]

const GEVOELSWOORDEN = [
  'Zelfvertrouwen', 'Stress', 'Frustratie', 'Schamen', 'Angst', 'Plezier',
  'Makkelijk', 'Intensief', 'Trots', 'Uitgeput', 'Verward', 'Tevreden',
  'Gefocust', 'Enthousiast', 'Teleurgesteld', 'Nerveus', 'Kalm', 'Gemotiveerd',
  'Overweldigd', 'Nieuwsgierig', 'Voldaan', 'Onzeker',
]

function formatTijd(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function formatTijdLang(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

function berekenStreak(sessies: { created_at: string }[]) {
  if (!sessies.length) return 0
  const datums = [...new Set(sessies.map(s => new Date(s.created_at).toDateString()))]
  let streak = 0
  for (let i = 0; i < 30; i++) {
    const dag = new Date()
    dag.setDate(dag.getDate() - i)
    dag.setHours(0, 0, 0, 0)
    if (datums.includes(dag.toDateString())) { streak++ } else { break }
  }
  return streak
}

// Achievement badge SVG (groen voor voltooiing)
function GroenBadge({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 43 43" fill="none">
      <path d="M35.481 35.5H35.5M35.481 35.5C34.2356 36.735 31.9786 36.4274 30.3959 36.4274C28.453 36.4274 27.5174 36.8074 26.1309 38.194C24.9502 39.3747 23.3675 41.5 21.5 41.5C19.6326 41.5 18.0498 39.3748 16.8691 38.194C15.4826 36.8074 14.547 36.4274 12.6041 36.4274C11.0214 36.4274 8.76437 36.735 7.51898 35.5C6.26362 34.2551 6.57256 31.9888 6.57256 30.3958C6.57256 28.3828 6.13231 27.4572 4.69876 26.0237C2.56627 23.8912 1.50003 22.8249 1.5 21.5C1.50002 20.175 2.56625 19.1088 4.69871 16.9763C5.9784 15.6966 6.57256 14.4286 6.57256 12.6041C6.57256 11.0213 6.26499 8.76429 7.5 7.51889C8.74485 6.26357 11.0112 6.57251 12.6042 6.57251C14.4285 6.57251 15.6966 5.97841 16.9763 4.69874C19.1088 2.56625 20.175 1.5 21.5 1.5C22.825 1.5 23.8912 2.56625 26.0237 4.69874C27.3031 5.97813 28.5709 6.57251 30.3958 6.57251C31.9787 6.57251 34.2357 6.26494 35.4811 7.5C36.7364 8.74486 36.4274 11.0112 36.4274 12.6041C36.4274 14.6172 36.8677 15.5427 38.3013 16.9763C40.4338 19.1088 41.5 20.175 41.5 21.5C41.5 22.8249 40.4337 23.8912 38.3012 26.0237C36.8677 27.4572 36.4274 28.3829 36.4274 30.3958C36.4274 31.9888 36.7364 34.2551 35.481 35.5Z" fill="#22C55E" stroke="#16A34A" strokeWidth="1.5"/>
      <path d="M15.5 23.2857C15.5 23.2857 17.9 24.5893 19.1 26.5C19.1 26.5 22.7 19 27.5 16.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Studio() {
  const router = useRouter()
  const params = useParams()

  const [partituur, setPartituur] = useState<any>(null)
  const [leraarNaam, setLeraarNaam] = useState('')
  const [leraarDatum, setLeraarDatum] = useState('')
  const [leraarInstructies, setLeraarInstructies] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [stap, setStap] = useState<Stap>('pre-speel')
  const [bpm, setBpm] = useState(80)
  const [geselecteerdeEx, setGeselecteerdeEx] = useState<string[]>([])

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
  const streamRef = useRef<MediaStream | null>(null)

  const [annotaties, setAnnotaties] = useState<AnnotatieItem[]>([])
  const [nieuweAnnotatie, setNieuweAnnotatie] = useState('')
  const [antwoorden, setAntwoorden] = useState({ hoeGingHet: '', tops: '', tips: '' })
  const [aiFeedback, setAiFeedback] = useState<any>(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [niveau, setNiveau] = useState(3)
  const [challenges, setChallenges] = useState<string[]>([])
  const [challengesLaden, setChallengesLaden] = useState(true)

  const leraarAudioRef = useRef<HTMLAudioElement | null>(null)
  const [leraarTrackPos, setLeraarTrackPos] = useState(0)
  const [leraarTrackDuur, setLeraarTrackDuur] = useState(0)
  const [leraarTrackSpeelt, setLeraarTrackSpeelt] = useState(false)

  const [cameraActief, setCameraActief] = useState(false)
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)

  // Pre-speel
  const preAudioRef = useRef<HTMLAudioElement | null>(null)
  const [preSpeel_speelt, setPreSpeel_speelt] = useState(false)
  const [preSpeel_pos, setPreSpeel_pos] = useState(0)
  const [preSpeel_duur, setPreSpeel_duur] = useState(0)
  const [preSpeel_snelheid, setPreSpeel_snelheid] = useState(1)

  // Post-sessie state
  const [sessieStart, setSessieStart] = useState<Date | null>(null)
  const [badgeVisible, setBadgeVisible] = useState(false)
  const [analyseVisible, setAnalyseVisible] = useState(false)
  const [klasNaam, setKlasNaam] = useState('')
  const [academieNaam, setAcademieNaam] = useState('')
  const [streakDagen, setStreakDagen] = useState(0)
  const [gedeeldMetKlas, setGedeeldMetKlas] = useState(true)
  const [gevoelswoorden, setGevoelswoorden] = useState<string[]>([])
  const [gevoelIntensiteit, setGevoelIntensiteit] = useState(3)
  const [eigenGevoel, setEigenGevoel] = useState('')
  const opnamePlayerRef = useRef<HTMLAudioElement | null>(null)
  const [opnameSpeelt, setOpnameSpeelt] = useState(false)
  const [opnamePos, setOpnamePos] = useState(0)
  const [opnameDuur, setOpnameDuur] = useState(0)

  const golfBars = useMemo(() =>
    Array.from({ length: 38 }, (_, i) => 14 + Math.abs(Math.sin(i * 0.63) * 36 + Math.cos(i * 1.1) * 16)), []
  )

  useEffect(() => {
    return () => { cameraStreamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  useEffect(() => {
    if (cameraActief && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current
      cameraVideoRef.current.play().catch(() => {})
    }
  }, [cameraActief])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('geselecteerdeEx')
      if (raw) setGeselecteerdeEx(JSON.parse(raw))
    } catch {}
  }, [])

  // Badge animaties
  useEffect(() => {
    if (stap === 'voltooiing') {
      setBadgeVisible(false)
      const t = setTimeout(() => setBadgeVisible(true), 400)
      return () => clearTimeout(t)
    }
    if (stap === 'analyse') {
      setAnalyseVisible(false)
      const t = setTimeout(() => setAnalyseVisible(true), 400)
      return () => clearTimeout(t)
    }
  }, [stap])

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data } = await supabase.from('partituren').select('*').eq('id', params.id).single()
      if (data) {
        setPartituur(data)
        if (data.leraar_id) {
          const { data: leraar } = await supabase.from('profiles').select('naam').eq('id', data.leraar_id).single()
          setLeraarNaam(leraar?.naam || '')
        }
        if (data.created_at) {
          setLeraarDatum(new Date(data.created_at).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' }))
        }
        const { data: annotatieData } = await supabase
          .from('annotaties').select('inhoud')
          .eq('partituur_id', params.id).eq('type', 'leraar').order('created_at', { ascending: true })
        setLeraarInstructies(annotatieData?.map((a: any) => a.inhoud) || [])

        const { data: profiel } = await supabase.from('profiles').select('niveau, instrument, academie').eq('id', user.id).single()
        setNiveau(profiel?.niveau || 3)
        setAcademieNaam(profiel?.academie || '')

        // Klas ophalen
        const { data: klasData } = await supabase
          .from('klas_studenten')
          .select('klassen(naam)')
          .eq('student_id', user.id)
          .limit(1)
          .maybeSingle()
        if (klasData?.klassen) setKlasNaam((klasData.klassen as any).naam || '')

        // Streak berekenen
        const { data: streakSessies } = await supabase
          .from('oefensessies').select('created_at')
          .eq('student_id', user.id).order('created_at', { ascending: false }).limit(30)
        if (streakSessies) setStreakDagen(berekenStreak(streakSessies))

        const { data: recenteSessies } = await supabase
          .from('oefensessies').select('tops, tips, gevoel')
          .eq('student_id', user.id).order('created_at', { ascending: false }).limit(3)

        try {
          const res = await fetch('/api/genereer-challenges', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instrument: profiel?.instrument || 'onbekend', niveau: profiel?.niveau || 3, recenteSessies: recenteSessies || [], partituurTitel: data.titel, partituurComponist: data.componist })
          })
          const challengesData = await res.json()
          setChallenges(challengesData.map((c: any) => c.challenge))
        } catch {
          setChallenges(['Speel het stuk van begin tot einde zonder te stoppen.', 'Kies één moeilijk fragment en oefen het vijf keer langzaam.'])
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

  const tikMetronoom = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtxRef.current
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1)
    setBeat(true); setTimeout(() => setBeat(false), 100)
  }

  const stopMetronoom = () => { if (metronomRef.current) clearInterval(metronomRef.current); setMetronomActief(false) }

  const toggleMetronoom = () => {
    if (metronomActief) { stopMetronoom() } else {
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
      cameraStreamRef.current?.getTracks().forEach(t => t.stop())
      cameraStreamRef.current = null
      const stream = await navigator.mediaDevices.getUserMedia(videoOpname ? { audio: true, video: true } : { audio: true })
      audioStreamRef.current = stream; streamRef.current = stream
      if (videoOpname) {
        cameraStreamRef.current = stream
        if (cameraVideoRef.current) { cameraVideoRef.current.srcObject = stream; cameraVideoRef.current.play().catch(() => {}) }
      }
      let mimeType = videoOpname
        ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
        : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/mp4')
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || (videoOpname ? 'video/webm' : 'audio/webm') })
        setOpnameBlob(blob); setOpnameUrl(URL.createObjectURL(blob)); setIsVideoOpname(videoOpname)
        stream.getTracks().forEach(t => t.stop())
        audioStreamRef.current = null; streamRef.current = null; cameraStreamRef.current = null
        if (videoOpname) setCameraActief(false)
      }
      mediaRecorderRef.current = recorder; recorder.start(100)
      if (!sessieStart) setSessieStart(new Date())
      setOpnameActief(true); setGepauzeerd(false); setTimerActief(true)
    } catch { alert('Microfoon/camera toegang geweigerd.') }
  }

  const pauzeerOpname = () => {
    if (mediaRecorderRef.current?.state === 'recording') { mediaRecorderRef.current.pause(); setGepauzeerd(true); setTimerActief(false) }
  }
  const hervat = () => {
    if (mediaRecorderRef.current?.state === 'paused') { mediaRecorderRef.current.resume(); setGepauzeerd(false); setTimerActief(true) }
  }
  const stopOpname = () => { mediaRecorderRef.current?.stop(); setOpnameActief(false); setGepauzeerd(false); setTimerActief(false) }

  const rondeAf = () => {
    if (opnameActief) stopOpname()
    stopMetronoom(); setTimerActief(false)
    if (leraarAudioRef.current) { leraarAudioRef.current.pause(); leraarAudioRef.current.currentTime = 0 }
    setStap('voltooiing')
  }

  const voegAnnotatieToe = () => {
    if (!nieuweAnnotatie.trim() || !audioPlayerRef.current) return
    setAnnotaties(prev => [...prev, { tijdstip: Math.floor(audioPlayerRef.current!.currentTime), inhoud: nieuweAnnotatie }])
    setNieuweAnnotatie('')
  }

  const toggleGevoelwoord = (woord: string) => {
    setGevoelswoorden(prev => prev.includes(woord) ? prev.filter(w => w !== woord) : [...prev, woord])
  }

  const slaSessionOp = async () => {
    if (!userId || !partituur) return
    setLoadingFeedback(true)

    const alleGevoelens = [...gevoelswoorden, ...(eigenGevoel.trim() ? [eigenGevoel.trim()] : [])]
    const gevoelString = alleGevoelens.length > 0
      ? `${alleGevoelens.join(', ')} (intensiteit ${gevoelIntensiteit}/5)`
      : `Neutraal (intensiteit ${gevoelIntensiteit}/5)`

    let feedback = null
    try {
      const res = await fetch('/api/studio-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel: partituur.titel, componist: partituur.componist,
          duur: seconden, bpm,
          antwoorden: { tops: antwoorden.tops, tips: antwoorden.tips, gevoel: gevoelString },
          studentId: userId, huidigNiveau: niveau
        })
      })
      feedback = await res.json(); setAiFeedback(feedback)
    } catch { console.error('Feedback fout') }

    let opnameOpgeslagenUrl = null
    if (opnameBlob) {
      const ext = opnameBlob.type.includes('mp4') ? 'mp4' : 'webm'
      const naam = `opname_${Date.now()}_${userId}.${ext}`
      const { error } = await supabase.storage.from('opnames').upload(naam, opnameBlob, { contentType: opnameBlob.type })
      if (!error) { const { data: u } = supabase.storage.from('opnames').getPublicUrl(naam); opnameOpgeslagenUrl = u.publicUrl }
    }

    const { error: insertError } = await supabase.from('oefensessies').insert({
      student_id: userId, partituur_id: partituur.id, duur: seconden, bpm,
      tops: antwoorden.tops, tips: antwoorden.tips, gevoel: gevoelString,
      ai_feedback: JSON.stringify(feedback), challenges,
      opname_url: opnameOpgeslagenUrl, status: 'afgerond', notities: JSON.stringify(annotaties)
    })
    if (insertError) { alert(`Fout: ${insertError.message}`); setLoadingFeedback(false); return }
    if (annotaties.length > 0 && opnameOpgeslagenUrl) {
      await supabase.from('opname_annotaties').insert(
        annotaties.map(a => ({ opname_url: opnameOpgeslagenUrl, auteur_id: userId, partituur_id: partituur.id, tijdstip: a.tijdstip, inhoud: a.inhoud }))
      )
    }
    setLoadingFeedback(false); setStap('analyse')
  }

  if (loading) return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6', fontFamily: 'var(--font-apercu)' }}>Laden...</p>
    </main>
  )
  if (!partituur) return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#666' }}>Partituur niet gevonden</p>
    </main>
  )

  const startTijdStr = sessieStart
    ? sessieStart.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
    : '--:--'
  const datumStr = new Date().toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' })
  const klasLabel = [academieNaam, klasNaam].filter(Boolean).join(' – ') || 'Mijn klasgroep'

  // ── SESSIE ────────────────────────────────────────────────────────────────────
  if (stap === 'sessie') {
    return (
      <main style={{
        minHeight: '100dvh', backgroundColor: '#0D1B2A',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 20px)',
        maxWidth: 430, margin: '0 auto', width: '100%',
      }}>
        <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 18, textAlign: 'center', paddingTop: 16, paddingBottom: 8, flexShrink: 0 }}>
          Practice Studio
        </p>

        <div style={{ padding: '4px 18px 0', display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0 }}>
          {OEFENINGEN.map((o, i) => {
            const sel = geselecteerdeEx.length === 0 ? i === 0 : geselecteerdeEx.includes(o.id)
            const locked = !sel && i > 0 && geselecteerdeEx.length > 0
            const border = locked ? '#FFD100' : '#FF560D'
            return (
              <div key={o.id} style={{ border: `2px solid ${border}`, borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: `2px solid ${locked ? '#FFD100' : sel ? 'transparent' : 'rgba(255,255,255,0.3)'}`, backgroundColor: sel && !locked ? '#22C55E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {locked ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFD100" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  ) : sel ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 13, lineHeight: 1.25 }}>{o.label}</p>
                  <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 1 }}>{o.beschrijving}</p>
                </div>
                <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'rgba(255,255,255,0.55)', fontSize: 12, flexShrink: 0 }}>{o.duur} min</p>
              </div>
            )
          })}
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', margin: '14px 18px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 12px 0', flexShrink: 0 }}>
          <button onClick={toggleMetronoom} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="30" height="24" viewBox="0 0 30 24" fill="none">
              {[3, 7, 13, 9, 5, 11].map((h, idx) => (
                <rect key={idx} x={idx * 5} y={24 - h} width="4" height={h} rx="1.5" fill={metronomActief ? '#FF560D' : 'rgba(255,255,255,0.55)'} />
              ))}
            </svg>
            <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.65)', fontSize: 9 }}>Metronoom</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: metronomActief ? '#FF560D' : 'rgba(255,255,255,0.25)' }} />
              <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: metronomActief ? '#FF560D' : 'rgba(255,255,255,0.45)', fontSize: 9 }}>{bpm} BPM</p>
              <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: metronomActief ? '#FF560D' : 'rgba(255,255,255,0.25)' }} />
            </div>
          </button>
          <button onClick={() => setToonPartituur(v => !v)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={toonPartituur ? '#FF560D' : 'rgba(255,255,255,0.55)'} strokeWidth="1.8" strokeLinecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.65)', fontSize: 9 }}>Partituur</p>
          </button>
          <button onClick={() => setToonLeraarTrack(v => !v)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={toonLeraarTrack ? '#FF560D' : 'rgba(255,255,255,0.55)'} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>
            <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.65)', fontSize: 9 }}>Track</p>
            {leraarNaam && <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.35)', fontSize: 8, textAlign: 'center', maxWidth: 60, lineHeight: 1.2 }}>{leraarNaam.split(' ').slice(0,2).join(' ')} · {leraarDatum}</p>}
          </button>
          <button onClick={() => setToonOpmerkingen(v => !v)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={toonOpmerkingen ? '#FF560D' : 'rgba(255,255,255,0.55)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.65)', fontSize: 9 }}>Aanwijzingen</p>
          </button>
        </div>

        {metronomActief && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '10px 20px 0', flexShrink: 0 }}>
            <button onClick={() => setBpm(b => Math.max(40, b - 2))} style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>
            </button>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: '#FF560D', fontSize: 18, fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'center' }}>{bpm} BPM</p>
            <button onClick={() => setBpm(b => Math.min(240, b + 2))} style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 20px 8px' }}>
          <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 52, letterSpacing: 3, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 20 }}>
            {formatTijdLang(seconden)}
          </p>
          <div style={{ width: '100%', height: 68, backgroundColor: 'white', borderRadius: 34, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 2.5, overflow: 'hidden' }}>
            {golfBars.map((h, i) => {
              const progress = seconden > 0 ? seconden / 600 : 0
              const played = (i / golfBars.length) < progress
              return (
                <div key={i} style={{ flex: 1, height: `${Math.min(h, 54)}px`, borderRadius: 2, backgroundColor: played ? '#0766C6' : '#FF560D', opacity: seconden === 0 ? 0.2 : played ? 1 : 0.7 }} />
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 28, marginTop: 24, alignItems: 'center' }}>
            <button onClick={opnameActief ? (gepauzeerd ? hervat : pauzeerOpname) : startOpname} style={{ width: 70, height: 70, borderRadius: '50%', backgroundColor: '#FF560D', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!opnameActief ? (
                <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: 'white' }} />
              ) : opnameActief && !gepauzeerd ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M6 3.5l13 8.5-13 8.5V3.5z"/></svg>
              )}
            </button>
            <button onClick={opnameActief ? stopOpname : startOpname} style={{ width: 70, height: 70, borderRadius: '50%', backgroundColor: '#FF560D', border: '4px solid #0766C6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {opnameActief ? (
                <div style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: 'white' }} />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z"/></svg>
              )}
            </button>
          </div>
        </div>

        {toonPartituur && partituur.bestand_url && (
          <div style={{ padding: '0 18px 12px', flexShrink: 0 }}>
            <div style={{ borderRadius: 14, overflow: 'hidden', height: 280 }}>
              <iframe src={`${partituur.bestand_url}#toolbar=0`} style={{ width: '100%', height: '100%', border: 'none' }} title={partituur.titel} />
            </div>
          </div>
        )}
        {toonLeraarTrack && partituur.leraar_audio_url && (() => {
          const ltPct = leraarTrackDuur > 0 ? leraarTrackPos / leraarTrackDuur : 0
          return (
            <div style={{ padding: '0 18px 12px', flexShrink: 0 }}>
              <audio ref={leraarAudioRef} src={partituur.leraar_audio_url}
                onTimeUpdate={() => { if (leraarAudioRef.current) setLeraarTrackPos(leraarAudioRef.current.currentTime) }}
                onLoadedMetadata={() => { if (leraarAudioRef.current) setLeraarTrackDuur(leraarAudioRef.current.duration) }}
                onEnded={() => setLeraarTrackSpeelt(false)} />
              <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px', gap: 8 }}>
                  <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {leraarNaam || 'Leraar'}{leraarDatum ? ` – ${leraarDatum}` : ''}
                  </p>
                </div>
                <div style={{ backgroundColor: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 56 }}>
                  <button onClick={() => { if (!leraarAudioRef.current) return; if (leraarTrackSpeelt) { leraarAudioRef.current.pause(); setLeraarTrackSpeelt(false) } else { leraarAudioRef.current.play(); setLeraarTrackSpeelt(true) } }} style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: 'transparent', border: '2px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {leraarTrackSpeelt ? <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M6 3.5l13 8.5-13 8.5V3.5z"/></svg>}
                  </button>
                </div>
                <div style={{ padding: '8px 14px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.65)', fontSize: 10, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', minWidth: 28 }}>{formatTijd(Math.floor(leraarTrackPos))}</span>
                  <div style={{ flex: 1, position: 'relative', height: 16 }}>
                    <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 1 }}>
                      <div style={{ width: `${ltPct * 100}%`, height: '100%', backgroundColor: 'white', borderRadius: 1 }} />
                    </div>
                    <input type="range" min={0} max={leraarTrackDuur || 100} value={leraarTrackPos} step={0.1}
                      onChange={(e) => { const t = Number(e.target.value); setLeraarTrackPos(t); if (leraarAudioRef.current) leraarAudioRef.current.currentTime = t }}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', margin: 0 }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.65)', fontSize: 10, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>{formatTijd(Math.floor(leraarTrackDuur))}</span>
                </div>
              </div>
            </div>
          )
        })()}
        {toonOpmerkingen && leraarInstructies.length > 0 && (
          <div style={{ padding: '0 18px 12px', flexShrink: 0 }}>
            {leraarInstructies.slice(0, 2).map((inst, i) => (
              <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 12px', marginBottom: 6 }}>
                <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{inst}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '8px 18px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', flexShrink: 0 }}>
          <button onClick={rondeAf} style={{ width: '100%', height: 54, borderRadius: 27, backgroundColor: '#FF560D', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Eindigen
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </main>
    )
  }

  // ── VOLTOOIING ────────────────────────────────────────────────────────────────
  if (stap === 'voltooiing') {
    return (
      <main style={{
        minHeight: '100dvh', backgroundColor: '#0D1B2A',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 20px)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 430, margin: '0 auto', width: '100%',
      }}>
        <div style={{ padding: '20px 20px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <h1 style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 26, textAlign: 'center', marginBottom: 24 }}>
            Overzicht {startTijdStr} – {datumStr}
          </h1>

          {/* Oefening kaarten */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
            {OEFENINGEN.map((o) => {
              const gedaan = geselecteerdeEx.length === 0 || geselecteerdeEx.includes(o.id)
              return (
                <div key={o.id} style={{ border: `2px solid #FF560D`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, backgroundColor: gedaan ? '#22C55E' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {gedaan && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 14, lineHeight: 1.25 }}>{o.label}</p>
                    <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{o.beschrijving}</p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'rgba(255,255,255,0.55)', fontSize: 13, flexShrink: 0 }}>{o.duur} min</p>
                </div>
              )
            })}
          </div>

          {/* Badge animatie */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <div style={{
              transition: 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
              transform: badgeVisible ? 'scale(1)' : 'scale(0.2)',
              opacity: badgeVisible ? 1 : 0,
            }}>
              <GroenBadge size={140} />
            </div>
            <p style={{
              fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 28, textAlign: 'center',
              transition: 'opacity 0.5s ease 0.3s',
              opacity: badgeVisible ? 1 : 0,
            }}>
              Oefensessie Voltooid!
            </p>
          </div>
        </div>

        {/* Pijl knop */}
        <div style={{ padding: '0 20px' }}>
          <button onClick={() => setStap('activiteit')} style={{ width: '100%', height: 54, borderRadius: 27, backgroundColor: '#FF560D', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </main>
    )
  }

  // ── ACTIVITEIT OPSLAAN ────────────────────────────────────────────────────────
  if (stap === 'activiteit') {
    const opnamePct = opnameDuur > 0 ? opnamePos / opnameDuur : 0
    const autoSamenvatting = (() => {
      const ex = (geselecteerdeEx.length > 0 ? geselecteerdeEx : ['herhalen'])
        .map(id => OEFENINGEN.find(o => o.id === id)?.label).filter(Boolean)
      return `${ex.join(', ')} geoefend. Totale duur: ${formatTijdLang(seconden)} op ${bpm} BPM.`
    })()

    return (
      <main style={{
        minHeight: '100dvh', backgroundColor: '#0D1B2A',
        maxWidth: 430, margin: '0 auto', width: '100%',
        paddingTop: 'env(safe-area-inset-top, 20px)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '24px 20px 0' }}>
          <h1 style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 30, marginBottom: 20 }}>
            Activiteit opslaan
          </h1>

          {/* Hoofdkaart */}
          <div style={{ border: '2px solid #FF560D', borderRadius: 20, overflow: 'hidden', marginBottom: 20 }}>

            {/* Partituur info rij */}
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <GroenBadge size={40} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 13, lineHeight: 1.3 }}>
                  "{partituur.titel}" – {partituur.componist || 'Onbekend'}
                </p>
                <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                  {leraarNaam || 'Leraar'}{leraarDatum ? ` – ${leraarDatum}` : ''}
                </p>
              </div>
            </div>

            {/* Challenge pill */}
            {challenges.length > 0 && (
              <div style={{ padding: '0 16px 12px' }}>
                <div style={{ display: 'inline-block', backgroundColor: 'rgba(7,102,198,0.35)', border: '1px solid rgba(7,102,198,0.6)', borderRadius: 20, padding: '6px 14px' }}>
                  <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{challenges[0]}</p>
                </div>
              </div>
            )}

            {/* Auto beschrijving */}
            <div style={{ margin: '0 16px 14px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6 }}>{autoSamenvatting}</p>
            </div>

            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />

            {/* Challenges voltooid */}
            <div style={{ padding: '12px 16px' }}>
              <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 13, marginBottom: 10 }}>
                +{challenges.length} Challenges voltooid!
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {challenges.slice(0, 3).map((_, i) => (
                  <Image key={i} src="/icons/Medaille.svg" alt="medaille" width={30} height={26} />
                ))}
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '14px 16px' }}>
              {[
                { label: 'Starttijd', waarde: startTijdStr },
                { label: 'Totale Tijd', waarde: formatTijdLang(seconden) },
                { label: 'Streak', waarde: `${streakDagen + 1}`, icon: '🔥' },
              ].map(({ label, waarde, icon }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 3 }}>{label}</p>
                  <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                    {waarde}{icon ? ` ${icon}` : ''}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 16px' }} />

            {/* Audio player */}
            <div style={{ padding: '14px 16px 16px' }}>
              {opnameUrl ? (
                <>
                  <audio
                    ref={opnamePlayerRef}
                    src={opnameUrl}
                    onTimeUpdate={() => { if (opnamePlayerRef.current) setOpnamePos(opnamePlayerRef.current.currentTime) }}
                    onLoadedMetadata={() => { if (opnamePlayerRef.current) setOpnameDuur(opnamePlayerRef.current.duration) }}
                    onEnded={() => setOpnameSpeelt(false)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Tijdstempel links */}
                    <span style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.55)', fontSize: 10, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTijdLang(Math.floor(opnamePos))}
                    </span>

                    {/* Waveform player */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <div style={{ height: 52, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 26, display: 'flex', alignItems: 'center', padding: '0 52px 0 14px', gap: 2, overflow: 'hidden' }}>
                        {golfBars.map((h, i) => {
                          const played = (i / golfBars.length) < opnamePct
                          return (
                            <div key={i} style={{ flex: 1, height: `${Math.min(h * 0.65, 36)}px`, borderRadius: 1.5, backgroundColor: played ? '#0766C6' : 'rgba(255,255,255,0.4)' }} />
                          )
                        })}
                      </div>
                      {/* Play knop overlappend rechts */}
                      <button
                        onClick={() => {
                          if (!opnamePlayerRef.current) return
                          if (opnameSpeelt) { opnamePlayerRef.current.pause(); setOpnameSpeelt(false) }
                          else { opnamePlayerRef.current.play(); setOpnameSpeelt(true) }
                        }}
                        style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: '50%', backgroundColor: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {opnameSpeelt
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="#0D1B2A"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="#0D1B2A"><path d="M6 3.5l13 8.5-13 8.5V3.5z"/></svg>}
                      </button>
                    </div>

                    {/* Tijdstempel rechts */}
                    <span style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.55)', fontSize: 10, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTijdLang(Math.floor(opnameDuur))}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ height: 52, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Geen opname</p>
                </div>
              )}
            </div>
          </div>

          {/* Klasgroep */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 16, marginBottom: 10 }}>Mijn klasgroep</p>
            <div style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <p style={{ fontFamily: 'var(--font-apercu)', color: 'white', fontSize: 15 }}>{klasLabel}</p>
            </div>
          </div>

          {/* Pijl */}
          <button onClick={() => setStap('reflectie')} style={{ width: '100%', height: 54, borderRadius: 27, backgroundColor: '#FF560D', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </main>
    )
  }

  // ── REFLECTIE ────────────────────────────────────────────────────────────────
  if (stap === 'reflectie') {
    const kanOpslaan = antwoorden.tops.trim().length > 0 || gevoelswoorden.length > 0
    return (
      <main style={{
        minHeight: '100dvh', backgroundColor: '#0D1B2A',
        maxWidth: 430, margin: '0 auto', width: '100%',
        paddingTop: 'env(safe-area-inset-top, 20px)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
      }}>
        <style>{`
          .gevoel-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 2px; outline: none; cursor: pointer; }
          .gevoel-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #FF560D; cursor: pointer; border: 3px solid white; box-shadow: 0 0 0 2px rgba(255,86,13,0.4); }
          .gevoel-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: #FF560D; cursor: pointer; border: 3px solid white; }
        `}</style>

        <div style={{ padding: '24px 20px 0' }}>
          <h1 style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 26, lineHeight: 1.2, marginBottom: 24 }}>
            Reflecteer over je oefenmoment
          </h1>

          {/* Vraag 1 */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 15, marginBottom: 8 }}>
              Hoe ging het oefenen vandaag?
            </p>
            <textarea
              placeholder="Over het algemeen best een goed, overgangen nog steeds..."
              value={antwoorden.hoeGingHet}
              onChange={(e) => setAntwoorden(a => ({ ...a, hoeGingHet: e.target.value }))}
              rows={2}
              style={{ width: '100%', backgroundColor: 'transparent', border: '1.5px solid rgba(7,102,198,0.6)', borderRadius: 14, padding: '12px 16px', fontFamily: 'var(--font-apercu)', fontSize: 14, color: 'white', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Vraag 2 */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 15, marginBottom: 8 }}>
              Wat ging er goed?
            </p>
            <textarea
              placeholder="Akkoorden A, C en D klonken goed vandaag!"
              value={antwoorden.tops}
              onChange={(e) => setAntwoorden(a => ({ ...a, tops: e.target.value }))}
              rows={2}
              style={{ width: '100%', backgroundColor: 'transparent', border: '1.5px solid rgba(7,102,198,0.6)', borderRadius: 14, padding: '12px 16px', fontFamily: 'var(--font-apercu)', fontSize: 14, color: 'white', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Vraag 3 */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 15, marginBottom: 8 }}>
              Wat vond je moeilijk?
            </p>
            <textarea
              placeholder="Nog steeds de overgangen, veel fouten..."
              value={antwoorden.tips}
              onChange={(e) => setAntwoorden(a => ({ ...a, tips: e.target.value }))}
              rows={2}
              style={{ width: '100%', backgroundColor: 'transparent', border: '1.5px solid rgba(7,102,198,0.6)', borderRadius: 14, padding: '12px 16px', fontFamily: 'var(--font-apercu)', fontSize: 14, color: 'white', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Gevoelssectie */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 15, marginBottom: 4 }}>
              Algemeen gevoel speelervaring?
            </p>

            <div style={{ border: '1.5px solid rgba(7,102,198,0.6)', borderRadius: 16, padding: '14px 14px 16px', backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12 }}>
                Duid aan wat van toepassing is.
              </p>

              {/* Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {GEVOELSWOORDEN.map(woord => {
                  const sel = gevoelswoorden.includes(woord)
                  return (
                    <button
                      key={woord}
                      onClick={() => toggleGevoelwoord(woord)}
                      style={{
                        padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${sel ? '#0766C6' : 'rgba(255,255,255,0.2)'}`,
                        backgroundColor: sel ? '#0766C6' : 'transparent',
                        color: 'white', fontFamily: 'var(--font-apercu)', fontSize: 13,
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                    >
                      {woord}
                    </button>
                  )
                })}
              </div>

              {/* Eigen gevoel invullen */}
              <div style={{ position: 'relative', marginBottom: 18 }}>
                <input
                  type="text"
                  placeholder="Of schrijf zelf een gevoel..."
                  value={eigenGevoel}
                  onChange={(e) => setEigenGevoel(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    backgroundColor: 'transparent',
                    border: '1.5px solid rgba(255,255,255,0.18)',
                    borderRadius: 12, padding: '10px 14px',
                    fontFamily: 'var(--font-apercu)', fontSize: 14,
                    color: 'white', outline: 'none',
                  }}
                />
              </div>

              {/* Gevoelscore label + slider */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Gevoelscore</p>
                  <span style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: '#FF560D', fontSize: 15 }}>{gevoelIntensiteit} / 5</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, transform: 'translateY(-50%)', borderRadius: 2, background: `linear-gradient(to right, #FF560D ${gevoelIntensiteit * 20}%, rgba(255,255,255,0.2) ${gevoelIntensiteit * 20}%)` }} />
                  <input
                    type="range" min={0} max={5} step={1}
                    value={gevoelIntensiteit}
                    onChange={(e) => setGevoelIntensiteit(Number(e.target.value))}
                    className="gevoel-slider"
                    style={{ position: 'relative', zIndex: 1, background: 'transparent' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>0</span>
                  <span style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>5</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delen toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>Delen met klasgroep?</p>
            <button
              onClick={() => setGedeeldMetKlas(v => !v)}
              style={{
                width: 54, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                backgroundColor: gedeeldMetKlas ? '#0766C6' : 'rgba(255,255,255,0.15)',
                position: 'relative', padding: 0, transition: 'background-color 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, width: 22, height: 22, borderRadius: '50%', backgroundColor: 'white',
                left: gedeeldMetKlas ? 29 : 3, transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* Deel knop */}
          <button
            onClick={slaSessionOp}
            disabled={loadingFeedback}
            style={{
              width: '100%', height: 58, borderRadius: 29, border: 'none', cursor: loadingFeedback ? 'default' : 'pointer',
              backgroundColor: loadingFeedback ? 'rgba(255,86,13,0.5)' : '#FF560D',
              fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 17,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              marginBottom: 8,
            }}
          >
            {loadingFeedback ? 'Bezig...' : 'Deel mijn sessie'}
            {!loadingFeedback && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            )}
          </button>
        </div>
      </main>
    )
  }

  // ── ANALYSE — voltooiing animatie + navigatie ─────────────────────────────────
  if (stap === 'analyse') {
    return (
      <main style={{
        minHeight: '100dvh', backgroundColor: '#0D1B2A',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 20px)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 430, margin: '0 auto', width: '100%',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px 32px', gap: 20 }}>

          {/* Badge */}
          <div style={{
            transition: 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
            transform: analyseVisible ? 'scale(1)' : 'scale(0.2)',
            opacity: analyseVisible ? 1 : 0,
          }}>
            <GroenBadge size={140} />
          </div>

          {/* Tekst */}
          <div style={{
            textAlign: 'center',
            transition: 'opacity 0.5s ease 0.3s',
            opacity: analyseVisible ? 1 : 0,
          }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 28, lineHeight: 1.2, marginBottom: 8 }}>
              Reflectie en delen<br />voltooid!
            </p>
            <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              Goed bezig — tot de volgende keer!
            </p>
          </div>
        </div>

        {/* Navigatieknoppen */}
        <div style={{
          padding: '0 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
          transition: 'opacity 0.5s ease 0.5s',
          opacity: analyseVisible ? 1 : 0,
        }}>
          {/* Home */}
          <button
            onClick={() => router.push('/dashboard')}
            style={{ width: '100%', height: 56, borderRadius: 28, backgroundColor: '#FF560D', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 16 }}>Home</span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Practice Studio */}
            <button
              onClick={() => router.push(`/partituren/${partituur.id}`)}
              style={{ height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="white" stroke="none"/></svg>
              <span style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 14 }}>Opnieuw</span>
            </button>

            {/* Klasgroep */}
            <button
              onClick={() => router.push('/sessies')}
              style={{ height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 14 }}>Klasgroep</span>
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── WARM WIT — pre-speel, toggles ─────────────────────────────────────────────
  return (
    <main style={{ backgroundColor: '#F3E7DD', minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '28px 20px 40px' }}>

        {/* PRE-SPEEL */}
        {stap === 'pre-speel' && (() => {
          const tijdPct = preSpeel_duur > 0 ? preSpeel_pos / preSpeel_duur : 0
          const speedPct = (preSpeel_snelheid - 0.25) / 0.75

          const VinylDisc = ({ kleur, size }: { kleur: string; size: number }) => {
            const r = size / 2; const mid = r * 0.58; const cen = r * 0.28
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
                <circle cx={r} cy={r} r={r} fill={kleur} />
                <circle cx={r} cy={r} r={mid} fill="#0D1B2A" />
                <circle cx={r} cy={r} r={cen} fill={kleur} />
              </svg>
            )
          }

          const NavyDisc = ({ size }: { size: number }) => {
            const r = size / 2; const mid = r * 0.62; const cen = r * 0.28
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
                <circle cx={r} cy={r} r={r} fill="#0D1B2A" />
                <circle cx={r} cy={r} r={mid} fill="rgba(255,255,255,0.18)" />
                <circle cx={r} cy={r} r={cen} fill="#0D1B2A" />
              </svg>
            )
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0D1B2A" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <Image src="/images/doremio-logo2.png" alt="Doremio" width={52} height={38} />
              </div>
              <h1 style={{ fontFamily: 'var(--font-kiro)', color: '#0D1B2A', fontSize: 32, fontWeight: 700, lineHeight: 1.1, marginBottom: 24 }}>Opname bekijken</h1>
              <div style={{ backgroundColor: '#0766C6', borderRadius: 20, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px 12px', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 14, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{partituur.titel}" – {partituur.componist || 'Onbekend'}
                    </p>
                    <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
                      {leraarNaam || 'Leraar'}{leraarDatum ? ` – ${leraarDatum}` : ''}
                    </p>
                  </div>
                  <svg width="22" height="18" viewBox="0 0 22 18" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <line x1="0" y1="3" x2="22" y2="3" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="0" y1="9" x2="22" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="0" y1="15" x2="22" y2="15" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="5" y1="0" x2="5" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="13" y1="6" x2="13" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    <line x1="18" y1="12" x2="18" y2="18" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ backgroundColor: '#0D1B2A', height: 186, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <audio ref={preAudioRef} src={partituur.leraar_audio_url || undefined}
                    onTimeUpdate={() => { if (preAudioRef.current) setPreSpeel_pos(preAudioRef.current.currentTime) }}
                    onLoadedMetadata={() => { if (preAudioRef.current) setPreSpeel_duur(preAudioRef.current.duration) }}
                    onEnded={() => setPreSpeel_speelt(false)} />
                  <button
                    onClick={() => { if (!preAudioRef.current) return; if (preSpeel_speelt) { preAudioRef.current.pause(); setPreSpeel_speelt(false) } else { preAudioRef.current.play(); setPreSpeel_speelt(true) } }}
                    style={{ width: 66, height: 66, borderRadius: '50%', backgroundColor: 'transparent', border: '2.5px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {preSpeel_speelt
                      ? <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>
                      : <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M6 3.5l13 8.5-13 8.5V3.5z"/></svg>}
                  </button>
                </div>
                <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-apercu)', color: 'white', fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>{formatTijd(Math.floor(preSpeel_pos))}</span>
                    <div style={{ flex: 1, position: 'relative', height: 26 }}>
                      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 1 }}>
                        <div style={{ width: `${tijdPct * 100}%`, height: '100%', backgroundColor: 'white', borderRadius: 1 }} />
                      </div>
                      <div style={{ position: 'absolute', top: '50%', left: `${tijdPct * 100}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}><NavyDisc size={18} /></div>
                      <input type="range" min={0} max={preSpeel_duur || 100} value={preSpeel_pos} step={0.1}
                        onChange={(e) => { const t = Number(e.target.value); setPreSpeel_pos(t); if (preAudioRef.current) preAudioRef.current.currentTime = t }}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', margin: 0 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-apercu)', color: 'white', fontSize: 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{formatTijd(Math.floor(preSpeel_duur))}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    <div style={{ flex: 1, position: 'relative', height: 14 }}>
                      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1 }} />
                      {([{ r: 0.12, k: '#FFD100' }, { r: 0.50, k: '#FF560D' }, { r: 0.86, k: '#FFD100' }]).map(({ r, k }, i) => (
                        <div key={i} style={{ position: 'absolute', top: '50%', left: `${r * 100}%`, transform: 'translate(-50%, -50%)' }}>
                          <VinylDisc kleur={k} size={14} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, paddingTop: 2, flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ position: 'relative', height: 22, marginBottom: 4 }}>
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1 }} />
                        <div style={{ position: 'absolute', top: '50%', left: `${speedPct * 100}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}><VinylDisc kleur="#FF560D" size={16} /></div>
                        <input type="range" min={0.25} max={1} step={0.25} value={preSpeel_snelheid}
                          onChange={(e) => { const s = Number(e.target.value); setPreSpeel_snelheid(s); if (preAudioRef.current) preAudioRef.current.playbackRate = s }}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', margin: 0 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        {['x0.25', 'x0.5', 'x0.75'].map(l => (
                          <span key={l} style={{ fontFamily: 'var(--font-apercu)', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{l}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setStap('toggles')} style={{ position: 'fixed', bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))', right: 20, width: 160, height: 52, borderRadius: 26, backgroundColor: '#FF560D', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          )
        })()}

        {/* TOGGLES */}
        {stap === 'toggles' && (() => {
          const rijen = [
            { label: 'Metronoom', sub: `${bpm} Bpm`, value: toonMetronoom, set: setToonMetronoom, kleur: '#FF560D', icon: (<svg width="28" height="28" viewBox="0 0 37 37" fill="none"><path d="M6.78784 13.5757V22.6261" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M12.4445 4.52527V31.6766" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M18.101 9.05042V27.1513" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M23.7574 13.5757V22.6261" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M29.4141 11.3131V24.8888" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>) },
            { label: 'Partituur weergeven', sub: partituur.titel ? `"${partituur.titel}".PDF` : 'Partituur', value: toonPartituur, set: setToonPartituur, kleur: '#FFD100', icon: (<svg width="28" height="28" viewBox="0 0 43 41" fill="none"><path d="M1.5 1.5L37.5 1.5" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M1.5 15.5L27.5 15.5" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M1.5 29.5L15.5 29.5" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M34 33.5C34 36.8137 31.2018 39.5 27.75 39.5C24.2982 39.5 21.5 36.8137 21.5 33.5C21.5 30.1863 24.2982 27.5 27.75 27.5C31.2018 27.5 34 30.1863 34 33.5ZM34 33.5V15.5C34.8333 16.7 35.5 21.74 41.5 22.7" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>) },
            { label: 'Track Begeleiding', sub: leraarNaam ? `Opname ${leraarNaam.split(' ').slice(0,2).join(' ')} – ${leraarDatum}` : 'Referentie-opname', value: toonLeraarTrack, set: setToonLeraarTrack, kleur: '#0766C6', icon: (<svg width="30" height="30" viewBox="0 0 49 49" fill="none"><path d="M1.5 24.5C1.5 13.6577 1.5 8.23654 4.86827 4.86827C8.23654 1.5 13.6577 1.5 24.5 1.5C35.3423 1.5 40.7635 1.5 44.1317 4.86827C47.5 8.23654 47.5 13.6577 47.5 24.5C47.5 35.3423 47.5 40.7635 44.1317 44.1317C40.7635 47.5 35.3423 47.5 24.5 47.5C13.6577 47.5 8.23654 47.5 4.86827 44.1317C1.5 40.7635 1.5 35.3423 1.5 24.5Z" stroke="white" strokeWidth="3"/><path d="M24.5 14.8157V34.1841" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M17.2368 19.658V29.3422" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M9.97369 22.0789V26.921" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M31.7632 19.658V29.3422" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M39.0263 22.0789V26.921" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>) },
            { label: 'Aanwijzingen weergeven', sub: leraarNaam ? `${leraarNaam.split(' ').slice(0,2).join(' ')} – ${leraarDatum}` : 'Instructies leraar', value: toonOpmerkingen, set: setToonOpmerkingen, kleur: '#FF560D', icon: (<svg width="28" height="28" viewBox="0 0 37 37" fill="none"><path d="M11.9898 28.3859C14.5104 29.8448 17.4754 30.3372 20.3322 29.7712C23.1889 29.2053 25.7424 27.6198 27.5165 25.3101C29.2906 23.0005 30.1642 20.1245 29.9745 17.2183C29.7848 14.3121 28.5447 11.5741 26.4854 9.51473C24.4261 7.45536 21.6882 6.21521 18.7822 6.0255C15.8761 5.83579 13.0002 6.70946 10.6907 8.48363C8.38119 10.2578 6.79569 12.8114 6.22979 15.6682C5.6639 18.5251 6.15625 21.4903 7.61504 24.0109L6.05136 28.6797C5.9926 28.8559 5.98408 29.045 6.02673 29.2257C6.06939 29.4065 6.16155 29.5718 6.29288 29.7032C6.42421 29.8345 6.58952 29.9267 6.77028 29.9693C6.95104 30.012 7.14011 30.0034 7.3163 29.9447L11.9898 28.3859Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>) },
          ]
          return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <button onClick={() => setStap('pre-speel')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0D1B2A" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <Image src="/images/doremio-logo2.png" alt="Doremio" width={52} height={38} />
              </div>
              <h1 style={{ fontFamily: 'var(--font-kiro)', color: '#0D1B2A', fontSize: 34, fontWeight: 700, lineHeight: 1.15, marginBottom: 24 }}>Ready to play?</h1>
              <div style={{ backgroundColor: '#0766C6', borderRadius: 24, padding: '6px 20px 20px' }}>
                {rijen.map((rij, i) => (
                  <div key={rij.label}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 18, paddingBottom: i < rijen.length - 1 ? 18 : 20 }}>
                      <div style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{rij.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 15, lineHeight: 1.3 }}>{rij.label}</p>
                        <p style={{ fontFamily: 'var(--font-apercu)', color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rij.sub}</p>
                      </div>
                      <button onClick={() => rij.set(!rij.value)} style={{ flexShrink: 0, width: 54, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', backgroundColor: rij.value ? 'rgba(255,255,255,0.18)' : '#0D1B2A', position: 'relative', padding: 0, transition: 'background-color 0.2s' }}>
                        <svg style={{ position: 'absolute', top: 3, left: rij.value ? 27 : 3, transition: 'left 0.2s' }} width="22" height="22" viewBox="0 0 22 22">
                          <circle cx="11" cy="11" r="11" fill={rij.kleur} />
                          <circle cx="11" cy="11" r="7" fill="#0D1B2A" />
                          <circle cx="11" cy="11" r="3" fill={rij.kleur} />
                        </svg>
                      </button>
                    </div>
                    {i < rijen.length - 1 && <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />}
                  </div>
                ))}
                <button onClick={() => {}} style={{ width: '100%', height: 44, borderRadius: 999, backgroundColor: '#0D1B2A', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-apercu)', fontWeight: 700, color: 'white', fontSize: 15, marginTop: 20 }}>Opslaan</button>
              </div>
              <button onClick={() => setStap('sessie')} style={{ position: 'fixed', bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))', right: 20, width: 160, height: 52, borderRadius: 26, backgroundColor: '#FF560D', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          )
        })()}


      </div>
    </main>
  )
}
