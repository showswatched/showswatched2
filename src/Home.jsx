import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './Home.css';
import { useEffect, useState } from 'react';

const features = [
  {
    icon: <span style={{fontSize:'2.4rem',color:'#fff',display:'flex',justifyContent:'center'}}><img src="https://img.icons8.com/ios-filled/60/ffffff/tv.png" alt="Track Shows" style={{height:'44px',marginBottom:'8px'}}/></span>,
    title: 'Track Your Shows & Movies',
    desc: 'Log every movie and TV show you\'ve watched or want to see.'
  },
  {
    icon: <span style={{fontSize:'2.4rem',color:'#5fe05f',display:'flex',justifyContent:'center'}}><img src="https://img.icons8.com/ios-filled/60/5fe05f/bookmark-ribbon.png" alt="Diary" style={{height:'44px',marginBottom:'8px'}}/></span>,
    title: 'Personal Diary',
    desc: 'Keep a private journal of your viewing journey.'
  },
  {
    icon: <span style={{fontSize:'2.4rem',color:'#ff7ab2',display:'flex',justifyContent:'center'}}><img src="https://img.icons8.com/ios-filled/60/ff7ab2/search--v1.png" alt="Search" style={{height:'44px',marginBottom:'8px'}}/></span>,
    title: 'Discover & Search',
    desc: 'Find new favorites using real-time TMDb search.'
  },
  {
    icon: <span style={{fontSize:'2.4rem',color:'#ffc43d',display:'flex',justifyContent:'center'}}><img src="https://img.icons8.com/ios-filled/60/ffc43d/clapperboard.png" alt="Streaming Info" style={{height:'44px',marginBottom:'8px'}}/></span>,
    title: 'Streaming Info',
    desc: 'See where to watch, with up-to-date streaming info.'
  }
];

const howItWorks = [
  {
    icon: <img src="https://img.icons8.com/ios-filled/60/ffffff/search--v1.png" alt="Search" style={{height:'38px',marginBottom:'8px'}}/>,
    title: '1. Search',
    desc: 'Find any movie or TV show instantly.'
  },
  {
    icon: <img src="https://img.icons8.com/ios-filled/60/7ed6ff/plus-math.png" alt="Add to Diary" style={{height:'38px',marginBottom:'8px'}}/>,
    title: '2. Add to Diary',
    desc: 'Save to your personal diary with one click.'
  },
  {
    icon: <img src="https://img.icons8.com/ios-filled/60/7ed6ff/checked-checkbox.png" alt="Mark as Watched" style={{height:'38px',marginBottom:'8px'}}/>,
    title: '3. Mark as Watched',
    desc: 'Toggle watched/unwatched as you go.'
  }
];

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export default function Home() {
  const { currentUser } = useAuth();
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTrending() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${import.meta.env.VITE_TMDB_API_KEY}`);
        if (!res.ok) throw new Error('Failed to fetch trending movies');
        const data = await res.json();
        setTrending(data.results.slice(0, 10));
      } catch (err) {
        setError('Could not load trending movies.');
      }
      setLoading(false);
    }
    fetchTrending();
  }, []);

  if (currentUser) return <Navigate to="/dashboard" />;
  return (
    <div className="sw-bg">
      <div className="sw-container">
        <div className="sw-header-box sw-header-custom">
          <div className="sw-logo-row">
            <div className="sw-header-logo-bg">
              <img src="https://img.icons8.com/ios-filled/100/000000/movie-projector.png" alt="logo" className="sw-header-logo" />
            </div>
          </div>
          <h1 className="sw-main-title sw-header-title-custom">ShowsWatched.com</h1>
          <p className="sw-main-sub sw-header-sub-custom">Track What You Watch. Discover What’s Next.</p>
          <Link to="/signup"><button className="sw-main-btn sw-header-btn-custom">Get Started</button></Link>
        </div>
        <div className="sw-section">
          <h2 className="sw-section-title" style={{textAlign:'center'}}>Features</h2>
          <div className="sw-feature-grid sw-feature-custom-grid">
            {features.map((f, i) => (
              <div className="sw-feature-card sw-feature-custom-card" key={i}>
                <div className="sw-feature-icon sw-feature-custom-icon">{f.icon}</div>
                <div className="sw-feature-title sw-feature-custom-title">{f.title}</div>
                <div className="sw-feature-desc sw-feature-custom-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="sw-section">
          <h2 className="sw-section-title" style={{textAlign:'center'}}>How It Works</h2>
          <div className="sw-hiw-grid sw-hiw-custom-grid">
            {howItWorks.map((step, i) => (
              <div className="sw-hiw-card sw-hiw-custom-card" key={i}>
                <div className="sw-hiw-icon sw-hiw-custom-icon">{step.icon}</div>
                <div className="sw-hiw-title sw-hiw-custom-title">{step.title}</div>
                <div className="sw-hiw-desc sw-hiw-custom-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="sw-section">
          <h2 className="sw-section-title" style={{textAlign:'center'}}>Trending Now</h2>
          <div className="sw-trending-grid sw-trending-custom-grid">
            {loading ? (
              <div className="sw-trending-placeholder">Loading trending movies...</div>
            ) : error ? (
              <div className="sw-trending-placeholder">{error}</div>
            ) : trending.length === 0 ? (
              <div className="sw-trending-placeholder">No trending movies found.</div>
            ) : (
              trending.slice(0, 6).map((movie) => (
                <div className="sw-trending-card sw-trending-custom-card" key={movie.id}>
                  <img
                    src={movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : 'https://placehold.co/120x160?text=No+Image'}
                    alt={movie.title}
                    className="sw-trending-img sw-trending-custom-img"
                  />
                  <div className="sw-trending-title sw-trending-custom-title">{movie.title}</div>
                  <div className="sw-trending-year sw-trending-custom-year">{movie.release_date ? movie.release_date.slice(0, 4) : ''}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
