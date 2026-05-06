'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function PartituurDetail() {
  const [partituur, setPartituur] = useState<any>(null)
  const [referenties, setReferenties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingReferenties, setLoadingReferenties] = useState(false)
  const [annotatie, setAnnotatie] = useState('')
  const [rol, setRol] = useState('')
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

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
          try {
            setReferenties(JSON.parse(data.referentie_url))
          } catch (e) {}
        }
      }
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
        body: JSON.stringify({
          titel: partituur.titel,
          componist: partituur.componist
        })
      })
      const data = await response.json()
      setReferenties(data.links)
      await supabase
        .from('partituren')
        .update({ referentie_url: JSON.stringify(data.links) })
        .eq('id', partituur.id)
    } catch (e) {
      console.error(e)
    }
    setLoadingReferenties(false)
  }

  const slaAnnotatieOp = async () => {
    if (!annotatie.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('annotaties').insert({
      partituur_id: partituur.id,
      auteur_id: user.id,
      inhoud: annotatie,
      type: rol === 'leraar' ? 'leraar' : 'student'
    })

    if (error) {
      console.error('Fout:', error.message)
      return
    }

    setAnnotatie('')
  }

  const startOefensessie = () => {
    router.push(`/studio/${partituur.id}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F3E7DD' }}>
        <p style={{ color: '#0766C6' }}>Laden...</p>
      </main>
    )
  }

  if (!partituur) {
    return (
      <main className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#F3E7DD' }}>
        <p style={{ color: '#666' }}>Partituur niet gevonden</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-6 py-10"
      style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-lg mx-auto">

        <button
          onClick={() => router.back()}
          className="mb-6 text-sm flex items-center gap-2"
          style={{ color: '#0766C6' }}>
          ← Terug
        </button>

        <div className="rounded-2xl p-6 mb-4"
          style={{ backgroundColor: '#fff' }}>
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#0766C6' }}>
            {partituur.titel}
          </h1>
          {partituur.componist && (
            <p className="text-sm mb-4" style={{ color: '#888' }}>
              {partituur.componist}
            </p>
          )}
          {partituur.bestand_url && (
            <a
              href={partituur.bestand_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
              Partituur bekijken
            </a>
          )}
        </div>

        <button
          onClick={startOefensessie}
          className="w-full py-4 rounded-2xl text-white font-semibold text-lg mb-4 transition-transform hover:scale-105"
          style={{ backgroundColor: '#FF560D' }}>
          Oefensessie starten
        </button>

        <div className="rounded-2xl p-6 mb-4"
          style={{ backgroundColor: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#333' }}>
              Referentie videos
            </h2>
            <button
              onClick={zoekReferenties}
              disabled={loadingReferenties}
              className="text-sm px-3 py-1 rounded-lg"
              style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
              {loadingReferenties ? 'Zoeken...' : 'Zoek'}
            </button>
          </div>
          {referenties.length === 0 ? (
            <p className="text-sm" style={{ color: '#888' }}>
              Nog geen referentie videos. Klik op zoek om er te vinden.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {referenties.map((ref: any, i: number) => (
               <a 
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#F3E7DD' }}>
                  {ref.thumbnail && (
                    <img
                      src={ref.thumbnail}
                      alt={ref.titel}
                      className="w-16 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#333' }}>
                      {ref.titel}
                    </p>
                    <p className="text-xs" style={{ color: '#888' }}>
                      {ref.kanaal}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-6 mb-4"
          style={{ backgroundColor: '#fff' }}>
          <h2 className="font-semibold mb-4" style={{ color: '#333' }}>
            {rol === 'leraar' ? 'Instructies toevoegen' : 'Notities toevoegen'}
          </h2>
          <textarea
            placeholder={rol === 'leraar'
              ? 'Voeg instructies toe voor de student...'
              : 'Voeg eigen notities toe...'}
            value={annotatie}
            onChange={(e) => setAnnotatie(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl text-sm resize-none mb-3"
            style={{ backgroundColor: '#F3E7DD' }}
          />
          <button
            onClick={slaAnnotatieOp}
            disabled={!annotatie.trim()}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium"
            style={{ backgroundColor: !annotatie.trim() ? '#999' : '#0766C6' }}>
            Opslaan
          </button>
        </div>

      </div>
    </main>
  )
}