import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, Calendar, CheckCircle2, BarChart3,
  PlayCircle, Timer, Fingerprint, AlertCircle
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";

export default function ViewElections() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ongoing");
  const { username, role } = useAuthStore();
  const [elections, setElections] = useState({ ongoing: [], upcoming: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Protect Route
  useEffect(() => {
    if (!username || role !== "admin") {
      navigate("/login");
    }
  }, [username, role, navigate]);

  useEffect(() => {
    const fetchElections = async () => {
      if (!username) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/elections/my-elections`, {
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Server error: ${res.status}`);
        }

        const data = await res.json();
        const now = new Date();

        const ongoing = [];
        const upcoming = [];
        const completed = [];

        data.forEach((e) => {
          const startMs = e.start_time ? new Date(e.start_time).getTime() : 0;
          const endMs = e.end_time ? new Date(e.end_time).getTime() : 0;

          const start = new Date(startMs);
          const end = new Date(endMs);

          const uiElection = {
            id: e.election_id,
            name: e.election_name,
            creator: e.creator_name,
            id_ref: e.election_id,
            start_time: start,
            end_time: end,
            dateInfo: "",
            my_authority_id: e.my_authority_id ?? null,
          };

          // Guard: if times are epoch 0 (not yet set up on chain), treat as upcoming
          const notSetup = startMs === 0 || endMs === 0;

          if (notSetup || start > now) {
            // Upcoming: election hasn't started yet (or not configured)
            uiElection.dateInfo = notSetup
              ? "Not yet configured"
              : `Starts: ${start.toLocaleString()}`;
            upcoming.push(uiElection);
          } else if (start <= now && end > now) {
            // Ongoing: started but not finished
            uiElection.dateInfo = `Ends: ${end.toLocaleString()}`;
            ongoing.push(uiElection);
          } else {
            // Completed: end time has passed
            uiElection.dateInfo = `Ended: ${end.toLocaleDateString()}`;
            completed.push(uiElection);
          }
        });

        setElections({ ongoing, upcoming, completed });
      } catch (err) {
        console.error("Failed to fetch elections", err);
        setError(err.message || "Failed to load elections.");
      } finally {
        setLoading(false);
      }
    };

    fetchElections();
  }, [username]);

  const tabCounts = {
    ongoing: elections.ongoing.length,
    upcoming: elections.upcoming.length,
    completed: elections.completed.length,
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-12">
          <button
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Panel</span>
          </button>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-white">
              Election Registry
            </h1>
            <p className="text-gray-400">Manage and monitor blockchain-secured voting sessions.</p>
          </div>
        </header>

        {/* Tab Bar */}
        <div className="flex justify-center mb-10">
          <div className="flex gap-2 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/5 w-full max-w-xl shadow-2xl">
            <TabButton
              active={activeTab === "ongoing"}
              onClick={() => setActiveTab("ongoing")}
              icon={<PlayCircle size={16} />}
              label="Ongoing"
              count={tabCounts.ongoing}
              color="emerald"
            />
            <TabButton
              active={activeTab === "upcoming"}
              onClick={() => setActiveTab("upcoming")}
              icon={<Timer size={16} />}
              label="Upcoming"
              count={tabCounts.upcoming}
              color="indigo"
            />
            <TabButton
              active={activeTab === "completed"}
              onClick={() => setActiveTab("completed")}
              icon={<CheckCircle2 size={16} />}
              label="Completed"
              count={tabCounts.completed}
              color="gray"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-red-400 py-20">
            <AlertCircle size={36} />
            <p className="text-sm">{error}</p>
          </div>
        ) : elections[activeTab].length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {elections[activeTab].map((election) => (
                <ElectionCard key={election.id} election={election} type={activeTab} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Button ────────────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon, label, count, color }) {
  const colorMap = {
    emerald: "bg-emerald-600 shadow-emerald-600/40",
    indigo: "bg-indigo-600 shadow-indigo-600/40",
    gray: "bg-slate-600 shadow-slate-600/40",
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${active
        ? `${colorMap[color]} text-white shadow-xl scale-[1.02]`
        : "text-gray-500 hover:text-gray-300"
        }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${active ? "bg-white/20 text-white" : "bg-white/5 text-gray-500"
            }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ tab }) {
  const messages = {
    ongoing: { icon: <PlayCircle size={40} className="text-emerald-500/40" />, text: "No ongoing elections right now." },
    upcoming: { icon: <Timer size={40} className="text-indigo-500/40" />, text: "No upcoming elections scheduled." },
    completed: { icon: <CheckCircle2 size={40} className="text-gray-600" />, text: "No completed elections yet." },
  };
  const { icon, text } = messages[tab];
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-gray-600">
      {icon}
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

// ─── Election Card ─────────────────────────────────────────────────────────────
function ElectionCard({ election, type }) {
  const navigate = useNavigate();
  const isOngoing = type === "ongoing";
  const isUpcoming = type === "upcoming";
  const isCompleted = type === "completed";

  const iconBg = isOngoing
    ? "bg-emerald-500/10 text-emerald-400"
    : isUpcoming
      ? "bg-indigo-500/10 text-indigo-400"
      : "bg-gray-500/10 text-gray-400";

  const badgeStyle = isOngoing
    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
    : isUpcoming
      ? "border-indigo-500/30 text-indigo-400 bg-indigo-500/5"
      : "border-gray-500/30 text-gray-500 bg-gray-500/5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -8 }}
      className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-7 rounded-[2.5rem] flex flex-col justify-between shadow-xl hover:border-indigo-500/30 transition-all group"
    >
      <div>
        {/* Header row */}
        <div className="flex justify-between items-start mb-6">
          <div className={`p-3 rounded-2xl ${iconBg}`}>
            <BarChart3 size={24} />
          </div>
          <div className="flex flex-col items-end">
            <span className={`text-[10px] font-black tracking-[0.2em] px-3 py-1 rounded-full border mb-2 ${badgeStyle}`}>
              {type.toUpperCase()}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-gray-600 font-mono">
              <Fingerprint size={12} /> {election.id_ref}
            </div>
          </div>
        </div>

        {/* Name & Creator */}
        <h3 className="text-2xl font-bold mb-1 group-hover:text-indigo-400 transition-colors text-white">
          {election.name}
        </h3>
        <p className="text-gray-500 text-sm mb-8 font-medium">Created by: {election.creator}</p>

        {/* Date info */}
        <div className="flex items-center gap-3 text-sm text-gray-400 bg-white/5 p-3 rounded-xl border border-white/5 mb-8">
          {isOngoing ? (
            <Clock size={16} className="text-emerald-400 animate-pulse" />
          ) : (
            <Calendar size={16} />
          )}
          <span className="font-medium">{election.dateInfo}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Secondary action per status */}
        {isCompleted && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (election.my_authority_id) {
                  navigate(`/authority/dkg/dashboard/${election.id}`, {
                    state: { authorityId: election.my_authority_id },
                  });
                } else {
                  alert("You are not an authority for this election.");
                }
              }}
              className={`py-3 text-xs font-bold rounded-xl transition-all shadow-lg ${election.my_authority_id
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
            >
              Calculate
            </button>
            <button
              onClick={() => navigate(`/results/${election.id}`)}
              className="py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-all"
            >
              View Result
            </button>
          </div>
        )}


      </div>
    </motion.div>
  );
}