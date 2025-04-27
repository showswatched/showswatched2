import { useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import './Home.css'; // Ensure CSS is imported for auth styles

export default function Login() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(emailRef.current.value, passwordRef.current.value);
      navigate('/dashboard'); // Redirect to dashboard after login
    } catch (err) {
      setError(err.message || 'Failed to log in'); // Show full Firebase error
    }
    setLoading(false);
  }

  return (
    <div className="auth-bg">
      <div className="auth-container">
        <div className="auth-logo-row">
          <img src="https://img.icons8.com/ios-filled/100/ffffff/movie-projector.png" alt="App Logo" className="auth-logo" />
        </div>
        <div className="auth-subtitle">Track your favorite shows and movies</div>
        <h2 className="auth-title">Sign In</h2>
        {error && <div className="auth-error">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email" className="auth-label">Email *</label>
          <input id="email" type="email" ref={emailRef} placeholder="Email" required className="auth-input" />
          <label htmlFor="password" className="auth-label">Password *</label>
          <input id="password" type="password" ref={passwordRef} placeholder="Password" required className="auth-input" />
          <button disabled={loading} type="submit" className="auth-btn">SIGN IN</button>
        </form>
        <div className="auth-link-row">
          <span style={{color:'#fff'}}>Don't have an account? <a href="/showswatched2/signup" className="auth-link">Sign up</a></span>
        </div>
      </div>
    </div>
  );
}
