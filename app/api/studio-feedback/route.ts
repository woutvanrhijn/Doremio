import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { titel, componist, duur, bpm, antwoorden, studentId, huidigNiveau } = await request.json()
    const niveau = huidigNiveau || 3

    const prompt = `Je bent een warme, motiverende muziekleraar voor jongeren in het DKO (deeltijds kunstonderwijs).
Een student heeft net een oefensessie afgerond en heeft drie reflectievragen beantwoord.

Partituur: ${titel}${componist ? ` van ${componist}` : ''}
Sessieduur: ${Math.floor(duur / 60)} minuten ${duur % 60} seconden
Metronoom: ${bpm} BPM
Huidig niveau: ${niveau}/5

Reflecties van de student:
1. Wat ging goed vandaag? → "${antwoorden.tops}"
2. Wat wil je verbeteren? → "${antwoorden.tips}"
3. Hoe voelde de sessie aan? → "${antwoorden.gevoel}"

Geef feedback in 3 delen én een niveaubeoordeling:
- **Tops**: bevestig concreet wat goed ging
- **Tips**: 1-2 concrete oefentips voor volgende sessie
- **Motivatie**: één aanmoedigende zin

Niveaubeoordeling (niveau_delta):
- +1 als gevoel "Super goed!" is én de tops sterk zijn
- -1 als gevoel "Moeilijk" is én tips aangeven dat veel moeite kost
- 0 in alle andere gevallen

Schrijf in het Nederlands, warm en direct. Max 100 woorden totaal voor tops/tips/motivatie.
Geef je antwoord als JSON: {"tops": "...", "tips": "...", "motivatie": "...", "niveau_delta": 0}`

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }]
    })

    const tekst = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const clean = tekst.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)

    if (studentId && typeof data.niveau_delta === 'number') {
      const nieuwNiveau = Math.min(5, Math.max(1, niveau + data.niveau_delta))
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      await admin.from('profiles').update({ niveau: nieuwNiveau }).eq('id', studentId)
      data.nieuw_niveau = nieuwNiveau
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Feedback fout:', error)
    return NextResponse.json({
      tops: 'Goed bezig met deze oefensessie!',
      tips: 'Probeer volgende keer een klein fragment te herhalen tot het vlot gaat.',
      motivatie: 'Elke sessie telt — je wordt beter met elke minuut die je oefent.',
      niveau_delta: 0
    })
  }
}
