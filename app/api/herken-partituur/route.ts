import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { bestand, type } = await request.json()
    const base64Data = bestand.includes(',') ? bestand.split(',')[1] : bestand

    let content: any[]

    if (type === 'application/pdf') {
      content = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64Data
          }
        },
        {
          type: 'text',
          text: 'Dit is een muziekpartituur. Zoek de titel van het muziekstuk en de naam van de componist op de eerste pagina. Geef enkel JSON terug: {"titel": "...", "componist": "..."}. Geen andere tekst.'
        }
      ]
    } else {
      const mediaType = type.startsWith('image/') ? type : 'image/jpeg'
      content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data
          }
        },
        {
          type: 'text',
          text: 'Dit is een foto van een muziekpartituur. Zoek de titel en componist. Geef enkel JSON terug: {"titel": "...", "componist": "..."}. Geen andere tekst.'
        }
      ]
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 150,
      messages: [{ role: 'user', content }]
    })

    const tekst = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const clean = tekst.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Fout bij herkennen:', error)
    return NextResponse.json({ titel: '', componist: '' })
  }
}