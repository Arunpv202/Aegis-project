// ElectionDetailsCard.jsx – full election info for the creator view
import React, { useState } from "react";
import { Copy, Check, ShieldCheck, Calendar, Users, Key, Activity, ChevronDown, ChevronUp } from "lucide-react";

function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text || "").then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <button onClick={copy} className="ml-1.5 text-slate-500 hover:text-emerald-400 transition-colors flex-shrink-0" title="Copy">
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
    );
}

function KV({ label, value, mono = false, color = "text-slate-300" }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            <span className={`text-sm ${color} ${mono ? "font-mono" : ""} break-all`}>{value || "—"}</span>
        </div>
    );
}

function HashRow({ label, value, color = "text-emerald-400" }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            <div className="flex items-center gap-1 bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5">
                <code className={`font-mono text-xs flex-1 break-all ${color}`}>{value || "—"}</code>
                {value && <CopyBtn text={value} />}
            </div>
        </div>
    );
}

function StatusPill({ active, labelOn, labelOff }) {
    return active ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {labelOn}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-700/40 text-slate-500 border border-white/5">
            {labelOff}
        </span>
    );
}

export default function ElectionDetailsCard({ election, authorities = [] }) {
    const [showTally, setShowTally] = useState(false);

    if (!election) return null;

    const {
        electionId, electionName, creatorName,
        registrationMerkleRoot, round1Active, round2Active, completed,
        startTime, endTime, numAuthorities, threshold,
        voteCount, encryptedTallyTxHash, encryptedTallyData, electionPublicKey, candidates = [],
    } = election;

    const fmt = (iso) => iso
        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
        : "—";

    return (
        <div className="bg-slate-900/60 border border-white/[0.08] backdrop-blur rounded-2xl p-5 mb-4">
            {/* Title row */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck size={16} className="text-indigo-400" />
                        <h2 className="text-base font-bold text-white tracking-tight">{electionName}</h2>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500">ID: {electionId}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <StatusPill active={round1Active} labelOn="R1 Active" labelOff="R1 Inactive" />
                    <StatusPill active={round2Active} labelOn="R2 Active" labelOff="R2 Inactive" />
                    <StatusPill active={completed} labelOn="Completed" labelOff="In Progress" />
                </div>
            </div>

            {/* Key-value grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 mb-4">
                <KV label="Creator" value={creatorName} />
                <KV label="Start Time" value={fmt(startTime)} />
                <KV label="End Time" value={fmt(endTime)} />
                <KV label="Authorities" value={numAuthorities ?? authorities.length} />
                <KV label="Threshold" value={threshold} />
                <KV label="Total Votes" value={voteCount ?? "—"} color="text-indigo-300" />
            </div>

            {/* Hashes */}
            <div className="flex flex-col gap-2 mb-4">
                <HashRow label="Registration Merkle Root" value={registrationMerkleRoot} color="text-violet-400" />
                {electionPublicKey && (
                    <HashRow label="Election Public Key (Joint Key)" value={electionPublicKey} color="text-sky-400" />
                )}
            </div>

            {/* Encrypted Tally Button & Expandable Content */}
            {encryptedTallyTxHash && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-0.5 flex items-center gap-1.5">
                                <Activity size={12} className="animate-pulse" /> Tally Published
                            </p>
                            <p className="text-xs text-amber-400/80">The encrypted tally sum for all candidates is on-chain.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowTally(!showTally)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold transition-all"
                            >
                                {showTally ? "Hide Tally Content" : "View Tally Content"}
                                {showTally ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                        </div>
                    </div>

                    {showTally && encryptedTallyData && encryptedTallyData.c1 && (
                        <div className="mt-2 flex flex-col gap-2 animate-fadeIn transition-all">
                            <div className="h-px bg-amber-500/20 mb-1" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70 mb-1">
                                Homomorphic Encryption Sum (C1 / C2)
                            </p>

                            {candidates.map((c, i) => (
                                <div key={i} className="mb-2 bg-black/40 border border-amber-500/10 rounded-xl overflow-hidden text-xs">
                                    <div className="px-3 py-2 bg-amber-500/5 font-bold text-amber-500 border-b border-amber-500/10 flex items-center gap-2">
                                        Candidate: <span className="text-white">{c.name}</span>
                                    </div>
                                    <div className="p-3 flex flex-col gap-2 font-mono break-all text-[10px]">
                                        <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                                            <span className="text-amber-500/60 font-bold uppercase sm:w-8 shrink-0">C1:</span>
                                            <span className="text-slate-300">
                                                {encryptedTallyData.c1[i] ? (encryptedTallyData.c1[i].startsWith('0x') ? encryptedTallyData.c1[i] : `0x${encryptedTallyData.c1[i]}`) : "—"}
                                            </span>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                                            <span className="text-amber-500/60 font-bold uppercase sm:w-8 shrink-0">C2:</span>
                                            <span className="text-slate-300">
                                                {encryptedTallyData.c2[i] ? (encryptedTallyData.c2[i].startsWith('0x') ? encryptedTallyData.c2[i] : `0x${encryptedTallyData.c2[i]}`) : "—"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Divider */}
            <div className="h-px bg-white/[0.05] mb-4" />

            {/* Candidates */}
            {candidates.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                        Candidates
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {candidates.map((c, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-sm text-slate-200 hover:bg-indigo-500/18 transition-colors"
                            >
                                {c.name}
                                {c.symbol && c.symbol !== "N/A" && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-400">
                                        {c.symbol}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
