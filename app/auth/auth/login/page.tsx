'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistreren, setIsRegistreren] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fout, setFout] = useState('')
  const router = useRouter()

  const handleSubmit = async () => {
    setLoading(true)
    setFout('')

    if (isRegistreren) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setFout(error.message); setLoading(false); return }
      setFout('Controleer je email om je account te bevestigen.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setFout(error.message); setLoading(false); return }
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#F3E7DD' }}>

      <div className="w-20 h-20 rounded-2xl mb-6 flex items-center justify-center"
        style={{ backgroundColor: '#0766C6' }}>
        <span className="text-white text-4xl">♪</span>
      </div>

      <h1 className="text-3xl font-bold mb-2" style={{ color: '#0766C6' }}>
        {isRegistreren ? 'Account aanmaken' : 'Welkom terug'}
      </h1>
      <p className="text-sm mb-8" style={{ color: '#666' }}>Doremio</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="email"
          placeholder="E-mailadres"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-0 text-base"
          style={{ backgroundColor: '#fff' }}
        />
        <input
          type="password"
          placeholder="Wachtwoord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-0 text-base"
          style={{ backgroundColor: '#fff' }}
        />

        {fout && (
          <p className="text-sm text-center" style={{ color: '#FF560D' }}>{fout}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-semibold text-lg"
          style={{ backgroundColor: loading ? '#999' : '#0766C6' }}>
          {loading ? 'Laden...' : isRegistreren ? 'Registreren' : 'Inloggen'}
        </button>

        <button
          onClick={() => setIsRegistreren(!isRegistreren)}
          className="text-sm text-center"
          style={{ color: '#0766C6' }}>
          {isRegistreren ? 'Al een account? Inloggen' : 'Nog geen account? Registreren'}
        </button>
      </div>
    </main>
  )
}