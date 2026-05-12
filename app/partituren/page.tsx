'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function PartiturenLijst() {
  const [partituren, setPartituren] = useState<any[]>([])
  const [uploaders, setUploaders] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [rol, setRol] = useState('')
  const router = useRouter()

  useEffect(() => {
    const haalOp = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profiel } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const gevondenRol = profiel?.role || ''
      setRol(gevondenRol)

      let query = supabase
        .from('partituren')
        .select('*')
        .order('created_at', { ascending: false })

      if (gevondenRol === 'leraar') {
        query = query.eq('leraar_id', user.id)
      }

      const { data } = await query
      const lijst = data || []
      setPartituren(lijst)

      // Uploadersnamen ophalen
      const leraarIds = [...new Set(lijst.map((p: any) => p.leraar_id).filter(Boolean))]
      if (leraarIds.length > 0) {
        const { data: profielen } = await supabase
          .from('profiles')
          .select('id, naam')
          .in('id', leraarIds)
        const map: Record<string, string> = {}
        profielen?.forEach((p: any) => { map[p.id] = p.naam })
        setUploaders(map)
      }

      setLoading(false)
    }
    haalOp()
  }, [router])

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#F3E7DD' }}>
      <p style={{ color: '#0766C6' }}>Laden...</p>
    </main>
  )

  return (
    <main className="min-h-screen px-6 py-10" style={{ backgroundColor: '#F3E7DD' }}>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push('/dashboard')}
              className="text-sm mb-2 flex items-center gap-1"
              style={{ color: '#0766C6' }}>
              ← Dashboard
            </button>
            <h1 className="text-3xl font-bold" style={{ color: '#0766C6' }}>
              Partituren
            </h1>
            <p className="text-sm mt-1" style={{ color: '#888' }}>
              {partituren.length} {partituren.length === 1 ? 'stuk' : 'stukken'}
            </p>
          </div>
          {rol === 'leraar' && (
            <button
              onClick={() => router.push('/partituren/nieuw')}
              className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm transition-transform hover:scale-105"
              style={{ backgroundColor: '#0766C6' }}>
              + Nieuw
            </button>
          )}
        </div>

        {/* Lege staat */}
        {partituren.length === 0 ? (
          <div className="rounded-2xl p-12 flex flex-col items-center gap-4 text-center"
            style={{ backgroundColor: '#fff' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: '#F3E7DD' }}>
              <span className="text-3xl">🎼</span>
            </div>
            <p className="font-semibold" style={{ color: '#333' }}>
              {rol === 'leraar' ? 'Nog geen partituren geüpload' : 'Nog geen partituren beschikbaar'}
            </p>
            {rol === 'leraar' && (
              <button
                onClick={() => router.push('/partituren/nieuw')}
                className="mt-2 px-6 py-3 rounded-xl text-white font-semibold transition-transform hover:scale-105"
                style={{ backgroundColor: '#0766C6' }}>
                Eerste partituur uploaden
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {partituren.map((p: any) => (
              <button
                key={p.id}
                onClick={() => router.push(`/partituren/${p.id}`)}
                className="w-full text-left rounded-2xl overflow-hidden transition-transform hover:scale-[1.01] shadow-sm"
                style={{ backgroundColor: '#fff' }}>

                {/* Gekleurde bovenrand als accent */}
                <div className="h-1 w-full" style={{ backgroundColor: '#0766C6' }} />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base truncate" style={{ color: '#0766C6' }}>
                        {p.titel}
                      </p>
                      {p.componist && (
                        <p className="text-sm mt-0.5 truncate" style={{ color: '#555' }}>
                          {p.componist}
                        </p>
                      )}
                    </div>
                    <span className="text-xl flex-shrink-0 mt-0.5">🎵</span>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {uploaders[p.leraar_id] && (
                      <span className="text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: '#F3E7DD', color: '#0766C6' }}>
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
    </main>
  )
}