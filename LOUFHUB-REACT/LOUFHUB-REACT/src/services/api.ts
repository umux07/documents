const TMDB_BASE = 'https://api.themoviedb.org/3'
const API_KEY = import.meta.env.VITE_TMDB_API_KEY?.trim()

async function request(path: string) {
  if (!API_KEY) {
    throw new Error('TMDB API key is missing. Add VITE_TMDB_API_KEY to your .env file, then restart the development server.')
  }

  const separator = path.includes('?') ? '&' : '?'
  const response = await fetch(`${TMDB_BASE}${path}${separator}api_key=${encodeURIComponent(API_KEY)}`)
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
  const paths: Record<MovieCategory, string> = {
    popular: '/movie/popular',
    trending: '/trending/movie/week',
    'top-rated': '/movie/top_rated',
    upcoming: '/movie/upcoming',
    'now-playing': '/movie/now_playing',
  }
  return request(paths[category])
}

export function getMovieDetails(id: number) {
  return request(`/movie/${id}?append_to_response=videos,recommendations`)
}

export function searchMovies(query: string) {
  return request(`/search/movie?query=${encodeURIComponent(query)}`)
}

// The football screen remains a clearly labelled demo until a sports provider is selected.
export function getSportsStatus() {
  return Promise.resolve({ message: 'Football data is not connected yet. Add a sports data provider to display verified live scores and fixtures.' })
}
