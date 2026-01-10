
import React, { useEffect, useState } from 'react';

import { adminApi } from '../api/admin';
import type { LLMProvider, ModelInfo, TaskConfig } from '../api/admin';


export default function AdminDashboard() {
    const [providers, setProviders] = useState<LLMProvider[]>([]);
    const [tasks, setTasks] = useState<TaskConfig[]>([]);
    const [modelsMap, setModelsMap] = useState<Record<string, ModelInfo[]>>({});
    const [usage, setUsage] = useState<any[]>([]);
    const [taskUsage, setTaskUsage] = useState<any[]>([]);
    const [queueStats, setQueueStats] = useState<{ queued: number, processing: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [p, t, u, q, tu] = await Promise.all([
                adminApi.getProviders(),
                adminApi.getTasks(),
                adminApi.getUsage(),
                adminApi.getQueueStats(),
                adminApi.getTaskUsage()
            ]);
            setProviders(p);
            setTasks(t);
            setUsage(u);
            setQueueStats(q);
            setTaskUsage(tu);
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = async (name: string, key: string) => {
        try {
            await adminApi.updateProvider(name, key);
            alert('Key saved and verified!');
            loadInitialData(); // Refresh status
        } catch (err: any) {
            alert('Failed to save key: ' + err.message);
        }
    };

    const handleFetchModels = async (providerName: string) => {
        try {
            const models = await adminApi.fetchModels(providerName);
            setModelsMap(prev => ({ ...prev, [providerName]: models }));
        } catch (err: any) {
            alert('Failed to fetch models: ' + err.message);
        }
    };

    const handleSaveTask = async (task: string, provider: string, model: string, budget?: number) => {
        try {
            await adminApi.updateTask(task, provider, model, budget);
            alert('Task updated!');
            loadInitialData();
        } catch (err: any) {
            alert('Failed to update task: ' + err.message);
        }
    };

    const handleQueueAction = async (action: 'restart') => {
        await adminApi.controlQueue(action);
        alert('Action triggered');
    };


    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12">
            <h1 className="text-3xl font-extrabold mb-8 text-primary">Admin Control Panel</h1>

            {error && <div className="bg-red-50 p-4 text-red-900 border border-red-200 font-bold rounded">{error}</div>}

            {/* PROVIDERS */}
            <section className="bg-white p-6 rounded shadow border border-slate-200">
                <h2 className="text-xl font-bold mb-4 text-primary">LLM Providers</h2>
                <div className="grid gap-6">
                    {['gemini', 'openai'].map(name => {
                        const provider = providers.find(p => p.name === name);
                        return (
                            <div key={name} className="border-2 border-slate-200 p-4 rounded bg-slate-50">
                                <h3 className="font-bold capitalize mb-2 text-primary text-lg">{name}</h3>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`px-2 py-1 text-sm font-bold rounded border ${provider?.lastKeyTestStatus === 'valid' ? 'bg-green-100 text-green-900 border-green-300' : 'bg-yellow-100 text-yellow-900 border-yellow-300'}`}>
                                        Status: {provider?.lastKeyTestStatus || 'Unknown'}
                                    </div>
                                    <div className="text-sm text-secondary font-bold">
                                        Key: {provider?.encryptedKey ? '********' : 'Not Set'}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        placeholder="New API Key"
                                        className="border-2 border-slate-300 p-2 rounded flex-1 text-primary placeholder-secondary font-medium focus:border-blue-600 focus:ring-blue-600 focus:outline-none bg-white"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveKey(name, (e.target as HTMLInputElement).value);
                                        }}
                                    />
                                    <button
                                        onClick={(e) => {
                                            const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                            handleSaveKey(name, input.value);
                                        }}
                                        className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 font-bold border border-blue-900 shadow-sm"
                                    >
                                        Save & Test
                                    </button>
                                    <button
                                        onClick={() => handleFetchModels(name)}
                                        className="bg-slate-200 text-primary px-4 py-2 rounded hover:bg-slate-300 font-bold border border-slate-400 shadow-sm"
                                    >
                                        Fetch Models
                                    </button>
                                </div>

                                {/* Models List */}
                                {modelsMap[name] && (
                                    <div className="mt-4 max-h-60 overflow-y-auto border-t-2 border-slate-200 pt-2">
                                        <h4 className="font-bold text-sm mb-2 text-primary">Available Models:</h4>
                                        <ul className="text-sm space-y-1">
                                            {modelsMap[name].map(m => (
                                                <li key={m.name} className="flex justify-between items-center bg-white border border-slate-200 p-2 rounded">
                                                    <span className="text-primary font-semibold">{m.name}</span>
                                                    <span className={`text-xs px-2 py-1 rounded font-bold border ${m.hasApiKey ? 'bg-green-100 text-green-900 border-green-300' : 'bg-red-100 text-red-900 border-red-300'}`}>
                                                        {m.hasApiKey ? 'Key Ready' : 'No Key'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* TASKS */}
            <section className="bg-white p-6 rounded shadow border border-slate-200">
                <h2 className="text-xl font-bold mb-4 text-primary">Task Configuration</h2>
                <div className="grid gap-4">
                    {['embeddings', 'microFragmentLabeling', 'analyzer', 'imageGeneration', 'sceneExtraction', 'timelineResolution', 'visualAnalysis'].map(taskKey => {
                        const config = tasks.find(t => t.task === taskKey);
                        const usageInfo = taskUsage.find(u => u.task === taskKey);
                        return (
                            <TaskRow
                                key={taskKey}
                                task={taskKey}
                                currentConfig={config}
                                usageInfo={usageInfo}
                                providers={providers}
                                modelsMap={modelsMap}
                                onSave={handleSaveTask}
                            />
                        );
                    })}
                </div>
            </section>

            {/* QUEUE */}
            <section className="bg-white p-6 rounded shadow border border-slate-200">
                <h2 className="text-xl font-bold mb-4 text-primary">Ingestion Queue</h2>
                <div className="flex items-center gap-8">
                    <div>
                        <div className="text-3xl font-black text-primary">{queueStats?.queued || 0}</div>
                        <div className="text-secondary font-bold">Queued</div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-blue-700">{queueStats?.processing || 0}</div>
                        <div className="text-secondary font-bold">Processing</div>
                    </div>
                    <button
                        onClick={() => handleQueueAction('restart')}
                        className="ml-auto bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800 font-bold border border-red-900 shadow-sm"
                    >
                        Restart Worker
                    </button>
                </div>
            </section>

            {/* USAGE STATS */}
            <section className="bg-white p-6 rounded shadow border border-slate-200">
                <h2 className="text-xl font-bold mb-4 text-primary">Token Usage</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-2 border-slate-200">
                        <thead className="bg-slate-100 border-b-2 border-slate-200">
                            <tr>
                                <th className="p-3 text-primary font-bold border-r border-slate-200">Date</th>
                                <th className="p-3 text-primary font-bold border-r border-slate-200">Provider</th>
                                <th className="p-3 text-primary font-bold border-r border-slate-200">Model</th>
                                <th className="p-3 text-primary font-bold border-r border-slate-200">Requests</th>
                                <th className="p-3 text-primary font-bold border-r border-slate-200">Input Tok</th>
                                <th className="p-3 text-primary font-bold">Output Tok</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usage.map((row: any) => (
                                <tr key={row.id} className="border-b border-slate-200 hover:bg-slate-50">
                                    <td className="p-3 text-primary font-medium border-r border-slate-200">{new Date(row.date).toLocaleDateString()}</td>
                                    <td className="p-3 capitalize text-primary font-medium border-r border-slate-200">{row.providerName}</td>
                                    <td className="p-3 text-primary font-medium border-r border-slate-200">{row.modelName}</td>
                                    <td className="p-3 text-primary font-mono font-bold border-r border-slate-200">{row.requests}</td>
                                    <td className="p-3 text-primary font-mono font-bold border-r border-slate-200">{row.inputTokens}</td>
                                    <td className="p-3 text-primary font-mono font-bold">{row.outputTokens}</td>
                                </tr>
                            ))}
                            {usage.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center text-secondary font-bold italic">No usage data found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function TaskRow({ task, currentConfig, usageInfo, providers, modelsMap, onSave }: any) {
    const [prov, setProv] = useState(currentConfig?.providerName || 'gemini');
    const [mod, setMod] = useState(currentConfig?.modelName || '');
    const [budget, setBudget] = useState(currentConfig?.dailyBudget || 200);
    const [price, setPrice] = useState(currentConfig?.pricePer1kTokens || 0.0);

    // If models not loaded, provide input?
    const availableModels = modelsMap[prov] || [];
    const used = usageInfo?.count || 0;
    const inputTok = usageInfo?.inputTokens || 0;
    const outputTok = usageInfo?.outputTokens || 0;
    const estCost = usageInfo?.estimatedCost || 0.0;

    const isBudgetExceeded = used >= budget;
    const isNearLimit = used >= budget * 0.8;

    useEffect(() => {
        if (currentConfig) {
            setProv(currentConfig.providerName);
            setMod(currentConfig.modelName);
            setBudget(currentConfig.dailyBudget ?? 200);
            setPrice(currentConfig.pricePer1kTokens || 0.0);
        }
    }, [currentConfig]);

    return (
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 last:border-0 hover:bg-slate-50 p-2 rounded transition-colors bg-white">
            <div className="flex items-center gap-4">
                <div className="w-48 font-mono text-sm font-bold text-primary">{task}</div>
                <select
                    value={prov}
                    onChange={e => setProv(e.target.value)}
                    className="border-2 border-slate-300 p-2 rounded text-primary font-bold focus:border-indigo-600 focus:ring-indigo-600 bg-white"
                >
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                </select>

                {availableModels.length > 0 ? (
                    <select
                        value={mod}
                        onChange={e => setMod(e.target.value)}
                        className="border-2 border-slate-300 p-2 rounded flex-1 text-primary font-bold focus:border-indigo-600 focus:ring-indigo-600 bg-white"
                    >
                        <option value="">Select Model...</option>
                        {availableModels.map((m: any) => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        type="text"
                        value={mod}
                        onChange={e => setMod(e.target.value)}
                        placeholder="Model Name (e.g. text-embedding-004)"
                        className="border-2 border-slate-300 p-2 rounded flex-1 text-primary placeholder-secondary font-bold focus:border-indigo-600 focus:ring-indigo-600 bg-white"
                    />
                )}

                <div className="flex flex-col items-start">
                    <label className="text-xs uppercase font-bold text-slate-500">Price/1k</label>
                    <input
                        type="number"
                        step="0.000001"
                        value={price}
                        onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                        className="w-24 p-2 border-2 border-slate-300 rounded font-bold"
                    />
                </div>

                <button
                    onClick={() => onSave(task, prov, mod, budget, price)}
                    className="bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-800 font-bold border border-indigo-900 shadow-sm h-full self-end"
                >
                    Apply
                </button>
            </div>

            {/* Usage Stats Row */}
            <div className="pl-52 flex gap-8 text-xs items-center bg-slate-100 p-2 rounded mt-1">
                <div className="flex flex-col">
                    <span className="font-bold text-slate-500">TODAY'S USAGE</span>
                    <span className="font-mono text-lg">{used} <span className="text-xs text-slate-400">reqs</span></span>
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-slate-500">TOKENS</span>
                    <span className="font-mono">In: {inputTok.toLocaleString()} | Out: {outputTok.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-slate-500">EST. COST</span>
                    <span className="font-mono text-lg text-green-700">${estCost.toFixed(5)}</span>
                </div>

                {(task === 'sceneExtraction') && (
                    <div className="ml-auto flex items-center gap-2">
                        <span className="font-bold text-slate-600">Budget:</span>
                        <input
                            type="number"
                            value={budget}
                            onChange={e => setBudget(parseInt(e.target.value) || 0)}
                            className="w-20 p-1 border border-slate-300 rounded"
                        />
                        <div className={`px-2 py-1 rounded border font-bold ${isBudgetExceeded ? 'bg-red-100 text-red-800 border-red-300' : isNearLimit ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-green-100 text-green-800 border-green-300'}`}>
                            {isBudgetExceeded ? 'STOPPED' : 'ACTIVE'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
