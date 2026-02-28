/**
 * SearchNullifier.jsx
 *
 * - Search for a vote by nullifier
 * - After result appears, automatically load the locally-stored vote hash
 *   from IndexedDB (saved at vote time) and compare it with the blockchain hash.
 * - Show a prominent "Vote NOT Tampered" / "Hash Mismatch" banner.
 */
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Search, Loader2, ShieldCheck, AlertTriangle, ShieldOff } from "lucide-react";
import VoteCard from "./VoteCard";
import { getVoteHash } from "../../utils/voteHashStorage";

function normalise(h) {
    return (h || "").trim().toLowerCase().replace(/^0x/, "");
}

export default function SearchNullifier({ electionId, initialNullifier, disableVerification = false }) {

    const [nullifier, setNullifier] = useState("");
    const [result, setResult] = useState(null);   // blockchain vote
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Hash-match state
    const [localRecord, setLocalRecord] = useState(null); // IndexedDB record
    const [matchStatus, setMatchStatus] = useState(null); // "match" | "mismatch" | "no-local"

    // Auto-trigger when a nullifier is passed in from a VoteCard click
    useEffect(() => {
        if (initialNullifier && initialNullifier.trim()) {
            doSearch(initialNullifier.trim());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialNullifier]);

    // Whenever a result arrives, try to load the local hash from IndexedDB
    useEffect(() => {
        if (disableVerification) return;
        if (!result) { setMatchStatus(null); setLocalRecord(null); return; }

        (async () => {
            const record = await getVoteHash(electionId).catch(() => null);
            setLocalRecord(record);

            if (!record) {
                setMatchStatus("no-local");
                return;
            }
            // Compare local hash against blockchain encryptedVoteHash
            const match = normalise(record.voteHash) === normalise(result.encryptedVoteHash);
            setMatchStatus(match ? "match" : "mismatch");
        })();
    }, [result, electionId, disableVerification]);

    const doSearch = async (overrideNullifier) => {
        const target = (overrideNullifier ?? nullifier).trim();
        if (!target) return;
        setLoading(true);
        setError("");
        setResult(null);
        setMatchStatus(null);
        setLocalRecord(null);
        try {
            const { data } = await axios.post(
                "/api/blockexplorer/search",
                { electionId, nullifier: target },
                { withCredentials: true }
            );
            setResult(data.vote);
            if (overrideNullifier) setNullifier(overrideNullifier);
        } catch (err) {
            setError(err.response?.data?.message || "Vote not found for this nullifier.");
        } finally {
            setLoading(false);
        }
    };

    const doAutoSearch = async () => {
        setLoading(true);
        setError("");
        setResult(null);
        setMatchStatus(null);
        setLocalRecord(null);

        try {
            const record = await getVoteHash(electionId);
            if (!record || !record.nullifier) {
                setError("No local vote receipt found for this election on this device. Automatic hash comparison is only available on the device that cast the vote.");
                setLoading(false);
                return;
            }
            // Use the nullifier from the local DB
            await doSearch(record.nullifier);
        } catch (err) {
            setError("Error accessing local storage. Could not retrieve vote receipt.");
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-900/60 border border-white/[0.08] backdrop-blur rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                {disableVerification ? "Search by Nullifier" : "Verify Your Vote"}
            </p>

            {!disableVerification ? (
                <div className="flex flex-col gap-3 mb-4">
                    <button
                        onClick={doAutoSearch}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-indigo-600 border border-indigo-500 text-white text-sm font-bold hover:bg-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                        {loading ? "Searching Blockchain…" : "Search My Vote"}
                    </button>
                    <p className="text-xs text-slate-400 text-center px-4">
                        This securely retrieves your local vote receipt to verify that your encrypted vote on the blockchain hasn't been tampered with.
                    </p>
                </div>
            ) : (
                <div className="flex gap-2 mb-3 flex-wrap">
                    <input
                        type="text"
                        value={nullifier}
                        onChange={e => setNullifier(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && doSearch()}
                        placeholder="Paste nullifier hash…"
                        className="flex-1 min-w-[200px] bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                    <button
                        onClick={() => doSearch()}
                        disabled={loading || !nullifier.trim()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-bold hover:bg-indigo-500/35 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        {loading ? "Searching…" : "Search"}
                    </button>
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm mb-3">
                    {error}
                </div>
            )}

            {result && (
                <div className="mt-2 flex flex-col gap-3">
                    {/* Vote card */}
                    <VoteCard vote={result} index={0} />

                    {/* ── Hash match banner ── */}
                    {(!disableVerification && matchStatus === "match") && (
                        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                            <ShieldCheck size={20} className="text-emerald-400 flex-shrink-0" />
                            <div>
                                <p className="text-emerald-400 text-sm font-bold">Vote NOT Tampered ✓</p>
                                <p className="text-emerald-400/60 text-xs mt-0.5">
                                    Your locally-stored hash matches the blockchain record exactly.
                                </p>
                            </div>
                        </div>
                    )}

                    {(!disableVerification && matchStatus === "mismatch") && (
                        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                            <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                            <div>
                                <p className="text-red-400 text-sm font-bold">Hash Mismatch — Vote May Be Tampered!</p>
                                <p className="text-red-400/60 text-xs mt-0.5">
                                    Your local hash does not match the value stored on the blockchain.
                                </p>
                            </div>
                        </div>
                    )}

                    {(!disableVerification && matchStatus === "no-local") && (
                        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                            <ShieldOff size={18} className="text-amber-400 flex-shrink-0" />
                            <p className="text-amber-400 text-xs">
                                No local vote receipt found for this election on this device.
                                Automatic hash comparison is only available on the device that cast the vote.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Expose the search trigger so VoteCard can call it externally
SearchNullifier.displayName = "SearchNullifier";
