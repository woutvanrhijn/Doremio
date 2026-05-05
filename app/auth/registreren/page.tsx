'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Registreren() {
  const [naam, setNaam] = useState('')
  const [gebruikersnaam, setGebruikersnaam] = useState('')
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [loading, setLoading] = useState(false)
  const [fout, setFout] = useState('')
  const router = useRouter()

  const handleRegistreren = async () => {
    setLoading(true)
    setFout('')

    if (!naam || !gebruikersnaam || !email || !wachtwoord) {
      setFout('Vul alle velden in')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: wachtwoord,
      options: {
        data: { naam, gebruikersnaam }
      }
    })

    if (error) { setFout(error.message); setLoading(false); return }
    router.push('/onboarding/rol')
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#F3E7DD' }}>

      <div className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center"
        style={{ backgroundColor: '#0766C6' }}>
        <span className="text-white text-3xl">♪</span>
      </div>

      <h1 className="text-3xl font-bold mb-2" style={{ color: '#0766C6' }}>
        Account aanmaken
      </h1>
      <p className="text-sm mb-8" style={{ color: '#666' }}>Doremio</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
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
          placeholder="Gebruikersnaam"
          value={gebruikersnaam}
          onChange={(e) => setGebruikersnaam(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-base"
          style={{ backgroundColor: '#fff' }}
        />
        <input
          type="email"
          placeholder="E-mailadres"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-base"
          style={{ backgroundColor: '#fff' }}
        />
        <input
          type="password"
          placeholder="Wachtwoord"
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-base"
          style={{ backgroundColor: '#fff' }}
        />

        {fout && (
          <p className="text-sm" style={{ color: '#FF560D' }}>{fout}</p>
        )}

        <button
          onClick={handleRegistreren}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-semibold text-lg mt-2"
          style={{ backgroundColor: loading ? '#999' : '#0766C6' }}>
          {loading ? 'Laden...' : 'Registreren'}
        </button>

        <Link href="/auth/login">
          <p className="text-sm text-center" style={{ color: '#0766C6' }}>
            Al een account? Inloggen
          </p>
        </Link>
      </div>
    </main>
  )
}