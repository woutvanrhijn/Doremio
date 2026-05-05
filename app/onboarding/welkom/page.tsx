'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Welkom() {
  const [naam, setNaam] = useState('')
  const [rol, setRol] = useState('')
  const router = useRouter()

  useEffect(() => {
    const haalProfielOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('naam, role')
        .eq('id', user.id)
        .single()
      if (data) {
        setNaam(data.naam || '')
        setRol(data.role || '')
      }
    }
    haalProfielOp()
  }, [router])

  const naarDashboard = () => {
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#F3E7DD' }}>

      <div className="w-24 h-24 rounded-3xl mb-8 flex items-center justify-center"
        style={{ backgroundColor: '#0766C6' }}>
        <span className="text-white text-5xl">♪</span>
      </div>

      <h1 className="text-4xl font-bold mb-4 text-center" style={{ color: '#0766C6' }}>
        Welkom, {naam}!
      </h1>

      <p className="text-lg text-center mb-2" style={{ color: '#444' }}>
        {rol === 'student' && 'Jouw muzikale reis begint hier.'}
        {rol === 'leraar' && 'Klaar om jouw studenten te begeleiden.'}
        {rol === 'ouder' && 'Volg de muzikale groei van jouw kind.'}
      </p>

      <p className="text-sm text-center mb-12" style={{ color: '#888' }}>
        Doremio helpt je verder groeien als muzikant.
      </p>

      <div className="w-full max-w-sm flex flex-col gap-3 mb-12">
        <div className="flex items-center gap-4 rounded-2xl p-4"
          style={{ backgroundColor: '#fff' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#0766C6' }}>
            <span className="text-white text-lg">♫</span>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#333' }}>De Partituur</p>
            <p className="text-xs" style={{ color: '#888' }}>Oefen op basis van jouw lesmateriaal</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl p-4"
          style={{ backgroundColor: '#fff' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#FF560D' }}>
            <span className="text-white text-lg">🎙</span>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#333' }}>De Studio</p>
            <p className="text-xs" style={{ color: '#888' }}>Neem je oefensessies op</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl p-4"
          style={{ backgroundColor: '#fff' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#FFD100' }}>
            <span className="text-lg">📈</span>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#333' }}>Het Parcours</p>
            <p className="text-xs" style={{ color: '#888' }}>Volg jouw muzikale groei</p>
          </div>
        </div>
      </div>

      <button
        onClick={naarDashboard}
        className="w-full max-w-sm py-4 rounded-2xl text-white font-semibold text-lg transition-transform hover:scale-105"
        style={{ backgroundColor: '#0766C6' }}>
        Start met Doremio →
      </button>

    </main>
  )
}