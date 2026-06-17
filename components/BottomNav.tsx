'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

function IconHome({ kleur }: { kleur: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.9 26.2999L20.1 26.2999" stroke={kleur} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.04466 18.8809C1.49748 15.3202 1.22389 13.5398 1.89706 11.9615C2.57023 10.3832 4.06375 9.30337 7.05077 7.14365L9.28254 5.53C12.9984 2.84333 14.8563 1.5 17 1.5C19.1437 1.5 21.0017 2.84333 24.7175 5.53L26.9492 7.14365C29.9363 9.30337 31.4298 10.3832 32.1029 11.9615C32.7761 13.5398 32.5025 15.3202 31.9553 18.8808L31.4887 21.9172C30.7131 26.9648 30.3252 29.4886 28.515 30.9943C26.7047 32.5 24.0582 32.5 18.7652 32.5H15.2348C9.94182 32.5 7.29531 32.5 5.48506 30.9943C3.6748 29.4886 3.28695 26.9648 2.51127 21.9172L2.04466 18.8809Z" stroke={kleur} strokeWidth="3" strokeLinejoin="round"/>
    </svg>
  )
}

function IconStudio({ kleur }: { kleur: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M31.0238 17.7382C31.0238 25.891 24.4147 32.5001 16.2619 32.5001C8.10913 32.5001 1.5 25.891 1.5 17.7382C1.5 9.58545 8.10913 2.97632 16.2619 2.97632C17.9873 2.97632 19.6435 3.27232 21.1825 3.8163" stroke={kleur} strokeWidth="3" strokeLinecap="round"/>
      <path d="M28.0714 12.5716C28.0714 14.6097 26.4191 16.262 24.381 16.262C22.3428 16.262 20.6905 14.6097 20.6905 12.5716C20.6905 10.5334 22.3428 8.88107 24.381 8.88107C26.4191 8.88107 28.0714 10.5334 28.0714 12.5716ZM28.0714 12.5716V1.50012C28.5635 2.23822 28.9571 5.33822 32.5 5.92869" stroke={kleur} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.4762 17.7382C18.4762 16.5153 17.4848 15.5239 16.2619 15.5239C15.039 15.5239 14.0476 16.5153 14.0476 17.7382C14.0476 18.9611 15.039 19.9525 16.2619 19.9525C17.4848 19.9525 18.4762 18.9611 18.4762 17.7382Z" stroke={kleur} strokeWidth="3"/>
    </svg>
  )
}

function IconLesmateriaal({ kleur }: { kleur: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2.5H8.5A2 2 0 0 0 6.5 4.5V27.5A2 2 0 0 0 8.5 29.5H23.5A2 2 0 0 0 25.5 27.5V10L18 2.5Z" stroke={kleur} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 2.5V10H25.5" stroke={kleur} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="16" y1="16" x2="16" y2="23" stroke={kleur} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12.5" y1="19.5" x2="19.5" y2="19.5" stroke={kleur} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconKlasgroep({ kleur }: { kleur: string }) {
  return (
    <svg width="34" height="28" viewBox="0 0 46 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M39.8122 28.625C41.2639 28.625 42.4187 27.7114 43.4555 26.434C45.5779 23.8189 42.0932 21.7291 40.7641 20.7057C39.413 19.6653 37.9045 19.0759 36.375 18.9375M34.4375 15.0625C37.1126 15.0625 39.2812 12.8939 39.2812 10.2188C39.2812 7.54362 37.1126 5.375 34.4375 5.375" stroke={kleur} strokeWidth="3" strokeLinecap="round"/>
      <path d="M5.81288 28.625C4.36111 28.625 3.20638 27.7114 2.16959 26.434C0.0471381 23.8189 3.53189 21.7291 4.86097 20.7057C6.21204 19.6653 7.72059 19.0759 9.25009 18.9375M10.2188 15.0625C7.54371 15.0625 5.37509 12.8939 5.37509 10.2188C5.37509 7.54362 7.54371 5.375 10.2188 5.375" stroke={kleur} strokeWidth="3" strokeLinecap="round"/>
      <path d="M15.2248 23.0279C13.2451 24.2521 8.0545 26.7516 11.216 29.8794C12.7603 31.4073 14.4803 32.5 16.6427 32.5H28.9822C31.1446 32.5 32.8646 31.4073 34.409 29.8794C37.5704 26.7516 32.3798 24.2521 30.4001 23.0279C25.7577 20.1574 19.8672 20.1574 15.2248 23.0279Z" stroke={kleur} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M29.5937 8.28125C29.5937 12.0264 26.5577 15.0625 22.8125 15.0625C19.0673 15.0625 16.0312 12.0264 16.0312 8.28125C16.0312 4.53607 19.0673 1.5 22.8125 1.5C26.5577 1.5 29.5937 4.53607 29.5937 8.28125Z" stroke={kleur} strokeWidth="3"/>
    </svg>
  )
}

function IconMe({ kleur }: { kleur: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.88472 23.4111C8.28917 24.3273 4.10574 26.1979 6.65373 28.5387C7.8984 29.6821 9.28464 30.4999 11.0275 30.4999H20.9725C22.7154 30.4999 24.1016 29.6821 25.3463 28.5387C27.8943 26.1979 23.7108 24.3273 22.1153 23.4111C18.3738 21.2629 13.6262 21.2629 9.88472 23.4111Z" stroke={kleur} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21.075 13.1C21.075 15.9029 18.8029 18.175 16 18.175C13.1972 18.175 10.925 15.9029 10.925 13.1C10.925 10.2972 13.1972 8.02502 16 8.02502C18.8029 8.02502 21.075 10.2972 21.075 13.1Z" stroke={kleur} strokeWidth="3"/>
      <path d="M2.73831 21.8C1.94226 20.0112 1.5 18.0314 1.5 15.9486C1.5 7.96886 7.99187 1.5 16 1.5C24.0081 1.5 30.5 7.96886 30.5 15.9486C30.5 18.0314 30.0577 20.0112 29.2617 21.8" stroke={kleur} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

const STUDENT_NAV = [
  { label: 'home',            path: '/dashboard',  Icon: IconHome,      isActief: (p: string) => p === '/dashboard' },
  { label: 'practice studio', path: '/practice-studio', Icon: IconStudio, isActief: (p: string) => p.startsWith('/practice-studio') || p.startsWith('/studio') || p.startsWith('/quickplay') },
  { label: 'klasgroep',       path: '/sessies',    Icon: IconKlasgroep, isActief: (p: string) => p.startsWith('/sessies') },
  { label: 'me',              path: '/profiel',    Icon: IconMe,        isActief: (p: string) => p.startsWith('/profiel') },
]

const LERAAR_NAV = [
  { label: 'home',         path: '/dashboard',  Icon: IconHome,         isActief: (p: string) => p === '/dashboard' },
  { label: 'lesmateriaal', path: '/partituren', Icon: IconLesmateriaal, isActief: (p: string) => p.startsWith('/partituren') },
  { label: 'klasgroep',    path: '/venster',    Icon: IconKlasgroep,    isActief: (p: string) => p.startsWith('/venster') },
  { label: 'me',           path: '/profiel',    Icon: IconMe,           isActief: (p: string) => p.startsWith('/profiel') },
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

  const isStudent = rol !== 'leraar'
  const navBg = isStudent ? '#0766C6' : '#0D1B2A'
  const inactiefKleur = isStudent ? 'rgba(255,255,255,0.55)' : '#8FA3B8'

  return (
    <nav
      className="fixed bottom-0 z-50 flex items-center justify-around px-2"
      style={{
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        backgroundColor: navBg,
        height: `calc(72px + env(safe-area-inset-bottom, 0px))`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {nav.map(item => {
        const actief = item.isActief(pathname)
        const kleur = actief ? '#FF560D' : inactiefKleur
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className="flex flex-col items-center gap-1 flex-1 py-2 active:opacity-70 transition-opacity"
          >
            <item.Icon kleur={kleur} />
            <span
              className="font-apercu text-caption"
              style={{ color: kleur, fontWeight: actief ? 700 : 400 }}
            >
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
