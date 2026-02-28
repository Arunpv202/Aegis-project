import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { Lock, User, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import InlineMessage from '../../components/UI/InlineMessage';
import { motion } from 'framer-motion';

const Login = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const { login, error, isLoading, clearError, setRole } = useAuthStore();
    useEffect(() => {
        clearError();
    }, [clearError]);

    const navigate = useNavigate();
    const location = useLocation();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) clearError();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(formData.username, formData.password);

            // Determine role from navigation state or localStorage or default to 'user'
            const role = location.state?.role || localStorage.getItem('role') || 'user';

            // Update store
            setRole(role);

            // Redirect
            if (role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                navigate('/user/dashboard');
            }
        } catch (err) {
            console.error("Login failed", err);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white font-sans p-6 relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    {/* Decorative Corner Glow */}
                    <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl" />

                    <div className="text-center mb-10 relative">
                        <div className="inline-flex p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-6 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                            <ShieldCheck size={32} />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            Welcome Back
                        </h2>
                        <p className="text-gray-400 text-sm">
                            Sign in to access your secure voting dashboard
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-5">
                            <div className="group">
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Username</label>
                                <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                                    </div>
                                    <input
                                        id="username"
                                        name="username"
                                        type="text"
                                        required
                                        className="appearance-none block w-full px-3 py-4 pl-12 bg-black/40 border border-white/10 rounded-xl placeholder-gray-600 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all sm:text-sm font-medium"
                                        placeholder="Enter your username"
                                        value={formData.username}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Password</label>
                                <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        className="appearance-none block w-full px-3 py-4 pl-12 bg-black/40 border border-white/10 rounded-xl placeholder-gray-600 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all sm:text-sm font-medium"
                                        placeholder="Enter your password"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <InlineMessage type="error" message={error} onClose={clearError} />
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white transition-all shadow-lg active:scale-[0.98] ${isLoading
                                        ? 'bg-indigo-900/50 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 hover:shadow-indigo-600/30'
                                    }`}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="animate-spin" size={18} />
                                        <span>Verifying Credentials...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>Sign In to Dashboard</span>
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-500 text-sm">
                            Don't have an account?{' '}
                            <Link to="/signup" className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors hover:underline decoration-indigo-500/30 underline-offset-4">
                                Create Account
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
