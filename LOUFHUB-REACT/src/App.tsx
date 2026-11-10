import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, Bookmark, Check, ChevronDown, Clapperboard, Compass,
  Disc3, Film, Flame, Headphones, Home, ListMusic, Menu, Music2, Play,
  Radio, RefreshCw, Search, ShieldCheck, Sparkles, Trophy, X
} from 'lucide-react'
import {
  getFootballMatches, getMovieDetails, getMovieWatchProviders, getMovies, getMoviesPage,
  searchMovies, type FootballResult, type MovieCategory, type WatchProviderRegion
} from './services/api'
import { MUSIC_PAGE_SIZE, searchTracks, type Track } from './services/music'
import LocalMediaPlayer from './components/LocalMediaPlayer'

type Movie = {
  id: number
  title?: string
  name?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string
  release_date?: string
  vote_average?: number
  runtime?: number
  genres?: { id: number; name: string }[]
  videos?: { results?: { key: string; name: string; site: string; type: string; official?: boolean }[] }
  recommendations?: { results?: Movie[] }
}
type Page = 'Home' | 'Movies' | 'Music' | 'Football' | 'My Library'
const poster = (path?: string | null) => path ? `https://image.tmdb.org/t/p/w500${path}` : ''
const backdrop = (path?: string | null) => path ? `https://image.tmdb.org/t/p/w1280${path}` : ''
const categories: { label: string; value: MovieCategory }[] = [
  { label: 'Popular', value: 'popular' }, { label: 'Trending', value: 'trending' },
  { label: 'Top rated', value: 'top-rated' }, { label: 'Upcoming', value: 'upcoming' },
  { label: 'Now playing', value: 'now-playing' },
]
const watchRegions = [
  { code: 'US', label: 'United States' }, { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' }, { code: 'AU', label: 'Australia' },
  { code: 'IN', label: 'India' }, { code: 'DE', label: 'Germany' }, { code: 'FR', label: 'France' },
]

function readSaved(): Movie[] {
  try { return JSON.parse(localStorage.getItem('loufhub_saved_movies') || '[]') } catch { return [] }
}

export default function App() {
  const [page, setPage] = useState<Page>('Home')
  const [movies, setMovies] = useState<Movie[]>([])
  const [category, setCategory] = useState<MovieCategory>('popular')
  const [movieQuery, setMovieQuery] = useState('')
  const [musicQuery, setMusicQuery] = useState('')
  const [sportsQuery, setSportsQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Movie[] | null>(null)
  const [movieError, setMovieError] = useState('')
  const [sports, setSports] = useState<FootballResult | null>(null)
  const [sportsError, setSportsError] = useState('')
  const [sportsLoading, setSportsLoading] = useState(false)
  const [loadingMovies, setLoadingMovies] = useState(true)
  const [loadingMoreMovies, setLoadingMoreMovies] = useState(false)
  const [moviePage, setMoviePage] = useState(1)
  const [hasMoreMovies, setHasMoreMovies] = useState(false)
  const [musicTracks, setMusicTracks] = useState<Track[]>([])
  const [musicLoading, setMusicLoading] = useState(true)
  const [musicError, setMusicError] = useState('')
  const [musicOffset, setMusicOffset] = useState(0)
  const [hasMoreTracks, setHasMoreTracks] = useState(false)
  const [loadingMoreTracks, setLoadingMoreTracks] = useState(false)
  const [activeTrack, setActiveTrack] = useState<Track | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
  const [movieDetailsError, setMovieDetailsError] = useState('')
  const [movieProviders, setMovieProviders] = useState<WatchProviderRegion | null>(null)
  const [watchRegion, setWatchRegion] = useState(navigator.language?.split('-')[1]?.toUpperCase() || 'US')
  const [saved, setSaved] = useState<Movie[]>(readSaved)
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    localStorage.setItem('loufhub_saved_movies', JSON.stringify(saved))
  }, [saved])

  useEffect(() => {
    let active = true
    setLoadingMovies(true)
    setMovieError('')
    getMovies(category)
      .then(data => {
        if (!active) return
        setMovies(Array.isArray(data.results) ? data.results : [])
        setMoviePage(data.page || 1)
        setHasMoreMovies((data.page || 1) < (data.total_pages || 1))
      })
      .catch(error => { if (active) setMovieError(error.message || 'Could not load the movie catalogue. Check your TMDB API key and internet connection.') })
      .finally(() => { if (active) setLoadingMovies(false) })
    return () => { active = false }
  }, [category])

  useEffect(() => {
    let active = true
    refreshScores(() => active)
    const timer = window.setInterval(() => refreshScores(() => active), 60_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    let active = true
    setMusicLoading(true)
    setMusicError('')
    setMusicTracks([])
    setHasMoreTracks(false)
    const timer = window.setTimeout(async () => {
      setMusicOffset(0)
      try {
        const result = await searchTracks(musicQuery || 'top music')
        if (active) {
          setMusicTracks(result.tracks)
          setHasMoreTracks(result.resultCount > result.tracks.length)
        }
      } catch (error) {
        if (active) setMusicError(error instanceof Error ? error.message : 'Music search is unavailable.')
      } finally {
        if (active) setMusicLoading(false)
      }
    }, musicQuery ? 300 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [musicQuery])

  const featured = movies.find(m => m.backdrop_path) || movies[0]
  const filteredMatches = useMemo(() => (sports?.matches || []).filter(match => `${match.league} ${match.home} ${match.away}`.toLowerCase().includes(sportsQuery.toLowerCase())), [sports, sportsQuery])
  const visibleMovies = useMemo(() => {
    if (page === 'My Library') return saved
    if (page === 'Movies') return movies
    return movies.slice(0, 8)
  }, [movies, page, saved])

  const navItems: { label: Page; icon: typeof Home }[] = [
    { label: 'Home', icon: Home }, { label: 'Movies', icon: Film }, { label: 'Music', icon: Headphones },
    { label: 'Football', icon: Trophy }, { label: 'My Library', icon: ListMusic },
  ]

  function changePage(next: Page) { setPage(next); setMobileNav(false); setSearchResults(null) }
  function isSaved(movie: Movie) { return saved.some(item => item.id === movie.id) }
  function toggleSaved(movie: Movie) {
    setSaved(current => current.some(item => item.id === movie.id) ? current.filter(item => item.id !== movie.id) : [movie, ...current])
  }
  async function openMovie(movie: Movie) {
    setSelectedMovie(movie)
    setDetailsLoading(true)
    setMovieDetailsError('')
    setMovieProviders(null)
    const [details, providers] = await Promise.allSettled([
      getMovieDetails(movie.id),
      getMovieWatchProviders(movie.id),
    ])
    if (details.status === 'fulfilled') setSelectedMovie(details.value)
    else setMovieDetailsError(details.reason instanceof Error ? details.reason.message : 'Movie details are unavailable.')
    if (providers.status === 'fulfilled') setMovieProviders(providers.value.results?.[watchRegion] || null)
    else setMovieDetailsError(current => [current, providers.reason instanceof Error ? providers.reason.message : 'Watch options are unavailable.'].filter(Boolean).join(' '))
    setDetailsLoading(false)
  }
  async function submitMovieSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!movieQuery.trim()) { setSearchResults(null); return }
    try {
      const data = await searchMovies(movieQuery.trim())
      setSearchResults(data.results || [])
    } catch (error) { setMovieError(error instanceof Error ? error.message : 'Movie search is unavailable.') }
  }
  async function loadMoreMovies() {
    setLoadingMoreMovies(true)
    try {
      const data = await getMoviesPage(category, moviePage + 1)
      setMovies(current => [...current, ...(Array.isArray(data.results) ? data.results : [])])
      setMoviePage(data.page || moviePage + 1)
      setHasMoreMovies((data.page || moviePage + 1) < (data.total_pages || moviePage + 1))
    } catch (error) {
      setMovieError(error instanceof Error ? error.message : 'Could not load more movies.')
    } finally {
      setLoadingMoreMovies(false)
    }
  }
  async function loadMoreTracks() {
    setLoadingMoreTracks(true)
    const nextOffset = musicOffset + MUSIC_PAGE_SIZE
    try {
      const result = await searchTracks(musicQuery || 'top music', nextOffset)
      setMusicTracks(current => [...current, ...result.tracks])
      setMusicOffset(nextOffset)
      setHasMoreTracks(result.resultCount > nextOffset + result.tracks.length)
    } catch (error) {
      setMusicError(error instanceof Error ? error.message : 'Could not load more songs.')
    } finally {
      setLoadingMoreTracks(false)
    }
  }
  async function refreshScores(isActive: () => boolean = () => true) {
    setSportsLoading(true)
    try {
      const result = await getFootballMatches()
      if (isActive()) {
        setSports(result)
        setSportsError('')
      }
    } catch (error) {
      if (isActive()) setSportsError(error instanceof Error ? error.message : 'Football scores could not be loaded.')
    } finally {
      if (isActive()) setSportsLoading(false)
    }
  }
  async function changeWatchRegion(region: string) {
    setWatchRegion(region)
    if (!selectedMovie) return
    try {
      const providers = await getMovieWatchProviders(selectedMovie.id)
      setMovieProviders(providers.results?.[region] || null)
    } catch (error) {
      setMovieDetailsError(error instanceof Error ? error.message : 'Watch options are unavailable.')
    }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Sparkles size={19} /></span><span>LOUF<span>HUB</span></span><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X /></button></div>
      <div className="side-label">DISCOVER</div>
      <nav className="side-nav">
        {navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${page === label ? 'active' : ''}`} onClick={() => changePage(label)}><Icon size={18} /><span>{label}</span>{label === 'Football' && <span className="nav-live-dot" />}</button>)}
      </nav>
      <div className="side-label side-label-spaced">YOUR SPACE</div>
      <button className="nav-link" onClick={() => { setCategory('trending'); changePage('Movies') }}><Flame size={18} /><span>Trending picks</span></button>
      <button className="nav-link" onClick={() => changePage('My Library')}><Bookmark size={18} /><span>Saved movies</span><span className="nav-count">{saved.length}</span></button>
      <div className="sidebar-bottom">
        <div className="premium-card"><div className="premium-icon"><ShieldCheck size={18} /></div><strong>Your hub, your vibe.</strong><p>Discover films, music and football in one place.</p><button onClick={() => changePage('My Library')}>Open your library <ArrowRight size={14} /></button></div>
        <div className="profile-row"><div className="avatar">L</div><div><strong>Guest explorer</strong><span>Local demo profile</span></div><ChevronDown size={15} /></div>
      </div>
    </aside>

    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu /></button>
        <div className="breadcrumb"><span>LOUFHUB</span><span className="crumb-slash">/</span><strong>{page}</strong></div>
        <div className="topbar-note">MOVIES <i /> MUSIC <i /> SPORTS</div>
        <div className="top-avatar">L</div>
      </header>

      <div className="content-wrap">
        {(page === 'Home' || page === 'Movies') && <>
          {page === 'Home' && <section className="hero" style={featured?.backdrop_path ? { backgroundImage: `linear-gradient(90deg, rgba(13,12,22,.98) 0%, rgba(13,12,22,.82) 48%, rgba(13,12,22,.2) 100%), linear-gradient(0deg, #0d0c16 0%, transparent 50%), url(${backdrop(featured.backdrop_path)})` } : undefined}>
            <div className="hero-content"><div className="hero-kicker"><span className="live-pip" /> YOUR ENTERTAINMENT UNIVERSE</div><h1>Every story.<br />Every <span>sound.</span><br />Every game.</h1><p>Discover your next favourite film, explore new music and stay close to the game — all in one hub.</p><div className="hero-actions"><button className="primary-button" onClick={() => changePage('Movies')}><Compass size={17} /> Explore movies</button><button className="secondary-button" onClick={() => changePage('Football')}><Trophy size={16} /> Football center</button></div><div className="hero-tags"><span><Film size={13} /> MOVIES</span><span><Music2 size={13} /> MUSIC</span><span><Activity size={13} /> SPORTS</span></div></div>
            <div className="hero-stamp"><span>THE</span><strong>HUB</strong><small>OF WHAT YOU LOVE</small></div>
          </section>}

          {page === 'Movies' && <div className="page-intro"><span className="eyebrow">THE BIG SCREEN, YOUR WAY</span><h1>Movie <span>discovery</span></h1><p>Browse popular, trending, top-rated, upcoming and now-playing titles.</p></div>}

          {page === 'Movies' && <div className="movie-toolbar">
            <div className="category-tabs">{categories.map(item => <button key={item.value} className={category === item.value ? 'selected' : ''} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
            <form className="category-search" onSubmit={submitMovieSearch}><Search size={16} /><input value={movieQuery} onChange={e => setMovieQuery(e.target.value)} placeholder="Search movie titles..." /><button type="submit">Search</button></form>
          </div>}

          <div className="catalog-layout">
            <section className="section-block catalog-main">
              <div className="section-heading"><div><span className="eyebrow">{page === 'Movies' ? 'BROWSE THE CATALOGUE' : 'CURATED FOR YOU'}</span><h2>{page === 'Movies' ? `${categories.find(c => c.value === category)?.label} movies` : 'Popular movies'}</h2></div><button className="text-button" onClick={() => changePage('Movies')}>View all <ArrowRight size={15} /></button></div>
              {searchResults && <div className="search-feedback"><strong>{searchResults.length} search results</strong><button onClick={() => setSearchResults(null)}>Clear search <X size={14} /></button></div>}
              {loadingMovies ? <div className="movie-grid">{Array.from({ length: 8 }).map((_, i) => <div className="skeleton-poster" key={i} />)}</div>
                : (searchResults || visibleMovies).length ? <div className="movie-grid">{(searchResults || visibleMovies).map(movie => <article className="movie-card-wrap" key={movie.id}>
                  <button className="movie-card" onClick={() => openMovie(movie)}><div className="poster-wrap">{movie.poster_path ? <img src={poster(movie.poster_path)} alt={`${movie.title || movie.name} poster`} loading="lazy" /> : <div className="poster-placeholder"><Film size={28} /></div>}<span className="poster-play"><Play size={17} fill="currentColor" /></span>{movie.vote_average ? <span className="rating">★ {movie.vote_average.toFixed(1)}</span> : null}</div><strong>{movie.title || movie.name || 'Untitled'}</strong><span>{movie.release_date?.slice(0, 4) || 'Release date TBA'}</span></button>
                  <button className={`save-movie ${isSaved(movie) ? 'saved' : ''}`} onClick={() => toggleSaved(movie)} aria-label={isSaved(movie) ? 'Remove from library' : 'Save to library'}>{isSaved(movie) ? <Check size={14} /> : <Bookmark size={14} />}</button>
                </article>)}</div>
                : <div className="empty-state"><Clapperboard size={28} /><strong>Movie catalogue waiting to connect</strong><p>{movieError || 'Add your TMDB API key to the React app settings to load real movie information.'}</p></div>}
              {movieError && <p className="setup-hint">{movieError}</p>}
              {page === 'Movies' && !searchResults && hasMoreMovies && <button className="load-more-button" onClick={loadMoreMovies} disabled={loadingMoreMovies}>{loadingMoreMovies ? 'Loading…' : 'Load more movies'}</button>}
            </section>
            <aside className="recommend-sidebar">
              <div className="side-panel-title"><div><span className="eyebrow">MOST DISCOVERED</span><h3>Top 10 movies</h3></div><Flame size={18} /></div>
              {movies.slice(0, 10).map((movie, index) => <button className="top-item" key={movie.id} onClick={() => openMovie(movie)}><span className="top-rank">{String(index + 1).padStart(2, '0')}</span>{movie.poster_path ? <img src={poster(movie.poster_path)} alt="" /> : <span className="top-placeholder"><Film size={14} /></span>}<span className="top-meta"><strong>{movie.title || movie.name}</strong><small>{movie.release_date?.slice(0, 4) || 'Movie'} {movie.vote_average ? `· ★ ${movie.vote_average.toFixed(1)}` : ''}</small></span></button>)}
              {!movies.length && <p className="side-empty">Top picks appear when TMDB is connected.</p>}
              <div className="side-panel-foot">TOP 10 FROM ACTIVE TMDB LIST</div>
            </aside>
          </div>

          {page === 'Home' && <section className="section-block quick-discover"><div className="section-heading"><div><span className="eyebrow">PICK YOUR MOOD</span><h2>Explore the hub</h2></div></div><div className="discover-grid"><button className="discover-card discover-music" onClick={() => changePage('Music')}><div><Music2 size={21} /><span>LISTEN & DISCOVER</span><strong>Find your<br />next sound.</strong><em>Explore music <ArrowRight size={14} /></em></div><Disc3 className="discover-art" size={125} /></button><button className="discover-card discover-sports" onClick={() => changePage('Football')}><div><Trophy size={21} /><span>FOLLOW THE GAME</span><strong>Feel every<br />moment.</strong><em>Open football <ArrowRight size={14} /></em></div><Activity className="discover-art" size={125} /></button></div></section>}
        </>}

        {page === 'Music' && <section className="page-section">
          <div className="page-intro"><span className="eyebrow">SOUNDTRACK YOUR DAY</span><h1>Music <span>discovery</span></h1><p>Search the iTunes catalog and play official 30-second previews. Open Apple Music to access full tracks.</p></div>
          <div className="music-toolbar"><div><span className="eyebrow">DISCOVER TRACKS</span><h2>Music for every mood</h2></div><form className="category-search" onSubmit={e => e.preventDefault()}><Search size={16} /><input value={musicQuery} onChange={e => setMusicQuery(e.target.value)} placeholder="Search songs or artists..." /></form></div>
          <div className="music-layout"><div className="music-list">
              {musicLoading && !musicTracks.length && <p className="side-empty">Searching the iTunes catalog…</p>}
              {musicError && <p className="setup-hint">{musicError}</p>}
              {musicTracks.map((track, i) => <article className="music-row" key={track.trackId}>
                <span className="track-number">{String(i + 1).padStart(2, '0')}</span>
                {track.artwork ? <img className="album-art-image" src={track.artwork} alt="" /> : <div className={`album-art album-color-${i % 5}`}><Music2 size={22} /></div>}
                <div className="track-meta"><strong>{track.title}</strong><span>{track.artist} · {track.album}</span></div>
                <button className="track-play-button" onClick={() => setActiveTrack(track)} aria-label={`Play preview of ${track.title}`}><Play size={14} fill="currentColor" /> Preview</button>
                {track.trackUrl && <a className="track-store-link" href={track.trackUrl} target="_blank" rel="noreferrer">Apple Music</a>}
              </article>)}
              {!musicLoading && !musicError && !musicTracks.length && <p className="side-empty">No iTunes preview results for that search.</p>}
              {hasMoreTracks && <button className="load-more-button" onClick={loadMoreTracks} disabled={loadingMoreTracks}>{loadingMoreTracks ? 'Loading…' : 'Load more tracks'}</button>}
              {activeTrack && <div className="preview-player"><div><strong>{activeTrack.title}</strong><span>{activeTrack.artist} · iTunes preview</span></div><audio key={activeTrack.trackId} src={activeTrack.previewUrl} controls autoPlay /></div>}
            </div>
            <aside className="recommend-sidebar music-top"><div className="side-panel-title"><div><span className="eyebrow">iTUNES CATALOG</span><h3>Preview picks</h3></div><Headphones size={18} /></div>{musicTracks.slice(0, 10).map((track, i) => <button className="top-item music-top-item" key={track.trackId} onClick={() => setActiveTrack(track)}><span className="top-rank">{String(i + 1).padStart(2, '0')}</span>{track.artwork ? <img className="mini-album-image" src={track.artwork} alt="" /> : <span className={`mini-album album-color-${i % 5}`}><Music2 size={13} /></span>}<span className="top-meta"><strong>{track.title}</strong><small>{track.artist}</small></span></button>)}<div className="side-panel-foot">30-SECOND PREVIEWS</div></aside>
          </div>
          <LocalMediaPlayer />
          <div className="notice"><ShieldCheck size={18} /><span><strong>Playback and downloads:</strong> iTunes provides short previews and links to the licensed store; full tracks are not downloadable from this app. Use the local player for media files you own.</span></div>
        </section>}

        {page === 'Football' && <section className="page-section">
          <div className="page-intro"><span className="eyebrow">THE BEAUTIFUL GAME</span><h1>Football <span>center</span></h1><p>Fixtures, results, standings and match information in one place.</p></div>
          <div className="football-banner"><div><span className="eyebrow">MATCHDAY TRACKER</span><h2>Stay in the game.</h2><p>{sportsError || (sportsLoading ? 'Refreshing live scores…' : 'Live scores refresh automatically every minute.')}</p></div><button className="refresh-scores" onClick={() => refreshScores()} disabled={sportsLoading}><RefreshCw size={16} /> Refresh</button></div>
          <div className="music-toolbar"><div><span className="eyebrow">MATCH CENTER</span><h2>Live scores & fixtures</h2></div><form className="category-search" onSubmit={e => e.preventDefault()}><Search size={16} /><input value={sportsQuery} onChange={e => setSportsQuery(e.target.value)} placeholder="Search teams or leagues..." /></form></div>
          {sports?.errors.map(error => <p className="setup-hint" key={error}>{error}</p>)}
          <div className="match-list">{filteredMatches.map(match => <div className="match-row" key={match.id}><div className="match-league">{match.league}<span>{match.date ? new Date(match.date).toLocaleString() : 'Date unavailable'}</span></div><div className="team-name">{match.home}</div><div className="match-score">{match.homeScore} : {match.awayScore}</div><div className="team-name team-away">{match.away}</div><span className="match-status">{match.status}</span></div>)}{!filteredMatches.length && <p className="side-empty">{sportsError || (sportsLoading ? 'Loading football fixtures…' : 'No matches found for this search.')}</p>}</div>
          <div className="notice"><Radio size={18} /><span>Scoreboard data is provided by ESPN and refreshes once per minute. Broadcast access requires a licensed provider.</span></div>
        </section>}

        {page === 'My Library' && <section className="page-section"><div className="page-intro"><span className="eyebrow">YOUR PERSONAL SPACE</span><h1>My <span>library</span></h1><p>Your saved movies are stored in this browser on this device.</p></div>{saved.length ? <div className="movie-grid">{saved.map(movie => <article className="movie-card-wrap" key={movie.id}><button className="movie-card" onClick={() => openMovie(movie)}><div className="poster-wrap">{movie.poster_path ? <img src={poster(movie.poster_path)} alt="" /> : <div className="poster-placeholder"><Film /></div>}</div><strong>{movie.title || movie.name}</strong><span>{movie.release_date?.slice(0, 4) || 'Saved movie'}</span></button><button className="save-movie saved" onClick={() => toggleSaved(movie)} aria-label="Remove from library"><Check size={14} /></button></article>)}</div> : <div className="library-empty"><div className="library-orbit"><ListMusic size={34} /></div><h2>Your collection starts here</h2><p>Use the bookmark icon on any movie to save it to your local library.</p><button className="primary-button" onClick={() => changePage('Movies')}>Discover movies <ArrowRight size={16} /></button></div>}</section>}

        <footer className="footer"><span>© 2026 LOUFHUB</span><span>MADE FOR WHAT YOU LOVE <Sparkles size={12} /></span></footer>
      </div>
    </main>

    {selectedMovie && <div className="modal-backdrop" onClick={() => setSelectedMovie(null)}>
      <section className="movie-modal" onClick={event => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setSelectedMovie(null)} aria-label="Close details"><X /></button>
        {selectedMovie.backdrop_path && <img className="modal-backdrop-image" src={backdrop(selectedMovie.backdrop_path)} alt="" />}
        <div className="modal-body">
          <span className="eyebrow">MOVIE DETAILS</span>
          <h2>{selectedMovie.title || selectedMovie.name}</h2>
          <p className="modal-meta">{selectedMovie.release_date || 'Release date unavailable'} {selectedMovie.runtime ? ` · ${selectedMovie.runtime} min` : ''} {selectedMovie.vote_average ? ` · ★ ${selectedMovie.vote_average.toFixed(1)}/10` : ''}</p>
          {selectedMovie.genres?.length ? <div className="genre-tags">{selectedMovie.genres.map(genre => <span key={genre.id}>{genre.name}</span>)}</div> : null}
          <p>{selectedMovie.overview || 'No synopsis is available for this title.'}</p>
          <div className="modal-actions">
            <button className="primary-button" onClick={() => toggleSaved(selectedMovie)}>{isSaved(selectedMovie) ? <Check size={16} /> : <Bookmark size={16} />}{isSaved(selectedMovie) ? 'Saved to library' : 'Save to library'}</button>
            {(() => {
              const trailer = selectedMovie.videos?.results?.find(video => video.site === 'YouTube' && video.type === 'Trailer')
              return trailer ? <a className="secondary-button trailer-link" href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noreferrer"><Play size={15} /> Watch trailer</a> : <span className="trailer-unavailable">Trailer not listed by TMDB</span>
            })()}
          </div>
          {detailsLoading && <p className="setup-hint">Loading movie details…</p>}
          {movieDetailsError && <p className="setup-hint">{movieDetailsError}</p>}
          <div className="watch-options">
            <div className="watch-options-heading"><strong>Where to watch</strong><label htmlFor="watch-region">Region</label><select id="watch-region" value={watchRegion} onChange={event => changeWatchRegion(event.target.value)}>{!watchRegions.some(region => region.code === watchRegion) && <option value={watchRegion}>{watchRegion}</option>}{watchRegions.map(region => <option value={region.code} key={region.code}>{region.label}</option>)}</select></div>
            {movieProviders?.link
              ? <div className="watch-provider-list">
                {(['flatrate', 'free', 'ads', 'rent', 'buy'] as const).flatMap(type => (movieProviders[type] || []).map(provider => <span key={`${type}-${provider.provider_id}`}>{provider.provider_name} · {type === 'flatrate' ? 'stream' : type}</span>))}
                <a className="secondary-button trailer-link" href={movieProviders.link} target="_blank" rel="noreferrer">View licensed options</a>
              </div>
              : <p className="trailer-unavailable">No providers are listed for this title in {watchRegion}. Check another region or browse TMDB's listings.</p>}
          </div>
          <div className="notice"><ShieldCheck size={17} /><span>LOUFHUB shows trailers and licensed viewing options only. Full-movie playback and downloads are provided by rights holders, not TMDB.</span></div>
          {selectedMovie.recommendations?.results?.length ? <div className="recommendation-inline"><strong>You may also like</strong><span>{selectedMovie.recommendations.results.slice(0, 4).map(movie => movie.title).filter(Boolean).join(' · ')}</span></div> : null}
        </div>
      </section>
    </div>}
  </div>
}
