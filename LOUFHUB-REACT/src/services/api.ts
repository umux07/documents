const TMDB_BASE = 'https://api.themoviedb.org/3'
const ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN?.trim()
const API_KEY = import.meta.env.VITE_TMDB_API_KEY?.trim()

async function request(path: string) {
  if (!ACCESS_TOKEN && !API_KEY) {
    throw new Error('TMDB credentials are missing. Add VITE_TMDB_ACCESS_TOKEN or VITE_TMDB_API_KEY to your .env file, then restart the development server.')
  }

  const separator = path.includes('?') ? '&' : '?'
  const credentials = ACCESS_TOKEN ? '' : `${separator}api_key=${encodeURIComponent(API_KEY!)}`
  const response = await fetch(`${TMDB_BASE}${path}${credentials}`, {
    headers: ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : undefined,
  })
  if (!response.ok) {
    let detail = `TMDB request failed (${response.status})`
    try {
      const body = await response.json()
      detail = body.status_message || detail
    } catch { /* Keep the HTTP error message. */ }
    throw new Error(detail)
  }
  return response.json()
}

export type MovieCategory = 'popular' | 'trending' | 'top-rated' | 'upcoming' | 'now-playing'

export function getMovies(category: MovieCategory = 'popular') {
  return getMoviesPage(category, 1)
}

export function getMoviesPage(category: MovieCategory, page: number) {
  const paths: Record<MovieCategory, string> = {
    popular: `/movie/popular?page=${page}`,
    trending: `/trending/movie/week?page=${page}`,
    'top-rated': `/movie/top_rated?page=${page}`,
    upcoming: `/movie/upcoming?page=${page}`,
    'now-playing': `/movie/now_playing?page=${page}`,
  }
  return request(paths[category])
}

export function getMovieDetails(id: number) {
  return request(`/movie/${id}?append_to_response=videos,recommendations`)
}

export function searchMovies(query: string) {
  return request(`/search/movie?query=${encodeURIComponent(query)}`)
}

export type WatchProvider = { provider_id: number; provider_name: string; logo_path: string | null }
export type WatchProviderRegion = {
  link?: string
  flatrate?: WatchProvider[]
  rent?: WatchProvider[]
  buy?: WatchProvider[]
  free?: WatchProvider[]
  ads?: WatchProvider[]
}

export function getMovieWatchProviders(id: number) {
  return request(`/movie/${id}/watch/providers`) as Promise<{ results?: Record<string, WatchProviderRegion> }>
}

export type FootballMatch = {
  id: string
  league: string
  home: string
  away: string
  homeScore: string
  awayScore: string
  status: string
  date: string
}

export type FootballResult = { matches: FootballMatch[]; errors: string[] }

const footballLeagues = [
  { id: 'eng.1', name: 'Premier League' },
  { id: 'esp.1', name: 'La Liga' },
  { id: 'ger.1', name: 'Bundesliga' },
  { id: 'ita.1', name: 'Serie A' },
  { id: 'fra.1', name: 'Ligue 1' },
  { id: 'uefa.champions', name: 'UEFA Champions League' },
]

export async function getFootballMatches(): Promise<FootballResult> {
  const results = await Promise.allSettled(footballLeagues.map(async league => {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard`)
    if (!response.ok) throw new Error(`${league.name} scoreboard request failed (${response.status})`)
    const data = await response.json()
    const events = Array.isArray(data.events) ? data.events : []
    return events.map((event: any): FootballMatch => {
      const competition = event.competitions?.[0]
      const competitors = Array.isArray(competition?.competitors) ? competition.competitors : []
      const home = competitors.find((team: any) => team.homeAway === 'home')
      const away = competitors.find((team: any) => team.homeAway === 'away')
      return {
        id: `${league.id}-${event.id}`,
        league: league.name,
        home: home?.team?.displayName || 'Home team',
        away: away?.team?.displayName || 'Away team',
        homeScore: home?.score ?? '–',
        awayScore: away?.score ?? '–',
        status: competition?.status?.type?.shortDetail || event.status?.type?.shortDetail || 'Scheduled',
        date: event.date || '',
      }
    })
  }))

  const matches: FootballMatch[] = []
  const errors: string[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') matches.push(...result.value)
    else errors.push(`${footballLeagues[index].name}: ${result.reason instanceof Error ? result.reason.message : 'request failed'}`)
  })
  if (errors.length === footballLeagues.length) throw new Error('Football scoreboards are unavailable. Check your connection and try again.')
  matches.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  return { matches, errors }
}
