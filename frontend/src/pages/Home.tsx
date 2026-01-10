import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';
import type { ProjectDTO } from '@merchcrafter/shared';
import {
    Folder,
    Plus,
    Calendar,
    ArrowRight,
    Trash2,
    Loader2
} from 'lucide-react';

export default function Home() {
    const [projects, setProjects] = useState<ProjectDTO[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = () => {
        apiFetch('/projects')
            .then(res => res.json())
            .then(data => setProjects(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm('Are you sure you want to delete this project?')) return;

        try {
            await apiFetch(`/projects/${id}`, { method: 'DELETE' });
            loadProjects();
        } catch (error) {
            console.error(error);
            alert('Failed to delete project');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex justify-between items-center border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Folder className="w-6 h-6 mr-2 text-indigo-600" />
                        My Projects
                    </h1>
                    <p className="text-sm text-secondary mt-1 font-medium">Manage your creative workspaces</p>
                </div>
                {/* <Link to="/upload" className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 shadow-sm transition">
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                </Link> */}
                {/* Note: Project creation flows often start from Analysis -> Save or Upload -> Create Project. 
                    If there is a direct create flow, uncomment above. For now assuming projects are created via saving analysis or legacy upload?
                    Actually the legacy upload likely created a project or just a book. 
                    Re-enabling the button as it was there before:
                */}
                <Link to="/upload" className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 shadow-sm transition">
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                </Link>
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Folder className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-2 text-sm font-bold text-gray-900">No projects yet</h3>
                    <p className="mt-1 text-sm text-secondary font-medium">Start by creating a new project or analyzing a book.</p>
                    <div className="mt-6">
                        <Link to="/upload" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none">
                            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            New Project
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map(project => (
                        <Link
                            key={project.id}
                            to={`/project/${project.id}`}
                            className="group relative bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition border border-gray-200 hover:border-indigo-200 block"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition">
                                    <Folder className="w-6 h-6 text-indigo-600" />
                                </div>
                                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${project.status === 'READY' ? 'bg-green-100 text-green-800' :
                                    project.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                    {project.status}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-1 truncate pr-8" title={project.originalFilename}>
                                {project.originalFilename || 'Untitled Project'}
                            </h3>
                            <p className="text-sm text-secondary font-medium mb-6 line-clamp-2 min-h-[2.5em]">
                                {project.description || 'No description provided.'}
                            </p>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <div className="flex items-center text-xs text-secondary font-bold">
                                    <Calendar className="w-3.5 h-3.5 mr-1" />
                                    {new Date(project.createdAt).toLocaleDateString()}
                                </div>
                                <span className="flex items-center text-sm font-medium text-indigo-600 group-hover:translate-x-1 transition-transform">
                                    Open <ArrowRight className="w-4 h-4 ml-1" />
                                </span>
                            </div>

                            <button
                                onClick={(e) => handleDelete(e, project.id)}
                                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100"
                                title="Delete Project"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
