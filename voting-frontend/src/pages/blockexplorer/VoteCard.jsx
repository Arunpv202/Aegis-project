// VoteCard.jsx – displays one encrypted vote record
// Clicking "Search My Vote" scrolls to the nullifier search and triggers it.
import React, { useState } from "react";
import { Copy, Check, Clock, Layers, Zap, Search } from "lucide-react";

function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text || "").then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };
    return (
        <button
            onClick={copy}
            className="ml-2 text-slate-500 hover:text-emerald-400 transition-colors flex-shrink-0"
            title="Copy"
        >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
    );
}

function HashRow({ label, value, color = "text-emerald-400" }) {
    const display = value ? (value.length > 40 ? value.slice(0, 20) + "…" + value.slice(-8) : value) : "—";
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            <div className="flex items-center gap-1 bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5">
                <code className={`font-mono text-xs flex-1 break-all ${color}`}>{display || "—"}</code>
                {value && <CopyBtn text={value} />}
            </div>
        </div>
    );
}

/**
 * VoteCard
 *
 * Props:
 *  vote         – vote object from blockchain
 *  index        – display index (0-based)
 *  onSearchNullifier – optional callback(nullifier) to trigger the search panel
 */
export default function VoteCard({ vote, index = 0, onSearchNullifier }) {
    if (!vote) return null;

    const { nullifier, txHash, blockNumber, gasUsed, timestamp, encryptedVoteHash } = vote;

    const formattedTime = timestamp
        ? new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(timestamp))
        : "—";

    return (
        <div className="group bg-black/30 border border-white/[0.07] rounded-2xl p-4 hover:border-emerald-500/25 hover:shadow-[0_0_20px_rgba(52,211,153,0.06)] transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Vote #{index + 1}
                </span>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Meta info */}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                        {blockNumber && (
                            <span className="flex items-center gap-1">
                                <Layers size={11} /> #{blockNumber}
                            </span>
                        )}
                        {gasUsed && (
                            <span className="flex items-center gap-1">
                                <Zap size={11} /> {gasUsed.toLocaleString()} gas
                            </span>
                        )}
                        {timestamp && (
                            <span className="flex items-center gap-1">
                                <Clock size={11} /> {formattedTime}
                            </span>
                        )}
                    </div>

                    {/* Search My Vote button – only shown if a handler is wired */}
                    {onSearchNullifier && nullifier && (
                        <button
                            onClick={() => onSearchNullifier(nullifier)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-[11px] font-bold hover:bg-indigo-500/25 transition-all"
                            title="Search and verify this vote on-chain"
                        >
                            <Search size={11} /> Search My Vote
                        </button>
                    )}
                </div>
            </div>

            {/* Hash rows */}
            <div className="flex flex-col gap-2">
                <HashRow label="Nullifier" value={nullifier} color="text-violet-400" />
                <HashRow label="Tx Hash" value={txHash} color="text-sky-400" />
                <HashRow label="Encrypted Vote Hash" value={encryptedVoteHash} color="text-emerald-400" />
            </div>
        </div>
    );
}
