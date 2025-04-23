import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import DiscussionSection from './DiscussionSection';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_REGION = 'US'; // You can make this dynamic if needed

export default function UserDashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState('movie');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [diaryFilter, setDiaryFilter] = useState('all');
  const [diary, setDiary] = useState([]); // Now stores user diary entries
  const [providersMap, setProvidersMap] = useState({});
  const debounceTimeout = useRef(null);
  const lastManualSearch = useRef('');

  const trending = [
    {
      id: 1,
      title: 'Ash',
      year: '2025',
      poster: 'https://image.tmdb.org/t/p/w200/1.jpg',
      desc: 'A woman wakes up on a distant planet and finds the crew of her space…'
    },
    {
      id: 2,
      title: 'Conclave',
      year: '2024',
      poster: 'https://image.tmdb.org/t/p/w200/2.jpg',
      desc: 'After the unexpected death of the Pope, Cardinal Lawrence is…'
    },
    {
      id: 3,
      title: 'Sinners',
      year: '2025',
      poster: 'https://image.tmdb.org/t/p/w200/3.jpg',
      desc: 'Trying to leave their troubled lives behind, twin brothers return to their…'
    },
    {
      id: 4,
      title: 'Locked',
      year: '2025',
      poster: 'https://image.tmdb.org/t/p/w200/4.jpg',
      desc: 'When Eddie breaks into a luxury SUV, he steps into a deadly trap set by…'
    }
  ];
  const providers = [
    { key: 'appletv', img: 'https://img.icons8.com/color/48/000000/apple-tv.png', alt: 'Apple TV' },
    { key: 'amazon', img: 'https://img.icons8.com/color/48/000000/amazon-prime-video.png', alt: 'Amazon Prime' },
    { key: 'facebook', img: 'https://img.icons8.com/color/48/000000/facebook-new.png', alt: 'Facebook' },
    { key: 'youtube', img: 'https://img.icons8.com/color/48/000000/youtube-play.png', alt: 'YouTube' },
    { key: 'plex', img: 'https://img.icons8.com/color/48/000000/plex.png', alt: 'Plex' }
  ];

  // Fetch diary from Firestore
  useEffect(() => {
    if (!currentUser) return;
    async function fetchDiary() {
      const q = query(collection(db, 'diary'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      const entries = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      setDiary(entries);
      // Fetch providers for each entry
      for (const entry of entries) {
        fetchProviders(entry);
      }
    }
    fetchDiary();
    // eslint-disable-next-line
  }, [currentUser]);

  // Fetch providers from TMDb
  async function fetchProviders(entry) {
    if (providersMap[entry.id]) return; // Already fetched
    let url = '';
    if (entry.media_type === 'movie') {
      url = `${TMDB_BASE_URL}/movie/${entry.id}/watch/providers?api_key=${TMDB_API_KEY}`;
    } else {
      url = `${TMDB_BASE_URL}/tv/${entry.id}/watch/providers?api_key=${TMDB_API_KEY}`;
    }
    try {
      const res = await fetch(url);
      const data = await res.json();
      const regionData = data.results?.[TMDB_REGION] || {};
      setProvidersMap(prev => ({ ...prev, [entry.id]: regionData }));
    } catch (e) {
      setProvidersMap(prev => ({ ...prev, [entry.id]: {} }));
    }
  }

  async function fetchSearchResults(queryStr, type) {
    if (!queryStr.trim()) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const endpoint = type === 'movie' ? '/search/movie' : '/search/tv';
      const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(queryStr)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.results) {
        setSearchResults(data.results);
      } else {
        setSearchResults([]);
        setSearchError('No results found.');
      }
    } catch (err) {
      setSearchError('Failed to fetch results.');
    }
    setSearchLoading(false);
  }

  useEffect(() => {
    if (searchQuery.trim() === '' || searchQuery === lastManualSearch.current) return;
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      fetchSearchResults(searchQuery, searchType);
    }, 400);
    return () => clearTimeout(debounceTimeout.current);
  }, [searchQuery, searchType]);

  async function handleSearch(e) {
    e.preventDefault();
    lastManualSearch.current = searchQuery;
    await fetchSearchResults(searchQuery, searchType);
  }

  // Add to Diary (Firestore)
  async function handleAddToDiary(item) {
    if (!currentUser) return;
    // Prevent duplicate
    if (diary.some(d => d.id === item.id && d.media_type === (item.media_type || searchType))) return;
    const diaryEntry = {
      uid: currentUser.uid,
      id: item.id,
      title: item.title || item.name,
      date: (item.release_date || item.first_air_date || '').slice(0, 10),
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://placehold.co/120x170?text=No+Image',
      desc: item.overview || 'No description.',
      watched: false,
      media_type: item.media_type || searchType,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'diary'), diaryEntry);
    // Refresh diary
    const q = query(collection(db, 'diary'), where('uid', '==', currentUser.uid));
    const snap = await getDocs(q);
    const entries = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
    setDiary(entries);
    fetchProviders(diaryEntry);
    setSearchResults([]);
    setSearchQuery('');
  }

  // Remove from Diary (Firestore)
  async function handleRemoveFromDiary(docId) {
    await deleteDoc(doc(db, 'diary', docId));
    setDiary(prev => prev.filter(d => d.docId !== docId));
  }

  // Toggle Watched/Unwatched (Firestore)
  async function handleToggleWatched(docId, watched) {
    await updateDoc(doc(db, 'diary', docId), { watched: !watched });
    setDiary(prev => prev.map(d => d.docId === docId ? { ...d, watched: !d.watched } : d));
  }

  function handleShare(item) {
    window.alert(`Share this: ${item.title}`);
  }

  async function handleSignOut() {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      alert('Failed to sign out');
    }
  }

  // Filtered Diary
  const filteredDiary = diary.filter(entry => {
    if (diaryFilter === 'all') return entry.media_type === searchType;
    if (diaryFilter === 'watched') return entry.watched && entry.media_type === searchType;
    if (diaryFilter === 'unwatched') return !entry.watched && entry.media_type === searchType;
    return entry.media_type === searchType;
  });

  return (
    <div className="dashboard-bg">
      <div className="dashboard-content-wrapper">
        {/* Welcome Banner */}
        <div className="dashboard-banner">
          <div className="dashboard-welcome">Welcome makeaclick!</div>
          <button className="dashboard-signout" onClick={handleSignOut}>SIGN OUT</button>
        </div>
        {/* Search Section */}
        <div className="dashboard-search-section">
          <img src="https://img.icons8.com/ios-filled/100/ffffff/movie-projector.png" alt="App Icon" className="dashboard-logo" />
          <div className="dashboard-search-title">Search for Movies / Tv Shows</div>
          <div className="dashboard-search-instructions">NEED INSTRUCTIONS?</div>
          <div className="dashboard-search-toggle-row">
            <button className={searchType === 'movie' ? 'dashboard-toggle active' : 'dashboard-toggle'} onClick={() => setSearchType('movie')}>MOVIE</button>
            <button className={searchType === 'tv' ? 'dashboard-toggle active' : 'dashboard-toggle'} onClick={() => setSearchType('tv')}>TV SHOW</button>
          </div>
          <form className="dashboard-search-bar-row" onSubmit={handleSearch}>
            <input
              className="dashboard-search-bar"
              placeholder="Type to search for movies or shows…*"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button className="dashboard-search-btn" type="submit" disabled={searchLoading || !searchQuery.trim()}>
              {searchLoading ? 'SEARCHING...' : 'SEARCH'}
            </button>
          </form>
          {/* Search Results */}
          <div className="dashboard-search-results">
            {searchError && <div className="auth-error" style={{ marginTop: '1rem' }}>{searchError}</div>}
            {!searchError && searchResults.length > 0 && (
              <div className="dashboard-trending-row" style={{ marginTop: '1.4rem' }}>
                {searchResults.map(result => (
                  <div className="dashboard-trending-card" key={result.id}>
                    <img
                      src={result.poster_path ? `https://image.tmdb.org/t/p/w200${result.poster_path}` : 'https://placehold.co/120x170?text=No+Image'}
                      alt={result.title || result.name}
                      className="dashboard-trending-poster"
                    />
                    <div className="dashboard-trending-movie-title">{result.title || result.name}</div>
                    <div className="dashboard-trending-year">{(result.release_date || result.first_air_date || '').slice(0, 4)}</div>
                    <div className="dashboard-trending-desc">{result.overview ? result.overview.slice(0, 90) + (result.overview.length > 90 ? '…' : '') : 'No description.'}</div>
                    <button className="dashboard-trending-add" onClick={() => handleAddToDiary(result)}>
                      {diary.some(d => d.id === result.id) ? 'IN DIARY' : 'ADD TO DIARY'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Diary Section */}
        <div className="dashboard-diary-section">
          <div className="dashboard-diary-title">My Diary</div>
          <div className="dashboard-diary-filter-row">
            <button className={diaryFilter === 'all' ? 'dashboard-diary-filter active' : 'dashboard-diary-filter'} onClick={() => setDiaryFilter('all')}>ALL</button>
            <button className={diaryFilter === 'watched' ? 'dashboard-diary-filter active' : 'dashboard-diary-filter'} onClick={() => setDiaryFilter('watched')}>WATCHED</button>
            <button className={diaryFilter === 'unwatched' ? 'dashboard-diary-filter active' : 'dashboard-diary-filter'} onClick={() => setDiaryFilter('unwatched')}>UNWATCHED</button>
          </div>
          <div className="dashboard-diary-providers-row">
            <button className="dashboard-providers-btn">ALL PROVIDERS</button>
            {providers.map(p => <img key={p.key} src={p.img} alt={p.alt} className="dashboard-provider-icon" />)}
            <button className="dashboard-remove-all-btn" onClick={() => setDiary([])}>REMOVE ALL</button>
          </div>
          {filteredDiary.length === 0 ? (
            <div style={{ color: '#aaa', margin: '2rem 0', textAlign: 'center' }}>No entries in your diary.</div>
          ) : (
            filteredDiary.map(entry => {
              const providerData = providersMap[entry.id] || {};
              const streaming = providerData.flatrate || [];
              const rent = providerData.rent || [];
              const buy = providerData.buy || [];
              return (
                <section className="dashboard-diary-card" key={entry.docId}>
                  <div className="dashboard-diary-content-row">
                    <div className="dashboard-diary-poster-col">
                      <img src={entry.poster} alt={entry.title} className="dashboard-diary-poster" />
                    </div>
                    <div className="dashboard-diary-main-col">
                      <div className="dashboard-diary-movie-title">{entry.title}</div>
                      <div className="dashboard-diary-date">{entry.date}</div>
                      <div className="dashboard-diary-desc">{entry.desc}</div>
                    </div>
                    <div className="dashboard-diary-side-col">
                      <div className="dashboard-diary-providers">
                        <div className="dashboard-diary-providers-group">
                          <div className="dashboard-diary-providers-label">Streaming:</div>
                          <div className="dashboard-diary-providers-icons">
                            {streaming.length === 0 ? <span style={{color:'#888'}}>N/A</span> : streaming.map(p => (
                              <img key={p.provider_id} src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.provider_name} title={p.provider_name} className="dashboard-provider-icon-sm" />
                            ))}
                          </div>
                        </div>
                        <div className="dashboard-diary-providers-group">
                          <div className="dashboard-diary-providers-label">Rent:</div>
                          <div className="dashboard-diary-providers-icons">
                            {rent.length === 0 ? <span style={{color:'#888'}}>N/A</span> : rent.map(p => (
                              <img key={p.provider_id} src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.provider_name} title={p.provider_name} className="dashboard-provider-icon-sm" />
                            ))}
                          </div>
                        </div>
                        <div className="dashboard-diary-providers-group">
                          <div className="dashboard-diary-providers-label">Buy:</div>
                          <div className="dashboard-diary-providers-icons">
                            {buy.length === 0 ? <span style={{color:'#888'}}>N/A</span> : buy.map(p => (
                              <img key={p.provider_id} src={`https://image.tmdb.org/t/p/w45${p.logo_path}`} alt={p.provider_name} title={p.provider_name} className="dashboard-provider-icon-sm" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-diary-btn-row">
                    <button className="dashboard-diary-share" onClick={() => handleShare(entry)}>SHARE</button>
                    <button
                      className={entry.watched ? "dashboard-diary-watched" : "dashboard-diary-unwatched"}
                      onClick={() => handleToggleWatched(entry.docId, entry.watched)}
                    >
                      {entry.watched ? 'WATCHED' : 'UNWATCHED'}
                    </button>
                    <button className="dashboard-diary-remove" onClick={() => handleRemoveFromDiary(entry.docId)}>REMOVE</button>
                  </div>
                  <DiscussionSection entryId={entry.docId} />
                </section>
              );
            })
          )}
          <button className="dashboard-diary-discussion">SHOW DISCUSSION</button>
        </div>
        {/* Trending Movies Section */}
        <div className="dashboard-trending-section">
          <div className="dashboard-trending-title">Trending Movies</div>
          <div className="dashboard-trending-row">
            {trending.map(movie => (
              <div className="dashboard-trending-card" key={movie.id}>
                <img src={movie.poster} alt={movie.title} className="dashboard-trending-poster" />
                <div className="dashboard-trending-movie-title">{movie.title}</div>
                <div className="dashboard-trending-year">{movie.year}</div>
                <div className="dashboard-trending-desc">{movie.desc}</div>
                <button className="dashboard-trending-add">ADD TO DIARY</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
