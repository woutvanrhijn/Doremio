import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { naam, instrument, niveau, sessies } = await request.json()

    const totaalMinuten = Math.round((sessies || []).reduce((a: number, s: any) => a + (s.duur || 0), 0) / 60)
    const recenteSessies = (sessies || []).slice(0, 5)
    const gevoelens = (sessies || []).map((s: any) => s.gevoel).filter(Boolean)
    const moeilijkCount = gevoelens.filter((g: string) => g === 'Moeilijk').length
    const supergoodCount = gevoelens.filter((g: string) => g === 'Super goed!').length

    const reflecties = recenteSessies.map((s: any) =>
      `- tops: "${s.tops || '-'}" | tips: "${s.tips || '-'}" | gevoel: "${s.gevoel || '-'}"`
    ).join('\n') || 'Geen recente reflecties.'

    const niveauLabel = ['Beginner', 'Gevorderd beginner', 'Intermediate', 'Gevorderd', 'Expert'][niveau - 1] || 'Intermediate'

    const prompt = `Je bent een muziekpedagoog die een beknopt oefenprofiel opstelt voor een instrumentleraar.

Student: ${naam}
Instrument: ${instrument}
Niveau: ${niveauLabel} (${niveau}/5)
Totaal geoefend: ${totaalMinuten} minuten over ${sessies?.length || 0} sessies
Gevoelsverdeling: ${supergoodCount}× "Super goed", ${moeilijkCount}× "Moeilijk"

Recente reflecties:
${reflecties}

Schrijf een kort oefenprofiel (max 100 woorden) voor de leraar met:
1. Oefenpatroon (frequentie en duur)
2. Sterktes op basis van de tops
3. Aandachtspunten op basis van tips en gevoel
4. Concrete aanbeveling voor de leraar

Schrijf in het Nederlands, professioneel maar toegankelijk. Geen bulletpoints, vloeiende tekst.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })

    const tekst = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ profiel: tekst })
  } catch (error) {
    console.error('Oefenprofiel fout:', error)
    return NextResponse.json({ profiel: 'Oefenprofiel kon niet worden gegenereerd.' })
  }
}
