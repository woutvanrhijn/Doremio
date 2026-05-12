'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function PartituurDetail() {
  const [partituur, setPartituur] = useState<any>(null)
  const [uploader, setUploader] = useState<string>('')
  const [referenties, setReferenties] = useState<any[]>([])
  const [annotaties, setAnnotaties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingReferenties, setLoadingReferenties] = useState(false)
  const [nieuweAnnotatie, setNieuweAnnotatie] = useState('')
  const [rol, setRol] = useState('')
  const [userId, setUserId] = useState('')
  const [pdfOpen, setPdfOpen] = useState(true)
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profiel } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setRol(profiel?.role || '')

      const { data } = await supabase
        .from('partituren')
        .select('*')
        .eq('id', params.id)
        .single()

      if (data) {
        setPartituur(data)
        if (data.referentie_url) {
          try { setReferenties(JSON.parse(data.referentie_url)) } catch (e) {}
        }

        // Uploadernaam ophalen
        if (data.leraar_id) {
          const { data: leraar } = await supabase
            .from('profiles')
            .select('naam')
            .eq('id', data.leraar_id)
            .single()
          setUploader(leraar?.naam || '')
        }
      }

      // Annotaties ophalen
      const { data: annotatieData } = await supabase
        .from('annotaties')
        .select('*, profiles(naam, role)')
        .eq('partituur_id', params.id)
        .order('created_at', { ascending: true })
      setAnnotaties(annotatieData || [])

      setLoading(false)
    }
    haalOp()
  }, [params.id, router])

  const zoekReferenties = async () => {
    if (!partituur) return
    setLoadingReferenties(true)
    try {
      const response = await fetch('/api/zoek-referenties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel: partituur.titel, componist: partituur.componist })
      })
      const data = await response.json()
      const links = data.links || []
      setReferenties(links)
      await supabase
        .from('partituren')
        .update({ referentie_url: JSON.stringify(links) })
        .eq('id', partituur.id)
    } catch (e) {
      console.error('Fout bij zoeken:', e)
    }
    setLoadingReferenties(false)
  }

  const slaAnnotatieOp = async () => {
    if (!nieuweAnnotatie.trim()) return
    const { data, error } = await supabase.from('annotaties').insert({
      partituur_id: partituur.id,
      auteur_id: userId,
      inhoud: nieuweAnnotatie,
      type: rol === 'leraar' ? 'leraar' : 'student'
    }).select('*, profiles(naam, role)').single()

    if (error) { console.error('Fout:', error.message); return }
    setAnnotaties(prev => [...prev, data])
    setNieuweAnnotatie('')
  }

  const uitvoeringen = referenties.filter(r => r.categorie === 'uitvoering')
  const shorts = referenties.filter(r => r.categorie === 'short')
  const leraarAnnotaties = annotaties.filter(a => a.type === 'leraar')
  const studentAnnotaties = annotaties.filter(a => a.type === 'student')

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  if (!partituur) return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#666' }}>Partituur niet gevonden</p>
    </main>
  )

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-lg mx-auto">

        <button onClick={() => router.back()}
          className="mb-6 text-sm flex items-center gap-2"
          style={{ color: '#0766C6' }}>
          ← Terug
        </button>

        {/* Hero kaart */}
        <div className="rounded-2xl overflow-hidden mb-4 shadow-sm"
          style={{ backgroundColor: '#fff' }}>
          {/* Gekleurde header balk */}
          <div className="px-6 pt-6 pb-4"
            style={{ borderBottom: '1px solid #F3E7DD' }}>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: '#0766C6' }}>
              {partituur.titel}
            </h1>
            {partituur.componist && (
              <p className="text-base mt-1" style={{ color: '#555' }}>
                {partituur.componist}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {uploader && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
                  ✦ {uploader}
                </span>
              )}
              <span className="text-xs" style={{ color: '#bbb' }}>
                {new Date(partituur.created_at).toLocaleDateString('nl-BE', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </span>
            </div>
          </div>

          {/* PDF inline viewer */}
          {partituur.bestand_url && (
            <div>
              <button
                onClick={() => setPdfOpen(!pdfOpen)}
                className="w-full px-6 py-3 flex items-center justify-between text-sm font-medium transition-colors"
                style={{
                  backgroundColor: pdfOpen ? '#F3E7DD' : '#fff',
                  color: '#0766C6',
                  borderBottom: pdfOpen ? 'none' : '1px solid #F3E7DD'
                }}>
                <span>{pdfOpen ? '▾ Partituur verbergen' : '▸ Partituur bekijken'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#F3E7DD', color: '#888' }}>PDF</span>
              </button>
              {pdfOpen && (
                <div style={{ height: '480px', backgroundColor: '#f5f5f5' }}>
                  <iframe
                    src={`${partituur.bestand_url}#toolbar=0`}
                    className="w-full h-full"
                    title={partituur.titel}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Oefensessie starten */}
        <button
          onClick={() => router.push(`/studio/${partituur.id}`)}
          className="w-full py-4 rounded-2xl text-white font-semibold text-lg mb-4 transition-transform hover:scale-[1.02] shadow-sm"
          style={{ backgroundColor: '#FF560D' }}>
          🎵 Oefensessie starten
        </button>

        {/* Leraar instructies */}
        {leraarAnnotaties.length > 0 && (
          <div className="rounded-2xl p-6 mb-4 shadow-sm" style={{ backgroundColor: '#fff' }}>
            <h2 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#333' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                style={{ backgroundColor: '#0766C6' }}>✦</span>
              Instructies van de leraar
            </h2>
            <div className="flex flex-col gap-3">
              {leraarAnnotaties.map((a: any, i: number) => (
                <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                  <p className="text-sm leading-relaxed" style={{ color: '#333' }}>
                    {a.inhoud}
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#aaa' }}>
                    {a.profiles?.naam} · {new Date(a.created_at).toLocaleDateString('nl-BE', {
                      day: 'numeric', month: 'short'
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student notities */}
        {studentAnnotaties.length > 0 && (
          <div className="rounded-2xl p-6 mb-4 shadow-sm" style={{ backgroundColor: '#fff' }}>
            <h2 className="font-semibold mb-3" style={{ color: '#333' }}>
              Mijn notities
            </h2>
            <div className="flex flex-col gap-3">
              {studentAnnotaties.map((a: any, i: number) => (
                <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: '#F3E7DD' }}>
                  <p className="text-sm leading-relaxed" style={{ color: '#333' }}>
                    {a.inhoud}
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#aaa' }}>
                    {new Date(a.created_at).toLocaleDateString('nl-BE', {
                      day: 'numeric', month: 'short'
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Annotatie toevoegen */}
        <div className="rounded-2xl p-6 mb-4 shadow-sm" style={{ backgroundColor: '#fff' }}>
          <h2 className="font-semibold mb-3" style={{ color: '#333' }}>
            {rol === 'leraar' ? '+ Instructie toevoegen' : '+ Notitie toevoegen'}
          </h2>
          <textarea
            placeholder={rol === 'leraar'
              ? 'Voeg instructies toe voor de student...'
              : 'Voeg eigen notities toe...'}
            value={nieuweAnnotatie}
            onChange={(e) => setNieuweAnnotatie(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm resize-none mb-3 outline-none"
            style={{ backgroundColor: '#F3E7DD', color: '#333' }}
          />
          <button onClick={slaAnnotatieOp} disabled={!nieuweAnnotatie.trim()}
            className="px-5 py-2 rounded-xl text-white text-sm font-semibold transition-transform hover:scale-105"
            style={{ backgroundColor: !nieuweAnnotatie.trim() ? '#ccc' : '#0766C6' }}>
            Opslaan
          </button>
        </div>

        {/* Uitvoeringen */}
        <div className="rounded-2xl p-6 mb-4 shadow-sm" style={{ backgroundColor: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold" style={{ color: '#333' }}>🎼 Uitvoeringen</h2>
              <p className="text-xs mt-0.5" style={{ color: '#888' }}>2–12 minuten</p>
            </div>
            <button onClick={zoekReferenties} disabled={loadingReferenties}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-transform hover:scale-105"
              style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
              {loadingReferenties ? 'Zoeken...' : '↻ Vernieuwen'}
            </button>
          </div>
          {uitvoeringen.length === 0 ? (
            <p className="text-sm" style={{ color: '#aaa' }}>
              Klik op vernieuwen om uitvoeringen te zoeken.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {uitvoeringen.map((ref: any, i: number) => (
                <ReferentieKaart key={i} ref_={ref} />
              ))}
            </div>
          )}
        </div>

        {/* Shorts */}
        {shorts.length > 0 && (
          <div className="rounded-2xl p-6 mb-4 shadow-sm" style={{ backgroundColor: '#fff' }}>
            <div className="mb-4">
              <h2 className="font-semibold" style={{ color: '#333' }}>⚡ Shorts</h2>
              <p className="text-xs mt-0.5" style={{ color: '#888' }}>Max 60 seconden</p>
            </div>
            <div className="flex flex-col gap-2">
              {shorts.map((ref: any, i: number) => (
                <ReferentieKaart key={i} ref_={ref} />
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}

function ReferentieKaart({ ref_ }: { ref_: any }) {
  return (
    <a href={ref_.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-xl transition-transform hover:scale-[1.02]"
      style={{ backgroundColor: '#F3E7DD' }}>
      {ref_.thumbnail && (
        <img src={ref_.thumbnail} alt={ref_.titel}
          className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#333' }}>{ref_.titel}</p>
        <p className="text-xs mt-0.5" style={{ color: '#888' }}>{ref_.kanaal}</p>
      </div>
      <span className="ml-auto text-lg flex-shrink-0">↗</span>
    </a>
  )
}