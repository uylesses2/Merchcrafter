const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // optional: redirect to login or clear token
        localStorage.removeItem('token');
        window.location.href = '/auth/login';
    }

    return response;
}
