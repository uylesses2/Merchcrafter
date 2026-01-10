import React from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

export default function Login() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="max-w-md w-full p-8 bg-white shadow-xl rounded-2xl border border-slate-100">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">MerchCrafter</h1>
                </div>
                <LoginForm onSuccess={() => navigate('/')} />
            </div>
        </div>
    );
}
