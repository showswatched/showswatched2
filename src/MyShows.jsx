import { useState, useEffect } from 'react';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const STATUS_OPTIONS = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'to watch', label: 'To Watch' }
];

export default function MyShows() {
  const { currentUser } = useAuth();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', season: '', episode: '', status: 'watching', genre: '' });
  const [filter, setFilter] = useState({ status: '', genre: '', search: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', season: '', episode: '', status: 'watching', genre: '' });

  useEffect(() => {
    async function fetchShows() {
      setLoading(true);
      setError('');
      try {
        const q = query(collection(db, 'shows'), where('uid', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        setShows(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setError('Failed to load shows.');
      }
      setLoading(false);
    }
    if (currentUser) fetchShows();
  }, [currentUser]);

  function getFilteredShows() {
    return shows.filter(show => {
      const matchStatus = filter.status ? show.status === filter.status : true;
      const matchGenre = filter.genre ? (show.genre || '').toLowerCase().includes(filter.genre.toLowerCase()) : true;
      const matchSearch = filter.search ? (show.title || '').toLowerCase().includes(filter.search.toLowerCase()) : true;
      return matchStatus && matchGenre && matchSearch;
    });
  }

  async function handleAddShow(e) {
    e.preventDefault();
    setError('');
    try {
      await addDoc(collection(db, 'shows'), {
        ...form,
        uid: currentUser.uid,
        createdAt: new Date().toISOString()
      });
      setForm({ title: '', season: '', episode: '', status: 'watching', genre: '' });
      const q = query(collection(db, 'shows'), where('uid', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      setShows(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      setError('Failed to add show.');
    }
  }

  async function handleDeleteShow(id) {
    setError('');
    try {
      await deleteDoc(doc(db, 'shows', id));
      setShows(shows.filter(show => show.id !== id));
    } catch (err) {
      setError('Failed to delete show.');
    }
  }

  function handleEditShow(show) {
    setEditId(show.id);
    setEditForm({
      title: show.title,
      season: show.season,
      episode: show.episode,
      status: show.status,
      genre: show.genre
    });
  }

  async function handleUpdateShow(e) {
    e.preventDefault();
    setError('');
    try {
      await updateDoc(doc(db, 'shows', editId), editForm);
      setShows(shows.map(show => show.id === editId ? { ...show, ...editForm } : show));
      setEditId(null);
    } catch (err) {
      setError('Failed to update show.');
    }
  }

  function handleCancelEdit() {
    setEditId(null);
  }

  const filteredShows = getFilteredShows();

  return (
    <div className="myshows-container">
      <h2>My Shows</h2>
      <form className="add-show-form" onSubmit={handleAddShow}>
        <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Season" value={form.season} onChange={e => setForm({ ...form, season: e.target.value })} />
        <input placeholder="Episode" value={form.episode} onChange={e => setForm({ ...form, episode: e.target.value })} />
        <input placeholder="Genre" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} />
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
          {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <button type="submit">Add Show</button>
      </form>
      <div className="filter-bar">
        <input placeholder="Search title..." value={filter.search} onChange={e => setFilter({ ...filter, search: e.target.value })} />
        <input placeholder="Genre" value={filter.genre} onChange={e => setFilter({ ...filter, genre: e.target.value })} />
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
      {error && <div className="error">{error}</div>}
      {loading ? <p>Loading...</p> : (
        <ul className="shows-list">
          {filteredShows.length === 0 ? <li>No shows found.</li> : filteredShows.map(show => (
            <li key={show.id}>
              {editId === show.id ? (
                <form className="edit-show-form" onSubmit={handleUpdateShow}>
                  <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required />
                  <input value={editForm.season} onChange={e => setEditForm({ ...editForm, season: e.target.value })} />
                  <input value={editForm.episode} onChange={e => setEditForm({ ...editForm, episode: e.target.value })} />
                  <input value={editForm.genre} onChange={e => setEditForm({ ...editForm, genre: e.target.value })} />
                  <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <button type="submit">Save</button>
                  <button type="button" onClick={handleCancelEdit}>Cancel</button>
                </form>
              ) : (
                <>
                  <strong>{show.title}</strong> (S{show.season || '-'}E{show.episode || '-'}) - {show.genre || 'No genre'}<br />
                  Status: {show.status}
                  <button onClick={() => handleEditShow(show)} style={{ marginLeft: '1em' }}>Edit</button>
                  <button onClick={() => handleDeleteShow(show.id)} style={{ marginLeft: '0.5em' }}>Delete</button>
                  {show.tmdbId && show.season && (
                    <ShowEpisodes show={show} />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShowEpisodes({ show }) {
  const [expanded, setExpanded] = useState(false);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch seasons when expanded
  const handleShowMore = async () => {
    if (!expanded && show.tmdbId) {
      setLoading(true);
      setError('');
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY;
        const url = `https://api.themoviedb.org/3/tv/${show.tmdbId}?api_key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        setSeasons(data.seasons || []);
        // Default to first season if available
        if (data.seasons && data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0].season_number);
        }
      } catch (e) {
        setError('Failed to load seasons.');
      }
      setLoading(false);
    }
    setExpanded(v => !v);
  };

  // Fetch episodes when selectedSeason changes
  useEffect(() => {
    const fetchEpisodes = async () => {
      if (show.tmdbId && selectedSeason != null) {
        setLoading(true);
        setError('');
        try {
          const apiKey = import.meta.env.VITE_TMDB_API_KEY;
          const url = `https://api.themoviedb.org/3/tv/${show.tmdbId}/season/${selectedSeason}?api_key=${apiKey}`;
          const res = await fetch(url);
          const data = await res.json();
          setEpisodes(data.episodes || []);
        } catch (e) {
          setError('Failed to load episodes.');
        }
        setLoading(false);
      }
    };
    fetchEpisodes();
  }, [show.tmdbId, selectedSeason]);

  return (
    <div style={{ marginTop: '0.7em', marginBottom: '0.3em', textAlign: 'left' }}>
      <button
        onClick={handleShowMore}
        className="dashboard-diary-collapse-btn"
        style={{ minWidth: 140, fontWeight: 'bold', background: '#ffe066', color: '#205a7a', border: '2px solid #205a7a', fontSize: '1.08rem', boxShadow: '0 2px 8px #0005', marginBottom: 6 }}
      >
        {expanded ? 'Hide Episodes' : '▶ Show Episodes'}
      </button>
      {expanded && (
        <div className="episodes-list" style={{ marginTop: 10, marginBottom: 8, background: '#f8f9fa', borderRadius: 8, padding: '10px 16px', boxShadow: '0 1px 6px #0002' }}>
          {loading ? <div>Loading...</div> : error ? <div style={{ color: 'red' }}>{error}</div> : (
            <>
              {seasons.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <label htmlFor="season-select" style={{ fontWeight: 600, color: '#205a7a', marginRight: 8 }}>Season:</label>
                  <select
                    id="season-select"
                    value={selectedSeason || ''}
                    onChange={e => setSelectedSeason(Number(e.target.value))}
                    style={{ fontWeight: 600, fontSize: '1rem', padding: '0.3em 0.7em', borderRadius: 5, border: '1px solid #205a7a', color: '#205a7a', background: '#fff' }}
                  >
                    {seasons.map(season => (
                      <option key={season.id || season.season_number} value={season.season_number}>
                        {season.name || `Season ${season.season_number}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {episodes.length > 0 ? (
                <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
                  {episodes.map(ep => (
                    <li key={ep.id || ep.episode_number} style={{ marginBottom: 3, color: '#205a7a', fontWeight: 500 }}>
                      <strong>Ep {ep.episode_number}:</strong> {ep.name} {ep.air_date ? <span style={{ color: '#888', fontWeight: 400 }}>({ep.air_date})</span> : ''}
                    </li>
                  ))}
                </ul>
              ) : <div>No episodes found.</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { ShowEpisodes };
