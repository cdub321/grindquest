import { useState } from 'react';

export default function AuthPanel({ onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    onSignIn({ email, password, isLogin, onStatus: setStatus });
  };

  return (
    <div className="max-w-md mx-auto bg-slate-800 border-2 border-slate-700 rounded-lg p-6 text-gray-100">
      <h2 className="text-2xl font-bold text-center text-blue-300 mb-4">
        {isLogin ? 'Log In' : 'Sign Up'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full bg-slate-700 border border-slate-700 rounded px-3 py-2 text-white"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-slate-700 border border-slate-700 rounded px-3 py-2 text-white"
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition-colors"
        >
          {isLogin ? 'Log In' : 'Create Account'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm text-gray-300">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-300 hover:underline"
        >
          {isLogin ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </div>
      {status && <p className="mt-3 text-center text-yellow-300 text-sm">{status}</p>}
    </div>
  );
}
