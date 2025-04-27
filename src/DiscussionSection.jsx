import React, { useEffect, useState, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, orderBy, onSnapshot, updateDoc, doc, increment, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import './Home.css';

function DiscussionSection({ entryId }) {
  console.log("entryId:", entryId);
  const { currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [userVotes, setUserVotes] = useState({});
  const [collapsed, setCollapsed] = useState(true);
  const commentInputRef = useRef(null);

  // Utility to fetch display name for current user
  async function getDisplayName(currentUser) {
    if (!currentUser) return 'Anonymous';
    try {
      const userDocSnap = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDocSnap && userDocSnap.exists()) {
        const data = userDocSnap.data();
        return data.displayName || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : currentUser.uid);
      }
    } catch (e) {}
    return currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : currentUser.uid);
  }

  useEffect(() => {
    const q = query(
      collection(db, `discussions/${entryId}/comments`),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), votes: doc.data().votes || {} }));
      console.log("Fetched comments:", data);
      setComments(data);
      if (currentUser) {
        const votes = {};
        data.forEach(comment => {
          if (comment.votes && comment.votes[currentUser.uid]) {
            votes[comment.id] = comment.votes[currentUser.uid];
          }
        });
        setUserVotes(votes);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [entryId, currentUser]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const author = await getDisplayName(currentUser);
    await addDoc(collection(db, `discussions/${entryId}/comments`), {
      text: newComment,
      author,
      authorUid: currentUser ? currentUser.uid : null,
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
    const author = await getDisplayName(currentUser);
    await addDoc(collection(db, `discussions/${entryId}/comments`), {
      text: replyText,
      author,
      authorUid: currentUser ? currentUser.uid : null,
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
    const ref = doc(db, `discussions/${entryId}/comments`, commentId);
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    const prevVote = comment.votes ? comment.votes[currentUser.uid] : undefined;
    // Only allow one vote per user per comment
    let update = {};
    if (type === 'up') {
      update = {
        upvotes: prevVote === 'up' ? increment(0) : increment(1),
        ...(prevVote === 'down' ? { downvotes: increment(-1) } : {}),
        [`votes.${currentUser.uid}`]: 'up',
      };
    } else if (type === 'down') {
      update = {
        downvotes: prevVote === 'down' ? increment(0) : increment(1),
        ...(prevVote === 'up' ? { upvotes: increment(-1) } : {}),
        [`votes.${currentUser.uid}`]: 'down',
      };
    }
    // Optimistically update userVotes for instant UI feedback
    setUserVotes(prev => ({ ...prev, [commentId]: type }));
    await updateDoc(ref, update);
  };

  const handleDelete = async (commentId) => {
    if (!currentUser) return;
    const comment = comments.find(c => c.id === commentId);
    if (!comment || comment.authorUid !== currentUser.uid) return;
    // Recursive delete: only delete comments where current user is the author
    const deleteWithReplies = async (id) => {
      const replies = comments.filter(c => c.parentId === id);
      for (const reply of replies) {
        if (reply.authorUid === currentUser.uid) {
          await deleteWithReplies(reply.id);
        }
        // If not author, skip (cannot delete due to Firestore rules)
      }
      // Only delete if the current user is the author (extra safety)
      const toDelete = comments.find(c => c.id === id);
      if (toDelete && toDelete.authorUid === currentUser.uid) {
        await deleteDoc(doc(db, `discussions/${entryId}/comments`, id));
      }
    };
    await deleteWithReplies(commentId);
  };

  // CollapsibleReplies component for mobile-friendly replies
  function CollapsibleReplies({ commentId, level, childrenCount, render, showCount = 1 }) {
    const [expanded, setExpanded] = useState(false);
    const replies = render(commentId, level+1);
    if (!replies || replies.length === 0) return null;
    if (expanded) {
      return (
        <div>
          {replies}
          {childrenCount > showCount && (
            <button style={{margin:'0.25em 0 0.5em 1em',fontSize:'0.95em'}} onClick={() => setExpanded(false)}>Hide Replies</button>
          )}
        </div>
      );
    }
    return (
      <div>
        {replies.slice(0, showCount)}
        {childrenCount > showCount && (
          <button style={{margin:'0.25em 0 0.5em 1em',fontSize:'0.95em'}} onClick={() => setExpanded(true)}>
            View {childrenCount - showCount + 1} more repl{childrenCount - showCount + 1 === 1 ? 'y' : 'ies'}
          </button>
        )}
      </div>
    );
  }

  const renderComments = (parentId = null, level = 0) => {
    const thread = comments.filter(c => c.parentId === parentId);
    return thread.map(comment => {
      const replies = comments.filter(c => c.parentId === comment.id);
      return (
        <div key={comment.id} className={`discussion-comment${level > 0 ? ' discussion-reply' : ''}`} style={{ marginLeft: level * 18 }}>
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
            {comment.authorUid === currentUser?.uid && (
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
          {/* Collapsible replies for mobile */}
          <CollapsibleReplies
            commentId={comment.id}
            level={level}
            childrenCount={replies.length}
            render={renderComments}
            showCount={1}
          />
        </div>
      );
    });
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
          <div className="discussion-comments">
            {loading ? <div>Loading...</div> : renderComments()}
          </div>
        </>
      )}
    </div>
  );
}

export default DiscussionSection;
