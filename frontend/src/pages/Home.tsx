import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';
import type { ProjectDTO } from '@merchcrafter/shared';

export default function Home() {
    const [projects, setProjects] = useState<ProjectDTO[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/projects')
            .then(res => res.json())
            .then(data => setProjects(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div>Loading projects...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
                <Link to="/upload" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                    New Project
                </Link>
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                    <p className="text-gray-500">No projects yet. Start by uploading a book!</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map(project => (
                        <div key={project.id} className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition relative group">
                            <Link to={`/project/${project.id}`} className="block h-full">
                                <h3 className="text-xl font-semibold mb-2 truncate pr-8" title={project.originalFilename}>{project.originalFilename}</h3>
                                {/* <p className="text-sm text-gray-500 mb-2">Type: {project.sourceType}</p> */}
                                <div className="flex justify-between items-center mt-4">
                                    <span className={`px-2 py-1 text-xs rounded-full ${project.status === 'READY' ? 'bg-green-100 text-green-800' :
                                        project.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                        {project.status}
                                    </span>
                                    <span className="text-xs text-gray-400">{new Date(project.createdAt).toLocaleDateString()}</span>
                                </div>
                            </Link>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to delete this project?')) {
                                        // Ideally optimistic update, but simple reload for now
                                        apiFetch(`/projects/${project.id}`, { method: 'DELETE' }).then(() => {
                                            // Also delete from local store
                                            import('../lib/processing/LocalStore').then(({ localStore }) => {
                                                localStore.deleteProject(project.id.toString()).then(() => {
                                                    window.location.reload();
                                                });
                                            });
                                        });
                                    }
                                }}
                                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete Project"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
