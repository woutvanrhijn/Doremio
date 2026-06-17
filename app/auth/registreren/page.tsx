'use client'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RegistrerenForm() {
  const searchParams = useSearchParams()
  const rol = (searchParams.get('rol') as 'student' | 'leraar') ?? 'student'

  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [loading, setLoading] = useState(false)
  const [fout, setFout] = useState('')
  const router = useRouter()

  const rolLabel = rol === 'leraar' ? 'Docent of ouder' : 'Student DKO'

  const handleRegistreren = async () => {
    setLoading(true)
    setFout('')

    if (!naam || !email || !wachtwoord) {
      setFout('Vul alle velden in')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: wachtwoord,
      options: {
        data: { naam, rol }
      }
    })

    if (error) { setFout(error.message); setLoading(false); return }
    router.push('/onboarding/rol')
    setLoading(false)
  }

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#0D1B2A' }}
    >
      {/* Rol-badge */}
      <div
        className="mb-2 px-4 py-1 rounded-full font-apercu font-bold text-white text-label"
        style={{ backgroundColor: rol === 'leraar' ? '#FF560D' : '#0766C6' }}
      >
        {rolLabel}
      </div>

      <h1 className="font-apercu font-bold text-display-md text-white mb-1">
        Account aanmaken
      </h1>
      <p className="font-apercu text-body-md mb-8" style={{ color: '#8FA3B8' }}>
        Welkom bij Doremio
      </p>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <input
          type="text"
          placeholder="Volledige naam"
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          className="w-full px-4 py-4 rounded-2xl font-apercu text-body-lg text-white placeholder:text-gray-muted focus:outline-none"
          style={{ backgroundColor: '#1A2E45' }}
        />
        <input
          type="email"
          placeholder="E-mailadres"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-4 rounded-2xl font-apercu text-body-lg text-white placeholder:text-gray-muted focus:outline-none"
          style={{ backgroundColor: '#1A2E45' }}
        />
        <input
          type="password"
          placeholder="Wachtwoord"
          value={wachtwoord}
          onChange={(e) => setWachtwoord(e.target.value)}
          className="w-full px-4 py-4 rounded-2xl font-apercu text-body-lg text-white placeholder:text-gray-muted focus:outline-none"
          style={{ backgroundColor: '#1A2E45' }}
        />

        {fout && (
          <p className="font-apercu text-body-sm" style={{ color: '#FF560D' }}>{fout}</p>
        )}

        <button
          onClick={handleRegistreren}
          disabled={loading}
          className="w-full py-4 rounded-full font-apercu font-bold text-navy text-body-lg mt-2 active:scale-95 transition-transform duration-100"
          style={{ backgroundColor: loading ? '#8FA3B8' : '#FFD100' }}
        >
          {loading ? 'Laden...' : 'Registreren'}
        </button>

        <Link href="/auth/login">
          <p className="font-apercu text-body-sm text-center mt-2" style={{ color: '#8FA3B8' }}>
            Al een account?{' '}
            <span style={{ color: '#0766C6' }} className="font-bold">Inloggen</span>
          </p>
        </Link>
      </div>
    </main>
  )
}

export default function RegistrerenPage() {
  return (
    <Suspense>
      <RegistrerenForm />
    </Suspense>
  )
}
