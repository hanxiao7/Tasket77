import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Register: React.FC = () => {
  const { register, error, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name || !email || !password) {
      setFormError('Name, email, and password are required');
      return;
    }
    await register(name, email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border border-blue-200">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900">
          <span className="text-blue-600">Tasket77</span>
          <br />
          <span className="text-lg font-normal text-gray-600">Create your account</span>
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {(formError || error) && (
            <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">{formError || error}</div>
          )}
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">Sign in</a>
        </div>
      </div>
    </div>
  );
};

export default Register; 