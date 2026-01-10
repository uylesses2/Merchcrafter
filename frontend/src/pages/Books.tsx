import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';
import {
    Book,
    Upload,
    Trash2,
    FileText,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Loader2,
    FlaskConical
} from 'lucide-react';

interface BookItem {
    id: string;
    title: string;
    status: string;
    pageCount: number;
    createdAt: string;
}

export default function Books() {
    const [books, setBooks] = useState<BookItem[]>([]);
    const [uploading, setUploading] = useState(false);

    // Upload State
    const [title, setTitle] = useState('');
    const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isUploadExpanded, setIsUploadExpanded] = useState(false);

    const refreshBooks = () => {
        apiFetch('/books')
            .then(res => res.json())
            .then((data: BookItem[]) => setBooks(data))
            .catch(console.error);
    };

    useEffect(() => {
        refreshBooks();
        const interval = setInterval(refreshBooks, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !ownershipConfirmed) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('ownershipConfirmed', 'true');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/books/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Upload failed');
            }

            setTitle('');
            setFile(null);
            setOwnershipConfirmed(false);
            setIsUploadExpanded(false);
            refreshBooks();
            alert('Book uploaded successfully!');
        } catch (err: any) {
            console.error(err);
            alert(`Upload failed: ${err.message || 'Unknown error'}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this book?')) return;

        try {
            await apiFetch(`/books/${id}`, { method: 'DELETE' });
            refreshBooks();
        } catch (error) {
            console.error(error);
            alert('Failed to delete book');
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

            {/* Header & Actions */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Library</h1>
                    <p className="text-sm text-secondary mt-1 font-medium">Manage your reference materials</p>
                </div>
                <button
                    onClick={() => setIsUploadExpanded(!isUploadExpanded)}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm transition"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Book
                </button>
            </div>

            {/* Upload Area (Collapsible) */}
            {isUploadExpanded && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fadeIn">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Book</h2>
                    <form onSubmit={handleUpload} className="space-y-4 max-w-2xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-1">Book Title (Optional)</label>
                                <input
                                    type="text"
                                    className="block w-full rounded-md border-2 border-gray-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600 sm:text-sm p-2 text-gray-900 placeholder-gray-500 font-medium"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Player's Handbook"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-1">PDF File</label>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    className="block w-full text-sm text-slate-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex items-start bg-yellow-50 p-3 rounded-md border border-yellow-200">
                            <input
                                id="ownership"
                                type="checkbox"
                                checked={ownershipConfirmed}
                                onChange={e => setOwnershipConfirmed(e.target.checked)}
                                className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="ownership" className="ml-2 block text-xs text-yellow-800">
                                I confirm I own this book. This file is for personal use only.
                            </label>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setIsUploadExpanded(false)}
                                className="mr-3 text-sm text-secondary hover:text-slate-800 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!ownershipConfirmed || !file || uploading}
                                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {uploading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                {uploading ? 'Uploading...' : 'Start Upload'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Books Grid */}
            {books.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Book className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-2 text-sm font-bold text-gray-900">No books yet</h3>
                    <p className="mt-1 text-sm text-secondary font-medium">Get started by uploading your first PDF.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {books.map(book => (
                        <div key={book.id} className="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden">
                            {/* Card Header (Visual) */}
                            <div className="h-32 bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center border-b border-gray-100">
                                <Book className="h-12 w-12 text-indigo-200 group-hover:text-indigo-400 transition" />
                            </div>

                            {/* Card Content */}
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-1" title={book.title}>
                                    {book.title}
                                </h3>

                                <div className="space-y-2 mt-2 mb-4">
                                    <div className="flex items-center text-xs text-secondary font-medium">
                                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                        {new Date(book.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center text-xs text-secondary font-medium">
                                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                                        {book.pageCount} pages
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                                    {/* Status Badge */}
                                    {book.status === 'READY' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
                                        </span>
                                    ) : book.status === 'FAILED' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                            <AlertCircle className="w-3 h-3 mr-1" /> Failed
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing
                                        </span>
                                    )}

                                    {/* Actions */}
                                    <div className="flex space-x-2">
                                        {book.status === 'READY' && (
                                            <Link
                                                to={`/analyzer?bookId=${book.id}`}
                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition"
                                                title="Analyze"
                                            >
                                                <FlaskConical className="w-4 h-4" />
                                            </Link>
                                        )}
                                        <button
                                            onClick={() => handleDelete(book.id)}
                                            className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
