'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

// ─── Types ────────────────────────────────────────────────────────────────────

type Klas = { id: string; naam: string; leraar_id: string }

type StudentSessieCard = {
  type: 'sessie'
  id: string
  studentId: string
  studentNaam: string
  datum: string
  titel: string
  componist: string | null
  klasId: string | null
  klasNaam: string | null
  leraarNaam: string | null
  sessieCount: number
  duur: number
  bpm: number | null
  gevoel: string | null
}

type LeraarMateriaakCard = {
  type: 'materiaal'
  id: string
  leraarId: string
  leraarNaam: string
  datum: string
  titel: string
  componist: string | null
  klasId: string | null
  klasNaam: string | null
  isOpname?: boolean
}

type AchievementCard = {
  type: 'achievement'
  id: string
  studentId: string
  studentNaam: string
  datum: string
  milestone: number
  sessieCount: number
  klasId: string | null
  klasNaam: string | null
}

type FeedCard = StudentSessieCard | LeraarMateriaakCard | AchievementCard

function formateerDatum(datum: string): string {
  const d = new Date(datum)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function korteDatum(datum: string): string {
  const d = new Date(datum)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formateerDuur(sec: number): string {
  if (!sec) return ''
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  const uur = Math.floor(min / 60)
  const rest = min % 60
  return rest > 0 ? `${uur}u ${rest}min` : `${uur}u`
}

const GEVOEL_KLEUR: Record<string, { bg: string; text: string }> = {
  'Super goed!': { bg: 'rgba(34,197,94,0.2)', text: '#22C55E' },
  'Goed bezig':  { bg: 'rgba(7,102,198,0.2)', text: '#0766C6' },
  'Oké':         { bg: 'rgba(255,209,0,0.2)',  text: '#B8960A' },
  'Moeilijk':    { bg: 'rgba(239,68,68,0.2)',  text: '#EF4444' },
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconPersoon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  )
}

function IconMuziek() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="6"  x2="13" y2="6"  stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="10" x2="13" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="14" x2="10" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18.5" cy="17" r="2.5" fill="white" />
      <line x1="21" y1="17" x2="21" y2="9.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 9.5 L24 8.5 L24 12 L21 13" fill="white" stroke="none" />
    </svg>
  )
}

function IconOpname() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function IconBadge() {
  return (
    <svg width="34" height="34" viewBox="0 0 43 43" fill="none">
      <path
        d="M35.481 35.5H35.5M35.481 35.5C34.2356 36.735 31.9786 36.4274 30.3959 36.4274C28.453 36.4274 27.5174 36.8074 26.1309 38.194C24.9502 39.3747 23.3675 41.5 21.5 41.5C19.6326 41.5 18.0498 39.3748 16.8691 38.194C15.4826 36.8074 14.547 36.4274 12.6041 36.4274C11.0214 36.4274 8.76437 36.735 7.51898 35.5C6.26362 34.2551 6.57256 31.9888 6.57256 30.3958C6.57256 28.3828 6.13231 27.4572 4.69876 26.0237C2.56627 23.8912 1.50003 22.8249 1.5 21.5C1.50002 20.175 2.56625 19.1088 4.69871 16.9763C5.9784 15.6966 6.57256 14.4286 6.57256 12.6041C6.57256 11.0213 6.26499 8.76429 7.5 7.51889C8.74485 6.26357 11.0112 6.57251 12.6042 6.57251C14.4285 6.57251 15.6966 5.97841 16.9763 4.69874C19.1088 2.56625 20.175 1.5 21.5 1.5C22.825 1.5 23.8912 2.56625 26.0237 4.69874C27.3031 5.97813 28.5709 6.57251 30.3958 6.57251C31.9787 6.57251 34.2357 6.26494 35.4811 7.5C36.7364 8.74486 36.4274 11.0112 36.4274 12.6041C36.4274 14.6172 36.8677 15.5427 38.3013 16.9763C40.4338 19.1088 41.5 20.175 41.5 21.5C41.5 22.8249 40.4337 23.8912 38.3012 26.0237C36.8677 27.4572 36.4274 28.3829 36.4274 30.3958C36.4274 31.9888 36.7364 34.2551 35.481 35.5Z"
        fill="#FFD100" stroke="#E6BC00" strokeWidth="1.5"
      />
      <path
        d="M15.5 23.2857C15.5 23.2857 17.9 24.5893 19.1 26.5C19.1 26.5 22.7 19 27.5 16.5"
        stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function IconHart({ gevuld }: { gevuld: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24"
      fill={gevuld ? '#FF560D' : 'none'}
      stroke={gevuld ? '#FF560D' : 'rgba(255,255,255,0.5)'}
      strokeWidth="2" strokeLinecap="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconComment() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconBekijken() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#0766C6" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconOpslaan({ opgeslagen }: { opgeslagen: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24"
      fill={opgeslagen ? '#FFD100' : 'none'}
      stroke={opgeslagen ? '#FFD100' : 'rgba(255,255,255,0.5)'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconZoek() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#999" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function TagPill({ label, textKleur, bg }: { label: string; textKleur: string; bg: string }) {
  return (
    <span style={{
      fontFamily: 'var(--font-apercu)', fontSize: 11, fontWeight: 600,
      color: textKleur, backgroundColor: bg, borderRadius: 20, padding: '4px 10px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ─── Actie knop helper ────────────────────────────────────────────────────────

function ActieKnop({
  onClick, active, activeBg, children,
}: {
  onClick: () => void
  active?: boolean
  activeBg?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5, borderRadius: 20,
        backgroundColor: active ? (activeBg ?? 'rgba(255,255,255,0.08)') : 'transparent',
        transition: 'background-color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function ActieLabel({ children, kleur }: { children: React.ReactNode; kleur?: string }) {
  return (
    <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 11, fontWeight: 600, color: kleur ?? 'rgba(255,255,255,0.5)' }}>
      {children}
    </span>
  )
}

function CommentInput({ accentKleur, onStuur }: { accentKleur: string; onStuur: () => void }) {
  const [tekst, setTekst] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 2 }}>
      <input
        type="text"
        placeholder="Schrijf een reactie..."
        value={tekst}
        onChange={e => setTekst(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && tekst.trim()) { setTekst(''); onStuur() } }}
        autoFocus
        style={{
          flex: 1, border: 'none', outline: 'none',
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 20, padding: '8px 14px',
          fontFamily: 'var(--font-apercu)', fontSize: 13, color: '#fff',
        }}
      />
      <button
        onClick={() => { if (tekst.trim()) { setTekst(''); onStuur() } }}
        style={{
          backgroundColor: accentKleur, border: 'none', cursor: 'pointer',
          borderRadius: 20, padding: '8px 16px',
          fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 12, color: '#fff',
          flexShrink: 0,
        }}
      >
        Stuur
      </button>
    </div>
  )
}

// ─── Feed Card Components ──────────────────────────────────────────────────────

function SessieKaart({ kaart, onBekijken }: { kaart: StudentSessieCard; onBekijken?: () => void }) {
  const [gelikt, setGelikt] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)
  const gevoelKleur = kaart.gevoel ? (GEVOEL_KLEUR[kaart.gevoel] ?? { bg: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.6)' }) : null
  const duurTekst = kaart.duur > 0 ? formateerDuur(kaart.duur) : null

  return (
    <div style={{ backgroundColor: '#0D1B2A', borderRadius: 16, borderLeft: '4px solid #0766C6', overflow: 'hidden' }}>
      {/* Blauwe header strip */}
      <div style={{ backgroundColor: 'rgba(7,102,198,0.12)', padding: '8px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0766C6" strokeWidth="2.5" strokeLinecap="round">
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
        <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 10, fontWeight: 700, color: '#0766C6', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Oefensessie
        </span>
      </div>

      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Bovenste rij */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: '#0766C6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconPersoon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 600, fontSize: 13, color: 'white', margin: 0, lineHeight: 1.3 }}>
              {kaart.studentNaam}{' '}
              <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400, fontSize: 12 }}>{formateerDatum(kaart.datum)}</span>
            </p>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: 'white', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              &ldquo;{kaart.titel}&rdquo;
              {kaart.componist ? <span style={{ fontWeight: 500, fontStyle: 'normal', color: 'rgba(255,255,255,0.75)' }}> {kaart.componist}</span> : null}
            </p>
            {(kaart.klasNaam || kaart.leraarNaam) && (
              <p style={{ fontFamily: 'var(--font-apercu)', fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {kaart.klasNaam ? `Klas ${kaart.klasNaam}` : ''}{kaart.klasNaam && kaart.leraarNaam ? ' · ' : ''}{kaart.leraarNaam ?? ''}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        {(duurTekst || kaart.bpm || kaart.gevoel) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {duurTekst && (
              <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {duurTekst}
              </span>
            )}
            {kaart.bpm && (
              <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                {kaart.bpm} bpm
              </span>
            )}
            {kaart.gevoel && gevoelKleur && (
              <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 10, fontWeight: 600, color: gevoelKleur.text, backgroundColor: gevoelKleur.bg, borderRadius: 20, padding: '2px 8px' }}>
                {kaart.gevoel}
              </span>
            )}
          </div>
        )}

        {/* Acties */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ActieKnop onClick={() => onBekijken?.()} activeBg="rgba(7,102,198,0.15)">
              <IconBekijken />
              <ActieLabel kleur="#0766C6">Bekijken</ActieLabel>
            </ActieKnop>
            <ActieKnop onClick={() => setGelikt(v => !v)} active={gelikt} activeBg="rgba(255,86,13,0.12)">
              <IconHart gevuld={gelikt} />
            </ActieKnop>
            <ActieKnop onClick={() => setCommentOpen(v => !v)} active={commentOpen}>
              <IconComment />
              <ActieLabel>Reageren</ActieLabel>
            </ActieKnop>
          </div>
          {kaart.klasNaam && (
            <TagPill label={kaart.klasNaam} textKleur="rgba(255,255,255,0.7)" bg="rgba(255,255,255,0.1)" />
          )}
        </div>

        {commentOpen && <CommentInput accentKleur="#0766C6" onStuur={() => setCommentOpen(false)} />}
      </div>
    </div>
  )
}

function LeraarMateriaalkKaart({ kaart }: { kaart: LeraarMateriaakCard }) {
  const [gelikt, setGelikt] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)

  const kleur = kaart.isOpname ? '#FFD100' : '#FF560D'
  const kleurBg = kaart.isOpname ? 'rgba(255,209,0,0.1)' : 'rgba(255,86,13,0.1)'

  return (
    <div style={{ backgroundColor: '#0D1B2A', borderRadius: 16, borderLeft: `4px solid ${kleur}`, overflow: 'hidden' }}>
      {/* Header strip */}
      <div style={{ backgroundColor: kleurBg, padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {kaart.isOpname ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth="2.5" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth="2.5" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          )}
          <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 10, fontWeight: 700, color: kleur, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {kaart.isOpname ? 'Opname · Lesmateriaal' : 'Nieuw lesmateriaal'}
          </span>
        </div>
        {kaart.isOpname && (
          <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 10, fontWeight: 700, color: kleur, backgroundColor: 'rgba(255,209,0,0.2)', borderRadius: 20, padding: '2px 8px' }}>
            Opname
          </span>
        )}
      </div>

      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: kleur, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {kaart.isOpname ? <IconOpname /> : <IconMuziek />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.3 }}>
              {kaart.leraarNaam} · {korteDatum(kaart.datum)}
            </p>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, fontStyle: 'italic', fontSize: 14, color: 'white', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              &ldquo;{kaart.titel}&rdquo;
              {kaart.componist ? <span style={{ fontWeight: 500, fontStyle: 'normal', color: 'rgba(255,255,255,0.75)' }}> {kaart.componist}</span> : null}
            </p>
          </div>
        </div>

        {/* Acties */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ActieKnop onClick={() => setOpgeslagen(v => !v)} active={opgeslagen} activeBg="rgba(255,209,0,0.12)">
              <IconOpslaan opgeslagen={opgeslagen} />
              <ActieLabel kleur={opgeslagen ? '#FFD100' : undefined}>Opslaan</ActieLabel>
            </ActieKnop>
            <ActieKnop onClick={() => setGelikt(v => !v)} active={gelikt} activeBg="rgba(255,86,13,0.12)">
              <IconHart gevuld={gelikt} />
            </ActieKnop>
            <ActieKnop onClick={() => setCommentOpen(v => !v)} active={commentOpen}>
              <IconComment />
              <ActieLabel>Reageren</ActieLabel>
            </ActieKnop>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {kaart.klasNaam && (
              <TagPill label={kaart.klasNaam} textKleur="rgba(255,255,255,0.7)" bg="rgba(255,255,255,0.1)" />
            )}
            <TagPill label="Docent" textKleur="#FF560D" bg="rgba(255,86,13,0.15)" />
          </div>
        </div>

        {commentOpen && <CommentInput accentKleur="#FF560D" onStuur={() => setCommentOpen(false)} />}
      </div>
    </div>
  )
}

function AchievementKaart({ kaart }: { kaart: AchievementCard }) {
  const [gelikt, setGelikt] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)

  const milestoneLabel: Record<number, string> = {
    1: 'Eerste stap!', 5: 'Op dreef!', 10: 'Repetition queen!', 25: 'Muziekkampioen!',
  }

  return (
    <div style={{ backgroundColor: '#0D1B2A', borderRadius: 16, borderLeft: '4px solid #FFD100', overflow: 'hidden' }}>
      <div style={{ backgroundColor: 'rgba(255,209,0,0.1)', padding: '8px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFD100" stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span style={{ fontFamily: 'var(--font-apercu)', fontSize: 10, fontWeight: 700, color: '#FFD100', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Achievement unlocked
        </span>
      </div>

      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: 'rgba(255,209,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconBadge />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 600, fontSize: 13, color: 'white', margin: 0, lineHeight: 1.3 }}>
              {kaart.studentNaam}{' '}
              <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400, fontSize: 12 }}>{formateerDatum(kaart.datum)}</span>
            </p>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: '#FFD100', margin: '4px 0 0' }}>
              {milestoneLabel[kaart.milestone] ?? `${kaart.milestone} sessies!`}
            </p>
            <p style={{ fontFamily: 'var(--font-apercu)', fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '3px 0 0' }}>
              New achievement unlocked · <span style={{ color: '#FFD100' }}>{kaart.sessieCount} sessies</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ActieKnop onClick={() => setGelikt(v => !v)} active={gelikt} activeBg="rgba(255,86,13,0.12)">
              <IconHart gevuld={gelikt} />
            </ActieKnop>
            <ActieKnop onClick={() => setCommentOpen(v => !v)} active={commentOpen}>
              <IconComment />
              <ActieLabel>Reageren</ActieLabel>
            </ActieKnop>
          </div>
          {kaart.klasNaam && (
            <TagPill label={kaart.klasNaam} textKleur="rgba(255,255,255,0.7)" bg="rgba(255,255,255,0.1)" />
          )}
        </div>

        {commentOpen && <CommentInput accentKleur="#FFD100" onStuur={() => setCommentOpen(false)} />}
      </div>
    </div>
  )
}

// ─── Fictieve leraar-items ─────────────────────────────────────────────────────

const FICTIEVE_FEED_ITEMS: FeedCard[] = [
  {
    type: 'materiaal', id: 'fict-mat-1', leraarId: 'fict-1',
    leraarNaam: "Lukas D'hondt",
    datum: new Date(Date.now() - 2 * 86400000).toISOString(),
    titel: "Knockin' On Heaven's Door", componist: 'Bob Dylan',
    klasId: null, klasNaam: '2A', isOpname: false,
  },
  {
    type: 'materiaal', id: 'fict-mat-2', leraarId: 'fict-2',
    leraarNaam: 'H. Jacobs',
    datum: new Date(Date.now() - 5 * 86400000).toISOString(),
    titel: "Knockin' On Heaven's Door", componist: 'Bob Dylan',
    klasId: null, klasNaam: '1A', isOpname: true,
  },
  {
    type: 'materiaal', id: 'fict-mat-3', leraarId: 'fict-3',
    leraarNaam: 'G. Jansen',
    datum: new Date(Date.now() - 10 * 86400000).toISOString(),
    titel: "Friday I'm In Love", componist: 'The Cure',
    klasId: null, klasNaam: '3C', isOpname: false,
  },
]

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function KlasgroepPage() {
  const [loading, setLoading] = useState(true)
  const [feed, setFeed] = useState<FeedCard[]>([])
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [geenKlassen, setGeenKlassen] = useState(false)
  const [zoekterm, setZoekterm] = useState('')
  const [actieveFilter, setActieveFilter] = useState<string>('all')

  const router = useRouter()

  useEffect(() => {
    const laadData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }

      const res = await fetch('/api/klasgroep-feed', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) { router.push('/auth/login'); return }

      const data = await res.json()
      setGeenKlassen(data.geenKlassen ?? false)
      setKlassen(data.klassen ?? [])
      const gecombineerd = [...FICTIEVE_FEED_ITEMS, ...(data.feed ?? [])]
        .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
      setFeed(gecombineerd)
      setLoading(false)
    }

    laadData()
  }, [router])

  const filterPills = [
    { id: 'all', label: 'All' },
    ...klassen.map((k) => ({ id: k.id, label: k.naam })),
    { id: 'docenten', label: 'Docenten' },
    { id: 'nieuwste', label: 'Nieuwste' },
  ]

  const zoekLower = zoekterm.toLowerCase()
  const gefilterdeeFeed = feed.filter((kaart) => {
    if (zoekterm) {
      let zoekVeld = ''
      if (kaart.type === 'sessie') zoekVeld = `${kaart.titel} ${kaart.studentNaam} ${kaart.componist ?? ''}`
      else if (kaart.type === 'materiaal') zoekVeld = `${kaart.titel} ${kaart.leraarNaam} ${kaart.componist ?? ''}`
      else if (kaart.type === 'achievement') zoekVeld = kaart.studentNaam
      if (!zoekVeld.toLowerCase().includes(zoekLower)) return false
    }
    if (actieveFilter === 'all' || actieveFilter === 'nieuwste') return true
    if (actieveFilter === 'docenten') return kaart.type === 'materiaal'
    return kaart.klasId === actieveFilter
  })

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-apercu)', color: '#8FA3B8' }}>Laden...</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0D1B2A', paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', paddingLeft: 20, paddingRight: 20, paddingTop: 'calc(env(safe-area-inset-top, 16px) + 16px)' }}>

        <h1 style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 32, color: '#0766C6', margin: '0 0 16px' }}>
          Klasgroep
        </h1>

        {/* Twee segment knoppen */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{
            flex: 1, borderRadius: 999, padding: '14px 0', textAlign: 'center',
            backgroundColor: '#0766C6', fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 14, color: '#fff',
          }}>
            Activiteiten bekijken
          </div>
          <button
            onClick={() => router.push('/venster')}
            style={{
              flex: 1, borderRadius: 999, padding: '14px 0', textAlign: 'center',
              backgroundColor: '#FF560D', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 14, color: '#fff',
            }}
          >
            Classview →
          </button>
        </div>

        {/* Zoekbalk */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 28, height: 48, padding: '0 16px', marginBottom: 14,
        }}>
          <IconZoek />
          <input
            type="text"
            placeholder="Search"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'var(--font-apercu)', fontSize: 15, color: '#fff', backgroundColor: 'transparent' }}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 20, scrollbarWidth: 'none' }}>
          {filterPills.map((pill) => {
            const geselecteerd = actieveFilter === pill.id
            return (
              <button key={pill.id} onClick={() => setActieveFilter(pill.id)} style={{
                flexShrink: 0, borderRadius: 999, padding: '7px 16px', fontSize: 13,
                fontFamily: 'var(--font-apercu)', fontWeight: geselecteerd ? 700 : 500,
                cursor: 'pointer', border: 'none',
                backgroundColor: geselecteerd ? '#FF560D' : '#0D1B2A',
                color: 'white',
                outline: geselecteerd ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
              }}>
                {pill.label}
              </button>
            )
          })}
        </div>

        {geenKlassen && (
          <div style={{ backgroundColor: 'rgba(7,102,198,0.15)', border: '1px solid rgba(7,102,198,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0766C6" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ fontFamily: 'var(--font-apercu)', fontSize: 13, color: '#8FA3B8', margin: 0 }}>
              Vraag je leraar om je toe te voegen aan een klas om klasgenoten te zien.
            </p>
          </div>
        )}

        {gefilterdeeFeed.length === 0 ? (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-apercu)', fontWeight: 700, fontSize: 16, color: '#fff', margin: '0 0 8px' }}>Geen activiteit gevonden</p>
            <p style={{ fontFamily: 'var(--font-apercu)', fontSize: 14, color: '#8FA3B8', margin: 0 }}>
              {zoekterm ? 'Probeer een andere zoekterm.' : actieveFilter === 'docenten' ? 'Geen lesmateriaal gevonden.' : 'Er is nog geen activiteit in deze groep.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gefilterdeeFeed.map((kaart) => {
              if (kaart.type === 'sessie') return (
                <SessieKaart
                  key={kaart.id}
                  kaart={kaart}
                  onBekijken={() => router.push(`/sessies/${kaart.id}`)}
                />
              )
              if (kaart.type === 'materiaal') return <LeraarMateriaalkKaart key={kaart.id} kaart={kaart} />
              if (kaart.type === 'achievement') return <AchievementKaart key={kaart.id} kaart={kaart} />
              return null
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
