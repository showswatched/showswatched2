import React from 'react';
import { FaTimesCircle, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';

export default function NotificationBanner({ notification, onDismiss }) {
  const { title, message, type = 'info' } = notification;
  let icon = <FaInfoCircle color="#25609c" size={22} />;
  if (type === 'warning') icon = <FaExclamationTriangle color="#f59e42" size={22} />;
  if (type === 'error') icon = <FaTimesCircle color="#dc2626" size={22} />;

  return (
    <div className={`notification-banner notification-${type}`}> 
      <span className="notification-icon">{icon}</span>
      <div className="notification-content">
        <strong>{title}</strong>
        <div>{message}</div>
      </div>
      <button className="notification-dismiss" onClick={onDismiss} title="Dismiss notification">
        <FaTimesCircle size={20} />
      </button>
    </div>
  );
}
