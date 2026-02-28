// AuthorityCard.jsx – one authority row with status badges
import React from "react";
import { CheckCircle, XCircle, Shield } from "lucide-react";

function Badge({ done, label }) {
    return done ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <CheckCircle size={10} /> {label}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-700/40 text-slate-500 border border-white/5">
            <XCircle size={10} /> {label}
        </span>
    );
}

export default function AuthorityCard({ authority }) {
    if (!authority) return null;

    const {
        authorityId,
        authorityName,
        round1Done,
        round2Done,
        decryptionDone,
        partialDecryptionHash,
    } = authority;

    return (
        <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-black/20 border border-white/[0.06] hover:bg-black/35 transition-colors">
            {/* Left: icon + name */}
            <div className="flex items-center gap-2.5 min-w-[140px] flex-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield size={15} className="text-amber-400" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-200 leading-tight">{authorityName}</p>
                    <p className="text-[10px] font-mono text-slate-500">Auth #{authorityId}</p>
                </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5">
                <Badge done={round1Done} label="R1" />
                <Badge done={round2Done} label="R2" />
                <Badge done={decryptionDone} label="Decrypted" />
            </div>

            {/* Partial decryption hash */}
            {partialDecryptionHash && partialDecryptionHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                <div className="w-full mt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                        Partial Decryption Hash
                    </p>
                    <div className="flex items-center gap-1 bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5">
                        <code className="font-mono text-[11px] text-amber-400 flex-1 break-all">
                            {partialDecryptionHash}
                        </code>
                    </div>
                </div>
            )}
        </div>
    );
}
