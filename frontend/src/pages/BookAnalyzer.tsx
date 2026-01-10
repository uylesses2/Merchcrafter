import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import {
    BookOpen,
    FlaskConical,
    Clock,
    Bookmark,
    Loader2,
    Search,
    Check,
    Trash2
} from 'lucide-react';

const ENTITY_TYPES = [
    'CHARACTER',
    'MONSTER_OR_CREATURE',
    'ITEM_OR_ARTIFACT',
    'LOCATION',
    'SCENE_OR_EVENT',
    'GROUP_OR_FACTION_OR_ORGANIZATION',
    'LANDMARK_OR_STRUCTURE',
    'BATTLE_OR_DUEL_OR_CONFLICT',
    'SPELL_OR_POWER_OR_ABILITY',
    'VEHICLE_OR_MOUNT',
    'PROPHECY_OR_LEGEND_OR_MYTH',
    'ALIEN',
    'ENTITY',
    'PLANET',
    'STAR_SYSTEM',
    'SPACE_SHIP',
    'SPACE_STATION',
    'SPACE_ANOMALY'
];

const ANALYSIS_MODES = [
    { value: 'VISUAL_ART', label: 'Visual Description' },
    { value: 'GENERAL_PROFILE', label: 'General Profile' },
    { value: 'KEY_SCENES', label: 'Key Scenes' },
    { value: 'RELATIONSHIPS', label: 'Relationships' },
    { value: 'QUOTES', label: 'Quotes & Voice' }
];

interface Book { id: string; title: string; }

interface Analysis { id: string; entityName: string; entityType: string; mode: string; resultJson: string; createdAt: string; }

export default function BookAnalyzer() {
    const [searchParams] = useSearchParams();

    // Helper Badge Component
    const Badge = ({ type }: { type: string }) => {
        const styles: Record<string, string> = {
            explicit: "bg-green-100 text-green-800 border-green-200",
            inferred_from_text: "bg-blue-100 text-blue-800 border-blue-200",
            unknown: "bg-gray-100 text-gray-600 border-gray-200"
        };
        const labels: Record<string, string> = {
            explicit: "Explicit",
            inferred_from_text: "Inferred",
            unknown: "Unknown"
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${styles[type] || styles.unknown}`}>
                {labels[type] || type}
            </span>
        );
    };

    // Data Sources
    const [books, setBooks] = useState<Book[]>([]);
    const [savedAnalyses, setSavedAnalyses] = useState<Analysis[]>([]);
    // const [projects, setProjects] = useState<Project[]>([]); // Unused

    // Configuration State
    const [multiBookMode, setMultiBookMode] = useState(false);
    const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
    const [entityType, setEntityType] = useState('CHARACTER');
    const [analysisMode, setAnalysisMode] = useState('VISUAL_ART');

    // Input State
    const [entityLabel, setEntityLabel] = useState('');
    const [focus, setFocus] = useState('');

    // Execution State
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

    // Sidebar Filters
    const [historySearch, setHistorySearch] = useState('');

    useEffect(() => {
        // Load Books
        apiFetch('/books')
            .then(res => res.json())
            .then(data => setBooks(data.filter((b: any) => b.status === 'READY')))
            .catch(console.error);
        // Load History
        loadHistory();

        // Projects fetch removed as unused

        // Initial Book Selection
        const initialBookId = searchParams.get('bookId');
        if (initialBookId) setSelectedBookIds([initialBookId]);

    }, []);

    const loadHistory = () => {
        apiFetch('/analyses?limit=50')
            .then(res => res.json())
            .then((data: Analysis[]) => setSavedAnalyses(data))
            .catch(console.error);
    };

    const handleBookSelection = (id: string) => {
        if (multiBookMode) {
            setSelectedBookIds(prev =>
                prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
            );
        } else {
            setSelectedBookIds([id]);
        }
    };

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        setCurrentAnalysisId(null);

        try {
            const res = await apiFetch('/rag/query', {
                method: 'POST',
                body: JSON.stringify({
                    bookIds: selectedBookIds,
                    entityType,
                    entityLabel,
                    focus,
                    analysisMode,
                    save: false // Don't auto-save to DB yet, wait for user action
                })
            });
            const data = await res.json();
            setResult(data.result);
        } catch (err) {
            console.error(err);
            alert('Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAnalysis = async () => {
        if (!result) return;
        if (currentAnalysisId) return; // Already saved

        try {
            const res = await apiFetch('/analyses', {
                method: 'POST',
                body: JSON.stringify({
                    bookIds: selectedBookIds,
                    entityType,
                    entityName: entityLabel,
                    mode: analysisMode,
                    resultJson: JSON.stringify(result),
                    summary: result.description || 'Saved Analysis',
                    projectId: searchParams.get('projectId') ? parseInt(searchParams.get('projectId')!) : undefined,
                    tags: []
                })
            });
            const saved = await res.json();
            setCurrentAnalysisId(saved.id);
            loadHistory(); // Refresh list
        } catch (err) {
            console.error(err);
            alert('Failed to save analysis');
        }
    };

    const handleDeleteAnalysis = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this analysis?')) return;

        try {
            await apiFetch(`/analyses/${id}`, { method: 'DELETE' });
            if (currentAnalysisId === id) {
                setResult(null);
                setCurrentAnalysisId(null);
            }
            loadHistory();
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const loadSavedAnalysis = async (analysis: Analysis) => {
        try {
            const detailRes = await apiFetch(`/analyses/${analysis.id}`);
            const detail = await detailRes.json();

            const parsedResult = typeof detail.resultJson === 'string' ? JSON.parse(detail.resultJson) : detail.resultJson;

            setResult(parsedResult);
            setEntityLabel(detail.entityName);
            setEntityType(detail.entityType);
            setAnalysisMode(detail.mode);
            setCurrentAnalysisId(detail.id);

            // Restore book selection if possible
            if (detail.books && detail.books.length > 0) {
                setSelectedBookIds(detail.books.map((b: any) => b.id));
            }

        } catch (e) {
            console.error(e);
        }
    };

    const filteredHistory = savedAnalyses.filter(a =>
        a.entityName.toLowerCase().includes(historySearch.toLowerCase()) ||
        a.entityType.toLowerCase().includes(historySearch.toLowerCase())
    );

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-100">

            {/* COLUMN 1: CONFIGURATION (Left Sidebar) */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Scope & Config
                    </h2>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-6">
                    {/* Books Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-700">BOOKS</label>
                            <button
                                onClick={() => setMultiBookMode(!multiBookMode)}
                                className={`text-[10px] px-2 py-0.5 rounded border ${multiBookMode ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-secondary font-bold border-slate-300'}`}
                            >
                                {multiBookMode ? 'Multi-Select ON' : 'Single'}
                            </button>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-1 bg-gray-50">
                            {books.map(b => (
                                <div
                                    key={b.id}
                                    onClick={() => handleBookSelection(b.id)}
                                    className={`px-3 py-2 text-sm rounded cursor-pointer flex items-center justify-between ${selectedBookIds.includes(b.id)
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    <span className="truncate">{b.title}</span>
                                    {selectedBookIds.includes(b.id) && <Check className="w-3 h-3 text-white" />}
                                </div>
                            ))}
                            {books.length === 0 && <div className="p-2 text-xs text-center text-secondary font-medium">No books found</div>}
                        </div>
                        <p className="text-xs text-secondary font-bold mt-1">{selectedBookIds.length} selected</p>
                    </div>

                    {/* Entity Type */}
                    <div>
                        <label className="block text-xs font-bold text-primary mb-2">ENTITY TYPE</label>
                        <select
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2 text-primary font-medium bg-white"
                            value={entityType}
                            onChange={e => setEntityType(e.target.value)}
                        >
                            {ENTITY_TYPES.map(t => (
                                <option key={t} value={t} className="text-gray-900 py-1">{t.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>

                    {/* Mode */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">ANALYSIS MODE</label>
                        <div className="space-y-1">
                            {ANALYSIS_MODES.map(m => (
                                <div
                                    key={m.value}
                                    onClick={() => setAnalysisMode(m.value)}
                                    className={`px-3 py-2 text-sm border rounded-md cursor-pointer transition ${analysisMode === m.value
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {m.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* COLUMN 2: WORKSPACE (Main Center) */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
                {/* Input Area */}
                <div className="p-4 bg-white border-b border-gray-200 shadow-sm z-10">
                    <form onSubmit={handleAnalyze} className="flex gap-4 items-end max-w-4xl mx-auto w-full">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-secondary mb-1">ENTITY NAME</label>
                            <input
                                type="text"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-primary font-medium placeholder-slate-400"
                                placeholder="e.g. The Protagonist"
                                value={entityLabel}
                                onChange={e => setEntityLabel(e.target.value)}
                                required
                            />
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-bold text-secondary mb-1">FOCUS (OPTIONAL)</label>
                            <input
                                type="text"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-primary font-medium placeholder-slate-400"
                                placeholder="Specific details..."
                                value={focus}
                                onChange={e => setFocus(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || selectedBookIds.length === 0}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center h-[38px]"
                        >
                            {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                            Analyze
                        </button>
                    </form>
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {!result ? (
                        <div className="h-full flex flex-col items-center justify-center text-secondary opacity-80">
                            <FlaskConical className="w-16 h-16 mb-4" />
                            <p className="text-lg">Ready to analyze</p>
                            <p className="text-sm">Select books and define an entity to begin</p>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Actions Header */}
                            <div className="flex justify-end gap-2">
                                {!currentAnalysisId ? (
                                    <button
                                        onClick={handleSaveAnalysis}
                                        className="flex items-center text-sm text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 shadow-sm"
                                    >
                                        <Bookmark className="w-4 h-4 mr-1.5" />
                                        Save Analysis
                                    </button>
                                ) : (
                                    <span className="flex items-center text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded border border-indigo-100">
                                        <Bookmark className="w-4 h-4 mr-1.5" />
                                        Saved
                                    </span>
                                )}
                            </div>

                            {/* Render Result */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
                                    <h1 className="text-2xl font-bold text-gray-900">{result.title || entityLabel}</h1>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded uppercase tracking-wide">{entityType}</span>
                                        <span className="text-secondary font-bold text-sm">{ANALYSIS_MODES.find(m => m.value === analysisMode)?.label}</span>
                                    </div>
                                    {result.description && <p className="mt-4 text-gray-700 italic border-l-4 border-indigo-200 pl-4">{result.description}</p>}
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Visual Mode Specific Rendering */}
                                    {result.attributes ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                            {Object.entries(result.attributes as Record<string, any>).map(([key, attr]) => (
                                                <div key={key} className="group relative">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1')}</h3>
                                                        <Badge type={attr.sourceType} />
                                                    </div>
                                                    <div className="text-gray-900 font-medium border-b border-gray-100 pb-2 group-hover:border-indigo-200 transition-colors">
                                                        {attr.value || <span className="text-gray-300 italic">Not specified</span>}
                                                    </div>

                                                    {/* Evidence Tooltip/Popover */}
                                                    {attr.evidence && attr.evidence.length > 0 && (
                                                        <div className="hidden group-hover:block absolute z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg -top-2 left-full ml-2">
                                                            <div className="font-bold mb-1 border-b border-gray-700 pb-1">Evidence</div>
                                                            <ul className="space-y-2 max-h-48 overflow-y-auto">
                                                                {attr.evidence.map((ev: any, i: number) => (
                                                                    <li key={i}>
                                                                        <span className="text-gray-400 block mb-0.5">[{ev.source || 'Fragment'}]:</span>
                                                                        <span className="italic">"{ev.quote}"</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        // Fallback Generic Rendering
                                        Object.entries(result).map(([key, value]) => {
                                            if (['title', 'name', 'contextSources', 'description'].includes(key)) return null;
                                            return (
                                                <div key={key}>
                                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-2 border-b border-indigo-100 pb-1 w-fit">{key.replace(/([A-Z])/g, ' $1')}</h3>
                                                    <div className="text-gray-700 text-sm leading-relaxed">
                                                        {typeof value === 'object'
                                                            ? <pre className="whitespace-pre-wrap font-sans text-xs">{JSON.stringify(value, null, 2).replace(/[{"}]/g, '')}</pre>
                                                            : String(value)}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Context Footer */}
                            {result.contextSources && (
                                <div className="text-xs text-secondary font-medium bg-gray-100 p-4 rounded-lg">
                                    <h4 className="font-bold mb-2 uppercase">Source Context</h4>
                                    <ul className="space-y-1">
                                        {result.contextSources.map((s: any, i: number) => (
                                            <li key={i}>• {typeof s === 'string' ? s : `${s.source}: ${s.summary || s.text}`}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* COLUMN 3: SAVED ANALYSES (Right Sidebar) */}
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center"><Clock className="w-4 h-4 mr-2" /> History</span>
                        <span className="text-xs font-normal normal-case bg-gray-200 px-2 py-0.5 rounded-full">{savedAnalyses.length}</span>
                    </h2>
                </div>
                <div className="p-3 border-b border-gray-100">
                    <div className="relative rounded-md shadow-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs py-2 border text-primary font-medium placeholder-slate-400"
                            placeholder="Search..."
                            value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {filteredHistory.map(analysis => (
                        <div
                            key={analysis.id}
                            onClick={() => loadSavedAnalysis(analysis)}
                            className="group block p-3 rounded-lg border border-gray-100 bg-white hover:border-indigo-300 hover:shadow-md transition cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="text-sm font-semibold text-gray-900 truncate pr-2 group-hover:text-indigo-600">{analysis.entityName}</h3>
                                <span className="text-[10px] text-slate-500 font-bold">{new Date(analysis.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1 mb-2">
                                <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-1.5 py-0.5 rounded uppercase border border-slate-300">{analysis.entityType}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-xs text-secondary font-medium line-clamp-2">
                                    {analysis.mode.replace('_', ' ')}
                                </div>
                                <button
                                    onClick={(e) => handleDeleteAnalysis(analysis.id, e)}
                                    className="hidden group-hover:block text-slate-400 hover:text-red-500 p-1"
                                    title="Delete Analysis"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div >
    );
}
