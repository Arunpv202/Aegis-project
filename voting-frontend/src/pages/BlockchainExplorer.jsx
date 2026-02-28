// src/pages/BlockchainExplorer.jsx
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Database, Hash, Box, Cpu, Clock, 
  ShieldCheck, Activity, Globe 
} from "lucide-react";

export default function BlockchainExplorer() {
  const navigate = useNavigate();
  const { electionId } = useParams();

  const transactions = [
    { hash: "0x7d2a...4f1e", block: "14205", method: "RegisterCandidate", gas: "45,000", time: "2 min ago" },
    { hash: "0x3e9b...11c4", block: "14202", method: "AuthorizeVoter", gas: "21,000", time: "15 min ago" },
    { hash: "0x9a1f...cc82", block: "14199", method: "CastVote", gas: "65,200", time: "42 min ago" },
  ];

  return (
    <div className="min-h-screen bg-[#05070a] text-white p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-emerald-500/5 rounded-full blur-[120px]" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
          >
            <ArrowLeft size={16} /> Back
          </button>
          
          <div className="flex items-center gap-4">
             <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <Database size={24} />
             </div>
             <div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Chain Explorer</h1>
                <p className="text-gray-500 font-mono text-xs">ID: {electionId || "LIVE_FEED"}</p>
             </div>
          </div>
        </header>

        {/* Transaction Table */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-gray-500 text-[10px] uppercase tracking-widest bg-white/[0.02]">
                <th className="px-6 py-4">Tx Hash</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Block</th>
                <th className="px-6 py-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((tx, i) => (
                <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-5 font-mono text-xs text-emerald-400">{tx.hash}</td>
                  <td className="px-6 py-5">
                    <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">
                      {tx.method}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-400 font-mono">{tx.block}</td>
                  <td className="px-6 py-5 text-sm text-gray-500 text-right">{tx.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}