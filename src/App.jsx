import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { db } from './firebase'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Login from './Login';
import Signup from './Signup';
import PrivateRoute from './PrivateRoute';
import MyShows from './MyShows';
import AdminDashboard from './AdminDashboard';
import Home from './Home';
import UserDashboard from './UserDashboard';

// Helper to check admin (for demo: set admin UID in code, or check Firestore user doc)
const ADMIN_UIDS = [
  // Add your admin Firebase user UID(s) here
  // Example: 'abc123adminuid'
];

function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [count, setCount] = useState(0)
  const [firestoreData, setFirestoreData] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorFirestore, setErrorFirestore] = useState(null)
  const isAdmin = currentUser && ADMIN_UIDS.includes(currentUser.uid);

  useEffect(() => {
    async function fetchData() {
      try {
        const querySnapshot = await getDocs(collection(db, 'testCollection'))
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setFirestoreData(docs)
        setLoading(false)
      } catch (err) {
        setErrorFirestore(err.message)
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  async function handleAddDoc() {
    try {
      const docRef = await addDoc(collection(db, 'testCollection'), {
        timestamp: new Date().toISOString(),
        value: Math.floor(Math.random() * 100)
      })
      setFirestoreData(prev => [...prev, { id: docRef.id, timestamp: new Date().toISOString(), value: 'added just now' }])
    } catch (err) {
      setErrorFirestore(err.message)
    }
  }

  async function handleLogout() {
    setError('');
    try {
      await logout();
      navigate('/login');
    } catch {
      setError('Failed to log out');
    }
  }

  return (
    <div className="dashboard-container">
      <header>
        <h1>Shows Watched Dashboard</h1>
        <div>
          <span>Logged in as {currentUser.email}</span>
          <button onClick={handleLogout} style={{ marginLeft: '1em' }}>Log Out</button>
          {isAdmin && <Link to="/admin" style={{ marginLeft: '1em' }}>Admin Area</Link>}
        </div>
        {error && <div className="error">{error}</div>}
      </header>
      <MyShows />
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button onClick={handleAddDoc} style={{ marginLeft: '1em' }}>
          Add Firestore Doc
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
        <div style={{marginTop: '1em', textAlign: 'left'}}>
          <h3>Firestore Test Collection</h3>
          {loading ? <p>Loading...</p> :
            errorFirestore ? <p style={{color:'red'}}>Error: {errorFirestore}</p> :
            firestoreData.length === 0 ? <p>No documents found.</p> :
            <ul>
              {firestoreData.map(doc => (
                <li key={doc.id}>{doc.timestamp} - {doc.value}</li>
              ))}
            </ul>
          }
        </div>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      {/* TODO: Add shows list and features here */}
      <p>Welcome! Start adding your watched shows.</p>
    </div>
  );
}

export default function App() {
  const { currentUser } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/admin" element={
        <PrivateRoute>
          <AdminDashboard />
        </PrivateRoute>
      } />
      <Route path="/dashboard" element={<UserDashboard />} />
      <Route path="/" element={
        currentUser ? <Navigate to="/dashboard" /> : <Home />
      } />
    </Routes>
  );
}
