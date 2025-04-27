import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import logo from './assets/react.svg'; // Replace with your logo path if different

export default function VerifyEmail() {
  const { currentUser, resendVerificationEmail, logout } = useAuth();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();

  const handleResend = async () => {
    setError('');
    try {
      await resendVerificationEmail();
      setSent(true);
    } catch (err) {
      setError('Failed to resend verification email.');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Refresh status: reload user and check if verified
  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await currentUser.reload();
      setChecked(true);
      if (currentUser.emailVerified) {
        window.location.reload(); // Or navigate('/dashboard')
      }
    } catch (err) {
      setError('Could not refresh status.');
    }
    setRefreshing(false);
  };

  return (
    <div className="verify-email-page">
      <div className="verify-branding">
        <img src={logo} alt="Site Logo" className="verify-logo" />
        <h2>Welcome to ShowsWatched!</h2>
      </div>
      <div className="verify-card">
        <h3>Verify Your Email</h3>
        <p>
          We have sent a verification link to <b>{currentUser?.email}</b>.<br />
          Please check your inbox and click the link to verify your email address.
        </p>
        {sent && <p style={{ color: 'green' }}>Verification email sent!</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={handleResend} disabled={refreshing}>Resend Verification Email</button>
        <button onClick={handleRefresh} disabled={refreshing} style={{ marginLeft: '1rem' }}>
          {refreshing ? 'Checking...' : 'Refresh Status'}
        </button>
        <button onClick={handleLogout} style={{ marginLeft: '1rem', background: '#eee', color: '#333' }}>Log Out</button>
        {checked && !currentUser.emailVerified && (
          <p style={{ color: 'orange', marginTop: '1rem' }}>
            Still not verified. Please try again after clicking the link in your email.
          </p>
        )}
      </div>
    </div>
  );
}
