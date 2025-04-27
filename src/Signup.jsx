import { useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import { sendEmailVerification } from 'firebase/auth';

export default function Signup() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const passwordConfirmRef = useRef();
  const { signup } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (passwordRef.current.value !== passwordConfirmRef.current.value) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const userCredential = await signup(emailRef.current.value, passwordRef.current.value);
      await sendEmailVerification(userCredential.user);
      setLoading(false);
      navigate('/verify-email');
    } catch (err) {
      setError(err.message || 'Failed to create an account');
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
        <h2 className="auth-title">Sign Up</h2>
        {error && <div className="auth-error">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email" className="auth-label">Email *</label>
          <input id="email" type="email" ref={emailRef} placeholder="Email" required className="auth-input" />
          <label htmlFor="password" className="auth-label">Password *</label>
          <input id="password" type="password" ref={passwordRef} placeholder="Password" required className="auth-input" />
          <label htmlFor="passwordConfirm" className="auth-label">Confirm Password *</label>
          <input id="passwordConfirm" type="password" ref={passwordConfirmRef} placeholder="Confirm Password" required className="auth-input" />
          <button disabled={loading} type="submit" className="auth-btn">Sign Up</button>
        </form>
        <div className="auth-link-row">
          <span style={{color:'#fff'}}>Already have an account? <a href="/showswatched2/login" className="auth-link">Sign In</a></span>
        </div>
      </div>
    </div>
  );
}
