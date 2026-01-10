import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export default function Billing() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const handlePurchase = async (bundle: string) => {
        setLoading(true);
        setMsg('');
        try {
            const res = await apiFetch('/billing/checkout', {
                method: 'POST',
                body: JSON.stringify({ bundle })
            });

            if (res.ok) {
                setMsg('Purchase successful!');
                window.location.reload();
            } else {
                setMsg('Purchase failed');
            }
        } catch (e) {
            setMsg('Error processing purchase');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Credits & Billing</h1>

            <div className="bg-white p-6 rounded-lg shadow mb-8">
                <h2 className="text-xl font-semibold mb-2">Current Balance</h2>
                <div className="text-4xl font-bold text-indigo-600">{user?.credits || 0} <span className="text-lg text-secondary font-bold">credits</span></div>
            </div>

            <h2 className="text-xl font-semibold mb-4">Purchase Credits (Stub)</h2>
            {msg && <div className="mb-4 text-green-600">{msg}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-lg font-bold">Small Bundle</h3>
                    <p className="text-secondary font-bold mb-4">20 Credits</p>
                    <div className="text-2xl font-bold mb-6">$5.00</div>
                    <button
                        onClick={() => handlePurchase('small')}
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Buy Now
                    </button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border-2 border-indigo-500 relative">
                    <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs px-2 py-1 rounded-bl">Popular</div>
                    <h3 className="text-lg font-bold">Medium Bundle</h3>
                    <p className="text-secondary font-bold mb-4">50 Credits</p>
                    <div className="text-2xl font-bold mb-6">$10.00</div>
                    <button
                        onClick={() => handlePurchase('medium')}
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Buy Now
                    </button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                    <h3 className="text-lg font-bold">Large Bundle</h3>
                    <p className="text-secondary font-bold mb-4">100 Credits</p>
                    <div className="text-2xl font-bold mb-6">$18.00</div>
                    <button
                        onClick={() => handlePurchase('large')}
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        Buy Now
                    </button>
                </div>
            </div>

            <div className="mt-8 text-sm text-secondary font-medium text-center">
                * This is a placeholder billing system. No real charges are made.
            </div>
        </div>
    );
}
