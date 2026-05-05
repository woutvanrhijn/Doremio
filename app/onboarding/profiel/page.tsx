'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Profiel() {
  const [rol, setRol] = useState('')
  const [naam, setNaam] = useState('')
  const [geboortejaar, setGeboortejaar] = useState('')
  const [instrument, setInstrument] = useState('')
  const [academie, setAcademie] = useState('')
  const [klasgroep, setKlasgroep] = useState('')
  const [vakken, setVakken] = useState('')
  const [loading, setLoading] = useState(false)
  const [fout, setFout] = useState('')
  const router = useRouter()

  useEffect(() => {
    const haalRolOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('role, naam')
        .eq('id', user.id)
        .single()
      if (data) {
        setRol(data.role || '')
        setNaam(data.naam || '')
      }
    }
    haalRolOp()
  }, [router])

  const slaOp = async () => {
    setLoading(true)
    setFout('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const updates: any = { naam, instrument, academie }
    if (rol === 'student') {
      updates.geboortejaar = parseInt(geboortejaar)
      updates.klasgroep = klasgroep
    }
    if (rol === 'leraar') {
      updates.vakken = vakken
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (error) { setFout(error.message); setLoading(false); return }
    router.push('/onboarding/welkom')
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
      style={{ backgroundColor: '#F3E7DD' }}>

      <div className="w-full max-w-sm">
        <div className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center"
          style={{ backgroundColor: '#0766C6' }}>
          <span className="text-white text-3xl">♪</span>
        </div>

        <h1 className="text-3xl font-bold mb-2" style={{ color: '#0766C6' }}>
          Jouw profiel
        </h1>
        <p className="text-sm mb-8" style={{ color: '#666' }}>
          Vertel ons iets over jezelf
        </p>

        <div className="flex flex-col gap-4">

          <input
            type="text"
            placeholder="Volledige naam"
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-base"
            style={{ backgroundColor: '#fff' }}
          />

          <input
            type="text"
            placeholder="Instrument (bv. gitaar, piano...)"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-base"
            style={{ backgroundColor: '#fff' }}
          />

          <input
            type="text"
            placeholder="Academie (bv. Academie Borgerhout)"
            value={academie}
            onChange={(e) => setAcademie(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-base"
            style={{ backgroundColor: '#fff' }}
          />

          {rol === 'student' && (
            <>
              <input
                type="number"
                placeholder="Geboortejaar (bv. 2010)"
                value={geboortejaar}
                onChange={(e) => setGeboortejaar(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base"
                style={{ backgroundColor: '#fff' }}
              />
              <input
                type="text"
                placeholder="Klasgroep (bv. Graad 2A)"
                value={klasgroep}
                onChange={(e) => setKlasgroep(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-base"
                style={{ backgroundColor: '#fff' }}
              />
            </>
          )}

          {rol === 'leraar' && (
            <input
              type="text"
              placeholder="Vakken (bv. gitaar, muziektheorie)"
              value={vakken}
              onChange={(e) => setVakken(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-base"
              style={{ backgroundColor: '#fff' }}
            />
          )}

          {fout && (
            <p className="text-sm" style={{ color: '#FF560D' }}>{fout}</p>
          )}

          <button
            onClick={slaOp}
            disabled={loading || !naam}
            className="w-full py-4 rounded-2xl text-white font-semibold text-lg mt-2"
            style={{ backgroundColor: loading || !naam ? '#999' : '#0766C6' }}>
            {loading ? 'Opslaan...' : 'Verder'}
          </button>

        </div>
      </div>
    </main>
  )
}