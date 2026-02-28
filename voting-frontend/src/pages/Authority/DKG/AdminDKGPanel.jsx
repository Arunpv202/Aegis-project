import { useState, useEffect } from 'react';
import { RefreshCw, Play, AlertTriangle, Check, X, Shield, Activity, Users } from 'lucide-react';
import useAuthStore from '../../../store/useAuthStore';

export default function AdminDKGPanel({ electionId, onRefresh }) {
    const [auths, setAuths] = useState([]);
    const [status, setStatus] = useState('loading'); // Add local status state
    const [loading, setLoading] = useState(false);
    const { token } = useAuthStore();

    const fetchAdminStatus = async () => {
        try {
            const res = await fetch(`/api/dkg/admin-status/${electionId}`);
            if (res.ok) {
                const data = await res.json();
                setAuths(data.authorities);
                setStatus(data.election_status); // Update status
            }
        } catch (e) {
            console.error("Admin status fetch failed", e);
        }
    };

    useEffect(() => {
        fetchAdminStatus();
        const interval = setInterval(fetchAdminStatus, 3000);
        return () => clearInterval(interval);
    }, [electionId]);

    const handleTrigger = async (round, label) => {
        if (!window.confirm(`Are you sure you want to FORCE START ${label}?`)) return;
        setLoading(true);
        try {
            const endpoint = round === 'round1' ? 'start-round1' : 'start-round2';
            await fetch(`/api/dkg/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ election_id: electionId })
            });
            alert(`${label} Started!`);
            fetchAdminStatus();
            if (onRefresh) onRefresh(); // Refresh parent dashboard
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!window.confirm("Are you sure you want to FINALIZE the DKG? This will compute the Election Public Key.")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/dkg/finalize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ election_id: electionId })
            });
            if (res.ok) {
                const data = await res.json();
                alert("Success: " + data.message);
                fetchAdminStatus();
                if (onRefresh) onRefresh(); // Refresh parent
            } else {
                const err = await res.json();
                alert("Failed: " + err.message);
            }
        } catch (e) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    const faultyCount = auths.filter(a => a.status.includes('Pending')).length;

    return (
        <div className="relative overflow-hidden mb-8 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
            {/* Header / Actions Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center p-6 border-b border-white/5 bg-gradient-to-r from-slate-900/50 to-indigo-900/20">
                <div className="mb-4 md:mb-0">
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                            <Shield size={24} />
                        </div>
                        <span>Admin Controls</span>
                    </h3>
                    <p className="text-sm text-indigo-200/60 ml-12 mt-1">Master Control Panel for DKG Protocol</p>
                </div>

                <div className="flex flex-wrap justify-center md:justify-end gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <ActionButton
                        color="blue"
                        icon={<Play size={14} fill="currentColor" />}
                        label={status === 'round1' || status === 'round2' || status === 'completed' ? "Round 1 Active" : "Start Round 1"}
                        onClick={() => handleTrigger('round1', 'Round 1')}
                        loading={loading}
                        disabled={status === 'round1' || status === 'round2' || status === 'completed'}
                    />
                    <ActionButton
                        color="purple"
                        icon={<Play size={14} fill="currentColor" />}
                        label={status === 'round2' || status === 'completed' ? "Round 2 Active" : "Start Round 2"}
                        onClick={() => handleTrigger('round2', 'Round 2')}
                        loading={loading}
                        disabled={status !== 'round1' || status === 'completed'} // Only enable if Round 1 is active (or technically could be setup but waiting round1... logic: must proceed sequentially)
                    />
                    <ActionButton
                        color="emerald"
                        icon={<Check size={16} />}
                        label={status === 'completed' ? "DKG Finalized" : "Finalize DKG"}
                        onClick={handleFinalize}
                        loading={loading}
                        disabled={status !== 'round2' || status === 'completed'} // Only finalize if Round 2 is active
                    />
                </div>
            </div>

            <div className="p-6">
                {/* STATUS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatusCard
                        icon={<Users size={20} />}
                        label="Total Authorities"
                        value={auths.length}
                        color="blue"
                    />
                    <StatusCard
                        icon={<Activity size={20} />}
                        label="Participating"
                        value={auths.filter(a => a.has_round1).length}
                        color="emerald"
                    />
                    <StatusCard
                        icon={<AlertTriangle size={20} />}
                        label="Faulty / Pending"
                        value={faultyCount}
                        color={faultyCount > 0 ? "rose" : "slate"}
                    />
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20 shadow-inner w-full">
                    <table className="w-full text-sm text-left whitespace-nowrap min-w-max">
                        <thead className="bg-white/5 text-gray-400 uppercase text-[11px] font-bold tracking-wider">
                            <tr>
                                <th className="p-4 pl-6">Authority ID</th>
                                <th className="p-4">Authority Name</th>
                                <th className="p-4 text-center">Round 1 (PK)</th>
                                <th className="p-4 text-center">Round 2 (Commit)</th>
                                <th className="p-4 text-right pr-6">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {auths.map(a => (
                                <tr key={a.authority_id} className="hover:bg-indigo-500/5 transition-all duration-300 group">
                                    <td className="p-4 pl-6 font-mono text-indigo-300 group-hover:text-indigo-200">{a.authority_id || '-'}</td>
                                    <td className="p-4 font-mono text-gray-400 text-xs">
                                        <span className="bg-black/40 px-2 py-1 rounded border border-white/5 text-indigo-300 font-bold">{a.username}</span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {a.has_round1
                                            ? <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"><Check size={16} strokeWidth={3} /></div>
                                            : <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-gray-600 border border-white/10"><X size={16} /></div>
                                        }
                                    </td>
                                    <td className="p-4 text-center">
                                        {a.has_round2
                                            ? <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"><Check size={16} strokeWidth={3} /></div>
                                            : <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-gray-600 border border-white/10"><X size={16} /></div>
                                        }
                                    </td>
                                    <td className="p-4 text-right pr-6">
                                        <Badge status={a.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {auths.length === 0 && (
                        <div className="p-8 text-center text-gray-500 italic">No authorities found for this election.</div>
                    )}
                </div>

                {faultyCount > 0 && (
                    <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-4 animate-fadeIn">
                        <div className="p-2 bg-rose-500/20 rounded-full text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                            <AlertTriangle size={20} />
                        </div>
                        <div className="text-rose-200 text-sm">
                            <span className="font-bold text-rose-300 block mb-1">Attention Required</span>
                            {faultyCount} authority node{faultyCount > 1 ? 's are' : ' is'} currently offline or pending submission. The protocol waits for all participants.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Sub Components ---

function ActionButton({ color, icon, label, onClick, loading, disabled }) {
    const styles = {
        blue: "from-blue-600 to-indigo-600 shadow-blue-500/25 border-blue-400/30",
        purple: "from-purple-600 to-pink-600 shadow-purple-500/25 border-purple-400/30",
        emerald: "from-emerald-600 to-teal-600 shadow-emerald-500/25 border-emerald-400/30"
    };

    return (
        <button
            onClick={onClick}
            disabled={loading || disabled}
            className={`
                group relative px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white
                bg-gradient-to-r ${styles[color]}
                border shadow-lg transition-all duration-300
                ${loading || disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-95'}
                flex items-center gap-2
            `}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function StatusCard({ icon, label, value, color }) {
    const styles = {
        blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
        slate: "bg-slate-700/30 border-slate-600/30 text-gray-400",
    };

    return (
        <div className={`p-5 rounded-2xl border ${styles[color]} flex items-center justify-between group transition-all hover:bg-opacity-50`}>
            <div>
                <div className={`text-3xl font-black mb-1 group-hover:scale-110 transition-transform origin-left`}>{value}</div>
                <div className="text-[10px] uppercase font-bold tracking-widest opacity-70">{label}</div>
            </div>
            <div className={`p-3 rounded-xl bg-white/5 backdrop-blur-sm`}>{icon}</div>
        </div>
    );
}

function Badge({ status }) {
    const isCompleted = status === 'Completed' || status === 'Ready';
    return (
        <span className={`
            px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border
            ${isCompleted
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.15)]'}
        `}>
            {status}
        </span>
    );
}
