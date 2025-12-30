import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, Activity, DollarSign, CreditCard, Layout } from 'lucide-react';

interface AdminStats {
    kpi: {
        totalUsers: number;
        activeUsers24h: number;
        totalProjects: number;
        totalRevenue: number;
        totalCreditsConsumed: number;
    };
    breakdown: {
        previewCount: number;
        finalCount: number;
        uploadTypes: { name: string; value: number }[];
        stylePopularity: { name: string; value: number }[];
    };
    charts: {
        dailyNewUsers: { date: string; count: number }[];
    };
    recentUsers: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        apiFetch('/admin/stats')
            .then(async res => {
                if (res.ok) return res.json();
                const err = await res.json();
                throw new Error(err.message || 'Failed load stats');
            })
            .then(data => setStats(data))
            .catch(e => setError(e.message));
    }, []);

    if (error) return <div className="text-red-500 p-6">Error: {error}</div>;
    if (!stats) return <div className="p-6">Loading analytics...</div>;

    return (
        <div className="space-y-8 pb-10">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Admin Analytics</h1>
                <span className="text-sm text-gray-500">Live Data</span>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard icon={<Users className="w-6 h-6 text-indigo-600" />} title="Total Users" value={stats.kpi.totalUsers} sub={`Active 24h: ${stats.kpi.activeUsers24h}`} />
                <KpiCard icon={<Layout className="w-6 h-6 text-blue-600" />} title="Projects Created" value={stats.kpi.totalProjects} />
                <KpiCard icon={<CreditCard className="w-6 h-6 text-green-600" />} title="Credits Consumed" value={stats.kpi.totalCreditsConsumed} />
                <KpiCard icon={<DollarSign className="w-6 h-6 text-yellow-600" />} title="Est. Revenue" value={`$${stats.kpi.totalRevenue.toFixed(2)}`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* User Growth Chart */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">User Growth (30 Days)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.charts.dailyNewUsers}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Style Popularity */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Top Art Styles</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.breakdown.stylePopularity} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Upload Types Pie */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Content Source Distribution</h3>
                    <div className="h-64 flex justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.breakdown.uploadTypes}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.breakdown.uploadTypes.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Generation Types */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4">Generation Funnel</h3>
                    <div className="grid grid-cols-2 gap-4 text-center h-full items-center">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-gray-500 text-sm">Previews Generated</p>
                            <p className="text-3xl font-bold text-blue-700">{stats.breakdown.previewCount}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <p className="text-gray-500 text-sm">Final Upscales</p>
                            <p className="text-3xl font-bold text-purple-700">{stats.breakdown.finalCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Recent Users</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stats.recentUsers.map((user: any) => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.credits}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ icon, title, value, sub }: { icon: any, title: string, value: string | number, sub?: string }) {
    return (
        <div className="bg-white p-6 rounded-lg shadow flex items-center space-x-4">
            <div className="bg-gray-100 p-3 rounded-full">
                {icon}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                {sub && <p className="text-xs text-green-600 mt-1">{sub}</p>}
            </div>
        </div>
    );
}
