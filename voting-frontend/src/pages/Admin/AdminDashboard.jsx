import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PlusCircle,
  BarChart3,
  ShieldCheck,
  Database,
  ArrowRight,
  Fingerprint,
  Key
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { username } = useAuthStore();
  const displayUser = username || localStorage.getItem("username") || "Admin";

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">

      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Status Bar */}
      <div className="absolute top-8 w-full max-w-5xl px-6 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <span className="font-bold tracking-tighter text-xl uppercase">Governance</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md">
            <Database size={14} className="text-indigo-400" />
            <span className="text-[10px] font-mono text-gray-400">{displayUser}</span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl w-full relative z-10">
        {/* Header Section */}
        <header className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6"
          >
            <Fingerprint size={12} /> Authority Protocol Active
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
            Admin Control
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Manage the lifecycle of decentralized elections. Deploy smart contracts and verify participation on the blockchain.
          </p>
        </header>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <DashboardCard
            title="Create Election"
            desc="Initialize a new ballot, register candidate data, and deploy the voting contract."
            icon={<PlusCircle size={36} />}
            color="indigo"
            onClick={() => navigate("/admin/create-election")}
          />

          <DashboardCard
            title="View Elections"
            desc="Review active polls, monitor live turnout, and finalize results on-chain."
            icon={<BarChart3 size={36} />}
            color="emerald"
            onClick={() => navigate("/admin/view-elections")}
          />

          <DashboardCard
            title="DKG Access"
            desc="Enter the DKG Secure Portal to participate in key generation."
            icon={<ShieldCheck size={36} />}
            color="red"
            onClick={() => navigate("/authority/enter")}
          />

          <DashboardCard
            title="View Blockchain"
            desc="Inspect on-chain election data, authority statuses, and encrypted votes as the creator."
            icon={<Key size={36} />}
            color="emerald"
            onClick={() => navigate("/blockexplorer")}
          />
        </div>

        {/* Technical Micro-copy */}
        <footer className="mt-20 text-center">
          <p className="text-[10px] text-gray-600 uppercase font-bold tracking-[0.5em]">
            System Status: Secured • Block Time: 0.04s
          </p>
        </footer>
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, icon, onClick, color }) {
  const isIndigo = color === "indigo";

  return (
    <motion.div
      whileHover={{ y: -10, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group cursor-pointer relative p-1 rounded-[2.5rem] bg-gradient-to-b from-white/10 to-transparent hover:from-white/20 transition-all duration-500 shadow-2xl"
    >
      <div className="bg-slate-900/90 backdrop-blur-xl p-10 rounded-[2.4rem] h-full flex flex-col items-center text-center">
        <div className={`mb-8 p-5 rounded-2xl transition-all duration-300 ${isIndigo
          ? "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white"
          : "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white"
          }`}>
          {icon}
        </div>

        <h2 className="text-3xl font-bold mb-4 group-hover:text-white transition-colors">{title}</h2>
        <p className="text-gray-400 leading-relaxed text-sm mb-10">{desc}</p>

        <div className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] transition-all ${isIndigo ? "text-indigo-400 group-hover:text-indigo-300" : "text-emerald-400 group-hover:text-emerald-300"
          }`}>
          <span>Launch Module</span>
          <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
}