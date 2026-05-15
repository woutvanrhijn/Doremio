'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const INSTRUMENTEN = [
  'Piano', 'Gitaar', 'Viool', 'Cello', 'Fluit', 'Klarinet', 'Saxofoon',
  'Trompet', 'Trombone', 'Slagwerk', 'Harp', 'Dwarsfluit', 'Hobo', 'Fagot',
  'Contrabas', 'Altviool', 'Orgel', 'Accordeon', 'Zang',
]

const GENRES = [
  'Klassiek', 'Jazz', 'Pop', 'Rock', 'Folk', 'Blues', 'Soul', 'R&B',
  'Elektronisch', 'Hip-hop', 'Wereldmuziek', 'Filmmuziek', 'Barok',
  'Romantisch', 'Contemporary', 'Kamermuziek', 'Symfonisch',
]

export default function ProfielBewerken() {
  const [naam, setNaam] = useState('')
  const [instrument, setInstrument] = useState('')
  const [customInstrument, setCustomInstrument] = useState('')
  const [academie, setAcademie] = useState('')
  const [bio, setBio] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [opslaan, setOpslaan] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      supabase.from('profiles')
        .select('naam, instrument, academie, bio, favoriete_genres')
        .eq('id', user.id).single()
        .then(({ data }) => {
          if (!data) return
          setNaam(data.naam || '')
          const instr = data.instrument || ''
          if (INSTRUMENTEN.includes(instr)) {
            setInstrument(instr)
          } else {
            setInstrument('Andere')
            setCustomInstrument(instr)
          }
          setAcademie(data.academie || '')
          setBio(data.bio || '')
          setGenres(data.favoriete_genres || [])
          setLoading(false)
        })
    })
  }, [router])

  const toggleGenre = (genre: string) => {
    setGenres(prev =>
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    )
  }

  const slaOp = async () => {
    setOpslaan(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const effectiefInstrument = instrument === 'Andere' ? customInstrument : instrument
    await supabase.from('profiles').update({
      naam, instrument: effectiefInstrument, academie, bio, favoriete_genres: genres
    }).eq('id', user.id)
    setOpgeslagen(true)
    setOpslaan(false)
    setTimeout(() => router.push('/profiel'), 800)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  return (
    <main className="min-h-screen px-6 py-10 pb-16" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-lg mx-auto">

        <button onClick={() => router.push('/profiel')}
          className="mb-6 text-sm flex items-center gap-2" style={{ color: '#0766C6' }}>
          ← Terug
        </button>

        <h1 className="text-2xl font-bold mb-1" style={{ color: '#0766C6' }}>Profiel bewerken</h1>
        <p className="text-sm mb-8" style={{ color: '#888' }}>Vertel wie jij bent als muzikant.</p>

        <div className="flex flex-col gap-5">

          {/* Basisgegevens */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 pt-5 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#888' }}>Basisgegevens</p>
            </div>
            <div className="px-5 pb-5 flex flex-col gap-3 mt-2">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#555' }}>Naam</label>
                <input type="text" value={naam} onChange={e => setNaam(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#555' }}>Academie</label>
                <input type="text" value={academie} onChange={e => setAcademie(e.target.value)}
                  placeholder="Naam van je academie"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
              </div>
            </div>
          </div>

          {/* Instrument */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#888' }}>Instrument</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[...INSTRUMENTEN, 'Andere'].map(i => (
                  <button key={i} onClick={() => setInstrument(i)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor: instrument === i ? '#0766C6' : '#F3E7DD',
                      color: instrument === i ? '#fff' : '#555',
                    }}>
                    {i}
                  </button>
                ))}
              </div>
              {instrument === 'Andere' && (
                <input type="text" value={customInstrument}
                  onChange={e => setCustomInstrument(e.target.value)}
                  placeholder="Mijn instrument..."
                  className="w-full mt-3 px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
              )}
            </div>
          </div>

          {/* Muzikale bio */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#888' }}>Muzikale bio</p>
              <p className="text-xs mb-3" style={{ color: '#bbb' }}>
                Vertel in een paar zinnen wie jij bent als muzikant.
              </p>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4}
                placeholder="Bijv. Ik speel al 3 jaar piano en luister het liefst naar jazz en filmmuziek. Mijn droom is..."
                className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
                style={{ backgroundColor: '#F3E7DD', color: '#333' }} />
            </div>
          </div>

          {/* Favoriete genres */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#fff' }}>
            <div className="px-5 pt-5 pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#888' }}>Favoriete genres</p>
              <p className="text-xs mb-3" style={{ color: '#bbb' }}>Kies alles wat jou aanspreekt.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {GENRES.map(genre => (
                  <button key={genre} onClick={() => toggleGenre(genre)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      backgroundColor: genres.includes(genre) ? '#0766C6' : '#F3E7DD',
                      color: genres.includes(genre) ? '#fff' : '#555',
                    }}>
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Opslaan */}
          <button onClick={slaOp} disabled={opslaan || opgeslagen || !naam.trim()}
            className="w-full py-4 rounded-2xl text-white font-semibold text-base"
            style={{
              backgroundColor: opgeslagen ? '#22c55e' : !naam.trim() ? '#bbb' : '#0766C6',
            }}>
            {opgeslagen ? '✓ Opgeslagen!' : opslaan ? 'Opslaan...' : 'Profiel opslaan'}
          </button>

        </div>
      </div>
    </main>
  )
}
