import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
    BookOpen,
    FlaskConical,  // Analyzer
    Folder,
    Settings,
    UserCircle,
    LogOut,
    ShieldCheck
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const Layout: React.FC = () => {
    const location = useLocation();
    const { user, logout } = useAuth(); // Retrieve from context or props


    const navigation = [
        { name: 'Library', href: '/books', icon: BookOpen },
        { name: 'Analyzer', href: '/analyzer', icon: FlaskConical },
        { name: 'Projects', href: '/projects', icon: Folder },
        // { name: 'Gallery', href: '/gallery', icon: Image },
        { name: 'Settings', href: '/settings', icon: Settings },
    ];

    // Conditionally add Admin Panel
    if (user?.role === 'ADMIN') {
        navigation.push({ name: 'Admin Panel', href: '/admin', icon: ShieldCheck });
    }

    const isCurrent = (href: string) => location.pathname.startsWith(href);

    return (
        <div className="h-screen flex overflow-hidden bg-gray-900 text-gray-100">
            {/* Sidebar (Mobile) */}
            {/* ... Mobile logic omitted for brevity, focusing on Desktop first ... */}

            {/* Sidebar (Desktop) */}
            <div className="hidden md:flex md:flex-shrink-0">
                <div className="flex flex-col w-64">
                    {/* Sidebar Component */}
                    <div className="flex flex-col h-0 flex-1 bg-gray-800 border-r border-gray-700">
                        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                            <div className="flex items-center flex-shrink-0 px-4 mb-5">
                                <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                                    MerchCrafter
                                </span>
                            </div>
                            <nav className="mt-5 flex-1 px-2 space-y-1">
                                {navigation.map((item) => (

                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${isCurrent(item.href)
                                            ? 'bg-gray-900 text-white font-bold'
                                            : 'text-gray-100 hover:bg-gray-700 hover:text-white'
                                            }`}
                                    >
                                        <item.icon
                                            className={`mr-3 flex-shrink-0 h-6 w-6 ${isCurrent(item.href) ? 'text-white' : 'text-gray-300 group-hover:text-white'
                                                }`}
                                            aria-hidden="true"
                                        />
                                        {item.name}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                        <div className="flex-shrink-0 flex border-t border-gray-700 p-4">
                            <div className="flex-shrink-0 w-full group block">
                                <div className="flex items-center">
                                    <div>
                                        <UserCircle className="inline-block h-9 w-9 rounded-full text-gray-400" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-white group-hover:text-gray-300">
                                            {user?.email || 'User'}
                                        </p>
                                        <button
                                            onClick={logout}
                                            className="text-xs font-medium text-gray-400 group-hover:text-gray-200 mt-1 flex items-center"
                                        >
                                            <LogOut className="h-4 w-4 mr-1" />
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-col w-0 flex-1 overflow-hidden">
                <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none scrollbar-thin scrollbar-thumb-gray-700 bg-gray-50 text-slate-900">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
