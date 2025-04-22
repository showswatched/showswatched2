import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const showsSnap = await getDocs(collection(db, 'shows'));
        setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setShows(showsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        setError('Failed to load admin data.');
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleDeleteShow(id) {
    setError('');
    try {
      await deleteDoc(doc(db, 'shows', id));
      setShows(shows.filter(show => show.id !== id));
    } catch (err) {
      setError('Failed to delete show.');
    }
  }

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      {error && <div className="error">{error}</div>}
      {loading ? <p>Loading...</p> : (
        <>
          <h3>All Users</h3>
          <ul>
            {users.length === 0 ? <li>No users found.</li> : users.map(user => (
              <li key={user.id}>{user.email || user.id}</li>
            ))}
          </ul>
          <h3>All Shows</h3>
          <ul>
            {shows.length === 0 ? <li>No shows found.</li> : shows.map(show => (
              <li key={show.id}>
                <strong>{show.title}</strong> (User: {show.uid})
                <button onClick={() => handleDeleteShow(show.id)} style={{ marginLeft: '1em' }}>Delete</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
