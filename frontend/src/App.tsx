import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';

import Home from './pages/Home';
import Upload from './pages/Upload';
import ProjectDetails from './pages/ProjectDetails';
import Billing from './pages/Billing';
import AdminDashboard from './pages/AdminDashboard';
import Settings from './pages/Settings';

function ProtectedLayout() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth/login" />;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex-shrink-0 flex items-center font-bold text-xl text-indigo-600">
                MerchCrafter
              </Link>
              <div className="ml-6 flex space-x-8 items-center">
                <Link to="/" className="text-gray-900 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium">Projects</Link>
                <Link to="/upload" className="text-gray-900 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium">New Project</Link>
                <Link to="/billing" className="text-gray-900 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium">Credits</Link>
                <Link to="/settings" className="text-gray-900 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium">Settings</Link>
                {user.role === 'ADMIN' && (
                  <Link to="/admin" className="text-gray-900 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium">Admin</Link>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <span className="mr-4 text-sm text-gray-700">Credits: <span className="font-bold">{user.credits}</span></span>
              <span className="mr-4 text-sm text-gray-500">{user.email}</span>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  console.log("Rendering App");
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/project/:id" element={<ProjectDetails />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
