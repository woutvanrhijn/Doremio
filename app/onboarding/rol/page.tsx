'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RolKeuze() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const kiesRol = async (rol: string) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) { 
      router.push('/auth/login')
      return 
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id, 
        role: rol 
      })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    router.push('/onboarding/profiel')
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#F3E7DD' }}>

      <div className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center"
        style={{ backgroundColor: '#0766C6' }}>
        <span className="text-white text-3xl">♪</span>
      </div>

      <h1 className="text-3xl font-bold mb-2 text-center" style={{ color: '#0766C6' }}>
        Wie ben jij?
      </h1>
      <p className="text-sm mb-10 text-center" style={{ color: '#666' }}>
        Kies je rol om verder te gaan
      </p>

      <div className="w-full max-w-sm flex flex-col gap-4">

        <button
          onClick={() => kiesRol('student')}
          disabled={loading}
          className="w-full py-5 px-6 rounded-2xl text-left transition-transform hover:scale-105"
          style={{ backgroundColor: '#0766C6' }}>
          <p className="text-white font-bold text-lg">🎵 Student</p>
          <p className="text-blue-200 text-sm">Ik volg muziekles aan een academie</p>
        </button>

        <button
          onClick={() => kiesRol('leraar')}
          disabled={loading}
          className="w-full py-5 px-6 rounded-2xl text-left transition-transform hover:scale-105"
          style={{ backgroundColor: '#FF560D' }}>
          <p className="text-white font-bold text-lg">🎼 Leraar</p>
          <p className="text-orange-200 text-sm">Ik geef muziekles aan een academie</p>
        </button>

        <button
          onClick={() => kiesRol('ouder')}
          disabled={loading}
          className="w-full py-5 px-6 rounded-2xl text-left transition-transform hover:scale-105"
          style={{ backgroundColor: '#FFD100' }}>
          <p className="font-bold text-lg" style={{ color: '#333' }}>👨‍👩‍👧 Ouder</p>
          <p className="text-sm" style={{ color: '#666' }}>Ik volg de voortgang van mijn kind</p>
        </button>

      </div>

      {loading && (
        <p className="mt-6 text-sm" style={{ color: '#666' }}>Laden...</p>
      )}

    </main>
  )
}