import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc, collectionGroup, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import UserTable from './UserTable';
import UserDetailsModal from './UserDetailsModal';
import MessagingModal from './MessagingModal';
import './AdminDashboard.css';

// --- Firestore test button for debugging permissions ---
function TestFirestoreButton() {
  async function testFirestoreRead() {
    try {
      const snap = await getDocs(collection(db, "users"));
      console.log("User docs:", snap.docs.map(doc => doc.data()));
    } catch (err) {
      console.error("Direct test error:", err);
    }
  }
  return <button onClick={testFirestoreRead} style={{marginBottom: 12}}>Test Firestore Read</button>;
}

// --- Admin notification creation ---
async function sendNotificationToUser(userId, notif) {
  await addDoc(collection(db, `users/${userId}/notifications`), {
    ...notif,
    read: false,
    createdAt: serverTimestamp(),
  });
}

async function sendNotificationToAllUsers(notif) {
  const usersSnap = await getDocs(collection(db, 'users'));
  const promises = usersSnap.docs.map(userDoc =>
    addDoc(collection(db, `users/${userDoc.id}/notifications`), {
      ...notif,
      read: false,
      createdAt: serverTimestamp(),
    })
  );
  await Promise.all(promises);
}

// Example UI: Add a simple form to send notification to all users
function AdminNotificationForm() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess('');
    try {
      await sendNotificationToAllUsers({ title, message, type });
      setSuccess('Notification sent to all users!');
      setTitle(''); setMessage('');
    } catch (err) {
      setError('Failed to send notification.');
    }
    setSending(false);
  }

  return (
    <form className="admin-notification-form" onSubmit={handleSubmit} style={{marginBottom: '2rem'}}>
      <h3>Send Notification to All Users</h3>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" required />
      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Message" required />
      <select value={type} onChange={e => setType(e.target.value)}>
        <option value="info">Info</option>
        <option value="warning">Warning</option>
        <option value="error">Error</option>
      </select>
      <button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send Notification'}</button>
      {success && <div style={{ color: 'green', marginTop: 8 }}>{success}</div>}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </form>
  );
}

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDiary, setUserDiary] = useState([]);
  const [userComments, setUserComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMessaging, setShowMessaging] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        console.log('Fetching users...');
        const usersSnap = await getDocs(collection(db, 'users'));
        console.log('Fetched users:', usersSnap.size);

        console.log('Fetching diary...');
        const diarySnap = await getDocs(collection(db, 'diary'));
        console.log('Fetched diary:', diarySnap.size);

        console.log('Fetching comments...');
        const commentsSnap = await getDocs(collectionGroup(db, 'comments'));
        console.log('Fetched comments:', commentsSnap.size);

        // Prepare stats
        const diaryCounts = {};
        const commentCounts = {};
        diarySnap.docs.forEach(d => {
          const uid = d.data().uid;
          diaryCounts[uid] = (diaryCounts[uid] || 0) + 1;
        });
        commentsSnap.docs.forEach(c => {
          const uid = c.data().authorUid;
          commentCounts[uid] = (commentCounts[uid] || 0) + 1;
        });
        // Attach stats to users
        setUsers(usersSnap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
          stats: {
            diaryCount: diaryCounts[doc.id] || 0,
            commentCount: commentCounts[doc.id] || 0
          }
        })));
      } catch (err) {
        console.error('AdminDashboard Firestore error:', err);
        setError('Failed to load users.');
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleSelectUser(user) {
    // Fetch diary entries
    console.log('Fetching diary entries for user...');
    const diarySnap = await getDocs(collection(db, 'diary'));
    console.log('Fetched diary entries:', diarySnap.size);
    const userDiary = diarySnap.docs
      .filter(d => d.data().uid === user.uid)
      .map(d => {
        // Use docId for Firestore doc ID to avoid conflict with TMDb/movie id
        return { docId: d.id, ...d.data() };
      });
    setUserDiary(userDiary);
    // Fetch comments from all nested comments collections
    console.log('Fetching comments for user...');
    const commentsSnap = await getDocs(collectionGroup(db, 'comments'));
    console.log('Fetched comments:', commentsSnap.size);
    const userComments = commentsSnap.docs
      .filter(c => c.data().authorUid === user.uid)
      .map(c => {
        const pathSegments = c.ref.path.split('/'); // discussions/{entryId}/comments/{commentId}
        const entryId = pathSegments[1];
        // Find the diary entry for this entryId (which is the TMDb/movie ID)
        const diary = diarySnap.docs.find(d => String(d.data().id) === entryId);
        const entryTitle = diary ? (diary.data().title || diary.data().desc || '') : '';
        const commentObj = { id: c.id, entryId, entryTitle, ...c.data() };
        console.log('AdminDashboard userComment:', commentObj);
        return commentObj;
      });
    setUserComments(userComments);
    // Now show modal
    setSelectedUser(user);
  }

  async function handleDisable(uid) {
    await updateDoc(doc(db, 'users', uid), { disabled: true });
    setUsers(users.map(u => u.uid === uid ? { ...u, disabled: true } : u));
    setSelectedUser(s => s && s.uid === uid ? { ...s, disabled: true } : s);
  }
  async function handleEnable(uid) {
    await updateDoc(doc(db, 'users', uid), { disabled: false });
    setUsers(users.map(u => u.uid === uid ? { ...u, disabled: false } : u));
    setSelectedUser(s => s && s.uid === uid ? { ...s, disabled: false } : s);
  }
  async function handleDelete(uid) {
    await deleteDoc(doc(db, 'users', uid));
    setUsers(users.filter(u => u.uid !== uid));
    setSelectedUser(null);
  }
  async function handleDeleteDiary(id) {
    // Defensive: ensure id is a string (Firestore doc id)
    if (!id || typeof id !== 'string') {
      setError('Cannot delete diary entry: invalid id.');
      return;
    }
    await deleteDoc(doc(db, 'diary', id));
    setUserDiary(userDiary.filter(d => d.docId !== id));
    await refreshUserStats();
  }
  async function handleDeleteComment(commentId) {
    // Find the comment and its entryId
    const comment = userComments.find(c => c.id === commentId);
    if (!comment) return;
    const entryId = comment.entryId || comment.entry_id || comment.diaryId || comment.parentEntryId;
    if (!entryId) {
      setError('Cannot delete: missing entryId for comment.');
      return;
    }
    await deleteDoc(doc(db, `discussions/${entryId}/comments`, commentId));
    setUserComments(userComments.filter(c => c.id !== commentId));
    await refreshUserStats();
  }
  async function refreshUserStats() {
    console.log('Refreshing user stats...');
    const diarySnap = await getDocs(collection(db, 'diary'));
    console.log('Fetched diary:', diarySnap.size);
    const commentsSnap = await getDocs(collectionGroup(db, 'comments'));
    console.log('Fetched comments:', commentsSnap.size);
    const diaryCounts = {};
    const commentCounts = {};
    diarySnap.docs.forEach(d => {
      const uid = d.data().uid;
      diaryCounts[uid] = (diaryCounts[uid] || 0) + 1;
    });
    commentsSnap.docs.forEach(c => {
      const uid = c.data().authorUid;
      commentCounts[uid] = (commentCounts[uid] || 0) + 1;
    });
    setUsers(prevUsers => prevUsers.map(u => ({
      ...u,
      stats: {
        diaryCount: diaryCounts[u.uid] || 0,
        commentCount: commentCounts[u.uid] || 0
      }
    })));
  }

  async function handleSendMessageAll(message) {
    // Store broadcast message in Firestore (could also trigger cloud function for email/push)
    await getDocs(collection(db, 'users')).then(snap => {
      snap.forEach(docu => {
        // For demo: store message as a subcollection
        // In production, use cloud function for push/email
        updateDoc(doc(db, 'users', docu.id), { lastAdminMessage: message });
      });
    });
    setShowMessaging(false);
    alert('Message sent to all users!');
  }
  function handleSendMessage(uid) {
    setShowMessaging(true);
    // For demo: could open a modal for direct message
  }

  return (
    <div className="admin-dashboard-container">
      <h2 className="admin-dashboard-title">Admin Dashboard</h2>
      <AdminNotificationForm />
      <TestFirestoreButton />
      <div className="admin-dashboard-actions">
        <button className="admin-dashboard-message-btn" onClick={() => setShowMessaging(true)}>
          Message All Users
        </button>
      </div>
      {error && <div className="admin-dashboard-error">{error}</div>}
      {loading ? (
        <div className="admin-dashboard-loading">Loading users...</div>
      ) : (
        <UserTable users={users} onSelectUser={handleSelectUser} />
      )}
      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          diaryEntries={userDiary}
          comments={userComments}
          onClose={() => setSelectedUser(null)}
          onDelete={handleDelete}
          onDisable={handleDisable}
          onEnable={handleEnable}
          onSendMessage={handleSendMessage}
          onDeleteDiary={handleDeleteDiary}
          onDeleteComment={handleDeleteComment}
        />
      )}
      {showMessaging && (
        <MessagingModal
          onSend={handleSendMessageAll}
          onClose={() => setShowMessaging(false)}
        />
      )}
    </div>
  );
}
