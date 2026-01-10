
import axios from 'axios';

const API_URL = 'http://localhost:3000/api/admin';

// Helper to get token (adjust based on your auth storage)
const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface LLMProvider {
    id: string;
    name: string;
    encryptedKey: string | null;
    settings: any;
    lastKeyTestStatus: string;
}

export interface ModelInfo {
    name: string;
    capabilities: string[];
    hasApiKey: boolean;
    keyStatus: string;
}

export interface TaskConfig {
    id: string;
    task: string;
    providerName: string;
    modelName: string;
    dailyBudget: number; // New
}

export const adminApi = {
    getProviders: async () => {
        const res = await axios.get<LLMProvider[]>(`${API_URL}/providers`, { headers: getAuthHeader() });
        return res.data;
    },

    updateProvider: async (name: string, apiKey: string, settings?: any) => {
        const res = await axios.post(`${API_URL}/providers`, { name, apiKey, settings }, { headers: getAuthHeader() });
        return res.data;
    },

    fetchModels: async (providerName: string) => {
        const res = await axios.get<ModelInfo[]>(`${API_URL}/models/${providerName}`, { headers: getAuthHeader() });
        return res.data;
    },

    getTasks: async () => {
        const res = await axios.get<TaskConfig[]>(`${API_URL}/tasks`, { headers: getAuthHeader() });
        return res.data;
    },

    updateTask: async (task: string, providerName?: string, modelName?: string, dailyBudget?: number, pricePer1kTokens?: number) => {
        const res = await axios.post(`${API_URL}/tasks`, { task, providerName, modelName, dailyBudget, pricePer1kTokens }, { headers: getAuthHeader() });
        return res.data;
    },

    getTaskUsage: async () => {
        const res = await axios.get<any[]>(`${API_URL}/tasks/usage`, { headers: getAuthHeader() });
        return res.data;
    },

    getUsage: async () => {
        const res = await axios.get<any[]>(`${API_URL}/usage`, { headers: getAuthHeader() });
        return res.data;
    },

    getQueueStats: async () => {
        const res = await axios.get<{ queued: number; processing: number }>(`${API_URL}/queue/stats`, { headers: getAuthHeader() });
        return res.data;
    },

    controlQueue: async (action: 'pause' | 'resume' | 'restart') => {
        const res = await axios.post(`${API_URL}/queue/control`, { action }, { headers: getAuthHeader() });
        return res.data;
    }
};
