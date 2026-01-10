
import { useState, useEffect } from 'react';
import { Sparkles, Loader2, ChevronRight, User, MapPin, Box, Eye, AlertTriangle, FileJson, Clock, Info } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import {
    validateCreativeSelection,
    ValidationWarning,
    ImageFormatEnum,
    ArtStyleEnum,
    getCompatibilitySuggestions,
    AttributeValue
} from '@merchcrafter/shared';

interface Entity {
    id: string;
    entityName: string;
    entityType: string;
    summary: string;
    analysisResult?: Record<string, AttributeValue<any>>; // Structured
}

interface EntitiesPanelProps {
    entities: Entity[];
    onGenerate: (entityId: string, styles: string[], merchStyle: string, imageFormat: string, outputUse: string, presetId?: string) => void;
    isGenerating: boolean;
}

const FORMAT_OPTS = ImageFormatEnum.options;
const STYLE_OPTS = ArtStyleEnum.options;
const USE_OPTS = [
    'TSHIRT', 'POSTER', 'STICKER', 'COLLECTOR_PRINT', 'BOOK_ILLUSTRATION', 'INFOGRAPHIC_PANEL'
];

function getEntityIcon(type: string) {
    const t = type.toUpperCase();
    if (t.includes('CHARACTER') || t.includes('CREATURE')) return <User className="w-4 h-4" />;
    if (t.includes('LOCATION') || t.includes('BUILDING')) return <MapPin className="w-4 h-4" />;
    return <Box className="w-4 h-4" />;
}

function TimeBadge({ state }: { state: string }) {
    const s = String(state).toLowerCase();
    const colors: Record<string, string> = {
        baseline: 'bg-slate-100 text-slate-600',
        unknown: 'bg-gray-100 text-gray-400',
        before: 'bg-blue-50 text-blue-600',
        after: 'bg-green-50 text-green-600',
        during: 'bg-amber-50 text-amber-600',
        constant: 'bg-purple-50 text-purple-600'
    };
    return (
        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${colors[s] || colors.baseline}`}>
            {state}
        </span>
    );
}

export function EntitiesPanel({ entities, onGenerate, isGenerating }: EntitiesPanelProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [selectedArtStyles, setSelectedArtStyles] = useState<string[]>([STYLE_OPTS[0]]);
    const [selectedFormat, setFormat] = useState<string>(FORMAT_OPTS[0]);
    const [selectedUse, setUse] = useState<string>(USE_OPTS[0]);

    // Preset State
    const [presets, setPresets] = useState<any[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string>('');
    const [suggestions, setSuggestions] = useState<any[]>([]);

    // Validation State
    const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [previewJson, setPreviewJson] = useState('');

    useEffect(() => {
        const res = validateCreativeSelection({
            format: selectedFormat,
            style: selectedArtStyles[0], // Validate primary style
            use: selectedUse
        });
        setWarnings(res.warnings);
    }, [selectedFormat, selectedArtStyles, selectedUse]);

    // Fetch presets on mount
    useEffect(() => {
        apiFetch('/creative/presets')
            .then((res: any) => res.json())
            .then((data: any) => {
                if (Array.isArray(data)) setPresets(data);
            })
            .catch(console.error);
    }, []);

    // Suggestions Logic
    useEffect(() => {
        if (!expandedId) return;
        const entity = entities.find(e => e.id === expandedId);
        if (!entity) return;

        // Local suggestions from shared helper
        const sugs = getCompatibilitySuggestions(entity.entityType, entity.analysisResult?.itemType?.value);
        if (sugs && Array.isArray(sugs)) setSuggestions(sugs);
    }, [expandedId, entities]);

    const handlePresetChange = (presetId: string) => {
        setSelectedPresetId(presetId);
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
            setFormat(preset.recommended.format);
            setSelectedArtStyles([preset.recommended.style]); // Reset to single
            setUse(preset.recommended.use);
        }
    };

    const handleGenerate = (id: string) => {
        onGenerate(id, selectedArtStyles, '', selectedFormat, selectedUse, selectedPresetId || undefined);
    };

    const toggleStyle = (style: string) => {
        if (selectedArtStyles.includes(style)) {
            // Don't allow empty
            if (selectedArtStyles.length > 1) setSelectedArtStyles(s => s.filter(x => x !== style));
        } else {
            if (selectedArtStyles.length < 3) setSelectedArtStyles(s => [...s, style]); // Max 3
        }
    };

    const expandedEntity = entities.find(e => e.id === expandedId);

    return (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2 text-indigo-600" />
                    Analyzed Entities
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {entities.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 text-xs">
                        No entities analyzed yet. Run the Book Analyzer first.
                    </div>
                ) : (
                    entities.map(entity => (
                        <div key={entity.id} className={`border rounded-lg transition-all ${expandedId === entity.id ? 'border-indigo-200 ring-1 ring-indigo-50 bg-indigo-50/10' : 'border-gray-100 hover:border-indigo-100'}`}>
                            <div
                                className="p-3 flex items-center justify-between cursor-pointer"
                                onClick={() => setExpandedId(expandedId === entity.id ? null : entity.id)}
                            >
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                        {getEntityIcon(entity.entityType)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{entity.entityName}</p>
                                        <p className="text-xs text-secondary truncate">{entity.entityType}</p>
                                    </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === entity.id ? 'rotate-90' : ''}`} />
                            </div>

                            {expandedId === entity.id && (
                                <div className="px-3 pb-3 pt-0 text-sm space-y-4 animate-fadeIn">
                                    {/* Attributes Display */}
                                    <div className="bg-white rounded border border-indigo-100 p-2 space-y-2">
                                        <p className="text-xs text-slate-600 italic mb-2">
                                            {entity.summary || "No summary available."}
                                        </p>
                                        {entity.analysisResult && Object.entries(entity.analysisResult).map(([key, attr]: [string, any]) => {
                                            if (!attr || (!attr.value && !attr.baseline)) return null;
                                            // Handle TimeState or VisualAttribute. If value is null, try baseline.value
                                            const displayValue = attr.value || attr.baseline?.value || 'N/A';
                                            if (displayValue === 'N/A' || displayValue === 'not specified') return null;

                                            return (
                                                <div key={key} className="text-xs border-b border-gray-50 last:border-0 pb-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-indigo-900 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                        <TimeBadge state={attr.timeState || 'UNKNOWN'} />
                                                    </div>
                                                    <p className="text-slate-700 mt-0.5">{String(displayValue)}</p>

                                                    {/* Evidence Collapsible */}
                                                    {attr.evidence && attr.evidence.length > 0 && (
                                                        <details className="group mt-1">
                                                            <summary className="cursor-pointer text-[10px] text-indigo-500 hover:text-indigo-700 list-none flex items-center">
                                                                <Info className="w-3 h-3 mr-1" />
                                                                Show Evidence ({attr.evidence.length})
                                                            </summary>
                                                            <div className="mt-1 pl-2 border-l-2 border-indigo-100 space-y-1">
                                                                {attr.evidence.map((ev: any, i: number) => (
                                                                    <p key={i} className="text-[10px] text-slate-500 italic">
                                                                        "{ev.quote}" <span className="text-gray-400">- {ev.source || 'Fragment'}</span>
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="space-y-3 pt-2 border-t border-indigo-100">
                                        <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-widest">Generation Settings</h4>

                                        {/* Image Format */}
                                        <div>
                                            <label className="text-xs font-bold text-secondary">Image Format</label>
                                            <select
                                                className="w-full text-xs p-1.5 rounded border border-gray-300 mt-1 text-slate-900"
                                                value={selectedFormat}
                                                onChange={e => setFormat(e.target.value)}
                                            >
                                                {FORMAT_OPTS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                            </select>
                                        </div>

                                        {/* Art Style Multi-Select */}
                                        <div>
                                            <label className="text-xs font-bold text-secondary flex justify-between">
                                                <span>Art Styles (Max 3)</span>
                                                <span className="text-indigo-600">{selectedArtStyles.length}</span>
                                            </label>
                                            <div className="h-32 overflow-y-auto border border-gray-200 rounded mt-1 bg-white p-1">
                                                {STYLE_OPTS.map(s => (
                                                    <div
                                                        key={s}
                                                        onClick={() => toggleStyle(s)}
                                                        className={`text-xs px-2 py-1.5 cursor-pointer rounded flex items-center justify-between mb-0.5 ${selectedArtStyles.includes(s) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-slate-700'}`}
                                                    >
                                                        {s.replace(/_/g, ' ')}
                                                        {selectedArtStyles.includes(s) && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 block"></span>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Use */}
                                        <div>
                                            <label className="text-xs font-bold text-secondary">Output Use</label>
                                            <select
                                                className="w-full text-xs p-1.5 rounded border border-gray-300 mt-1 text-slate-900"
                                                value={selectedUse}
                                                onChange={e => setUse(e.target.value)}
                                            >
                                                {USE_OPTS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                            </select>
                                        </div>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleGenerate(entity.id); }}
                                            disabled={isGenerating}
                                            className="w-full bg-indigo-600 text-white text-xs py-2 rounded hover:bg-indigo-700 flex items-center justify-center font-medium disabled:opacity-50"
                                        >
                                            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                            Generate Concept
                                        </button>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                apiFetch('/generate/preview', { // Mocking the idea of preview
                                                    method: 'POST',
                                                    body: JSON.stringify({
                                                        entityName: entity.entityName,
                                                        entityType: entity.entityType,
                                                        analysisResult: entity.analysisResult,
                                                        imageFormat: selectedFormat,
                                                        artStyle: selectedArtStyles,
                                                        outputUse: selectedUse,
                                                        presetId: selectedPresetId
                                                    })
                                                }).catch(() => { });
                                                alert("To view JSON, generate an image first, then check the generation details (debug mode).");
                                            }}
                                            className="w-full bg-slate-100 text-slate-600 text-xs py-2 rounded hover:bg-slate-200 flex items-center justify-center font-medium"
                                        >
                                            <FileJson className="w-3 h-3 mr-1" />
                                            (Debug) Preview JSON
                                        </button>

                                        {warnings.length > 0 && (
                                            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[10px] text-amber-800 space-y-1">
                                                {warnings.map((w, i) => (
                                                    <div key={i} className="flex items-start">
                                                        <AlertTriangle className="w-3 h-3 mr-1 shrink-0 mt-0.5" />
                                                        <span>{w.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {showPreview && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="font-bold text-gray-900">JSON Prompt Preview</h3>
                            <button onClick={() => setShowPreview(false)} className="text-gray-500 hover:text-gray-700">Close</button>
                        </div>
                        <div className="p-4 overflow-auto bg-slate-50 flex-1">
                            <pre className="text-xs font-mono whitespace-pre-wrap">{previewJson}</pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
