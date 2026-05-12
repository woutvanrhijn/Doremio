import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { titel, componist, duur, bpm, antwoorden } = await request.json()

    const prompt = `Je bent een warme, motiverende muziekleraar voor jongeren in het DKO (deeltijds kunstonderwijs). 
Een student heeft net een oefensessie afgerond en heeft drie reflectievragen beantwoord.

Partituur: ${titel}${componist ? ` van ${componist}` : ''}
Sessieduur: ${Math.floor(duur / 60)} minuten ${duur % 60} seconden
Metronoom: ${bpm} BPM

Reflecties van de student:
1. Wat ging goed vandaag? → "${antwoorden.tops}"
2. Wat wil je verbeteren? → "${antwoorden.tips}"  
3. Hoe voelde de sessie aan? → "${antwoorden.gevoel}"

Geef een korte, persoonlijke reactie in 3 delen:
1. **Tops** (wat ging goed, bevestig dit concreet)
2. **Tips** (1-2 concrete oefentips voor volgende sessie)
3. **Motivatie** (één zin die de student aanmoedigt)

Schrijf in het Nederlands, warm en direct. Geen lange teksten. Max 100 woorden totaal.
Geef je antwoord als JSON: {"tops": "...", "tips": "...", "motivatie": "..."}`

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })

    const tekst = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const clean = tekst.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Feedback fout:', error)
    return NextResponse.json({
      tops: 'Goed bezig met deze oefensessie!',
      tips: 'Probeer volgende keer een klein fragment te herhalen tot het vlot gaat.',
      motivatie: 'Elke sessie telt — je wordt beter met elke minuut die je oefent.'
    })
  }
}