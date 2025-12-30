import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

export default function CreateProject() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setCreating(true);
        setError('');

        try {
            const res = await apiFetch('/projects', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    description
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Failed to create project');
            }
            const { project } = await res.json();
            navigate(`/project/${project.id}`);

        } catch (err: any) {
            console.error(err);
            setError(err.message);
            setCreating(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New Project</h1>

            <div className="bg-white shadow rounded-lg p-6">
                <form onSubmit={handleCreate} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                            Project Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="e.g. My Fantasy Novel Merch"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                            Description (Optional)
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Briefly describe your project..."
                        />
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm">{error}</div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={creating || !name.trim()}
                            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${creating || !name.trim() ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                        >
                            {creating ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
