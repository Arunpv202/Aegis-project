import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { Lock, User, Calendar, Hash, ArrowRight, Loader2, ShieldPlus } from 'lucide-react';
import CryptoJS from 'crypto-js';
import InlineMessage from '../../components/UI/InlineMessage';
import { motion } from 'framer-motion';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        voter_id: '',
        dob: '',
        username: '',
        password: '',
        confirmPassword: ''
    });
    const { register, error, isLoading, clearError } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        clearError();
    }, [clearError]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) clearError();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            // Handle password mismatch locally usually
            alert("Passwords do not match");
            return;
        }

        // Client-side hashing of password before sending
        const hashedPassword = CryptoJS.SHA256(formData.password).toString();

        try {
            await register({
                name: formData.name,
                voter_id: formData.voter_id,
                dob: formData.dob,
                username: formData.username,
                password: hashedPassword
            });
            navigate('/login'); // Redirect to login on success
        } catch (err) {
            console.error("Signup failed", err);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white font-sans p-6 relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
            <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-lg relative z-10"
            >
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    {/* Decorative Corner Glow */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl" />

                    <div className="text-center mb-10 relative">
                        <div className="inline-flex p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 mb-6 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                            <ShieldPlus size={32} />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            Create Account
                        </h2>
                        <p className="text-gray-400 text-sm">
                            Join the secure voting platform
                        </p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            {/* Personal Info Group */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="group md:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Full Name</label>
                                    <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                        </div>
                                        <input
                                            name="name"
                                            type="text"
                                            required
                                            className="appearance-none block w-full px-3 py-4 pl-12 bg-black/40 border border-white/10 rounded-xl placeholder-gray-600 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all sm:text-sm font-medium"
                                            placeholder="John Doe"
                                            value={formData.name}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="group">
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Voter ID</label>
                                    <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Hash className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                        </div>
                                        <input
                                            name="voter_id"
                                            type="text"
                                            required
                                            pattern="\d{8}"
                                            title="Voter ID must be exactly 8 digits"
                                            className="appearance-none block w-full px-3 py-4 pl-12 bg-black/40 border border-white/10 rounded-xl placeholder-gray-600 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all sm:text-sm font-medium"
                                            placeholder="8 Digits"
                                            value={formData.voter_id}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                                <div className="group">
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Date of Birth</label>
                                    <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Calendar className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                        </div>
                                        <input
                                            name="dob"
                                            type="date"
                                            required
                                            className="appearance-none block w-full px-3 py-4 pl-12 bg-black/40 border border-white/10 rounded-xl placeholder-gray-600 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all sm:text-sm font-medium" // color-scheme-dark is standard CSS, might need detailed css for calendar icon
                                            value={formData.dob}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Account Info Group */}
                            <div className="pt-4 border-t border-white/5">
                                <div className="group mb-4">
                                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Username</label>
                                    <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                        </div>
                                        <input
                                            name="username"
                                            type="text"
                                            required
                                            pattern="[a-zA-Z0-9]{6}"
                                            title="Username must be exactly 6 alphanumeric characters"
                                            className="appearance-none block w-full px-3 py-4 pl-12 bg-black/40 border border-white/10 rounded-xl placeholder-gray-600 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all sm:text-sm font-medium"
                                            placeholder="6 Characters"
                                            value={formData.username}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="group">
                                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Password</label>
                                        <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                            </div>
                                            <input
                                                name="password"
                                                type="password"
                                                required
                                                className="appearance-none block w-full px-3 py-4 pl-12 bg-black/40 border border-white/10 rounded-xl placeholder-gray-600 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all sm:text-sm font-medium"
                                                placeholder="••••••••"
                                                value={formData.password}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="group">
                                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Confirm</label>
                                        <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                            </div>
                                            <input
                                                name="confirmPassword"
                                                type="password"
                                                required
                                                className="appearance-none block w-full px-3 py-4 pl-12 bg-black/40 border border-white/10 rounded-xl placeholder-gray-600 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all sm:text-sm font-medium"
                                                placeholder="••••••••"
                                                value={formData.confirmPassword}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <InlineMessage type="error" message={error} onClose={clearError} />
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white transition-all shadow-lg active:scale-[0.98] ${isLoading
                                        ? 'bg-emerald-900/50 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 hover:shadow-emerald-600/30'
                                    }`}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="animate-spin" size={18} />
                                        <span>Creating Account...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>Register & Join</span>
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 text-center bg-white/5 rounded-xl p-4 border border-white/5">
                        <p className="text-gray-400 text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="font-bold text-emerald-400 hover:text-emerald-300 transition-colors hover:underline decoration-emerald-500/30 underline-offset-4">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Signup;
