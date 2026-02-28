// MatchHashModal.jsx – voter compares their local hash against blockchain
import React, { useState } from "react";
import { X, ShieldCheck, AlertTriangle, ClipboardPaste } from "lucide-react";

export default function MatchHashModal({ blockchainHash, onClose }) {
    const [localHash, setLocalHash] = useState("");
    const [result, setResult] = useState(null); // "match" | "mismatch" | null

    const handleCompare = () => {
        if (!localHash.trim()) return;
        const normalise = (h) => h.trim().toLowerCase().replace(/^0x/, "");
        const match = normalise(localHash) === normalise(blockchainHash || "");
        setResult(match ? "match" : "mismatch");
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setLocalHash(text.trim());
            setResult(null);
        } catch { }
    };

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-white">Match Your Vote Hash</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                    Paste the encrypted vote hash you stored locally to verify it matches the blockchain record.
                </p>

                {/* Blockchain Hash display */}
                {blockchainHash && (
                    <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                            Blockchain Hash
                        </p>
                        <div className="bg-black/40 border border-white/[0.07] rounded-xl px-3 py-2">
                            <code className="font-mono text-xs text-emerald-400 break-all">{blockchainHash}</code>
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className="mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                        Your Local Hash
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={localHash}
                            onChange={e => { setLocalHash(e.target.value); setResult(null); }}
                            placeholder="Paste your hash here…"
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                        <button
                            onClick={handlePaste}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-700/50 border border-white/10 text-slate-400 hover:text-white text-xs transition-colors"
                            title="Paste from clipboard"
                        >
                            <ClipboardPaste size={14} />
                        </button>
                    </div>
                </div>

                {/* Result */}
                {result === "match" && (
                    <div className="flex items-center gap-2 bg-emerald-500/12 border border-emerald-500/25 rounded-xl px-4 py-3 text-emerald-400 text-sm font-bold mb-4">
                        <ShieldCheck size={18} />
                        ✓ Hash matches — your vote was NOT tampered with!
                    </div>
                )}
                {result === "mismatch" && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm font-bold mb-4">
                        <AlertTriangle size={18} />
                        ✗ Hash mismatch — vote may have been tampered!
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-sm hover:text-white transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleCompare}
                        disabled={!localHash.trim()}
                        className="px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-sm font-bold hover:bg-indigo-500/35 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Compare
                    </button>
                </div>
            </div>
        </div>
    );
}
