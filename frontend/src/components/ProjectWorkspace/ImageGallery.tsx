
import { useState } from 'react';
import type { GenerationDTO } from '@merchcrafter/shared';
import { Image as ImageIcon, CheckCircle2, Layout, Users, SlidersHorizontal, Trash2 } from 'lucide-react';

interface ImageGalleryProps {
    images: GenerationDTO[];
    entities: { id: string; name: string }[];
    onCombineScene: (selectedIds: string[]) => void;
    onMakeMoodBoard: (selectedIds: string[]) => void; // Unused for MVP but good to have
    onDelete?: (id: number) => void;
}

export function ImageGallery({ images, entities, onCombineScene, onMakeMoodBoard, onDelete }: ImageGalleryProps) {
    const [filterEntity, setFilterEntity] = useState('ALL');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const filteredImages = images.filter(img => {
        if (filterEntity === 'ALL') return true;
        return img.entityId === filterEntity;
    });

    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const isSelectionMode = selectedIds.length > 0;

    return (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 min-h-[500px] flex flex-col">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-semibold text-gray-900">Project Gallery</h2>
                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium">{filteredImages.length}</span>
                </div>

                <div className="flex items-center space-x-2">
                    <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                    <select
                        className="text-xs p-1.5 rounded border border-gray-300 text-slate-900 focus:ring-indigo-500 max-w-[150px]"
                        value={filterEntity}
                        onChange={e => setFilterEntity(e.target.value)}
                    >
                        <option value="ALL">All Entities</option>
                        {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Selection Toolbar */}
            {isSelectionMode && (
                <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100 flex items-center justify-between animate-fadeIn">
                    <span className="text-sm text-indigo-900 font-medium">{selectedIds.length} selected</span>
                    <div className="flex space-x-3">
                        <button
                            onClick={() => onMakeMoodBoard(selectedIds)}
                            className="bg-white border border-indigo-200 text-indigo-700 text-xs px-3 py-1.5 rounded hover:bg-indigo-50 flex items-center shadow-sm"
                        >
                            <Layout className="w-3.5 h-3.5 mr-1" /> Mood Board
                        </button>
                        <button
                            onClick={() => onCombineScene(selectedIds)}
                            className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded hover:bg-indigo-700 flex items-center shadow-sm"
                        >
                            <Users className="w-3.5 h-3.5 mr-1" /> Combine Scene
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="text-slate-500 hover:text-slate-800 text-xs px-2"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="p-6 flex-1 bg-gray-50/50">
                {filteredImages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-sm font-medium">No images generated yet.</p>
                        <p className="text-xs">Use the panel on the left to create concepts.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredImages.map(img => (
                            <div
                                key={img.id}
                                className={`relative group rounded-lg overflow-hidden border transition-all cursor-pointer ${selectedIds.includes(String(img.id)) ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200 hover:border-indigo-300'}`}
                                onClick={() => {
                                    if (isSelectionMode) toggleSelection(String(img.id), {} as any);
                                    else window.open(img.imageUrl || '', '_blank');
                                }}
                            >
                                <div className="aspect-square bg-slate-100">
                                    <img src={img.imageUrl || ''} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </div>

                                {/* Overlay Checkbox */}
                                <div
                                    className={`absolute top-2 left-2 w-5 h-5 rounded border border-gray-300 bg-white flex items-center justify-center cursor-pointer transition-opacity ${selectedIds.includes(String(img.id)) ? 'opacity-100 border-indigo-500 bg-indigo-500 text-white' : 'opacity-0 group-hover:opacity-100'}`}
                                    onClick={(e) => toggleSelection(String(img.id), e)}
                                >
                                    {selectedIds.includes(String(img.id)) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </div>

                                {/* Metadata Overlay */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white text-xs font-medium truncate">{img.prompt}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-white/80 text-[10px] bg-black/30 px-1.5 py-0.5 rounded">{img.artStyle || 'Custom'}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onDelete) onDelete(img.id);
                                            }}
                                            className="text-white/60 hover:text-red-400 p-1"
                                            title="Delete Image"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
