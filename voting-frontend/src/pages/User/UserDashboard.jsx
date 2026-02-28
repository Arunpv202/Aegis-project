import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  UserCircle,
  Key,
  Vote,
  LogOut,
  ArrowRight,
  ShieldCheck,
  Globe
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";

export default function UserDashboard() {
  const navigate = useNavigate();
  const { username } = useAuthStore();
  const displayUser = username || localStorage.getItem("username") || "Voter";

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

      {/* Top Navigation Bar */}
      <nav className="relative z-10 border-b border-white/5 bg-slate-900/20 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Vote size={20} className="text-white" />
          </div>
          <span className="font-bold tracking-tight text-xl">Voter Portal</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono text-gray-400">{displayUser}</span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
            <ShieldCheck size={14} /> Secured by Ethereum
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Welcome, Voter</h1>
          <p className="text-gray-400 max-w-lg mx-auto leading-relaxed">
            Access your registered elections or join a new one using your secure access token.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          <DashboardCard
            title="Register Election"
            desc="Enter your unique Election ID and secure token to authorize your participation on-chain."
            icon={<Key size={32} />}
            onClick={() => navigate("/user/register-election")}
            color="indigo"
          />
          <DashboardCard
            title="My Elections"
            desc="View your current status in ongoing, upcoming, and closed elections you have joined."
            icon={<Globe size={32} />}
            onClick={() => navigate("/user/existing-elections")}
            color="emerald"
          />
          <DashboardCard
            title="DKG Access"
            desc="Participate in the Distributed Key Generation process."
            icon={<ShieldCheck size={32} />}
            onClick={() => navigate("/authority/enter")}
            color="red"
          />
          <DashboardCard
            title="View Blockchain"
            desc="Verify your encrypted vote on-chain. Check election data and authority activity."
            icon={<Globe size={32} />}
            onClick={() => navigate("/blockexplorer")}
            color="indigo"
          />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 p-8 text-center border-t border-white/5">
        <div className="flex justify-center gap-6 text-[10px] uppercase tracking-[0.2em] font-bold text-gray-600">
          <span>Encrypted Identity</span>
          <span>•</span>
          <span>Zero-Knowledge Voting</span>
          <span>•</span>
          <span>Immutable Ledger</span>
        </div>
      </footer>
    </div>
  );
}

function DashboardCard({ title, desc, icon, onClick, color }) {
  const isIndigo = color === "indigo";

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group cursor-pointer relative p-1 rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent hover:from-white/20 transition-all duration-500 shadow-2xl"
    >
      <div className="bg-[#0f172a]/90 backdrop-blur-xl p-8 rounded-[1.9rem] h-full flex flex-col items-start text-left">
        <div className={`mb-6 p-4 rounded-2xl transition-all duration-300 ${isIndigo
          ? "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]"
          : "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
          }`}>
          {icon}
        </div>

        <h2 className="text-2xl font-bold mb-3 group-hover:text-white transition-colors">{title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-8 flex-1">{desc}</p>

        <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest transition-all ${isIndigo ? "text-indigo-400 group-hover:text-indigo-300" : "text-emerald-400 group-hover:text-emerald-300"
          }`}>
          <span>Access Portal</span>
          <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}