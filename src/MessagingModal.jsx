import React, { useState } from 'react';

export default function MessagingModal({ onSend, onClose }) {
  const [message, setMessage] = useState('');
  return (
    <div className="admin-modal-bg">
      <div className="admin-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>Send Message to All Users</h2>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} style={{ width: '100%' }} />
        <button onClick={() => onSend(message)} style={{ marginTop: 12 }}>Send</button>
      </div>
    </div>
  );
}
