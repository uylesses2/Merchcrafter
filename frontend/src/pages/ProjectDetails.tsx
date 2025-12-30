import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useParams } from 'react-router-dom';
import type { ProjectDTO } from '@merchcrafter/shared';
import { useAuth } from '../context/AuthContext';

export default function ProjectDetails() {
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<ProjectDTO | null>(null);
    const { user } = useAuth();

    // Generation State
    const [prompt, setPrompt] = useState('');
    const [character, setCharacter] = useState('');
    const [style, setStyle] = useState('Chibi');

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewId, setPreviewId] = useState<number | null>(null);
    const [finalUrl, setFinalUrl] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id) {
            apiFetch(`/projects/${id}`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Project not found');
                })
                .then(data => setProject(data))
                .catch(console.error);
        }
    }, [id]);

    const handleGeneratePreview = async () => {
        if (!project || !user) return;
        if (user.credits < 1) {
            setError("Not enough credits for preview (needs 1)");
            return;
        }
        if (!prompt && !character) {
            setError("Please enter a prompt or character description");
            return;
        }

        setGenerating(true);
        setError('');

        try {
            const res = await apiFetch('/generate/preview', {
                method: 'POST',
                body: JSON.stringify({
                    projectId: project.id,
                    prompt: `${style} style. ${character}. ${prompt}`, // Simple prompt composition
                    stylePreset: style,
                })
            });

            if (res.ok) {
                const data = await res.json();
                setPreviewUrl(data.imageUrl);
                setPreviewId(123); // Stub ID
                // window.location.reload(); // Don't reload, just show state
            } else {
                const err = await res.json();
                setError(err.message || 'Generation failed');
            }
        } catch (e) {
            setError('Generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateFinal = async () => {
        if (!previewId || !user) return;
        if (user.credits < 2) {
            setError("Not enough credits for final (needs 2)");
            return;
        }

        setGenerating(true);
        setError('');

        try {
            const res = await apiFetch('/generate/final', {
                method: 'POST',
                body: JSON.stringify({
                    previewId,
                })
            });

            if (res.ok) {
                const data = await res.json();
                setFinalUrl(data.imageUrl);
            } else {
                const err = await res.json();
                setError(err.message || 'Upscale failed');
            }
        } catch (e) {
            setError('Upscale failed');
        } finally {
            setGenerating(false);
        }
    };

    if (!project) return <div>Loading...</div>;

    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-4">{project.originalFilename}</h1>
            <p className="text-gray-500 mb-6">{project.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-lg font-medium mb-4">Design Your Merch</h2>
                    <div className="space-y-4">

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Art Style</label>
                            <select
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 text-gray-900"
                                value={style}
                                onChange={e => setStyle(e.target.value)}
                            >
                                <option>Chibi</option>
                                <option>Ghibli</option>
                                <option>Cartoon</option>
                                <option>Realistic</option>
                                <option>Watercolor</option>
                                <option>Oil Painting</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Character / Subject</label>
                            <input
                                type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 text-gray-900"
                                value={character}
                                onChange={e => setCharacter(e.target.value)}
                                placeholder="e.g. A brave knight in silver armor"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Detailed Prompt / Scene</label>
                            <textarea
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 text-gray-900"
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                rows={3}
                                placeholder="e.g. Standing on a cliff overlooking a dragon valley, sunset lighting..."
                            />
                        </div>

                        {error && <div className="text-red-500 text-sm">{error}</div>}

                        <button
                            onClick={handleGeneratePreview}
                            disabled={generating}
                            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                        >
                            {generating ? 'Generating...' : 'Generate Preview (1 Credit)'}
                        </button>
                    </div>
                </div>

                <div>
                    <h2 className="text-lg font-medium mb-4">Results</h2>
                    {previewUrl ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-gray-500 mb-2">Preview:</p>
                                <img src={previewUrl} alt="Preview" className="w-full rounded shadow" />
                            </div>

                            <button
                                onClick={handleGenerateFinal}
                                disabled={generating || !!finalUrl}
                                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
                            >
                                Approve & Upscale to 4K (2 Credits)
                            </button>

                            {finalUrl && (
                                <div className="mt-4">
                                    <p className="text-sm text-gray-500 mb-2">Final Result:</p>
                                    <img src={finalUrl} alt="Final" className="w-full rounded shadow" />
                                    <div className="mt-2 text-green-600 font-bold text-center">Ready for Merch!</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-64 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400">
                            Configure above to generate a preview
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
