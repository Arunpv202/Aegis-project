import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, ShieldCheck, Globe, Lock, Cpu } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  const selectRole = (role) => {
    localStorage.setItem("role", role); // Keep role preference
    navigate("/login", { state: { role } });
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-950 text-white font-sans">
      {/* Animated Background Elements */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 max-w-6xl w-full px-6 py-12">
        {/* Header Section */}
        <header className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center gap-4 mb-6"
          >
            <span className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-gray-400">
              <Lock size={12} /> Encrypted
            </span>
            <span className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-gray-400">
              <Globe size={12} /> Decentralized
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-5xl md:text-7xl font-black mb-6 tracking-tight tracking-tighter"
          >
            Blockchain <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Secure Voting</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
          >
            Empowering democracy through cryptographic proof. Choose your role to begin
            interacting with the immutable ledger.
          </motion.p>
        </header>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

          {/* USER CARD */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectRole("user")}
            className="group cursor-pointer p-1 rounded-3xl bg-gradient-to-b from-white/10 to-transparent hover:from-indigo-500/40 transition-all duration-500"
          >
            <div className="bg-slate-900/90 backdrop-blur-xl p-8 rounded-[calc(1.5rem-1px)] h-full flex flex-col items-center text-center">
              <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                <User size={40} />
              </div>
              <h2 className="text-3xl font-bold mb-3">Voter</h2>
              <p className="text-gray-400 mb-8">
                Cast your vote securely. Your identity is protected by ZK-proofs while
                your vote remains immutable on the chain.
              </p>

              {/* ORIGINAL BUTTON RETAINED */}
              <button className="w-full mt-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-500/20 transition-all">
                Login as Voter
              </button>
            </div>
          </motion.div>

          {/* ADMIN CARD */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectRole("admin")}
            className="group cursor-pointer p-1 rounded-3xl bg-gradient-to-b from-white/10 to-transparent hover:from-emerald-500/40 transition-all duration-500"
          >
            <div className="bg-slate-900/90 backdrop-blur-xl p-8 rounded-[calc(1.5rem-1px)] h-full flex flex-col items-center text-center">
              <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                <ShieldCheck size={40} />
              </div>
              <h2 className="text-3xl font-bold mb-3">Admin</h2>
              <p className="text-gray-400 mb-8">
                Manage election parameters, authorize eligible voters, and oversee
                the real-time tallying process.
              </p>

              {/* ORIGINAL BUTTON RETAINED */}
              <button className="w-full mt-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-500/20 transition-all">
                Login as Admin
              </button>
            </div>
          </motion.div>

        </div>

        {/* Technical Footer */}
        <div className="mt-20 flex flex-col items-center gap-4 text-gray-500">
          <div className="flex items-center gap-2 text-sm uppercase tracking-widest">
            <Cpu size={16} /> System Status: <span className="text-emerald-500">Operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}