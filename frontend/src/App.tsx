import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';

// Pages
import Projects from './pages/Home'; // Projects List (aliased from Home)
import Upload from './pages/Upload';
import ProjectDetails from './pages/ProjectDetails';
import Books from './pages/Books';
import BookAnalyzer from './pages/BookAnalyzer';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import AdminDashboard from './pages/AdminDashboard';
import Feedback from './pages/Feedback';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Loading...</div>;
  if (!user) return <Navigate to="/auth/login" />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/landing" replace />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />

          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/projects" element={<Projects />} />
            <Route path="/project/:id" element={<ProjectDetails />} />
            {/* ... rest of protected routes */}
            <Route path="/upload" element={<Upload />} />
            <Route path="/books" element={<Books />} />
            <Route path="/analyzer" element={<BookAnalyzer />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
