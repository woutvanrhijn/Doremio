'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [gebruiker, setGebruiker] = useState<any>(null)
  const [profiel, setProfiel] = useState<any>(null)
  const [aantalPartituren, setAantalPartituren] = useState(0)
  const [aantalSessies, setAantalSessies] = useState(0)
  const [recentePartituren, setRecentePartituren] = useState<any[]>([])
  const [uploaders, setUploaders] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setGebruiker(user)

      const { data: profielData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfiel(profielData)

      const rol = profielData?.role
      let partituren: any[] = []

      if (rol === 'leraar') {
        const { data } = await supabase
          .from('partituren')
          .select('*')
          .eq('leraar_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3)
        partituren = data || []

        const { count } = await supabase
          .from('partituren')
          .select('*', { count: 'exact', head: true })
          .eq('leraar_id', user.id)
        setAantalPartituren(count || 0)

      } else {
        const { data } = await supabase
          .from('partituren')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3)
        partituren = data || []

        const { count: countP } = await supabase
          .from('partituren')
          .select('*', { count: 'exact', head: true })
        setAantalPartituren(countP || 0)

        const { count: countS } = await supabase
          .from('oefensessies')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user.id)
        setAantalSessies(countS || 0)
      }

      setRecentePartituren(partituren)

      // Uploadernamen ophalen
      const leraarIds = [...new Set(partituren.map((p: any) => p.leraar_id).filter(Boolean))]
      if (leraarIds.length > 0) {
        const { data: profielen } = await supabase
          .from('profiles')
          .select('id, naam')
          .in('id', leraarIds)
        const uploaderMap: Record<string, string> = {}
        profielen?.forEach((p: any) => { uploaderMap[p.id] = p.naam })
        setUploaders(uploaderMap)
      }

      setLoading(false)
    }
    haalOp()
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

  const rol = profiel?.role
  const naam = profiel?.naam || gebruiker?.email

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
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
                {naam} · {rol === 'leraar' ? 'Leraar' : 'Student'}
              </p>
            </div>
          </div>
          <button onClick={uitloggen}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#fff', color: '#666' }}>
            Uitloggen
          </button>
        </div>

        {/* Statistieken */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => router.push('/partituren')}
            className="rounded-2xl p-6 text-left transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#0766C6' }}>
            <p className="text-blue-200 text-sm mb-1">Partituren</p>
            <p className="text-white text-3xl font-bold">{aantalPartituren}</p>
            <p className="text-blue-200 text-xs mt-2">Bekijk alle →</p>
          </button>

          <button
            onClick={() => rol !== 'leraar' && router.push('/studio')}
            className="rounded-2xl p-6 text-left transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#FF560D' }}>
            <p className="text-orange-200 text-sm mb-1">Oefensessies</p>
            <p className="text-white text-3xl font-bold">{aantalSessies}</p>
            <p className="text-orange-200 text-xs mt-2">
              {rol === 'leraar' ? 'Van studenten' : 'Jouw sessies →'}
            </p>
          </button>
        </div>

        {/* Recente partituren */}
        <div className="rounded-2xl p-6 mb-4" style={{ backgroundColor: '#fff' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#333' }}>
              Recente partituren
            </h2>
            <button
              onClick={() => router.push('/partituren')}
              className="text-sm"
              style={{ color: '#0766C6' }}>
              Alle bekijken →
            </button>
          </div>

          {recentePartituren.length === 0 ? (
            <p className="text-sm" style={{ color: '#888' }}>
              Nog geen partituren beschikbaar.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentePartituren.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/partituren/${p.id}`)}
                  className="w-full text-left rounded-2xl overflow-hidden transition-transform hover:scale-[1.01] shadow-sm"
                  style={{ backgroundColor: '#F3E7DD' }}>
                  <div className="h-1 w-full" style={{ backgroundColor: '#0766C6' }} />
                  <div className="p-4">
                    <p className="font-bold text-sm truncate" style={{ color: '#0766C6' }}>
                      {p.titel}
                    </p>
                    {p.componist && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#555' }}>
                        {p.componist}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {uploaders[p.leraar_id] && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: '#fff', color: '#0766C6' }}>
                          ✦ {uploaders[p.leraar_id]}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: '#bbb' }}>
                        {new Date(p.created_at).toLocaleDateString('nl-BE', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Snelle acties */}
        <div className="flex flex-col gap-3">
          {rol === 'leraar' && (
            <button
              onClick={() => router.push('/partituren/nieuw')}
              className="w-full py-4 rounded-2xl text-white font-semibold transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: '#0766C6' }}>
              + Nieuwe partituur uploaden
            </button>
          )}
          {rol === 'student' && (
            <button
              onClick={() => router.push('/partituren')}
              className="w-full py-4 rounded-2xl text-white font-semibold transition-transform hover:scale-[1.02]"
              style={{ backgroundColor: '#FF560D' }}>
              Oefenen starten
            </button>
          )}
        </div>

      </div>
    </main>
  )
}