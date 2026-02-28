import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, BarChart3, Medal, Share2, Award } from "lucide-react";
import axios from "axios";
import { motion } from "framer-motion";

export default function ResultPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [election, setElection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [totalVotes, setTotalVotes] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [elecRes, resultRes, candRes] = await Promise.all([
                    axios.get(`/api/elections/${id}`),
                    axios.get(`/api/elections/${id}/final-result`),
                    axios.get(`/api/elections/${id}/candidates`)
                ]);

                setElection(elecRes.data);

                // Merge blockchain vote counts with local DB symbol_name
                const symbolMap = {};
                (candRes.data || []).forEach(c => { symbolMap[c.candidate_name] = c.symbol_name; });

                const merged = (resultRes.data || []).map(r => ({
                    ...r,
                    symbol_name: symbolMap[r.candidate_name] || ''
                }));

                const sorted = merged.sort((a, b) => b.vote_count - a.vote_count);
                setCandidates(sorted);

                const total = sorted.reduce((sum, c) => sum + (c.vote_count || 0), 0);
                setTotalVotes(total);

            } catch (e) {
                console.error("Failed to load results", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">Loading Results...</div>;

    const winner = candidates[0];

    return (
        <div className="min-h-screen bg-[#020617] text-white p-6 font-sans relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />

            <div className="max-w-5xl mx-auto relative z-10">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-6 font-bold text-xs uppercase tracking-widest">
                        <Trophy size={14} /> Official Election Results
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black mb-4">{election?.election_name}</h1>
                    <p className="text-gray-400">Total Votes Cast: <span className="text-white font-bold">{totalVotes}</span></p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Winner Card - Hidden if Tie */}
                    {!(candidates.length > 1 && candidates[0].vote_count === candidates[1].vote_count) && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="lg:col-span-1 bg-gradient-to-b from-yellow-500/10 to-transparent p-1 rounded-[2.5rem] border border-yellow-500/20"
                        >
                            <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-[2.3rem] text-center h-full flex flex-col items-center">
                                <div className="w-24 h-24 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                                    <Award size={48} />
                                </div>
                                <h2 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-2">Winner</h2>
                                <h3 className="text-3xl font-black mb-2">{winner?.candidate_name}</h3>
                                <div className="text-6xl font-black text-white mb-4">{winner?.vote_count}</div>
                                <div className="text-sm text-gray-500 font-mono">Votes secured</div>
                            </div>
                        </motion.div>
                    )}

                    {/* Detailed List */}
                    <div className="lg:col-span-2 space-y-4">
                        {candidates.map((cand, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl flex items-center justify-between hover:border-indigo-500/30 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-gray-500'}`}>
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg group-hover:text-indigo-400 transition-colors">{cand.candidate_name}</h4>
                                        {cand.symbol_name && <div className="text-xs text-gray-500">{cand.symbol_name}</div>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black">{cand.vote_count}</div>
                                    <div className="text-xs text-gray-600">
                                        {totalVotes > 0 ? ((cand.vote_count / totalVotes) * 100).toFixed(1) : 0}%
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
