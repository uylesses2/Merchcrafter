import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

const CATEGORIES = ['ENTITY_TYPE', 'ART_STYLE', 'MERCH_TYPE', 'GENERAL'];

interface Feedback {
    id: string;
    category: string;
    title: string;
    message: string;
    status: string;
    adminNote?: string;
    createdAt: string;
}

export default function Feedback() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [category, setCategory] = useState('GENERAL');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        apiFetch('/feedback')
            .then(res => res.json())
            .then(setFeedbacks)
            .catch(console.error);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiFetch('/feedback', {
                method: 'POST',
                body: JSON.stringify({ category, title, message })
            });
            if (res.ok) {
                const newFeedback = await res.json();
                setFeedbacks([newFeedback, ...feedbacks]);
                setTitle('');
                setMessage('');
                alert('Feedback submitted!');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid md:grid-cols-2 gap-8">
            {/* Submit Form */}
            <div className="bg-white p-6 rounded-lg shadow h-fit">
                <h2 className="text-xl font-bold mb-4">Submit Feedback / Suggestion</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-secondary">Category</label>
                        <select
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-slate-900"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                        >
                            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-secondary">Title</label>
                        <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border text-slate-900"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-secondary">Message</label>
                        <textarea
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border h-32 text-slate-900"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                    >
                        {submitting ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                </form>
            </div>

            {/* History */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold">My Feedback</h2>
                {feedbacks.length === 0 && <p className="text-secondary font-medium">No feedback submitted yet.</p>}
                {feedbacks.map(f => (
                    <div key={f.id} className="bg-white p-4 rounded-lg shadow ring-1 ring-gray-100">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-secondary">
                                {f.category}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${f.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                                f.status === 'IN_REVIEW' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {f.status}
                            </span>
                        </div>
                        <h3 className="font-semibold mt-2">{f.title}</h3>
                        <p className="text-secondary text-sm mt-1">{f.message}</p>
                        {f.adminNote && (
                            <div className="mt-3 bg-yellow-50 p-2 rounded text-sm border-l-2 border-yellow-400">
                                <span className="font-semibold text-yellow-800">Admin Note:</span> {f.adminNote}
                            </div>
                        )}
                        <p className="text-xs text-secondary font-bold mt-2 text-right">
                            {new Date(f.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
