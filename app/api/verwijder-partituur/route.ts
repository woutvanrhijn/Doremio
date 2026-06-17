import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function storageSleutelVan(url: string | null): string | null {
  if (!url) return null
  const marker = '/storage/v1/object/public/partituren/'
  const idx = url.indexOf(marker)
  return idx !== -1 ? decodeURIComponent(url.slice(idx + marker.length)) : null
}

export async function DELETE(req: NextRequest) {
  const { partituurId, leraarId } = await req.json()

  if (!partituurId || !leraarId) {
    return NextResponse.json({ error: 'Ontbrekende parameters' }, { status: 400 })
  }

  // Verifieer eigenaarschap
  const { data: partituur, error: ophaalFout } = await admin
    .from('partituren')
    .select('id, bestand_url, leraar_audio_url, leraar_id')
    .eq('id', partituurId)
    .single()

  if (ophaalFout || !partituur) {
    return NextResponse.json({ error: 'Partituur niet gevonden' }, { status: 404 })
  }
  if (partituur.leraar_id !== leraarId) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  // Koppel oefensessies los
  await admin.from('oefensessies').update({ partituur_id: null }).eq('partituur_id', partituurId)

  // Verwijder annotaties
  await admin.from('annotaties').delete().eq('partituur_id', partituurId)

  // Verwijder bestanden uit Storage
  const teVerwijderen: string[] = []
  const bestandSleutel = storageSleutelVan(partituur.bestand_url)
  const audioSleutel = storageSleutelVan(partituur.leraar_audio_url)
  if (bestandSleutel) teVerwijderen.push(bestandSleutel)
  if (audioSleutel) teVerwijderen.push(audioSleutel)
  if (teVerwijderen.length > 0) {
    await admin.storage.from('partituren').remove(teVerwijderen)
  }

  // Verwijder de partituur
  const { error } = await admin.from('partituren').delete().eq('id', partituurId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
