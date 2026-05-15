'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

type NavItem = {
  label: string
  path: string
  icon: string
  isActief: (pathname: string) => boolean
}

const STUDENT_NAV: NavItem[] = [
  {
    label: 'Home',
    path: '/dashboard',
    icon: '♪',
    isActief: p => p === '/dashboard',
  },
  {
    label: 'Oefenen',
    path: '/partituren',
    icon: '🎵',
    isActief: p => p.startsWith('/partituren') || p.startsWith('/studio'),
  },
  {
    label: 'Logboek',
    path: '/sessies',
    icon: '📖',
    isActief: p => p.startsWith('/sessies'),
  },
  {
    label: 'Profiel',
    path: '/profiel',
    icon: '👤',
    isActief: p => p.startsWith('/profiel'),
  },
]

const LERAAR_NAV: NavItem[] = [
  {
    label: 'Home',
    path: '/dashboard',
    icon: '♪',
    isActief: p => p === '/dashboard',
  },
  {
    label: 'Partituren',
    path: '/partituren',
    icon: '🎵',
    isActief: p => p.startsWith('/partituren'),
  },
  {
    label: 'Classview',
    path: '/venster',
    icon: '👁',
    isActief: p => p.startsWith('/venster'),
  },
  {
    label: 'Profiel',
    path: '/profiel',
    icon: '👤',
    isActief: p => p.startsWith('/profiel'),
  },
]

export default function BottomNav() {
  const [rol, setRol] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => { if (data) setRol(data.role) })
    })
  }, [])

  if (!rol) return null

  const nav = rol === 'leraar' ? LERAAR_NAV : STUDENT_NAV

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ backgroundColor: '#fff', borderTop: '1px solid #F3E7DD' }}>
      <div
        className="flex max-w-lg mx-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        {nav.map(item => {
          const actief = item.isActief(pathname)
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className="flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors"
              style={{ color: actief ? '#0766C6' : '#bbb' }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: actief ? 700 : 400,
                letterSpacing: '0.02em',
              }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
