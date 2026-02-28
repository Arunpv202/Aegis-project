import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Key, ArrowRight, Loader2, Copy, CheckCircle2 } from "lucide-react";

export default function GenerateKey() {
    const navigate = useNavigate();
    const [electionId, setElectionId] = useState("");
    const [generatedKey, setGeneratedKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Determine dashboard link based on role
    const role = localStorage.getItem("role") || "user";
    const dashboardLink = role === "admin" ? "/admin/dashboard" : "/user/dashboard";

    const handleGenerate = async () => {
        if (!electionId) {
            alert("Please enter an Election ID");
            return;
        }

        setLoading(true);
        try {
            // Calling the existing endpoint for generating a single token
            // Route is mounted at /api/tokens in server.js, so full path is /api/tokens/register-user
            const response = await fetch("/api/tokens/register-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    election_id: electionId
                    // Name/VoterID are optional in backend, so we can omit them for a pure "Key Gen" 
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to generate key");
            }

            const data = await response.json();
            // Assuming response structure: { message: "...", token: { token: "HEXSTRING", ... } } 
            // or just { token: "HEXSTRING" } depending on controller. 
            // Checking tokenController.js: res.status(201).json({ message: 'Token generated', token: token });
            // where 'token' is the object. So key is data.token.token

            setGeneratedKey(data.token.token);

        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background Decor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md relative z-10"
            >
                <button
                    onClick={() => navigate(dashboardLink)}
                    className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Back to Dashboard</span>
                </button>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative">

                    <div className="text-center mb-10">
                        <div className="inline-flex p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-6 border border-indigo-500/20">
                            <Key size={32} />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight mb-3">Generate Access Key</h2>
                        <p className="text-gray-400 text-sm leading-relaxed px-4">
                            Create a unique, one-time secure key for participating in an election.
                        </p>
                    </div>

                    {!generatedKey ? (
                        <div className="space-y-6">
                            <div className="group">
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
                                    Election Identifier
                                </label>
                                <input
                                    type="text"
                                    value={electionId}
                                    onChange={(e) => setElectionId(e.target.value)}
                                    placeholder="Enter Election ID"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-6 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium font-mono text-center tracking-widest text-lg"
                                />
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full mt-4 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : "Generate Key"}
                            </button>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                                <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">Your Secure Key</p>
                                <div className="flex items-center justify-center gap-3">
                                    <code className="text-2xl font-mono text-white font-bold tracking-wider">{generatedKey}</code>
                                    <button onClick={copyToClipboard} className="text-emerald-400 hover:text-white transition-colors">
                                        {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate(dashboardLink)}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-3"
                            >
                                <span>Return to Dashboard</span>
                                <ArrowRight size={18} />
                            </button>
                        </motion.div>
                    )}

                </div>
            </motion.div>
        </div>
    );
}
