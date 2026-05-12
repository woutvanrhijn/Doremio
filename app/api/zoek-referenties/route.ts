import { NextRequest, NextResponse } from 'next/server'

function parseDuurNaarMinuten(duur: string): number {
  const match = duur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 999
  const uren = parseInt(match[1] || '0')
  const minuten = parseInt(match[2] || '0')
  return uren * 60 + minuten
}

async function haalVideoDetails(videoIds: string, apiKey: string) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'contentDetails,snippet')
  url.searchParams.set('id', videoIds)
  url.searchParams.set('key', apiKey)
  const res = await fetch(url.toString())
  const data = await res.json()
  return data.items || []
}

async function zoekUitvoeringen(titel: string, componist: string, apiKey: string) {
  const query = componist ? `${titel} ${componist}` : titel
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '10')
  url.searchParams.set('relevanceLanguage', 'nl')
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())
  const data = await res.json()
  if (!res.ok || !data.items) return []

  const ids = data.items.map((i: any) => i.id.videoId).join(',')
  const details = await haalVideoDetails(ids, apiKey)

  return details
    .filter((item: any) => {
      const minuten = parseDuurNaarMinuten(item.contentDetails.duration)
      return minuten >= 2 && minuten <= 12
    })
    .slice(0, 3)
    .map((item: any) => ({
      categorie: 'uitvoering',
      titel: item.snippet.title,
      kanaal: item.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      thumbnail: item.snippet.thumbnails?.medium?.url || ''
    }))
}

async function zoekShorts(titel: string, componist: string, apiKey: string) {
  // #shorts in query zorgt dat YouTube Shorts bovenaan rankt
  const query = componist
    ? `${titel} ${componist} #shorts`
    : `${titel} #shorts`
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', '10')
  url.searchParams.set('relevanceLanguage', 'nl')
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString())
  const data = await res.json()
  if (!res.ok || !data.items) return []

  const ids = data.items.map((i: any) => i.id.videoId).join(',')
  const details = await haalVideoDetails(ids, apiKey)

  return details
    .filter((item: any) => {
      // Echte Shorts zijn max 60 seconden
      const minuten = parseDuurNaarMinuten(item.contentDetails.duration)
      return minuten <= 1
    })
    .slice(0, 3)
    .map((item: any) => ({
      categorie: 'short',
      titel: item.snippet.title,
      kanaal: item.snippet.channelTitle,
      url: `https://www.youtube.com/shorts/${item.id}`,
      thumbnail: item.snippet.thumbnails?.medium?.url || ''
    }))
}

export async function POST(request: NextRequest) {
  try {
    const { titel, componist } = await request.json()
    if (!titel) return NextResponse.json({ links: [] })

    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      console.error('Geen YouTube API key')
      return NextResponse.json({ links: [] })
    }

    const [uitvoeringen, shorts] = await Promise.all([
      zoekUitvoeringen(titel, componist, apiKey),
      zoekShorts(titel, componist, apiKey)
    ])

    const links = [...uitvoeringen, ...shorts]
    return NextResponse.json({ links })

  } catch (error: any) {
    console.error('Fout bij zoeken referenties:', error)
    return NextResponse.json({ links: [] })
  }
}