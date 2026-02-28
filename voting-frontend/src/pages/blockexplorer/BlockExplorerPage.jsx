// BlockExplorerPage.jsx – sidebar layout with 3 nav sections
import React, { useState, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    Database, ArrowLeft, Loader2,
    ShieldCheck, User, Key, ChevronRight,
    LayoutDashboard, Users, Lock, Search as SearchIcon
} from "lucide-react";

import ElectionDetailsCard from "./ElectionDetailsCard";
import VoteCard from "./VoteCard";
import AuthorityCard from "./AuthorityCard";
import SearchNullifier from "./SearchNullifier";

// ─────────────────────────────────────────────────────────────────────────────
// Election ID Entry Modal
// ─────────────────────────────────────────────────────────────────────────────
function ElectionIdModal({ onSubmit }) {
    const [id, setId] = useState("");
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
                    <Database size={22} className="text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Block Explorer</h2>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Enter an Election ID to inspect the on-chain data for that election.
                    Your role (creator / voter / authority) will be detected automatically.
                </p>
                <input
                    autoFocus
                    type="text"
                    value={id}
                    onChange={e => setId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && id.trim() && onSubmit(id.trim())}
                    placeholder="e.g. election-2024-01"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors mb-4"
                />
                <button
                    onClick={() => id.trim() && onSubmit(id.trim())}
                    disabled={!id.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={16} /> View Blockchain
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role badge
// ─────────────────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
    const map = {
        creator: { label: "Creator", cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25", Icon: ShieldCheck },
        voter: { label: "Voter", cls: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25", Icon: User },
        authority: { label: "Authority", cls: "bg-amber-500/12 text-amber-400 border-amber-500/25", Icon: Key },
        both: { label: "Voter + Authority", cls: "bg-violet-500/12 text-violet-400 border-violet-500/25", Icon: ShieldCheck },
    };
    const cfg = map[role] || map.voter;
    const { label, cls, Icon } = cfg;
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border ${cls}`}>
            <Icon size={12} /> {label}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar nav item
// ─────────────────────────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, onClick, badge }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group relative whitespace-nowrap flex-shrink-0 w-auto md:w-full
                ${active
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                }`}
        >
            {/* Active indicator bar */}
            {active && (
                <span className="absolute left-1/2 bottom-0 -translate-x-1/2 h-0.5 w-6 bg-indigo-400 rounded-full md:left-0 md:top-1/2 md:-translate-y-1/2 md:-translate-x-0 md:h-6 md:w-0.5" />
            )}
            <span className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${active ? "bg-indigo-500/20 text-indigo-400" : "bg-white/[0.04] text-slate-500 group-hover:text-slate-300"}`}>
                <Icon size={15} />
            </span>
            <span className="flex-1 text-left">{label}</span>
            {badge != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-indigo-500/30 text-indigo-300" : "bg-white/[0.06] text-slate-500"}`}>
                    {badge}
                </span>
            )}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section heading in content area
// ─────────────────────────────────────────────────────────────────────────────
function ContentHeading({ icon: Icon, title, subtitle, color = "indigo" }) {
    const clrs = {
        indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
        amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
        emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    };
    return (
        <div className="flex items-center gap-3 mb-6">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${clrs[color]}`}>
                <Icon size={17} />
            </div>
            <div>
                <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated section panels
// ─────────────────────────────────────────────────────────────────────────────

/** Election Overview panel */
function PanelElectionOverview({ data }) {
    return (
        <div className="animate-fadeIn">
            <ContentHeading
                icon={LayoutDashboard}
                title="Election Overview"
                subtitle="On-chain election metadata and configuration"
                color="indigo"
            />
            <ElectionDetailsCard election={data.election} authorities={data.authorities} />
        </div>
    );
}

/** Authority Status panel */
function PanelAuthorityStatus({ data, role }) {
    const isAuthority = role === "authority" || role === "both";
    return (
        <div className="animate-fadeIn">
            <ContentHeading
                icon={Users}
                title="Authority Status"
                subtitle={`${data.authorities?.length ?? 0} participating authorities`}
                color="amber"
            />
            {/* If role is authority/both, show the user's own card first */}
            {isAuthority && data.authoritySection && (
                <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/60 mb-2">Your Status</p>
                    <AuthorityCard authority={data.authoritySection} />
                </div>
            )}

            {/* Full authority list */}
            {data.authorities?.length > 0 ? (
                <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                        All Authorities ({data.authorities.length})
                    </p>
                    <div className="flex flex-col gap-2.5">
                        {data.authorities.map(auth => (
                            <AuthorityCard
                                key={auth.authorityId || auth.id || auth.name}
                                authority={auth}
                            />
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-sm text-slate-500 py-6 text-center">No authority information available.</p>
            )}
        </div>
    );
}

/** Encrypted Votes panel */
function PanelEncryptedVotes({ data, electionId, showVoterVerify, onSearchNullifier, triggerNullifier }) {
    return (
        <div className="animate-fadeIn">
            <ContentHeading
                icon={Lock}
                title="Encrypted Votes"
                subtitle="On-chain vote commitments and nullifier lookup"
                color="emerald"
            />

            {/* ── Nullifier search – always at the top ── */}
            <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                    <SearchIcon size={11} /> Search by Nullifier
                </p>
                <SearchNullifier
                    electionId={electionId}
                    initialNullifier={triggerNullifier}
                    disableVerification={!showVoterVerify}
                />
            </div>



            {/* ── Latest votes grid (creator + authority) ── */}
            {!showVoterVerify && (
                <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                        Latest Encrypted Votes
                    </p>
                    {data.latestVotes?.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {data.latestVotes.slice(0, 2).map((v, i) => (
                                <VoteCard
                                    key={i}
                                    vote={v}
                                    index={i}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 py-4">No votes submitted yet.</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
    { id: "overview", label: "Election Overview", icon: LayoutDashboard },
    { id: "authority", label: "Authority Status", icon: Users },
    { id: "votes", label: "Encrypted Votes", icon: Lock },
];

export default function BlockExplorerPage() {
    const navigate = useNavigate();

    const [electionId, setElectionId] = useState("");
    const [showModal, setShowModal] = useState(true);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeSection, setActiveSection] = useState("overview");
    // nullifier string to auto-trigger in SearchNullifier
    const [triggerNullifier, setTriggerNullifier] = useState("");

    // Called from VoteCard "Search My Vote" button
    const handleSearchNullifier = useCallback((nullifier) => {
        setTriggerNullifier(""); // reset first so re-trigger works
        setTimeout(() => {
            setActiveSection("votes");
            setTriggerNullifier(nullifier);
        }, 0);
    }, []);

    const fetchData = async (id) => {
        setLoading(true);
        setError("");
        setData(null);
        setShowModal(false);
        setElectionId(id);
        setActiveSection("overview");
        try {
            const res = await axios.post(
                "/api/blockexplorer/view",
                { electionId: id },
                { withCredentials: true }
            );
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch blockchain data.");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setData(null);
        setError("");
        setElectionId("");
        setShowModal(true);
    };

    const role = data?.role ?? "";
    const showVoterVerify = role === "voter" || role === "both";
    const authBadge = data?.authorities?.length ?? null;
    const votesBadge = data?.latestVotes?.length ?? null;

    return (
        <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden font-sans">
            {/* BG glows */}
            <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
            <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/8 blur-[120px]" />

            {/* Election ID modal */}
            {showModal && <ElectionIdModal onSubmit={fetchData} />}


            <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 flex flex-col min-h-screen">
                {/* ── Header ── */}
                <header className="flex items-center gap-4 mb-8 flex-wrap">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest border border-white/[0.07] px-3 py-2 rounded-xl hover:border-white/20"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>

                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <Database size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-white">Chain Explorer</h1>
                            {electionId && (
                                <p className="font-mono text-[11px] text-slate-500">
                                    ID: {electionId}
                                    <button
                                        onClick={reset}
                                        className="ml-2 text-indigo-400 hover:text-indigo-300 text-[11px] underline"
                                    >
                                        change
                                    </button>
                                </p>
                            )}
                        </div>
                    </div>

                    {data?.role && <RoleBadge role={data.role} />}
                </header>

                {/* ── Loading ── */}
                {loading && (
                    <div className="flex flex-col items-center justify-center flex-1 gap-4 text-slate-500">
                        <Loader2 size={36} className="animate-spin text-indigo-400" />
                        <p className="text-sm font-medium">Querying blockchain…</p>
                    </div>
                )}

                {/* ── Error ── */}
                {error && !loading && (
                    <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-6 py-5 text-red-400 text-sm text-center max-w-lg mx-auto mt-16">
                        <p className="font-bold mb-1">Error</p>
                        <p>{error}</p>
                        <button
                            onClick={reset}
                            className="mt-4 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/25 transition"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* ── Sidebar + Content layout ── */}
                {data && !loading && (
                    <div className="flex flex-col md:flex-row gap-6 flex-1 items-start">

                        {/* ══ LEFT SIDEBAR ══ */}
                        <aside className="w-full md:w-56 flex-shrink-0 md:sticky md:top-8 z-20">
                            {/* Sidebar header */}
                            <div className="mb-4 px-1">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mb-1">Navigation</p>
                                <div className="h-px bg-white/[0.05]" />
                            </div>

                            <nav className="flex flex-row overflow-x-auto md:flex-col gap-2 md:gap-1 pb-2 md:pb-0 scrollbar-hide">
                                {NAV_ITEMS.map(item => (
                                    <NavItem
                                        key={item.id}
                                        icon={item.icon}
                                        label={item.label}
                                        active={activeSection === item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        badge={
                                            item.id === "authority" ? authBadge :
                                                item.id === "votes" ? votesBadge :
                                                    null
                                        }
                                    />
                                ))}
                            </nav>

                            {/* Sidebar footer – election meta */}
                            <div className="mt-6 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">Election</p>
                                <p className="text-xs text-slate-300 font-semibold truncate">{data.election?.electionName || "—"}</p>
                                <p className="font-mono text-[10px] text-slate-600 mt-1 truncate">#{data.election?.electionId || electionId}</p>
                                {data.role && (
                                    <div className="mt-2">
                                        <RoleBadge role={data.role} />
                                    </div>
                                )}
                            </div>
                        </aside>

                        {/* ══ RIGHT CONTENT ══ */}
                        <main className="flex-1 min-w-0">
                            {activeSection === "overview" && (
                                <PanelElectionOverview data={data} />
                            )}
                            {activeSection === "authority" && (
                                <PanelAuthorityStatus data={data} role={role} />
                            )}
                            {activeSection === "votes" && (
                                <PanelEncryptedVotes
                                    data={data}
                                    electionId={electionId}
                                    showVoterVerify={showVoterVerify}
                                    onSearchNullifier={handleSearchNullifier}
                                    triggerNullifier={triggerNullifier}
                                />
                            )}
                        </main>
                    </div>
                )}
            </div>

            {/* Fade-in animation */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.25s ease-out both;
                }
            `}</style>
        </div>
    );
}
