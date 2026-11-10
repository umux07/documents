import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, Bookmark, Check, ChevronDown, Clapperboard, Compass,
  Disc3, Film, Flame, Headphones, Home, ListMusic, Menu, Music2, Play,
  Radio, Search, ShieldCheck, Sparkles, Trophy, X
} from 'lucide-react'
import { getMovies, getMovieDetails, getSportsStatus, searchMovies, type MovieCategory } from './services/api'

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
type Track = { title: string; artist: string; genre: string; note: string }
const poster = (path?: string | null) => path ? `https://image.tmdb.org/t/p/w500${path}` : ''
const backdrop = (path?: string | null) => path ? `https://image.tmdb.org/t/p/w1280${path}` : ''
const categories: { label: string; value: MovieCategory }[] = [
  { label: 'Popular', value: 'popular' }, { label: 'Trending', value: 'trending' },
  { label: 'Top rated', value: 'top-rated' }, { label: 'Upcoming', value: 'upcoming' },
  { label: 'Now playing', value: 'now-playing' },
]
const tracks: Track[] = [
  { title: 'Essence', artist: 'Wizkid ft. Tems', genre: 'Afrobeats', note: 'Discovery pick' },
  { title: 'Calm Down', artist: 'Rema', genre: 'Afrobeats', note: 'Discovery pick' },
  { title: 'Last Last', artist: 'Burna Boy', genre: 'Afrobeats', note: 'Discovery pick' },
  { title: 'Water', artist: 'Tyla', genre: 'Amapiano / Pop', note: 'Discovery pick' },
  { title: 'Blinding Lights', artist: 'The Weeknd', genre: 'Pop', note: 'Discovery pick' },
  { title: 'Golden Hour', artist: 'JVKE', genre: 'Pop', note: 'Discovery pick' },
  { title: 'Unstoppable', artist: 'Sia', genre: 'Pop', note: 'Discovery pick' },
  { title: 'Midnight City', artist: 'M83', genre: 'Electronic', note: 'Discovery pick' },
  { title: 'Jerusalema', artist: 'Master KG ft. Nomcebo', genre: 'Afropop', note: 'Discovery pick' },
  { title: 'Ye', artist: 'Burna Boy', genre: 'Afrobeats', note: 'Discovery pick' },
]
const sampleMatches = [
  { league: 'Premier League', home: 'Arsenal', away: 'Chelsea', score: '— : —', status: 'Fixture example' },
  { league: 'La Liga', home: 'Real Madrid', away: 'Barcelona', score: '— : —', status: 'Fixture example' },
  { league: 'UEFA Champions League', home: 'PSG', away: 'Bayern Munich', score: '— : —', status: 'Fixture example' },
  { league: 'Serie A', home: 'Inter Milan', away: 'AC Milan', score: '— : —', status: 'Fixture example' },
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
  const [sports, setSports] = useState<any>(null)
  const [loadingMovies, setLoadingMovies] = useState(true)
  const [mobileNav, setMobileNav] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)
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
      .then(data => { if (active) setMovies(Array.isArray(data.results) ? data.results : []) })
      .catch(error => { if (active) setMovieError(error.message || 'Could not load the movie catalogue. Check your TMDB API key and internet connection.') })
      .finally(() => { if (active) setLoadingMovies(false) })
    return () => { active = false }
  }, [category])

  useEffect(() => {
    getSportsStatus().then(setSports).catch(() => setSports({ message: 'A sports data provider is not connected yet.' }))
  }, [])

  const featured = movies.find(m => m.backdrop_path) || movies[0]
  const filteredTracks = useMemo(() => tracks.filter(t => `${t.title} ${t.artist} ${t.genre}`.toLowerCase().includes(musicQuery.toLowerCase())), [musicQuery])
  const filteredMatches = useMemo(() => sampleMatches.filter(m => `${m.league} ${m.home} ${m.away}`.toLowerCase().includes(sportsQuery.toLowerCase())), [sportsQuery])
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
    try { setSelectedMovie(await getMovieDetails(movie.id)) } catch { /* Keep the catalogue details visible if the API is unavailable. */ }
    finally { setDetailsLoading(false) }
  }
  async function submitMovieSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!movieQuery.trim()) { setSearchResults(null); return }
    try {
      const data = await searchMovies(movieQuery.trim())
      setSearchResults(data.results || [])
    } catch (error: any) { setMovieError(error.message || 'Movie search is unavailable.') }
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
          <div className="page-intro"><span className="eyebrow">SOUNDTRACK YOUR DAY</span><h1>Music <span>discovery</span></h1><p>Find tracks and artists. Playback and downloads require a connected licensed music provider.</p></div>
          <div className="music-toolbar"><div><span className="eyebrow">DISCOVER TRACKS</span><h2>Music for every mood</h2></div><form className="category-search" onSubmit={e => e.preventDefault()}><Search size={16} /><input value={musicQuery} onChange={e => setMusicQuery(e.target.value)} placeholder="Search songs or artists..." /></form></div>
          <div className="music-layout"><div className="music-list">{filteredTracks.map((track, i) => <div className="music-row" key={track.title}><span className="track-number">{String(i + 1).padStart(2, '0')}</span><div className={`album-art album-color-${i % 5}`}><Music2 size={22} /></div><div className="track-meta"><strong>{track.title}</strong><span>{track.artist} · {track.genre}</span></div><span className="track-source">{track.note}</span><span className="provider-lock">Provider needed</span></div>)}{!filteredTracks.length && <p className="side-empty">No matching sample tracks.</p>}</div>
            <aside className="recommend-sidebar music-top"><div className="side-panel-title"><div><span className="eyebrow">EDITOR'S PICKS</span><h3>Top 10 music</h3></div><Headphones size={18} /></div>{tracks.map((track, i) => <div className="top-item music-top-item" key={track.title}><span className="top-rank">{String(i + 1).padStart(2, '0')}</span><span className={`mini-album album-color-${i % 5}`}><Music2 size={13} /></span><span className="top-meta"><strong>{track.title}</strong><small>{track.artist}</small></span></div>)}<div className="side-panel-foot">CURATED EXAMPLES · NOT A LIVE CHART</div></aside>
          </div>
          <div className="notice"><ShieldCheck size={18} /><span><strong>Licensed listening:</strong> these are discovery examples, not playable audio. Connect a music service that grants playback and download rights before enabling full tracks or videos.</span></div>
        </section>}

        {page === 'Football' && <section className="page-section">
          <div className="page-intro"><span className="eyebrow">THE BEAUTIFUL GAME</span><h1>Football <span>center</span></h1><p>Fixtures, results, standings and match information in one place.</p></div>
          <div className="football-banner"><div><span className="eyebrow">MATCHDAY TRACKER</span><h2>Stay in the game.</h2><p>{sports?.message || 'Connect a football data provider to show live match information.'}</p></div><div className="football-ball"><Trophy size={46} /></div></div>
          <div className="music-toolbar"><div><span className="eyebrow">MATCH CENTER</span><h2>Football fixtures</h2></div><form className="category-search" onSubmit={e => e.preventDefault()}><Search size={16} /><input value={sportsQuery} onChange={e => setSportsQuery(e.target.value)} placeholder="Search teams or leagues..." /></form></div>
          <div className="match-list">{filteredMatches.map(match => <div className="match-row" key={match.league}><div className="match-league">{match.league}<span>Sample fixture · provider required</span></div><div className="team-name">{match.home}</div><div className="match-score">{match.score}</div><div className="team-name team-away">{match.away}</div><span className="match-status">{match.status}</span></div>)}{!filteredMatches.length && <p className="side-empty">No matching sample fixtures.</p>}</div>
          <div className="notice"><Radio size={18} /><span>Live scores and match results need a connected sports data provider. Watching broadcasts and downloading highlights require separate authorized media rights.</span></div>
        </section>}

        {page === 'My Library' && <section className="page-section"><div className="page-intro"><span className="eyebrow">YOUR PERSONAL SPACE</span><h1>My <span>library</span></h1><p>Your saved movies are stored in this browser on this device.</p></div>{saved.length ? <div className="movie-grid">{saved.map(movie => <article className="movie-card-wrap" key={movie.id}><button className="movie-card" onClick={() => openMovie(movie)}><div className="poster-wrap">{movie.poster_path ? <img src={poster(movie.poster_path)} alt="" /> : <div className="poster-placeholder"><Film /></div>}</div><strong>{movie.title || movie.name}</strong><span>{movie.release_date?.slice(0, 4) || 'Saved movie'}</span></button><button className="save-movie saved" onClick={() => toggleSaved(movie)} aria-label="Remove from library"><Check size={14} /></button></article>)}</div> : <div className="library-empty"><div className="library-orbit"><ListMusic size={34} /></div><h2>Your collection starts here</h2><p>Use the bookmark icon on any movie to save it to your local library.</p><button className="primary-button" onClick={() => changePage('Movies')}>Discover movies <ArrowRight size={16} /></button></div>}</section>}

        <footer className="footer"><span>© 2026 LOUFHUB</span><span>MADE FOR WHAT YOU LOVE <Sparkles size={12} /></span></footer>
      </div>
    </main>

    {selectedMovie && <div className="modal-backdrop" onClick={() => setSelectedMovie(null)}><section className="movie-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSelectedMovie(null)} aria-label="Close details"><X /></button>{selectedMovie.backdrop_path && <img className="modal-backdrop-image" src={backdrop(selectedMovie.backdrop_path)} alt="" />}<div className="modal-body"><span className="eyebrow">MOVIE DETAILS</span><h2>{selectedMovie.title || selectedMovie.name}</h2><p className="modal-meta">{selectedMovie.release_date || 'Release date unavailable'} {selectedMovie.runtime ? ` · ${selectedMovie.runtime} min` : ''} {selectedMovie.vote_average ? ` · ★ ${selectedMovie.vote_average.toFixed(1)}/10` : ''}</p>{selectedMovie.genres?.length ? <div className="genre-tags">{selectedMovie.genres.map(g => <span key={g.id}>{g.name}</span>)}</div> : null}<p>{selectedMovie.overview || 'No synopsis is available for this title.'}</p><div className="modal-actions"><button className="primary-button" onClick={() => toggleSaved(selectedMovie)}>{isSaved(selectedMovie) ? <Check size={16} /> : <Bookmark size={16} />}{isSaved(selectedMovie) ? 'Saved to library' : 'Save to library'}</button>{(() => { const trailer = selectedMovie.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer'); return trailer ? <span className="trailer-ready"><Play size={15} /> Trailer ready to play below</span> : <span className="trailer-unavailable">Trailer not listed by TMDB</span> })()}</div>{(() => { const trailer = selectedMovie.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer'); return trailer ? <div className="trailer-player-wrap"><div className="trailer-player-heading"><strong>Watch trailer inside LOUFHUB</strong><span>Embedded player</span></div><div className="trailer-player"><iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?rel=0`} title={`${selectedMovie.title || selectedMovie.name || 'Movie'} official trailer`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div></div> : null })()}{detailsLoading && <p className="setup-hint">Loading complete movie details…</p>}<div className="notice"><ShieldCheck size={17} /><span>LOUFHUB displays movie information and listed trailers. Full-movie playback and downloads can only be enabled through authorized rights holders or licensed providers.</span></div>{selectedMovie.recommendations?.results?.length ? <div className="recommendation-inline"><strong>You may also like</strong><span>{selectedMovie.recommendations.results.slice(0, 4).map(m => m.title).filter(Boolean).join(' · ')}</span></div> : null}</div></section></div>}
  </div>
}
