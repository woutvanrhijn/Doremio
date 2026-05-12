'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NieuwePartituur() {
  const [stap, setStap] = useState<'keuze' | 'verwerken' | 'bevestigen'>('keuze')
  const [bestand, setBestand] = useState<File | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [titel, setTitel] = useState('')
  const [componist, setComponist] = useState('')
  const [annotatie, setAnnotatie] = useState('')
  const [referenties, setReferenties] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [fout, setFout] = useState('')
  const bestandInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const verwerkBestand = async (file: File) => {
    setBestand(file)
    setIsPdf(file.type === 'application/pdf')
    setStap('verwerken')

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string

      try {
        // Stap 1: AI herkent titel en componist
        const herkenResponse = await fetch('/api/herken-partituur', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bestand: base64, type: file.type })
        })
        const herkenData = await herkenResponse.json()
        const gevondenTitel = herkenData.titel || ''
        const gevondenComponist = herkenData.componist || ''
        setTitel(gevondenTitel)
        setComponist(gevondenComponist)

        // Stap 2: referenties zoeken op basis van herkende data
        if (gevondenTitel) {
          const refResponse = await fetch('/api/zoek-referenties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titel: gevondenTitel, componist: gevondenComponist })
          })
          const refData = await refResponse.json()
          setReferenties(refData.links || [])
        }
      } catch (e) {
        console.error('Fout bij verwerken:', e)
      }

      setStap('bevestigen')
    }
    reader.readAsDataURL(file)
  }

  const handleBestandKeuze = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) verwerkBestand(file)
  }

  const uploaden = async () => {
    if (!bestand || !titel) return
    setLoading(true)
    setFout('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const bestandsnaam = `${Date.now()}_${bestand.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('partituren')
        .upload(bestandsnaam, bestand)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('partituren')
        .getPublicUrl(bestandsnaam)

      const { data: partituur, error: dbError } = await supabase
        .from('partituren')
        .insert({
          titel,
          componist,
          bestand_url: urlData.publicUrl,
          leraar_id: user.id,
          // Referenties meteen opslaan
          referentie_url: referenties.length > 0 ? JSON.stringify(referenties) : null
        })
        .select()
        .single()
      if (dbError) throw dbError

      // Annotatie opslaan indien ingevuld
      if (annotatie.trim()) {
        await supabase.from('annotaties').insert({
          partituur_id: partituur.id,
          auteur_id: user.id,
          inhoud: annotatie,
          type: 'leraar'
        })
      }

      router.push(`/partituren/${partituur.id}`)
    } catch (e: any) {
      setFout(e.message)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-lg mx-auto">

        <button onClick={() => router.back()}
          className="mb-6 text-sm flex items-center gap-2"
          style={{ color: '#0766C6' }}>
          ← Terug
        </button>

        <h1 className="text-3xl font-bold mb-2" style={{ color: '#0766C6' }}>
          Nieuwe partituur
        </h1>
        <p className="text-sm mb-8" style={{ color: '#666' }}>
          Upload een PDF of maak een foto van je partituur
        </p>

        {stap === 'keuze' && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => bestandInput.current?.click()}
              className="w-full py-6 px-6 rounded-2xl text-left transition-transform hover:scale-105"
              style={{ backgroundColor: '#0766C6' }}>
              <p className="text-white font-bold text-lg">📄 PDF uploaden</p>
              <p className="text-blue-200 text-sm">Upload een bestaand PDF bestand</p>
            </button>

            <button
              onClick={() => cameraInput.current?.click()}
              className="w-full py-6 px-6 rounded-2xl text-left transition-transform hover:scale-105"
              style={{ backgroundColor: '#FF560D' }}>
              <p className="text-white font-bold text-lg">📷 Foto nemen</p>
              <p className="text-orange-200 text-sm">Scan een papieren partituur met je camera</p>
            </button>

            <input ref={bestandInput} type="file" accept=".pdf,image/*"
              onChange={handleBestandKeuze} className="hidden" />
            <input ref={cameraInput} type="file" accept="image/*"
              capture="environment" onChange={handleBestandKeuze} className="hidden" />
          </div>
        )}

        {stap === 'verwerken' && (
          <div className="flex flex-col items-center py-12 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
              style={{ backgroundColor: '#0766C6' }}>
              <span className="text-white text-3xl">♪</span>
            </div>
            <p className="font-semibold" style={{ color: '#0766C6' }}>
              Partituur wordt herkend...
            </p>
            <p className="text-sm text-center" style={{ color: '#888' }}>
              We zoeken de titel, componist en referentie-audio op
            </p>
          </div>
        )}

        {stap === 'bevestigen' && (
          <div className="flex flex-col gap-4">

            {/* PDF toon icoon, afbeelding toon preview */}
            {isPdf ? (
              <div className="rounded-2xl p-6 flex items-center gap-4"
                style={{ backgroundColor: '#fff' }}>
                <span className="text-4xl">📄</span>
                <div>
                  <p className="font-semibold" style={{ color: '#333' }}>{bestand?.name}</p>
                  <p className="text-sm" style={{ color: '#888' }}>PDF partituur</p>
                </div>
              </div>
            ) : (
              bestand && (
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
                  <img src={URL.createObjectURL(bestand)} alt="Voorvertoning"
                    className="w-full object-contain max-h-64" />
                </div>
              )
            )}

            <input
              type="text"
              placeholder="Titel van het stuk"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base"
              style={{ backgroundColor: '#fff' }}
            />

            <input
              type="text"
              placeholder="Componist"
              value={componist}
              onChange={(e) => setComponist(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base"
              style={{ backgroundColor: '#fff' }}
            />

            {/* Gevonden referenties tonen */}
            {referenties.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#fff' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: '#333' }}>
                  Gevonden referenties ({referenties.length})
                </p>
                <div className="flex flex-col gap-2">
                  {referenties.map((ref: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl"
                      style={{ backgroundColor: '#F3E7DD' }}>
                      {ref.thumbnail && (
                        <img src={ref.thumbnail} alt={ref.titel}
                          className="w-14 h-10 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: '#333' }}>
                          {ref.titel}
                        </p>
                        <p className="text-xs" style={{ color: '#888' }}>
                          {ref.platform === 'spotify' ? '🎵 Spotify' : '▶ YouTube'} · {ref.kanaal}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              placeholder="Instructies voor de student (optioneel)"
              value={annotatie}
              onChange={(e) => setAnnotatie(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl text-base resize-none"
              style={{ backgroundColor: '#fff' }}
            />

            {fout && <p className="text-sm" style={{ color: '#FF560D' }}>{fout}</p>}

            <button
              onClick={uploaden}
              disabled={loading || !titel}
              className="w-full py-4 rounded-2xl text-white font-semibold text-lg"
              style={{ backgroundColor: loading || !titel ? '#999' : '#0766C6' }}>
              {loading ? 'Uploaden...' : 'Partituur opslaan'}
            </button>

            <button
              onClick={() => setStap('keuze')}
              className="w-full py-3 rounded-2xl text-sm font-medium"
              style={{ backgroundColor: '#fff', color: '#666' }}>
              Opnieuw beginnen
            </button>
          </div>
        )}
      </div>
    </main>
  )
}