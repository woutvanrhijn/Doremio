import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { bestand, type } = await request.json()

    const base64Data = bestand.split(',')[1]
    const mediaType = type.startsWith('image') ? type : 'image/jpeg'

    let content: any[]

    if (type === 'application/pdf') {
      content = [
        {
          type: 'text',
          text: 'Dit is een partituur. Geef me enkel de titel en componist terug in JSON formaat: {"titel": "...", "componist": "..."}. Als je ze niet kan vinden, geef dan lege strings terug.'
        }
      ]
    } else {
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
          text: 'Dit is een foto van een muziekpartituur. Geef me enkel de titel en componist terug in JSON formaat: {"titel": "...", "componist": "..."}. Als je ze niet kan vinden, geef dan lege strings terug. Geef enkel de JSON terug, geen andere tekst.'
        }
      ]
    }

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content }]
    })

    const tekst = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const clean = tekst.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)

    return NextResponse.json(data)
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ titel: '', componist: '' })
  }
}