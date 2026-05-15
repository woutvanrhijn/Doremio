import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { instrument, niveau, recenteSessies, partituurTitel, partituurComponist } = await request.json()

    const niveauLabel = ['Beginner', 'Gevorderd beginner', 'Intermediate', 'Gevorderd', 'Expert'][niveau - 1] || 'Intermediate'

    const recentContext = (recenteSessies || []).slice(0, 3).map((s: any, i: number) =>
      `Sessie ${i + 1}: tops="${s.tops || '-'}", tips="${s.tips || '-'}", gevoel="${s.gevoel || '-'}"`
    ).join('\n') || 'Geen recente sessies.'

    const prompt = `Je bent een motiverende muziekcoach voor jongeren in het DKO (deeltijds kunstonderwijs).

Student speelt ${instrument} op niveau ${niveauLabel} (${niveau}/5).
Partituur: ${partituurTitel}${partituurComponist ? ` van ${partituurComponist}` : ''}

Recente sessie-reflecties van de student:
${recentContext}

Genereer exact 2 concrete, haalbare oefenchallenges voor deze sessie.
Regels:
- Aansluitend bij het niveau ${niveau}/5 (${niveauLabel})
- Gebaseerd op wat de student aangeeft als verbeterpunt
- Speels en motiverend voor jongeren
- Specifiek en meetbaar — niet "oefen beter" maar "speel maat 4-8 drie keer achter elkaar zonder stoppen"
- Kort: maximaal 2 zinnen per challenge

Geef je antwoord als JSON array: [{"challenge": "..."}, {"challenge": "..."}]`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }]
    })

    const tekst = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const clean = tekst.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)

    return NextResponse.json(data)
  } catch (error) {
    console.error('Challenges genereren fout:', error)
    return NextResponse.json([
      { challenge: 'Speel het stuk van begin tot einde zonder te stoppen, ook als je een foutje maakt.' },
      { challenge: 'Kies één moeilijk fragment en speel het vijf keer langzaam, daarna vijf keer op tempo.' }
    ])
  }
}
