import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { titel, componist } = await request.json()
    console.log('Ontvangen:', titel, componist)
    console.log('YouTube key aanwezig:', !!process.env.YOUTUBE_API_KEY)
    console.log('YouTube key start:', process.env.YOUTUBE_API_KEY?.substring(0, 8))

    return NextResponse.json({ 
      test: 'werkt',
      titel,
      componist 
    })
  } catch (error: any) {
    console.error('Fout:', error)
    return NextResponse.json({ fout: error.message })
  }
}