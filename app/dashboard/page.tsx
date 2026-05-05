'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [gebruiker, setGebruiker] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setGebruiker(user)
      setLoading(false)
    }
    checkUser()
  }, [router])

  const uitloggen = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  return (
    <main className="min-h-screen px-6 py-10"
      style={{ backgroundColor: '#F3E7DD' }}>

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: '#0766C6' }}>
              <span className="text-white text-2xl">♪</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#0766C6' }}>
                Doremio
              </h1>
              <p className="text-sm" style={{ color: '#666' }}>
                {gebruiker?.email}
              </p>
            </div>
          </div>
          <button
            onClick={uitloggen}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#fff', color: '#666' }}>
            Uitloggen
          </button>
        </div>

        <div className="rounded-2xl p-6 mb-4"
          style={{ backgroundColor: '#fff' }}>
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#333' }}>
            Welkom bij Doremio
          </h2>
          <p style={{ color: '#666' }}>
            Het platform wordt hier verder opgebouwd. Inloggen werkt!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl p-6"
            style={{ backgroundColor: '#0766C6' }}>
            <p className="text-white text-sm mb-1">Partituren</p>
            <p className="text-white text-3xl font-bold">0</p>
          </div>
          <div className="rounded-2xl p-6"
            style={{ backgroundColor: '#FF560D' }}>
            <p className="text-white text-sm mb-1">Oefensessies</p>
            <p className="text-white text-3xl font-bold">0</p>
          </div>
        </div>
      </div>
    </main>
  )
}