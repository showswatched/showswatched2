import { useRef, useState } from 'react';
import { useAuth } from './AuthContext';

export default function Login() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(emailRef.current.value, passwordRef.current.value);
    } catch {
      setError('Failed to log in');
    }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      <h2>Log In</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input type="email" ref={emailRef} placeholder="Email" required />
        <input type="password" ref={passwordRef} placeholder="Password" required />
        <button disabled={loading} type="submit">Log In</button>
      </form>
    </div>
  );
}
