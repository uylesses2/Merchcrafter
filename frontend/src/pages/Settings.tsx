import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'billing'>('profile');

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');

        try {
            const res = await apiFetch('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update password');
            }

            setMessage('Password updated successfully');
            setCurrentPassword('');
            setNewPassword('');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Account Settings</h1>

            <div className="flex space-x-4 border-b border-gray-200 mb-8">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`pb-4 px-4 font-medium ${activeTab === 'profile' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Profile & Security
                </button>
                <button
                    onClick={() => setActiveTab('billing')}
                    className={`pb-4 px-4 font-medium ${activeTab === 'billing' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Billing
                </button>
            </div>

            {activeTab === 'profile' && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-6">Change Password</h2>
                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                required
                                minLength={6}
                            />
                        </div>

                        {message && <div className="text-green-600 text-sm">{message}</div>}
                        {error && <div className="text-red-600 text-sm">{error}</div>}

                        <button
                            type="submit"
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
                        >
                            Update Password
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'billing' && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-xl font-semibold mb-6">Billing Overview</h2>
                    <div className="bg-gray-50 p-4 rounded-md mb-6">
                        <p className="text-sm text-gray-500">Current Balance</p>
                        <p className="text-3xl font-bold text-gray-900">{user?.credits} Credits</p>
                    </div>
                </div>
            )}
        </div>
    );
}
