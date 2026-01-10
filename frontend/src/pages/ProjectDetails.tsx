import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useParams, Link } from 'react-router-dom';
import type { ProjectDTO } from '@merchcrafter/shared';
import { useAuth } from '../context/AuthContext';
import {
    ArrowLeft,
    Wand2,
    Image as ImageIcon,
    Download,
    CheckCircle2,
    AlertCircle,
    Loader2,
    BookOpen,
    Plus,
    X,
    FileSearch
} from 'lucide-react';
import { EntitiesPanel } from '../components/ProjectWorkspace/EntitiesPanel';
import { ImageGallery } from '../components/ProjectWorkspace/ImageGallery';

interface BookSimple {
    id: string;
    title: string;
}



export default function ProjectDetails() {
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<ProjectDTO | null>(null);
    const { user } = useAuth();

    // Data Lists
    const [allBooks, setAllBooks] = useState<BookSimple[]>([]);

    // Linking State

    // Linking State
    const [isLinkingBook, setIsLinkingBook] = useState(false);
    const [selectedBookId, setSelectedBookId] = useState('');

    // Generation State
    // Removed old states (prompt, character, style, previewUrl, etc)
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (id) {
            refreshProject();
            fetchAvailableResources();
        }
    }, [id]);

    const refreshProject = () => {
        apiFetch(`/projects/${id}`)
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Project not found');
            })
            .then(data => setProject(data))
            .catch(console.error);
    };

    const fetchAvailableResources = () => {
        // Fetch all books
        apiFetch('/books').then(res => res.json()).then(setAllBooks).catch(console.error);
    };

    const handleLinkBook = async () => {
        if (!selectedBookId || !project) return;
        try {
            await apiFetch(`/projects/${project.id}/books`, {
                method: 'POST',
                body: JSON.stringify({ bookIds: [selectedBookId] })
            });
            setIsLinkingBook(false);
            setSelectedBookId('');
            refreshProject();
        } catch (e) {
            console.error("Failed to link book", e);
        }
    };

    const handleUnlinkBook = async (bookId: string) => {
        if (!project) return;
        if (!confirm('Remove this book from project?')) return;
        try {
            await apiFetch(`/projects/${project.id}/books/${bookId}`, { method: 'DELETE' });
            refreshProject();
        } catch (e) {
            console.error(e);
        }
    };

    // New Image Generation Logic
    const handleGenerateImage = async (entityId: string, styles: string[], merchStyle: string, imageFormat: string, outputUse: string, presetId?: string) => {
        if (!project || !user) return;

        setGenerating(true);
        setError('');

        try {
            const res = await apiFetch(`/projects/${project.id}/generations`, {
                method: 'POST',
                body: JSON.stringify({
                    entityId,
                    styles, // Send array
                    artStyle: styles[0], // Legacy fallback
                    merchStyle,
                    imageFormat,
                    outputUse,
                    presetId,
                    mode: 'SINGLE',
                    // New backend route expects `styles` array.
                    // Also sending formatted JSON prompt is handled by backend.
                })
            });

            if (res.ok) {
                refreshProject(); // Reloads generations
            } else {
                const err = await res.json();
                setError(err.message || 'Generation failed');
            }
        } catch (e) {
            setError('Generation failed');
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteGeneration = async (genId: number) => {
        if (!project) return;
        if (!confirm('Delete this image? This cannot be undone.')) return;

        try {
            const res = await apiFetch(`/projects/${project.id}/generations/${genId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                refreshProject();
            } else {
                const err = await res.json();
                alert(err.message || "Failed to delete image");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting image");
        }
    };

    const handleCombineScene = async (selectedIds: string[]) => {
        if (!project) return;

        const selectedGenerations = (project.generations as any[])?.filter((g: any) => selectedIds.includes(String(g.id))) || [];
        const entityIds = selectedGenerations.map((g: any) => g.entityId).filter((id: any) => !!id);
        const uniqueEntityIds = Array.from(new Set(entityIds));

        if (uniqueEntityIds.length === 0) {
            setError("Selected images don't have linked entities to combine.");
            return;
        }

        setGenerating(true);
        try {
            const res = await apiFetch(`/projects/${project.id}/generations`, {
                method: 'POST',
                body: JSON.stringify({
                    entityIds: uniqueEntityIds,
                    artStyle: selectedGenerations[0]?.artStyle || "Digital Painting",
                    mode: 'SCENE'
                })
            });
            if (res.ok) refreshProject();
            else {
                const err = await res.json();
                setError(err.message || 'Scene generation failed');
            }
        } catch (e) { console.error(e); setError('Generation failed'); } finally { setGenerating(false); }
    };

    const handleMakeMoodBoard = async (selectedIds: string[]) => {
        if (!project) return;
        const selectedGenerations = (project.generations as any[])?.filter((g: any) => selectedIds.includes(String(g.id))) || [];
        const entityIds = selectedGenerations.map((g: any) => g.entityId).filter((id: any) => !!id);
        const uniqueEntityIds = Array.from(new Set(entityIds));

        if (uniqueEntityIds.length === 0) {
            setError("Selected images don't have linked entities.");
            return;
        }

        setGenerating(true);
        try {
            const res = await apiFetch(`/projects/${project.id}/generations`, {
                method: 'POST',
                body: JSON.stringify({
                    entityIds: uniqueEntityIds,
                    artStyle: selectedGenerations[0]?.artStyle || "Mixed Media",
                    mode: 'MOODBOARD'
                })
            });
            if (res.ok) refreshProject();
            else {
                const err = await res.json();
                setError(err.message || 'Mood board failed');
            }
        } catch (e) { console.error(e); setError('Generation failed'); } finally { setGenerating(false); }
    };


    if (!project) return (
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
    );

    const availableBooksForLink = allBooks.filter(b => !project.books.some((pb: any) => pb.id === b.id));

    // Map analyses to Entity format for panel
    const displayEntities = (project.analyses || []).map((a: any) => ({
        id: a.id,
        entityName: a.entityName,
        entityType: a.entityType,
        summary: a.summary || "No summary",
        analysisResult: typeof a.content === 'string' ? JSON.parse(a.content) : a.content
    }));

    return (
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 h-[calc(100vh-64px)] flex flex-col">

            {/* Header */}
            <div className="flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                    <Link to="/projects" className="inline-flex items-center text-sm text-secondary hover:text-indigo-600 transition font-medium">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Projects
                    </Link>
                    <div className="flex space-x-2">
                        {error && (
                            <span className="text-red-600 bg-red-50 px-3 py-1 rounded text-xs flex items-center shadow-sm border border-red-100">
                                <AlertCircle className="w-4 h-4 mr-1" /> {error}
                            </span>
                        )}
                        <span className="text-sm font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            Credits: {user?.credits}
                        </span>
                    </div>
                </div>
                <h1 className="text-2xl font-extrabold text-gray-900">{project.originalFilename} <span className="text-lg font-normal text-slate-400">/ Workspace</span></h1>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* LEFT SIDEBAR (Scrollable) */}
                <div className="lg:col-span-3 flex flex-col space-y-4 h-full overflow-hidden">
                    {/* Entities Panel (Takes remaining space) */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        <EntitiesPanel
                            entities={displayEntities}
                            onGenerate={handleGenerateImage}
                            isGenerating={generating}
                        />
                    </div>

                    {/* Books (Collapsible or small) */}
                    <div className="bg-white shadow-sm rounded-xl border border-gray-200 flex-shrink-0 max-h-[200px] overflow-y-auto">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between sticky top-0">
                            <h2 className="text-xs font-semibold text-gray-900 flex items-center">
                                <BookOpen className="w-3.5 h-3.5 mr-2" /> Books
                            </h2>
                            <button onClick={() => setIsLinkingBook(true)} className="text-indigo-600 text-xs hover:text-indigo-800"><Plus className="w-4 h-4" /></button>
                        </div>
                        <div className="p-2 space-y-1">
                            {project.books?.length === 0 && <p className="text-xs text-slate-400 p-2 italic text-center">No books linked</p>}
                            {project.books?.map((b: any) => (
                                <div key={b.id} className="text-xs p-2 bg-gray-50 rounded flex justify-between group items-center border border-transparent hover:border-gray-200">
                                    <span className="truncate w-32 font-medium text-slate-700">{b.title}</span>
                                    <button onClick={() => handleUnlinkBook(b.id)} className="hidden group-hover:block text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                            {isLinkingBook && (
                                <div className="p-2 bg-indigo-50 rounded border border-indigo-100 mt-2">
                                    <select className="w-full text-xs mb-2 p-1 rounded" value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)}>
                                        <option value="">Select Book...</option>
                                        {availableBooksForLink.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                                    </select>
                                    <div className="flex space-x-2">
                                        <button onClick={handleLinkBook} className="flex-1 bg-indigo-600 text-white text-xs py-1 rounded hover:bg-indigo-700">Link</button>
                                        <button onClick={() => setIsLinkingBook(false)} className="flex-1 text-center text-xs py-1 text-slate-600 hover:text-slate-900">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MAIN: Gallery */}
                <div className="lg:col-span-9 h-full overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto pb-4">
                        <ImageGallery
                            images={(project.generations as any[]) || []}
                            entities={displayEntities.map((e: any) => ({ id: e.id, name: e.entityName }))}
                            onCombineScene={handleCombineScene}
                            onMakeMoodBoard={handleMakeMoodBoard}
                            onDelete={handleDeleteGeneration}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
