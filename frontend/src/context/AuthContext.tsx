import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import type { UserDTO, LoginResponse } from '@merchcrafter/shared';

interface AuthContextType {
    user: UserDTO | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    console.log("AuthProvider initializing");
    const [user, setUser] = useState<UserDTO | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (token) {
            // Validate token and fetch user
            apiFetch('/auth/me')
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Failed');
                })
                .then(data => setUser(data))
                .catch(() => {
                    logout();
                })
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, [token]);

    const login = async (email: string, password: string) => {
        const res = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error('Login failed');
        const data: LoginResponse = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
    };

    const register = async (email: string, password: string) => {
        const res = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error('Registration failed');
        const data: LoginResponse = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
