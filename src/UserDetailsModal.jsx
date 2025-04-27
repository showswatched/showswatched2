import React from 'react';

export default function UserDetailsModal({ user, onClose, onDisable, onEnable, onDelete, onSendMessage, diaryEntries, comments, onDeleteDiary, onDeleteComment }) {
  if (!user) return null;
  return (
    <div className="admin-modal-bg">
      <div className="admin-modal" style={{ maxWidth: 1200, width: '90vw', minWidth: 320, padding: '2.2rem 2.5rem', borderRadius: 18, background: '#fff', boxShadow: '0 4px 32px #205a7a22', margin: '0 auto' }}>
        <button className="close-btn" onClick={onClose} style={{ position: 'absolute', top: 18, right: 24, fontSize: 28, color: '#205a7a', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        <h2 style={{ color: '#205a7a', fontWeight: 900, fontSize: '2rem', marginBottom: 12 }}>User: <span style={{ color: '#25609c' }}>{user.displayName || user.email}</span></h2>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>Status: <b style={{ color: user.disabled ? '#d32f2f' : '#35b36b' }}>{user.disabled ? 'Inactive' : 'Active'}</b></div>
          <div>Roles: <span style={{ color: '#25609c' }}>{user.roles ? user.roles.join(', ') : '-'}</span></div>
          <div>Email: <span style={{ color: '#333' }}>{user.email}</span></div>
          <div>Stats: <span style={{ color: '#25609c' }}>Diary {user.stats?.diaryCount || 0}, Comments {user.stats?.commentCount || 0}</span></div>
        </div>
        <div style={{ margin: '1.2em 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {user.disabled ? (
            <button onClick={() => onEnable(user.uid)} style={{ background: '#35b36b', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 22px', fontWeight: 700 }}>Enable</button>
          ) : (
            <button onClick={() => onDisable(user.uid)} style={{ background: '#ffe066', color: '#205a7a', border: 'none', borderRadius: 7, padding: '7px 22px', fontWeight: 700 }}>Disable</button>
          )}
          <button onClick={() => onDelete(user.uid)} style={{ background: '#ff6b6b', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 22px', fontWeight: 700 }}>Delete</button>
          <button onClick={() => onSendMessage(user.uid)} style={{ background: '#25609c', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 22px', fontWeight: 700 }}>Message</button>
        </div>
        <h3 style={{ color: '#205a7a', fontWeight: 800, marginTop: 24, marginBottom: 12, fontSize: '1.2rem' }}>Diary Entries</h3>
        <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 18, background: '#f7fafd', borderRadius: 8, padding: '8px 10px' }}>
          {diaryEntries.length === 0 ? <div style={{ color: '#888', fontStyle: 'italic' }}>No diary entries.</div> :
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {diaryEntries.map(entry => (
                <li key={entry.docId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e6f0fa' }}>
                  <span style={{ fontWeight: 600, color: '#205a7a' }}>{entry.title}</span>
                  <button onClick={() => onDeleteDiary(entry.docId)} style={{ color: '#ff6b6b', background: 'none', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginLeft: 16 }}>Delete</button>
                </li>
              ))}
            </ul>
          }
        </div>
        <h3 style={{ color: '#205a7a', fontWeight: 800, marginTop: 18, marginBottom: 10, fontSize: '1.2rem' }}>Comments</h3>
        <div style={{ maxHeight: 140, overflowY: 'auto', background: '#f7fafd', borderRadius: 8, padding: '8px 10px' }}>
          {comments.length === 0 ? <div style={{ color: '#888', fontStyle: 'italic' }}>No comments.</div> :
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {comments.map(comment => (
                <li key={comment.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #e6f0fa' }}>
                  <span style={{ color: '#333', fontWeight: 500, maxWidth: 290, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {comment.text}
                    {comment.entryTitle && (
                      <span style={{ color: '#25609c', fontWeight: 400, marginLeft: 10, fontSize: 13 }}>
                        [on: {comment.entryTitle}]
                      </span>
                    )}
                  </span>
                  <button onClick={() => onDeleteComment(comment.id)} style={{ color: '#ff6b6b', background: 'none', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginLeft: 16 }}>Delete</button>
                </li>
              ))}
            </ul>
          }
        </div>
      </div>
    </div>
  );
}
