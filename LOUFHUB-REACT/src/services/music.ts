const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

export type Track = {
  trackId: number
  title: string
  artist: string
  album: string
  artwork: string
  previewUrl: string
  trackUrl: string
}

type ITunesResponse = {
  resultCount?: number
  results?: {
    trackId: number
    trackName: string
    artistName: string
    collectionName?: string
    artworkUrl100?: string
    previewUrl?: string
    trackViewUrl?: string
  }[]
}

export const MUSIC_PAGE_SIZE = 20

export async function searchTracks(query: string, offset = 0) {
  const params = new URLSearchParams({
    term: query.trim() || 'top music',
    entity: 'song',
    limit: String(MUSIC_PAGE_SIZE),
    offset: String(offset),
  })
  const response = await fetch(`${ITUNES_SEARCH_URL}?${params}`)
  if (!response.ok) throw new Error(`iTunes search failed (${response.status})`)

  const data = await response.json() as ITunesResponse
  const tracks = (data.results || [])
    .filter(track => track.previewUrl && track.trackId && track.trackName && track.artistName)
    .map(track => ({
      trackId: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName || 'Single',
      artwork: track.artworkUrl100 || '',
      previewUrl: track.previewUrl!,
      trackUrl: track.trackViewUrl || '',
    }))
  return { tracks, resultCount: data.resultCount || 0 }
}
