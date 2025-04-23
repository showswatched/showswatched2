import React, { useEffect, useState, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, orderBy, onSnapshot, updateDoc, doc, increment, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import './Home.css';

function DiscussionSection({ entryId }) {
  const { currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [userVotes, setUserVotes] = useState({});
  const [collapsed, setCollapsed] = useState(true);
  const commentInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, `diaryEntries/${entryId}/discussions`),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(data);
      const votes = {};
      data.forEach(comment => {
        if (comment.votes && comment.votes[currentUser.uid]) {
          votes[comment.id] = comment.votes[currentUser.uid];
        }
      });
      setUserVotes(votes);
      setLoading(false);
    });
    return () => unsub();
  }, [entryId, currentUser]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await addDoc(collection(db, `diaryEntries/${entryId}/discussions`), {
      text: newComment,
      author: currentUser.email,
      authorUid: currentUser.uid,
      timestamp: serverTimestamp(),
      parentId: null,
      upvotes: 0,
      downvotes: 0,
      votes: {},
      replies: [],
    });
    setNewComment('');
    commentInputRef.current && commentInputRef.current.focus();
  };

  const handleReply = async (parentId) => {
    if (!replyText.trim()) return;
    await addDoc(collection(db, `diaryEntries/${entryId}/discussions`), {
      text: replyText,
      author: currentUser.email,
      authorUid: currentUser.uid,
      timestamp: serverTimestamp(),
      parentId,
      upvotes: 0,
      downvotes: 0,
      votes: {},
      replies: [],
    });
    setReplyTo(null);
    setReplyText('');
  };

  const handleVote = async (commentId, type) => {
    if (!currentUser) return;
    const ref = doc(db, `diaryEntries/${entryId}/discussions`, commentId);
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    const prevVote = comment.votes ? comment.votes[currentUser.uid] : undefined;
    if (prevVote === type) return;
    let update = {};
    if (type === 'up') {
      update = {
        upvotes: increment(1),
        ...(prevVote === 'down' ? { downvotes: increment(-1) } : {}),
        [`votes.${currentUser.uid}`]: 'up',
      };
    } else if (type === 'down') {
      update = {
        downvotes: increment(1),
        ...(prevVote === 'up' ? { upvotes: increment(-1) } : {}),
        [`votes.${currentUser.uid}`]: 'down',
      };
    }
    await updateDoc(ref, update);
  };

  const handleDelete = async (commentId) => {
    if (!currentUser) return;
    const comment = comments.find(c => c.id === commentId);
    if (!comment || comment.authorUid !== currentUser.uid) return;
    const deleteWithReplies = async (id) => {
      const replies = comments.filter(c => c.parentId === id);
      for (const reply of replies) {
        await deleteWithReplies(reply.id);
      }
      await deleteDoc(doc(db, `diaryEntries/${entryId}/discussions`, id));
    };
    await deleteWithReplies(commentId);
  };

  const renderComments = (parentId = null, level = 0) => {
    return comments
      .filter(c => c.parentId === parentId)
      .map(comment => (
        <div key={comment.id} className={`discussion-comment${level > 0 ? ' discussion-reply' : ''}`} style={{ marginLeft: level * 32 }}>
          <div className="discussion-header">
            <span className="discussion-author">{comment.author}</span>
            <span className="discussion-date">{comment.timestamp?.toDate?.().toLocaleString?.() || ''}</span>
          </div>
          <div className="discussion-body">{comment.text}</div>
          <div className="discussion-actions">
            <button
              className={`discussion-vote${userVotes[comment.id]==='up' ? ' voted' : ''}`}
              onClick={() => handleVote(comment.id, 'up')}
              title="Thumbs up"
              disabled={userVotes[comment.id] === 'up'}
            >
              👍 {comment.upvotes || 0}
            </button>
            <button
              className={`discussion-vote${userVotes[comment.id]==='down' ? ' voted' : ''}`}
              onClick={() => handleVote(comment.id, 'down')}
              title="Thumbs down"
              disabled={userVotes[comment.id] === 'down'}
            >
              👎 {comment.downvotes || 0}
            </button>
            <button className="discussion-reply-btn" onClick={() => setReplyTo(comment.id)}>Reply</button>
            {comment.authorUid === currentUser.uid && (
              <button className="discussion-delete-btn" onClick={() => handleDelete(comment.id)} title="Delete">🗑️</button>
            )}
          </div>
          {replyTo === comment.id && (
            <div className="discussion-reply-form">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                autoFocus
              />
              <button onClick={() => handleReply(comment.id)}>Send</button>
              <button onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
          )}
          {renderComments(comment.id, level + 1)}
        </div>
      ));
  };

  return (
    <div className="discussion-section">
      <button
        className="discussion-collapse-btn"
        onClick={() => setCollapsed(c => !c)}
        style={{ marginBottom: collapsed ? 0 : 10 }}
      >
        {collapsed ? 'Show Discussion' : 'Hide Discussion'}
      </button>
      {!collapsed && (
        <>
          <h4>Discussion</h4>
          <form onSubmit={handleAddComment} className="discussion-form">
            <input
              type="text"
              ref={commentInputRef}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
            />
            <button type="submit">Send</button>
          </form>
          {loading ? <div>Loading...</div> : (
            <div className="discussion-comments">
              {renderComments()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DiscussionSection;
