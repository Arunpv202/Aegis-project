
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Round1 from './Round1';
import Round2 from './Round2';
import AdminDKGPanel from './AdminDKGPanel';
import useAuthStore from '../../../store/useAuthStore';

export default function DKGDashboard() {
    const { electionId } = useParams();
    const { username, role, token } = useAuthStore();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading');
    const [dkgState, setDkgState] = useState(null);
    const [view, setView] = useState('buttons'); // 'buttons', 'round1', 'round2'
    const [derivedAuthorityId, setDerivedAuthorityId] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const fetchStatus = async () => {
        if (!electionId) return;
        try {
            const res = await fetch(`/api/dkg/status/${electionId}`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data.status);
                setDkgState(data);
            } else {
                setStatus('error');
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    // Auto-fetch Authority ID for Round 2 usage
    const fetchMyAuthorityId = async () => {
        if (!username || !electionId || !token) return;
        try {
            const res = await fetch(`/api/dkg/authorities/${electionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();

                // 1. Prioritize Backend's identification of "Me"
                let myAuthId = data.my_authority_id;

                // 2. Fallback to username matching
                if (!myAuthId) {
                    const me = data.authorities.find(a => a.username === username);
                    if (me) myAuthId = me.authority_id;
                }

                if (myAuthId) {
                    setDerivedAuthorityId(myAuthId);
                }
            }
        } catch (e) {
            console.error("Failed to fetch authorities", e);
        }
    };

    useEffect(() => {
        fetchStatus();
        fetchMyAuthorityId();
        const interval = setInterval(() => {
            fetchStatus();
            // Retry ID fetch if not found yet (e.g. status changed from setup to round1)
            if (!derivedAuthorityId) fetchMyAuthorityId();
        }, 3000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [electionId, username, token]);

    const handleRound1Click = () => {
        if (status === 'setup' || status === 'setup_completed' || status === 'round1' || status === 'round2' || status === 'completed') {
            setView('round1');
            setIsMobileMenuOpen(false);
        } else {
            alert('Round 1 is not active yet.');
        }
    };

    const handleRound2Click = () => {
        if (status === 'round1') {
            alert('Round 2 has not started yet. Please wait for the timer.');
            return;
        }
        if (status === 'round2' || status === 'completed') {
            if (!derivedAuthorityId) {
                // Try one more fetch immediately
                fetchMyAuthorityId().then(() => {
                    setView('round2');
                    setIsMobileMenuOpen(false);
                });
            } else {
                setView('round2');
                setIsMobileMenuOpen(false);
            }
        } else {
            alert('Round 2 is not active.');
        }
    };

    const handleBack = () => {
        setView('buttons');
    };

    const isRound1Active = status === 'round1' || status === 'setup' || status === 'setup_completed';
    const isRound2Active = status === 'round2' || status === 'completed';

    if (status === 'loading') return <div className="p-10 text-white">Loading DKG Status...</div>;
    if (status === 'error') return (
        <div className="p-10 text-red-500">
            <h2 className="text-xl font-bold">Error loading DKG status</h2>
            <p>Invalid Election ID: {String(electionId)}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-white overflow-hidden flex flex-col">
            {/* Top Bar for Mobile or Branding */}
            <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md p-4 flex justify-between items-center lg:hidden z-50">
                <h1 className="text-xl font-bold">DKG Dashboard</h1>
                <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 bg-white/10 rounded">{status}</span>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 border border-white/10 rounded hover:bg-white/10">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">

                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* SIDEBAR NAVIGATION */}
                <div className={`
                    absolute lg:static inset-y-0 left-0 z-40
                    transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
                    transition-transform duration-300 ease-in-out
                    flex flex-col w-80 bg-slate-900 lg:bg-slate-900/80 border-r border-white/5 backdrop-blur-xl p-6 h-full
                `}>
                    <div className="mb-10">
                        <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            DKG Protocol
                        </h1>
                        <p className="text-xs text-gray-500 mt-2 font-mono">Election ID: {electionId}</p>
                    </div>

                    <nav className="flex-1 space-y-4">
                        {role === 'admin' && (
                            <NavButton
                                active={view === 'admin'}
                                onClick={() => { setView('admin'); setIsMobileMenuOpen(false); }}
                                title="Control Panel"
                                subtitle="Admin Controls"
                                status="active"
                            />
                        )}
                        <NavButton
                            active={view === 'round1'}
                            onClick={() => handleRound1Click()}
                            title="Round 1"
                            subtitle="Key Gen"
                            status={isRound1Active ? 'active' : 'inactive'}
                        />
                        <NavButton
                            active={view === 'round2'}
                            onClick={() => handleRound2Click()}
                            title="Round 2"
                            subtitle="Distribution"
                            status={isRound2Active ? 'active' : 'inactive'}
                        />
                    </nav>

                    <div className="mt-auto pt-6 border-t border-white/5">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-bold">Protocol Status</p>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status === 'error' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                                <span className="font-mono text-sm font-bold text-white capitalize">{status}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4">
                            {/* Context-aware Exit Buttons */}
                            {role === 'admin' ? (
                                <button
                                    onClick={() => navigate('/admin/dashboard')}
                                    className="w-full py-2 px-4 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold transition-all text-left flex items-center gap-2"
                                >
                                    <span>←</span> Admin Dashboard
                                </button>
                            ) : (
                                <button
                                    onClick={() => navigate('/user/dashboard')}
                                    className="w-full py-2 px-4 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 text-slate-400 hover:text-white text-xs font-bold transition-all text-left flex items-center gap-2"
                                >
                                    <span>←</span> User Dashboard
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative scrollbar-hide">
                    <div className="max-w-6xl mx-auto space-y-8">

                        {/* Dynamic Content View */}
                        <div className="min-h-[600px] transition-all duration-500">
                            {view === 'buttons' && (
                                <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-50">
                                    <div className="p-6 rounded-full bg-white/5 mb-4">
                                        <div className="w-12 h-12 border-2 border-dashed border-gray-600 rounded-full animate-spin-slow" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-500">Select a Round</h3>
                                    <p className="text-gray-600">Use the sidebar to navigate protocol rounds.</p>
                                </div>
                            )}

                            {view === 'admin' && role === 'admin' && (
                                <div className="animate-slideDown">
                                    <AdminDKGPanel electionId={electionId} onRefresh={fetchStatus} />
                                </div>
                            )}

                            {view === 'round1' && (
                                <div className="animate-fadeIn">
                                    <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                                        <span className="text-indigo-400">01.</span> Round 1
                                    </h2>
                                    <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 shadow-xl">
                                        <Round1
                                            electionId={electionId}
                                            dkgState={dkgState}
                                            refresh={fetchStatus}
                                        />
                                    </div>
                                </div>
                            )}

                            {view === 'round2' && (
                                <div className="animate-fadeIn">
                                    <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                                        <span className="text-purple-400">02.</span> Round 2
                                    </h2>
                                    <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 shadow-xl">
                                        <Round2
                                            electionId={electionId}
                                            authorityId={derivedAuthorityId}
                                            dkgState={dkgState}
                                            refresh={fetchStatus}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sidebar Button Component
function NavButton({ active, onClick, title, subtitle, status }) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-4 rounded-xl transition-all duration-300 group border relative overflow-hidden ${active
                ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-indigo-500/50 shadow-lg'
                : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'
                }`}
        >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <div className="relative z-10">
                <div className={`text-lg font-bold mb-1 ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                    {title}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">{subtitle}</span>
                    {status === 'active' && <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                </div>
            </div>
        </button>
    );
}