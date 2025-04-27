import React, { useState, useEffect, useRef, createRef } from 'react';
import ReactDOM from 'react-dom';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, setDoc, getDoc, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import DiscussionSection from './DiscussionSection';
import { ShowEpisodes } from './MyShows';
import { FaChevronDown, FaChevronUp, FaArrowUp, FaEdit, FaCheck, FaTimes, FaVideo, FaSearch, FaPlusCircle, FaCheckCircle, FaTv, FaComments, FaUserCircle, FaArchive } from 'react-icons/fa';
import TMDbAttribution from "./TMDbAttribution";
import NotificationBanner from './components/NotificationBanner';

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
  const [diary, setDiary] = useState([]); // Now stores user diary entries
  const [providersMap, setProvidersMap] = useState({});
  const debounceTimeout = useRef(null);
  const lastManualSearch = useRef('');
  const [modalEntry, setModalEntry] = useState(null);
  const [modalContentRating, setModalContentRating] = useState('');
  const diaryRefs = useRef({});
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Username (Display Name) State
  const [displayName, setDisplayName] = useState('');
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');

  // Trending Movies/TV State
  const [trendingType, setTrendingType] = useState('movie');
  const [trending, setTrending] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState('');
  const [trendingPage, setTrendingPage] = useState(1);

  // Check if user is admin (by role or UID, here by Firestore user doc roles array)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    async function checkAdmin() {
      if (!currentUser) return;
      const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsAdmin(Array.isArray(data.roles) && data.roles.includes('admin'));
      } else {
      }
    }
    checkAdmin();
  }, [currentUser]);

  // Reset trending state when trendingType changes
  useEffect(() => {
    setTrending([]);
    setTrendingPage(1);
    setTrendingLoading(true);
    setTrendingError('');
  }, [trendingType]);

  // Fetch trending movies or tv shows from TMDb on trendingType or page change
  useEffect(() => {
    let isMounted = true;
    async function fetchTrending(page = 1) {
      setTrendingLoading(true);
      setTrendingError('');
      try {
        const res = await fetch(`https://api.themoviedb.org/3/trending/${trendingType}/week?api_key=${TMDB_API_KEY}&page=${page}`);
        if (!res.ok) throw new Error('Failed to fetch trending');
        const data = await res.json();
        if (isMounted) {
          setTrending(page === 1 ? data.results : prev => {
            // Prevent duplicates by id
            const ids = new Set(prev.map(x => x.id));
            return [...prev, ...data.results.filter(x => !ids.has(x.id))];
          });
        }
      } catch (err) {
        if (isMounted) setTrendingError('Could not load trending.');
      }
      if (isMounted) setTrendingLoading(false);
    }
    fetchTrending(trendingPage);
    return () => { isMounted = false; };
  }, [trendingType, trendingPage]);

  // When trending or diary changes, if visible trending < 12, fetch more
  useEffect(() => {
    const visibleTrending = trending.filter(item => !diary.some(d => d.id === item.id && d.media_type === trendingType));
    if (visibleTrending.length < 12 && trending.length < 100) { // prevent infinite fetch
      setTrendingPage(page => page + 1);
    }
  }, [trending, diary, trendingType]);

  // Fetch diary from Firestore
  useEffect(() => {
    if (!currentUser) return;
    async function fetchDiary() {
      const q = query(collection(db, 'diary'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      let entries = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      // Sort newest first
      entries = entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setDiary(entries);
      // Fetch providers for each entry
      for (const entry of entries) {
        fetchProviders(entry);
      }
    }
    fetchDiary();
    // eslint-disable-next-line
  }, [currentUser]);

  // Fetch display name from Firestore users collection
  useEffect(() => {
    // Clear displayName on logout
    if (!currentUser) {
      setDisplayName('');
      setNewDisplayName('');
      return;
    }
    let ignore = false;
    async function fetchDisplayName() {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      let name = '';
      if (userDoc.exists()) {
        name = userDoc.data().displayName || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : currentUser.uid);
      } else {
        name = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : currentUser.uid);
      }
      if (!ignore) {
        setDisplayName(name);
        setNewDisplayName(name);
      }
    }
    fetchDisplayName();
    return () => { ignore = true; };
  }, [currentUser && currentUser.uid]);

  // Firestore-cached TMDb provider fetcher
  async function fetchProviders(entry) {
    if (providersMap[entry.id]) return; // Already in local state
    const cacheDocRef = doc(db, 'tmdbProvidersCache', `${entry.media_type}_${entry.id}`);
    try {
      const cacheSnap = await getDoc(cacheDocRef);
      const now = Date.now();
      if (cacheSnap.exists()) {
        const data = cacheSnap.data();
        // Defensive: Ensure all provider types are present as arrays on cache read
        if (data.providers) {
          data.providers.flatrate = Array.isArray(data.providers.flatrate) ? data.providers.flatrate : [];
          data.providers.rent = Array.isArray(data.providers.rent) ? data.providers.rent : [];
          data.providers.buy = Array.isArray(data.providers.buy) ? data.providers.buy : [];
        }
        // Use cached if less than 24h old
        if (data.timestamp && now - data.timestamp < 24 * 60 * 60 * 1000) {
          setProvidersMap(prev => ({ ...prev, [entry.id]: data.providers }));
          return;
        }
      }
      // Not cached or stale, fetch from TMDb
      let url = '';
      if (entry.media_type === 'movie') {
        url = `${TMDB_BASE_URL}/movie/${entry.id}/watch/providers?api_key=${TMDB_API_KEY}`;
      } else {
        url = `${TMDB_BASE_URL}/tv/${entry.id}/watch/providers?api_key=${TMDB_API_KEY}`;
      }
      const res = await fetch(url);
      if (res.status === 404) {
        setProvidersMap(prev => ({ ...prev, [entry.id]: {} }));
        await setDoc(cacheDocRef, { providers: {}, timestamp: now });
        return;
      }
      const data = await res.json();
      const regionData = data.results?.[TMDB_REGION] || data.results?.[0];
      const cert = regionData?.release_dates?.find(d => d.certification)?.certification;
      // Defensive: Ensure all provider types (flatrate, rent, buy) are present and arrays
      regionData.flatrate = Array.isArray(regionData.flatrate) ? regionData.flatrate : [];
      regionData.rent = Array.isArray(regionData.rent) ? regionData.rent : [];
      regionData.buy = Array.isArray(regionData.buy) ? regionData.buy : [];
      setProvidersMap(prev => ({ ...prev, [entry.id]: regionData }));
      await setDoc(cacheDocRef, { providers: regionData, timestamp: now });
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
      archived: false,
      media_type: item.media_type || searchType,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'diary'), diaryEntry);
    // Refresh diary
    const q = query(collection(db, 'diary'), where('uid', '==', currentUser.uid));
    const snap = await getDocs(q);
    let entries = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
    // Sort newest first
    entries = entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setDiary(entries);
    fetchProviders(diaryEntry);
    setSearchResults([]);
    setSearchQuery('');
  }

  // Remove from Diary (Firestore) and close modal
  async function handleRemoveFromDiary(docId) {
    // Optimistically remove from UI
    setDiary(prev => prev.filter(d => d.docId !== docId));
    setModalEntry(null); // Close modal
    try {
      await deleteDoc(doc(db, 'diary', docId));
      // Optionally re-fetch to ensure consistency
      const q = query(collection(db, 'diary'), where('uid', '==', currentUser.uid));
      const snap = await getDocs(q);
      let entries = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
      // Sort newest first
      entries = entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setDiary(entries);
    } catch (e) {
      window.alert('Failed to remove entry. Please try again.');
    }
  }

  // Remove ALL from Diary (Firestore) and UI
  // async function handleRemoveAll() {
  //   if (!currentUser) return;
  //   // Optimistically clear UI
  //   setDiary([]);
  //   try {
  //     // Get all diary entries for this user
  //     const q = query(collection(db, 'diary'), where('uid', '==', currentUser.uid));
  //     const snap = await getDocs(q);
  //     // Delete each entry from Firestore
  //     const batchDeletes = snap.docs.map(docSnap => deleteDoc(doc(db, 'diary', docSnap.id)));
  //     await Promise.all(batchDeletes);
  //     // Optionally re-fetch to ensure consistency
  //     // (Can be omitted since setDiary([]) clears UI, but included for robustness)
  //     const newSnap = await getDocs(q);
  //     let entries = newSnap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
  //     entries = entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  //     setDiary(entries);
  //   } catch (e) {
  //     window.alert('Failed to remove all entries. Please try again.');
  //   }
  // }

  // Toggle Watched/Unwatched (Firestore) with Optimistic UI and Archive Logic
  async function handleToggleWatched(docId, watched) {
    // Compute new states
    const newWatched = !watched;
    const newArchived = newWatched; // If watched, archived=true; if unwatched, archived=false

    // Optimistically update UI
    setDiary(prev => prev.map(d => d.docId === docId ? { ...d, watched: newWatched, archived: newArchived } : d));
    setModalEntry(prev => {
      if (prev && prev.docId === docId) {
        return { ...prev, watched: newWatched, archived: newArchived };
      }
      return prev;
    });
    try {
      await updateDoc(doc(db, 'diary', docId), { watched: newWatched, archived: newArchived });
    } catch (e) {
      // If error, revert optimistic update
      setDiary(prev => prev.map(d => d.docId === docId ? { ...d, watched, archived: watched } : d));
      setModalEntry(prev => {
        if (prev && prev.docId === docId) {
          return { ...prev, watched, archived: watched };
        }
        return prev;
      });
      window.alert('Failed to update watched status. Please try again.');
    }
  }

  async function handleArchiveToggle(docId, archived) {
    setDiary(prev => prev.map(d => d.docId === docId ? { ...d, archived: !archived } : d));
    setModalEntry(prev => {
      if (prev && prev.docId === docId) {
        return { ...prev, archived: !archived };
      }
      return prev;
    });
    try {
      await updateDoc(doc(db, 'diary', docId), { archived: !archived });
    } catch (e) {
      setDiary(prev => prev.map(d => d.docId === docId ? { ...d, archived } : d));
      setModalEntry(prev => {
        if (prev && prev.docId === docId) {
          return { ...prev, archived };
        }
        return prev;
      });
      window.alert('Failed to update archive status. Please try again.');
    }
  }

  function handleShare(item) {
    const shareUrl = window.location.origin + '/showswatched2/?entry=' + encodeURIComponent(item.docId || item.id);
    const shareText = `Check out this show/movie: ${item.title}`;
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: shareText,
        url: shareUrl
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        window.alert('Link copied to clipboard!');
      }, () => {
        window.alert('Could not copy link.');
      });
    } else {
      window.prompt('Copy this link:', shareUrl);
    }
  }

  async function handleSignOut() {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      alert('Failed to sign out')
    }
  }

  // Save display name to Firestore
  async function handleSaveDisplayName() {
    if (!newDisplayName.trim()) {
      setDisplayNameError('Display name cannot be empty.');
      return;
    }
    setSavingDisplayName(true);
    setDisplayNameError('');
    try {
      await setDoc(doc(db, 'users', currentUser.uid), { displayName: newDisplayName.trim() }, { merge: true });
      setDisplayName(newDisplayName.trim());
      setEditingDisplayName(false);
      // Force a reload of the display name from Firestore after save
      // This ensures that after refresh, the latest username is fetched
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const name = userDoc.data().displayName || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : currentUser.uid);
        setDisplayName(name);
        setNewDisplayName(name);
      }
    } catch (e) {
      setDisplayNameError('Failed to update display name.');
    }
    setSavingDisplayName(false);
  }

  function handleEditDisplayName() {
    setNewDisplayName(displayName);
    setEditingDisplayName(true);
    setDisplayNameError('');
  }

  function handleCancelEditDisplayName() {
    setEditingDisplayName(false);
    setDisplayNameError('');
  }

  async function fetchContentRating(entry) {
    if (!entry) return '';
    try {
      if (entry.media_type === 'movie') {
        const res = await fetch(`${TMDB_BASE_URL}/movie/${entry.id}/release_dates?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        const us = data.results?.find(r => r.iso_3166_1 === TMDB_REGION) || data.results?.[0];
        const cert = us?.release_dates?.find(d => d.certification)?.certification;
        return cert || '';
      } else if (entry.media_type === 'tv') {
        const res = await fetch(`${TMDB_BASE_URL}/tv/${entry.id}/content_ratings?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        const us = data.results?.find(r => r.iso_3166_1 === TMDB_REGION) || data.results?.[0];
        return us?.rating || '';
      }
    } catch {
      return '';
    }
    return '';
  }

  function handleOpenModal(entry) {
    setModalEntry(entry);
    setModalContentRating('');
    fetchContentRating(entry).then(rating => setModalContentRating(rating || ''));
  }

  function DiaryModal({ entry, providersMap, onClose, onShare, onToggleWatched, onRemove, onArchiveToggle, diary, contentRating, onAddToDiary }) {
    if (!entry) return null; // Only remove from DOM when modal is closed

    // Get providers for this entry
    const providerData = providersMap[entry.id] || {};
    const streaming = providerData.flatrate || [];
    const rent = providerData.rent || [];
    const buy = providerData.buy || [];
    const liveEntry = entry;

    // Render modal via React Portal
    return ReactDOM.createPortal(
      (
        <div className="dashboard-modal-overlay" onClick={onClose}>
          <div className="dashboard-modal-content" onClick={e => e.stopPropagation()} style={{ background: '#23242a' }}>
            <button
              className="dashboard-modal-close"
              onClick={onClose}
              aria-label="Close modal"
              type="button"
            >
              ×
            </button>
            <div className="dashboard-modal-body">
              <img
                className="dashboard-diary-poster"
                src={liveEntry.poster_path ? `https://image.tmdb.org/t/p/w300${liveEntry.poster_path}` : (liveEntry.poster || 'https://placehold.co/120x170?text=No+Image')}
                alt={liveEntry.title}
                style={{marginBottom: '1rem'}}
              />
              <div className="dashboard-diary-movie-title">{liveEntry.title}</div>
              <div className="dashboard-diary-date">
                {liveEntry.release_date ? liveEntry.release_date.slice(0, 4) : (liveEntry.date || '')}
                {contentRating && <span style={{marginLeft:8, color:'#ffe066', fontWeight:600}}>{contentRating}</span>}
              </div>
              <div className="dashboard-diary-desc">{liveEntry.overview || liveEntry.desc || ''}</div>
              <div className="dashboard-diary-providers-modal">
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
              {(entry.media_type === 'tv') && (entry.tmdbId || entry.id) && (
                <div style={{ margin: '1.2rem 0 0.8rem 0', display: 'flex', justifyContent: 'center' }}>
                  <ShowEpisodes show={{ ...entry, tmdbId: entry.tmdbId || entry.id }} />
                </div>
              )}
              {/* BUTTONS: SHARE, WATCHED/UNWATCHED, ARCHIVE, REMOVE - now stacked vertically */}
              <div className="dashboard-diary-btn-row dashboard-diary-btn-row--modal" style={{flexDirection:'column',alignItems:'stretch',gap:'0.7rem',paddingLeft:0,paddingRight:0,marginTop:'1.2rem',marginBottom:'0.5rem'}}>
                <button className="dashboard-diary-share" onClick={() => onShare(liveEntry)} title="Share this diary entry with friends via link or social media">SHARE</button>
                <button
                  className={liveEntry.watched ? "dashboard-diary-watched" : "dashboard-diary-unwatched"}
                  onClick={() => onToggleWatched(liveEntry.docId, liveEntry.watched)}
                  title={liveEntry.watched ? "Mark as not watched" : "Mark as watched"}
                >
                  {liveEntry.watched ? 'WATCHED' : 'UNWATCHED'}
                </button>
                <button
                  className="dashboard-diary-archive"
                  style={{ background: entry.archived ? '#b2b2b2' : '#25609c', color: entry.archived ? '#333' : '#fff', borderRadius: '7px', padding: '0.7rem 2.2rem', fontWeight: 700, fontFamily: 'Orbitron, Arial, sans-serif', fontSize: '1rem' }}
                  onClick={() => onArchiveToggle(entry.docId, entry.archived)}
                  title={entry.archived ? "Move this entry back to active diary" : "Archive this entry (hide from main diary)"}
                >
                  {entry.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button className="dashboard-diary-remove" onClick={() => onRemove(liveEntry.docId)} title="Remove this diary entry permanently">REMOVE</button>
                {!diary.some(d => d.docId === entry.docId || d.id === entry.id) && (
                  <button
                    className="dashboard-diary-share"
                    style={{ background: '#35b36b', color: '#fff', marginLeft: 8, fontWeight: 700 }}
                    onClick={() => onAddToDiary(entry)}
                  >
                    Add to Diary
                  </button>
                )}
              </div>
              {/* Discussion Section as Card/Panel */}
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(30,32,38,0.85)',
                boxShadow: '0 1px 8px #0002',
                border: '1px solid #2f3138',
                width: 'calc(100% + 80px)',
                maxWidth: 'none',
                marginLeft: '-40px',
                marginRight: '-40px'
              }}>
                <h3 style={{marginTop: 0, marginBottom: '1rem'}}>Discussion</h3>
                <DiscussionSection entryId={liveEntry.id} />
              </div>
            </div>
          </div>
        </div>
      ),
      document.getElementById('modal-root')
    );
  }

  const MemoDiaryModal = React.memo(DiaryModal);

  // Helper to get all unique providers from diary entries for current searchType
  function getAllProvidersFromDiaryByType() {
    const providerMap = {};
    diary.filter(entry => entry.media_type === searchType).forEach(entry => {
      const prov = providersMap[entry.id];
      if (!prov) return;
      [ ...(prov.flatrate || []), ...(prov.rent || []), ...(prov.buy || []) ].forEach(p => {
        providerMap[p.provider_id] = p;
      });
    });
    return Object.values(providerMap);
  }

  // Filter diary by selected provider and searchType, only show non-archived entries
  const providerFilteredDiary = selectedProvider
    ? diary.filter(entry => {
        if (entry.media_type !== searchType) return false;
        if (entry.archived) return false; // Only active (non-archived) entries
        const prov = providersMap[entry.id];
        if (!prov) return false;
        return [ ...(prov.flatrate || []), ...(prov.rent || []), ...(prov.buy || []) ]
          .some(p => p.provider_id === selectedProvider.provider_id);
      })
    : diary.filter(entry => entry.media_type === searchType && !entry.archived);

  // Provider Modal Component
  function ProviderModal({ open, onClose, providers, onSelect }) {
    if (!open) return null;
    return ReactDOM.createPortal(
      <div className="dashboard-modal-overlay" onClick={onClose}>
        <div className="dashboard-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, padding: 24 }}>
          <button className="dashboard-modal-close" onClick={onClose} aria-label="Close modal" type="button">×</button>
          <h2 style={{ color: '#fff', textAlign: 'center', marginBottom: 18 }}>Click to View Streaming Providers</h2>
          <div style={{ margin: '0 0 12px 0', color: '#8fc7ff', fontSize: '1.02rem', textAlign: 'center', fontWeight: 500 }}>
            View all providers. Click on a provider icon below to filter your diary and see which shows can be watched for that provider.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            {providers.map(p => (
              <img
                key={p.provider_id}
                src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                alt={p.provider_name}
                title={p.provider_name}
                className="dashboard-provider-icon-sm"
                style={{ cursor: 'pointer', border: selectedProvider && selectedProvider.provider_id === p.provider_id ? '2px solid #8fc7ff' : '2px solid transparent' }}
                onClick={() => {
                  onSelect(p);
                  setSelectedProvider(p);
                }}
              />
            ))}
          </div>
          {selectedProvider && (
            <button style={{ margin: '18px auto 0', display: 'block' }} onClick={() => setSelectedProvider(null)}>Show All Entries</button>
          )}
          <div style={{ marginTop: 24 }}>
            {providerFilteredDiary.length === 0 ? (
              <div style={{ color: '#aaa', textAlign: 'center' }}>No entries for this provider.</div>
            ) : (
              <div className="provider-modal-cards-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1.2rem', justifyItems: 'center', alignItems: 'stretch', marginTop: '1rem', width: '100%', overflowX: 'auto', boxSizing: 'border-box' }}>
                {providerFilteredDiary.map(entry => (
                  <section
                    key={entry.docId}
                    className="dashboard-diary-card collapsed"
                    style={{ width: '100%', maxWidth: '120px', minHeight: '210px', background: '#23242a', borderRadius: '10px', boxShadow: '0 2px 8px #0003', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0.2rem 0.9rem 0.2rem', margin: 0, boxSizing: 'border-box', justifySelf: 'center', cursor: 'pointer' }}
                    onClick={() => {
                      handleOpenModal(entry);
                      onClose();
                    }}
                  >
                    <div className="dashboard-diary-poster-col collapsed" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <img src={entry.poster} alt={entry.title} className="dashboard-diary-poster collapsed" style={{ width: '100px', height: '145px', objectFit: 'cover', borderRadius: '7px', marginBottom: '0.5rem' }} />
                    </div>
                    <div className="dashboard-diary-movie-title collapsed" style={{ textAlign: 'center', color: '#fff', fontSize: '1.02rem', fontWeight: 600, marginTop: '0.2rem', marginBottom: '0.1rem', wordBreak: 'break-word', width: '100%' }}>{entry.title}</div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.getElementById('modal-root')
    );
  }

  // Filtered Diary
  const activeDiary = diary.filter(entry => !entry.archived && entry.media_type === searchType);
  const archivedDiary = diary.filter(entry => entry.archived && entry.media_type === searchType);

  // Trending selector UI handlers
  function handleTrendingType(type) {
    setTrendingType(type);
  }

  function handleAddTrendingToDiary(item) {
    handleAddToDiary({
      id: item.id,
      title: item.title || item.name,
      poster_path: item.poster_path,
      release_date: item.release_date || item.first_air_date,
      overview: item.overview,
      media_type: trendingType,
    });
    setTrending(prev => prev.filter(t => t.id !== item.id));
  }

  // BackToTopButton component
  function BackToTopButton() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      function onScroll() {
        setVisible(window.scrollY > 300);
      }
      window.addEventListener('scroll', onScroll);
      return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleClick = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return visible ? (
      <button
        onClick={handleClick}
        style={{
          position: 'fixed',
          right: 18,
          bottom: 28,
          zIndex: 9999,
          background: 'rgba(37,96,156,0.93)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 54,
          height: 54,
          boxShadow: '0 3px 12px #0005',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          cursor: 'pointer',
          touchAction: 'manipulation',
        }}
        aria-label="Back to top"
        className="back-to-top-btn"
      >
        <span style={{ fontSize: 45, marginTop: -2 }}>↑</span>
      </button>
    ) : null;
  }

  // --- Notification state ---
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  useEffect(() => {
    let unsub = false;
    async function fetchNotifications() {
      if (!currentUser) return;
      setLoadingNotifications(true);
      const q = query(
        collection(db, `users/${currentUser.uid}/notifications`),
        where('read', '==', false),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const notificationsArr = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (!unsub) {
        setNotifications(notificationsArr);
        setLoadingNotifications(false);
      }
    }
    fetchNotifications();
    return () => { unsub = true; };
  }, [currentUser, db]);

  async function handleDismissNotification(id) {
    if (!currentUser) return;
    await updateDoc(doc(db, `users/${currentUser.uid}/notifications`, id), { read: true });
    setNotifications(notifications.filter(n => n.id !== id));
  }

  // --- Instructions Modal State ---
  const [showInstructions, setShowInstructions] = useState(false);

  // --- Instructions Modal Component ---
  function InstructionsModal({ open, onClose }) {
    if (!open) return null;
    return ReactDOM.createPortal(
      <div className="dashboard-modal-overlay" onClick={onClose}>
        <div className="dashboard-modal-content dashboard-instructions-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 780, padding: 36, background: '#23242a', color: '#e8f0fe', borderRadius: 18, boxShadow: '0 4px 32px #205a7a22' }}>
          <button className="dashboard-modal-close" onClick={onClose} aria-label="Close modal" type="button">×</button>
          <h2 style={{ color: '#8fc7ff', textAlign: 'center', marginBottom: 24, fontWeight: 700, fontSize: '2rem' }}>How to Use This Dashboard</h2>
          <div className="dashboard-instructions-grid">
            <div className="dashboard-instruction-card">
              <FaSearch size={30} style={{ color: '#8fc7ff', marginBottom: 8 }} />
              <div className="dashboard-instruction-title">Search for a Show or Movie</div>
              <div className="dashboard-instruction-desc">Use the search bar at the top to find movies or TV shows. Results come from TMDb.</div>
            </div>
            <div className="dashboard-instruction-card">
              <FaPlusCircle size={30} style={{ color: '#8fc7ff', marginBottom: 8 }} />
              <div className="dashboard-instruction-title">Add to Your Diary</div>
              <div className="dashboard-instruction-desc">Click on a result to add it to your diary. Track what you’ve watched or want to watch.</div>
            </div>
            <div className="dashboard-instruction-card">
              <FaCheckCircle size={30} style={{ color: '#8fc7ff', marginBottom: 8 }} />
              <div className="dashboard-instruction-title">Mark as Watched/Unwatched</div>
              <div className="dashboard-instruction-desc">Toggle the watched status for each diary entry to keep your list up to date.</div>
            </div>
            <div className="dashboard-instruction-card">
              <FaEdit size={30} style={{ color: '#8fc7ff', marginBottom: 8 }} />
              <div className="dashboard-instruction-title">Edit or Remove Entries</div>
              <div className="dashboard-instruction-desc">Click a diary entry to view details, edit notes, or remove it from your diary.</div>
            </div>
            <div className="dashboard-instruction-card">
              <FaTv size={30} style={{ color: '#8fc7ff', marginBottom: 8 }} />
              <div className="dashboard-instruction-title">View Streaming Providers</div>
              <div className="dashboard-instruction-desc">See where you can stream each show or movie (US region by default).</div>
            </div>
            <div className="dashboard-instruction-card">
              <FaComments size={30} style={{ color: '#8fc7ff', marginBottom: 8 }} />
              <div className="dashboard-instruction-title">Join Discussions</div>
              <div className="dashboard-instruction-desc">Add comments or replies to discuss shows with others. Upvote or downvote comments.</div>
            </div>
            <div className="dashboard-instruction-card">
              <FaUserCircle size={30} style={{ color: '#8fc7ff', marginBottom: 8 }} />
              <div className="dashboard-instruction-title">Manage Your Profile</div>
              <div className="dashboard-instruction-title">Update your display name and view your activity stats at the top of the dashboard.</div>
            </div>
            <div className="dashboard-instruction-card">
              <FaArchive size={30} style={{ color: '#8fc7ff', marginBottom: 8 }} />
              <div className="dashboard-instruction-title">Archive Entries</div>
              <div className="dashboard-instruction-desc">Archive shows/movies you’ve finished or want to hide from your main list. Toggle "Show Archived" to view them.</div>
            </div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #355a7a', margin: '30px 0 18px 0' }} />
          <div style={{ textAlign: 'center', color: '#b8c6e4', fontSize: '1.08rem' }}>
            Need more help? <a href="#" style={{ color: '#8fc7ff', fontWeight: 600, textDecoration: 'underline' }}>Contact support</a> or <a href="#" style={{ color: '#8fc7ff', fontWeight: 600, textDecoration: 'underline' }}>check the FAQ</a>
          </div>
          <style>{`
            .dashboard-instructions-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 28px 32px;
              margin-bottom: 0;
            }
            .dashboard-instruction-card {
              background: rgba(37,96,156,0.13);
              border-radius: 14px;
              padding: 22px 18px 18px 18px;
              box-shadow: 0 2px 12px #0002;
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              min-height: 120px;
              transition: box-shadow 0.18s;
            }
            .dashboard-instruction-title {
              font-weight: 700;
              font-size: 1.14rem;
              margin-bottom: 6px;
              color: #e8f0fe;
            }
            .dashboard-instruction-desc {
              font-size: 1.07rem;
              color: #b8c6e4;
              font-weight: 400;
            }
            @media (max-width: 800px) {
              .dashboard-instructions-grid {
                grid-template-columns: 1fr;
                gap: 18px 0;
              }
            }
          `}</style>
        </div>
      </div>,
      document.getElementById('modal-root')
    );
  }

  // Add useEffect to open modal if ?entry= is present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const entryId = params.get('entry');
    if (entryId) {
      // Try to find in diary first
      const found = diary.find(d => d.docId === entryId || d.id === entryId);
      if (found) {
        setModalEntry(found);
      } else {
        // Not in diary, try to fetch from TMDb (movie or tv)
        (async () => {
          let data = null;
          let mediaType = 'movie';
          // Try movie first
          let url = `${TMDB_BASE_URL}/movie/${entryId}?api_key=${TMDB_API_KEY}`;
          let res = await fetch(url);
          if (res.ok) {
            data = await res.json();
            mediaType = 'movie';
          } else {
            // Try tv
            url = `${TMDB_BASE_URL}/tv/${entryId}?api_key=${TMDB_API_KEY}`;
            res = await fetch(url);
            if (res.ok) {
              data = await res.json();
              mediaType = 'tv';
            }
          }
          if (data) {
            // Normalize to diary entry shape
            const entry = {
              id: data.id,
              title: data.title || data.name,
              poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '',
              desc: data.overview,
              media_type: mediaType,
              watched: false,
              archived: false
            };
            setModalEntry(entry);
          }
        })();
      }
    }
  // Only run on mount and when diary changes
  }, [diary]);

  return (
    <div style={{ background: '#23242a', minHeight: '100vh', width: '100vw' }}>
      {/* Notification banners (force at top for debug) */}
      {notifications.map(n => (
        <NotificationBanner key={n.id} notification={n} onDismiss={() => handleDismissNotification(n.id)} />
      ))}
      {/* Show Instructions Button above dashboard banner */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, marginBottom: 8 }}>
        <button
          className="dashboard-toggle"
          style={{
            fontSize: '1.07rem',
            padding: '0.6rem 1.5rem',
            fontWeight: 700,
            background: '#25609c',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            boxShadow: '0 2px 10px #205a7a33',
            cursor: 'pointer',
            transition: 'background 0.18s, color 0.18s',
            letterSpacing: 1
          }}
          onClick={() => setShowInstructions(true)}
        >
          Show Instructions
        </button>
      </div>
      <InstructionsModal open={showInstructions} onClose={() => setShowInstructions(false)} />
      <div className="dashboard-bg">
        <style>
          {`
            .dashboard-trending-movie-title {
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              min-height: 2.7em;
              max-height: 2.7em;
              line-height: 1.35em;
              font-size: 1.07rem;
              font-weight: 600;
              color: #fff;
              margin: 0.7em 0 0.2em 0;
              text-align: center;
            }
            .dashboard-trending-desc {
              display: -webkit-box;
              -webkit-line-clamp: 5;
              -webkit-box-orient: vertical;
              overflow: hidden;
              min-height: 6.75em;
              max-height: 6.75em;
              line-height: 1.35em;
              font-size: 0.98rem;
              color: #c7d0e0;
              margin-bottom: 1em;
              text-align: center;
            }
          `}
        </style>
        <div className="dashboard-content-wrapper">
          {/* Welcome Banner */}
          <div className="dashboard-banner">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* Logo at the top */}
              {/* Removed SVG video icon as requested */}
              {/* <FaVideo size={48} style={{ color: '#fff', marginBottom: 12 }} /> */}
              {/* Display Name Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ color: '#fff', fontWeight: 500, fontSize: '1.13rem', marginRight: 6 }}>
                  Display Name:
                </span>
                {editingDisplayName ? (
                  <>
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={e => setNewDisplayName(e.target.value)}
                      style={{
                        fontWeight: 700,
                        color: '#25609c',
                        background: '#23242a',
                        border: '1px solid #2f3138',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: '1.13rem',
                        outline: 'none',
                        width: 140
                      }}
                      disabled={savingDisplayName}
                      autoFocus
                    />
                    <button onClick={handleSaveDisplayName} disabled={savingDisplayName} style={{ background: 'none', border: 'none', color: '#35b36b', cursor: 'pointer', fontSize: 20, marginLeft: 6 }} title="Save"><FaCheck /></button>
                    <button onClick={handleCancelEditDisplayName} disabled={savingDisplayName} style={{ background: 'none', border: 'none', color: '#ff5a5a', cursor: 'pointer', fontSize: 20, marginLeft: 2 }} title="Cancel"><FaTimes /></button>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 700, color: '#35b36b', fontSize: '1.13rem', background: '#23242a', border: '1px solid #2f3138', borderRadius: 6, padding: '5px 10px', minWidth: 80, display: 'inline-block' }}>{displayName}</span>
                    <button onClick={handleEditDisplayName} style={{ background: 'none', border: 'none', color: '#8fc7ff', cursor: 'pointer', fontSize: 18, marginLeft: 6 }} title="Edit"><FaEdit /></button>
                  </>
                )}
              </div>
              {displayNameError && <div style={{ color: '#ff5a5a', marginTop: 4 }}>{displayNameError}</div>}
              {/* Logout and Admin Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button
                  className="dashboard-signout"
                  onClick={async () => {
                    try {
                      await logout();
                      window.localStorage.clear();
                      window.sessionStorage.clear();
                      navigate('/');
                      window.location.reload();
                    } catch (err) {
                      alert('Failed to sign out');
                    }
                  }}
                  style={{
                    background: '#2a1b1b',
                    color: '#ffb3b3',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 32px',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    letterSpacing: 1,
                    boxShadow: '0 2px 10px #205a7a33',
                    cursor: 'pointer',
                    transition: 'background 0.18s, color 0.18s',
                    marginBottom: '1.5rem',
                    marginTop: '0.5rem',
                    float: 'right',
                    zIndex: 1000,
                    minWidth: 180,
                    width: 220,
                    maxWidth: 260
                  }}
                >
                  Sign Out
                </button>
                {isAdmin && (
                  <button
                    className="dashboard-admin-btn"
                    style={{
                      background: '#25609c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 32px',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      letterSpacing: 1,
                      boxShadow: '0 2px 10px #205a7a33',
                      cursor: 'pointer',
                      transition: 'background 0.18s, color 0.18s',
                      marginBottom: '1.5rem',
                      marginTop: '0.5rem',
                      float: 'right',
                      zIndex: 1000,
                      minWidth: 180,
                      width: 220,
                      maxWidth: 260
                    }}
                    onClick={() => navigate('/admin')}
                  >
                    Admin Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Search Section */}
          <div className="dashboard-search-section">
            <img src="https://img.icons8.com/ios-filled/100/ffffff/movie-projector.png" alt="App Icon" className="dashboard-logo" />
            <div className="dashboard-search-title">Search for Movies / Tv Shows</div>
            <div style={{ height: '1.1rem' }}></div>
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
          {/* Monetization Banner - AdSense or Affiliate */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '1.5rem 0' }}>
            {/* AdSense Banner Example */}
            <ins className="adsbygoogle"
              style={{ display: 'block', width: '100%', maxWidth: 728, minHeight: 90 }}
              data-ad-client="ca-pub-5502818698237515"  // Replace with your AdSense publisher ID
              data-ad-slot="1749671682"            // Replace with your AdSense ad slot
              data-ad-format="auto"></ins>
          </div>
          {/* Monetization Banner END */}
          {/* Diary Section */}
          <div className="dashboard-diary-section">
            <div className="dashboard-diary-title">My Diary</div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0 2rem 0', gap: '1.2rem' }}>
              <button className={`dashboard-toggle${!showArchived ? ' active' : ''}`} onClick={() => setShowArchived(false)}>
                My Diary
              </button>
              <button className={`dashboard-toggle${showArchived ? ' active' : ''}`} onClick={() => setShowArchived(true)}>
                Archived
              </button>
            </div>
            <div className="dashboard-diary-providers-row">
              <button className="dashboard-providers-btn" onClick={() => setShowProviderModal(true)} title="View all providers. Click on a provider icon to see which shows can be watched for that provider.">Click to View Streaming Providers</button>
              {/* <button className="dashboard-remove-all-btn" onClick={handleRemoveAll}>REMOVE ALL</button> */}
            </div>
            {showArchived ? (
              archivedDiary.length === 0 ? (
                <div style={{ color: '#aaa', margin: '2rem 0', textAlign: 'center' }}>No archived entries.</div>
              ) : (
                <div className="dashboard-diary-cards-row">
                  {archivedDiary.map(entry => {
                    if (!diaryRefs.current[entry.docId]) diaryRefs.current[entry.docId] = createRef();
                    return (
                      <section
                        key={entry.docId}
                        ref={el => (diaryRefs.current[entry.docId] = el)}
                        className="dashboard-diary-card collapsed"
                      >
                        <div className="dashboard-diary-poster-col collapsed">
                          <img src={entry.poster} alt={entry.title} className="dashboard-diary-poster collapsed" />
                        </div>
                        <div className="dashboard-diary-movie-title collapsed">{entry.title}</div>
                        <button
                          className="dashboard-diary-showmore"
                          onClick={() => handleOpenModal(entry)}
                        >
                          Show More <FaChevronDown />
                        </button>
                      </section>
                    );
                  })}
                </div>
              )
            ) : (
              activeDiary.length === 0 ? (
                <div style={{ color: '#aaa', margin: '2rem 0', textAlign: 'center' }}>No entries in your diary.</div>
              ) : (
                <div className="dashboard-diary-cards-row">
                  {activeDiary.map(entry => {
                    if (!diaryRefs.current[entry.docId]) diaryRefs.current[entry.docId] = createRef();
                    return (
                      <section
                        key={entry.docId}
                        ref={el => (diaryRefs.current[entry.docId] = el)}
                        className="dashboard-diary-card collapsed"
                      >
                        <div className="dashboard-diary-poster-col collapsed">
                          <img src={entry.poster} alt={entry.title} className="dashboard-diary-poster collapsed" />
                        </div>
                        <div className="dashboard-diary-movie-title collapsed">{entry.title}</div>
                        <button
                          className="dashboard-diary-showmore"
                          onClick={() => handleOpenModal(entry)}
                        >
                          Show More <FaChevronDown />
                        </button>
                      </section>
                    );
                  })}
                </div>
              )
            )}
          </div>
          {/* White separator between diary and trending section */}
          <div style={{width:'100%',height: '10px',background: '#fff',borderRadius:'2px',margin: '2.5rem 0 2.2rem 0',boxShadow:'0 1px 8px #0002'}}></div>
          {/* Trending Movies Section */}
          <div className="dashboard-trending-section">
            {/* Move and center the trending title above the selector */}
            <div className="dashboard-trending-title" style={{textAlign:'center',fontSize:'1.7rem',fontWeight:700,marginBottom:'1.2rem',color:'#fff'}}>
              Trending {trendingType === 'movie' ? 'Movies' : 'TV Shows'}
            </div>
            <div className="dashboard-trending-toggle-row" style={{display:'flex',alignItems:'center',gap:12,justifyContent:'center',marginBottom:'1.2rem'}}>
              <button
                className={trendingType==='movie' ? 'dashboard-toggle active' : 'dashboard-toggle'}
                style={{fontSize:'0.97rem',padding:'0.4em 1.2em'}}
                onClick={() => handleTrendingType('movie')}
              >Movies</button>
              <button
                className={trendingType==='tv' ? 'dashboard-toggle active' : 'dashboard-toggle'}
                style={{fontSize:'0.97rem',padding:'0.4em 1.2em'}}
                onClick={() => handleTrendingType('tv')}
              >TV Shows</button>
            </div>
            <div className="dashboard-trending-row" style={{display:'grid',gridTemplateColumns:'repeat(5, 1fr)',gap:'1.2rem',justifyItems:'center',alignItems:'stretch',marginTop:'0.5rem'}}>
              {trendingLoading ? (
                <div style={{ color: '#aaa', margin: '2rem 0', textAlign: 'center', gridColumn: '1 / -1' }}>Loading…</div>
              ) : trendingError ? (
                <div style={{ color: '#ff5a5a', margin: '2rem 0', textAlign: 'center', gridColumn: '1 / -1' }}>{trendingError}</div>
              ) : (
                trending
                  .filter(item => !diary.some(d => d.id === item.id && d.media_type === trendingType))
                  .slice(0, 10)
                  .map(item => (
                    <div className="dashboard-trending-card" key={item.id}>
                      <img
                        src={item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://placehold.co/120x170?text=No+Image'}
                        alt={item.title || item.name}
                        className="dashboard-trending-poster"
                      />
                      <div className="dashboard-trending-movie-title">{item.title || item.name}</div>
                      <div className="dashboard-trending-year">{(item.release_date || item.first_air_date || '').slice(0, 4)}</div>
                      <div className="dashboard-trending-desc">{item.overview ? item.overview.slice(0, 90) + (item.overview.length > 90 ? '…' : '') : 'No description.'}</div>
                      <button className="dashboard-trending-add" onClick={() => handleAddTrendingToDiary(item)}>
                        ADD TO DIARY
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
      {modalEntry && (
        <DiaryModal
          entry={modalEntry}
          providersMap={providersMap}
          onClose={() => setModalEntry(null)}
          onShare={handleShare}
          onToggleWatched={handleToggleWatched}
          onRemove={handleRemoveFromDiary}
          onArchiveToggle={handleArchiveToggle}
          diary={diary}
          contentRating={modalContentRating}
          onAddToDiary={handleAddToDiary}
        />
      )}
      <ProviderModal
        open={showProviderModal}
        onClose={() => { setShowProviderModal(false); setSelectedProvider(null); }}
        providers={getAllProvidersFromDiaryByType()}
        onSelect={p => setSelectedProvider(p)}
      />
      <BackToTopButton />
      <TMDbAttribution />
    </div>
  );
}
