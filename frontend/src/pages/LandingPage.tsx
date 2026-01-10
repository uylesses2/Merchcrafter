import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Wand2, Shirt, Menu, X as XIcon, Sparkles, Layers, Search } from 'lucide-react';
import Modal from '../components/Modal';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    // Scroll effect for navbar
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLoginSuccess = () => {
        setIsLoginModalOpen(false);
        navigate('/projects');
    };

    const handleGetStarted = () => {
        if (user) {
            navigate('/projects');
        } else {
            setIsLoginModalOpen(true);
        }
    };

    return (
        <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] font-sans selection:bg-purple-100 selection:text-purple-900 overflow-x-hidden">

            <Modal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)}>
                <LoginForm onSuccess={handleLoginSuccess} onRegisterClick={() => { setIsLoginModalOpen(false); navigate('/auth/register'); }} />
            </Modal>

            {/* Navigation */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/70 backdrop-blur-xl border-b border-gray-200/50' : 'bg-transparent'}`}>
                <div className="max-w-[980px] mx-auto px-6 h-12 flex justify-between items-center text-xs font-medium tracking-wide">
                    <Link to="/" className="text-lg font-semibold tracking-tight hover:opacity-70 transition-opacity">
                        MerchCrafter
                    </Link>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-8 text-[#1D1D1F]/80">
                        <a href="#features" className="hover:text-[#1D1D1F] transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-[#1D1D1F] transition-colors">How it Works</a>
                        {user ? (
                            <button onClick={() => navigate('/projects')} className="bg-black text-white px-3 py-1 rounded-full hover:bg-gray-800 transition-colors">
                                Dashboard
                            </button>
                        ) : (
                            <button onClick={() => setIsLoginModalOpen(true)} className="bg-black text-white px-3 py-1 rounded-full hover:bg-gray-800 transition-colors">
                                Log in
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button className="md:hidden p-1" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMenuOpen && (
                    <div className="absolute top-12 left-0 w-full bg-white border-b border-gray-200 p-6 flex flex-col space-y-4 md:hidden animate-in slide-in-from-top-2">
                        <a href="#features" className="text-lg font-medium text-[#1D1D1F]" onClick={() => setIsMenuOpen(false)}>Features</a>
                        <a href="#how-it-works" className="text-lg font-medium text-[#1D1D1F]" onClick={() => setIsMenuOpen(false)}>How it Works</a>
                        <button
                            onClick={() => { setIsMenuOpen(false); setIsLoginModalOpen(true); }}
                            className="bg-black text-white py-3 rounded-lg text-lg font-medium w-full"
                        >
                            Log in
                        </button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <main className="pt-32 pb-24 md:pt-48 md:pb-32 px-6">
                <div className="max-w-[1200px] mx-auto text-center">
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tighter text-[#1D1D1F] mb-6 leading-[1.05]">
                        Story to Store.
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
                            Like magic.
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-[#86868B] font-medium max-w-2xl mx-auto mb-10 leading-relaxed tracking-tight">
                        The ultimate creative workflow for authors. Analyze your manuscript, Visualize your characters, and Create merchandise in seconds.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
                        <button
                            onClick={handleGetStarted}
                            className="bg-[#0071E3] text-white rounded-full px-8 py-3 text-lg font-medium hover:bg-[#0077ED] transition-all transform hover:scale-[1.02]"
                        >
                            Get Started
                        </button>
                        <a href="#how-it-works" className="text-[#0071E3] text-lg font-medium flex items-center hover:underline dropdown-toggle">
                            Learn more <ArrowRight className="ml-1 w-4 h-4" />
                        </a>
                    </div>

                    {/* Visual Story: Abstract Representation of the Workflow */}
                    <div className="relative max-w-5xl mx-auto h-[400px] md:h-[600px] bg-white rounded-[40px] shadow-2xl border border-gray-100 overflow-hidden flex items-center justify-center">
                        {/* Background Gradients */}
                        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-[100px]" />
                        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[100px]" />

                        {/* Card Sequence Container */}
                        <div className="relative flex items-center justify-center gap-8 md:gap-16 scale-75 md:scale-100">

                            {/* Card 1: The Book */}
                            <div className="w-48 h-64 bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center justify-center p-6 relative transform -rotate-6 transition-transform hover:rotate-0 duration-500 z-10">
                                <BookOpen className="w-12 h-12 text-gray-800 mb-4" />
                                <div className="space-y-2 w-full">
                                    <div className="h-2 bg-gray-100 rounded-full w-3/4" />
                                    <div className="h-2 bg-gray-100 rounded-full w-full" />
                                    <div className="h-2 bg-gray-100 rounded-full w-5/6" />
                                </div>
                                <div className="absolute -bottom-4 bg-white px-3 py-1 rounded-full shadow-md text-xs font-bold text-secondary border border-gray-100">
                                    Manuscript
                                </div>
                            </div>

                            {/* Connection Arrow 1 */}
                            <div className="w-24 h-[2px] bg-gradient-to-r from-gray-200 to-purple-400 hidden md:block" />

                            {/* Card 2: The Analysis (Floating higher) */}
                            <div className="w-56 h-72 bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 flex flex-col p-6 z-20 transform scale-110">
                                <div className="flex items-center space-x-2 mb-6">
                                    <div className="w-3 h-3 rounded-full bg-red-400" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                    <div className="w-3 h-3 rounded-full bg-green-400" />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div className="p-3 bg-purple-50 rounded-xl flex items-center space-x-3">
                                        <Sparkles className="w-5 h-5 text-purple-600" />
                                        <div className="h-2 bg-purple-200 rounded-full w-20" />
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-xl flex items-center space-x-3">
                                        <Search className="w-5 h-5 text-blue-600" />
                                        <div className="h-2 bg-blue-200 rounded-full w-16" />
                                    </div>
                                </div>
                                <div className="absolute -top-4 -right-4 bg-[#0071E3] text-white p-2 rounded-xl shadow-lg">
                                    <Wand2 className="w-6 h-6 animate-pulse" />
                                </div>
                            </div>

                            {/* Connection Arrow 2 */}
                            <div className="w-24 h-[2px] bg-gradient-to-r from-purple-400 to-gray-200 hidden md:block" />

                            {/* Card 3: The Merch */}
                            <div className="w-48 h-64 bg-slate-900 rounded-2xl shadow-xl border border-gray-800 flex flex-col items-center justify-center p-6 relative transform rotate-6 transition-transform hover:rotate-0 duration-500 z-10">
                                <Shirt className="w-16 h-16 text-white/90 mb-2" />
                                <div className="text-white/40 text-[10px] tracking-widest uppercase mt-4 font-semibold">
                                    Collection
                                </div>
                                <div className="absolute -bottom-4 bg-white px-3 py-1 rounded-full shadow-md text-xs font-semibold text-gray-900 border border-gray-100">
                                    Product Ready
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </main>

            {/* Features (Bento Grid) */}
            <section id="features" className="py-32 bg-white px-6">
                <div className="max-w-[980px] mx-auto">
                    <h2 className="text-4xl md:text-5xl font-semibold text-[#1D1D1F] mb-16 text-center tracking-tight">
                        Power. Beauty. Creativity.
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Feature 1 (Large) */}
                        <div className="col-span-1 md:col-span-2 bg-[#F5F5F7] rounded-3xl p-10 flex flex-col justify-between h-[400px] overflow-hidden group">
                            <div>
                                <h3 className="text-2xl font-semibold mb-2 text-[#1D1D1F]">Deep Context Analysis</h3>
                                <p className="text-[#86868B] max-w-md">Our AI reads your entire book, understanding nuances of character and setting that others miss.</p>
                            </div>
                            <div className="mt-8 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-700 ease-out">
                                <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-4 space-y-3 opacity-90">
                                    <div className="h-2 bg-gray-100 rounded w-full" />
                                    <div className="h-2 bg-gray-100 rounded w-5/6" />
                                    <div className="h-2 bg-purple-100 rounded w-1/3" />
                                </div>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-[#F5F5F7] rounded-3xl p-10 flex flex-col h-[400px] group">
                            <Layers className="w-10 h-10 text-indigo-600 mb-6" />
                            <h3 className="text-xl font-semibold mb-2 text-[#1D1D1F]">Smart Layers</h3>
                            <p className="text-[#86868B] text-sm leading-relaxed mb-auto">Break down your story into Micro-fragments, Scenes, and Arcs for precise control.</p>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-white border border-gray-100 shadow-xl rounded-3xl p-10 flex flex-col h-[400px] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                            <Wand2 className="w-12 h-12 text-purple-600 mb-6" />
                            <h3 className="text-xl font-semibold mb-2 text-[#1D1D1F]">Visual Studio</h3>
                            <p className="text-[#86868B] text-sm leading-relaxed">Turn text into 4K art. Choose a style, select a character, and generate.</p>
                        </div>

                        {/* Feature 4 (Large) */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-black rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between text-white h-[300px] overflow-hidden relative">
                            <div className="relative z-10 max-w-md">
                                <h3 className="text-2xl font-semibold mb-2">Ready for Print.</h3>
                                <p className="text-slate-300 font-medium">Export high-resolution images perfectly upscaled for t-shirts, mugs, and posters.</p>
                            </div>
                            <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-6 mt-8 md:mt-0 transform rotate-3 hover:rotate-6 transition-transform">
                                <Shirt className="w-16 h-16 text-white" />
                            </div>
                            {/* Abstract bg liquid */}
                            <div className="absolute right-[-100px] top-[-100px] w-96 h-96 bg-purple-900/50 rounded-full blur-[80px]" />
                        </div>
                    </div>
                </div>
            </section>

            {/* How it Works (Minimalist Steps) */}
            <section id="how-it-works" className="py-32 bg-[#FBFBFD] px-6">
                <div className="max-w-[800px] mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-semibold text-[#1D1D1F] mb-20 tracking-tight">Simplicity is the ultimate sophistication.</h2>

                    <div className="space-y-24">
                        {[
                            { step: "01", title: "Upload", desc: "Drag and drop your PDF or EPUB. We handle the rest." },
                            { step: "02", title: "Refine", desc: "Review the extracted characters. Tweak their appearance prompts." },
                            { step: "03", title: "Create", desc: "Generate art. Upscale to 4K. Download for your shop." }
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col md:flex-row items-center md:items-start md:text-left gap-8 md:gap-16 group">
                                <div className="text-6xl md:text-8xl font-bold text-gray-100 group-hover:text-purple-100 transition-colors select-none">
                                    {item.step}
                                </div>
                                <div className="pt-4 max-w-md">
                                    <h3 className="text-2xl font-semibold text-[#1D1D1F] mb-3">{item.title}</h3>
                                    <p className="text-xl text-[#86868B] leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-32 px-6 bg-white border-t border-gray-100">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1D1D1F] mb-6">
                        Start your collection.
                    </h2>
                    <p className="text-xl text-[#86868B] mb-10">Join thousands of authors turning words into worlds.</p>
                    <button
                        onClick={handleGetStarted}
                        className="bg-[#0071E3] text-white rounded-full px-10 py-4 text-xl font-medium hover:bg-[#0077ED] transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl"
                    >
                        Try MerchCrafter Free
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#F5F5F7] py-12 px-6 text-xs text-[#86868B]">
                <div className="max-w-[980px] mx-auto border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p>Copyright © {new Date().getFullYear()} FanForge Labs Inc. All rights reserved.</p>
                    <div className="flex space-x-6">
                        <a href="#" className="hover:text-[#1D1D1F] hover:underline">Privacy Policy</a>
                        <a href="#" className="hover:text-[#1D1D1F] hover:underline">Terms of Use</a>
                        <a href="#" className="hover:text-[#1D1D1F] hover:underline">Sales and Refunds</a>
                        <a href="#" className="hover:text-[#1D1D1F] hover:underline">Legal</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
