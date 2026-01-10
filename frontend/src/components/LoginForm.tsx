import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { Loader2 } from 'lucide-react';

interface LoginFormProps {
    onSuccess?: () => void;
    showRegisterLink?: boolean;
    onRegisterClick?: () => void;
}

export default function LoginForm({ onSuccess, showRegisterLink = true, onRegisterClick }: LoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isRecovering, setIsRecovering] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            await login(email, password);
            if (onSuccess) onSuccess();
        } catch (err) {
            setError('Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleRecover = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await apiFetch('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            setMessage(data.message || 'If an account exists, a recovery email has been sent.');
            setIsRecovering(false);
        } catch (err: any) {
            setError('Failed to request password recovery.');
        } finally {
            setLoading(false);
        }
    };

    if (isRecovering) {
        return (
            <div className="space-y-4">
                <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-900">Reset Password</h3>
                    <p className="text-sm text-slate-600 mt-2">Enter your email to receive a temporary password.</p>
                </div>

                {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md font-medium border border-red-200">{error}</div>}

                <form onSubmit={handleRecover} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-800 mb-1">Email Address</label>
                        <input
                            type="email"
                            className="block w-full rounded-lg border-2 border-slate-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600 sm:text-sm p-2.5 text-slate-900 placeholder-slate-400 transition-colors"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {loading ? 'Sending...' : 'Send Recovery Email'}
                    </button>
                </form>
                <div className="text-center">
                    <button
                        onClick={() => setIsRecovering(false)}
                        className="text-sm font-medium text-indigo-700 hover:text-indigo-900 underline decoration-indigo-200 hover:decoration-indigo-900 underline-offset-2"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900">Welcome Back</h3>
                <p className="text-sm text-slate-600 mt-1">Please sign in to continue.</p>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md font-medium border border-red-200">{error}</div>}
            {message && <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md font-medium border border-green-200">{message}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1">Email</label>
                    <input
                        type="email"
                        className="block w-full rounded-lg border-2 border-slate-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600 sm:text-sm p-2.5 text-slate-900 placeholder-slate-400 transition-colors"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                    />
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-bold text-slate-800">Password</label>
                        <button
                            type="button"
                            onClick={() => setIsRecovering(true)}
                            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                        >
                            Forgot password?
                        </button>
                    </div>
                    <input
                        type="password"
                        className="block w-full rounded-lg border-2 border-slate-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600 sm:text-sm p-2.5 text-slate-900 placeholder-slate-400 transition-colors"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01]"
                >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
            </form>

            {showRegisterLink && (
                <div className="text-center pt-2">
                    <p className="text-sm text-slate-600">
                        Don't have an account?{' '}
                        {onRegisterClick ? (
                            <button onClick={onRegisterClick} className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline">
                                Create account
                            </button>
                        ) : (
                            <a href="/auth/register" className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline">
                                Create account
                            </a>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
