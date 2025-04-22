import { useRef, useState } from 'react';
import { useAuth } from './AuthContext';

export default function Signup() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const passwordConfirmRef = useRef();
  const { signup } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (passwordRef.current.value !== passwordConfirmRef.current.value) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signup(emailRef.current.value, passwordRef.current.value);
    } catch {
      setError('Failed to create an account');
    }
    setLoading(false);
  }

  return (
    <div className="auth-container">
      <h2>Sign Up</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <input type="email" ref={emailRef} placeholder="Email" required />
        <input type="password" ref={passwordRef} placeholder="Password" required />
        <input type="password" ref={passwordConfirmRef} placeholder="Confirm Password" required />
        <button disabled={loading} type="submit">Sign Up</button>
      </form>
    </div>
  );
}
