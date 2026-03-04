import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Settings,
  User,
  Image as ImageIcon,
  Flag,
  AlignLeft,
  Calendar,
  CheckCircle,
  Plus,
  Trash2
} from "lucide-react";
import useAuthStore from "../../store/useAuthStore";

export default function ElectionSetup() {
  const navigate = useNavigate();
  const [electionId, setElectionId] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [newCandidate, setNewCandidate] = useState({ candidate_name: "", symbol_name: "" });
  const [timings, setTimings] = useState({ start_time: "", end_time: "", result_time: "" });
  const [authorities, setAuthorities] = useState([]);
  const [newAuthority, setNewAuthority] = useState({ name: "", username: "" });
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  useEffect(() => {
    const savedId = localStorage.getItem("current_election_id");
    if (savedId) setElectionId(savedId);
  }, []);

  const handleAddCandidate = () => {
    if (newCandidate.candidate_name && newCandidate.symbol_name) {
      setCandidates([...candidates, newCandidate]);
      setNewCandidate({ candidate_name: "", symbol_name: "" });
    }
  };

  const handleAddAuthority = () => {
    if (newAuthority.username) {
      setAuthorities([...authorities, { ...newAuthority, username: newAuthority.username.trim() }]);
      setNewAuthority({ name: "", username: "" });
    }
  };

  const handleAddAdminAsAuthority = () => {
    // Attempt to get from LocalStorage if not in store context directly here, 
    // but better to rely on what was used in login.
    // AuthStore is not imported, let's look at localStorage 'user' object or 'username' if we saved it.
    // In useAuthStore.js we used localStorage.getItem('user-storage') persisted by zustand usually.
    // But we also might have saved 'username' directly in Login.jsx?
    // Let's assume user entered it or it's in localStorage 'username' if we saved it there.
    // Login.jsx saved `localStorage.setItem("username", username);` ? No, useAuthStore probably handles it.
    // Let's check localStorage usage in other files. AdminDashboard used `localStorage.getItem("username")`.
    const adminUsername = localStorage.getItem("username");

    if (!adminUsername) {
      alert("No admin username found. Please login again.");
      return;
    }
    setAuthorities([...authorities, { name: "Admin (Me)", username: adminUsername }]);
  };

  const handleCompleteSetup = async () => {
    if (!electionId) { alert("Election ID missing"); return; }
    if (!token) { alert("Please login again (token missing)"); return; }
    console.log("[Setup Debug] Token being sent:", token);
    setLoading(true);
    try {
      // 1. Setup election details (candidates, times)
      const setupRes = await fetch("/api/elections/setup", {

        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          election_id: electionId,
          candidates,
          start_time: timings.start_time,
          end_time: timings.end_time,
          result_time: timings.result_time,

          authorities: authorities
        }),
      });

      if (!setupRes.ok) throw new Error("Failed to setup details");

      // 2. Complete setup and start registration
      const completeRes = await fetch("/api/elections/complete-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ election_id: electionId }),
      });

      if (completeRes.ok) {
       // alert("Election setup complete! Registration window open for 2 minutes.");
        navigate("/admin/view-elections");
      } else {
        throw new Error("Failed to complete setup");
      }

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Navigation */}
        <button
          onClick={() => navigate("/admin/register-users")}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium tracking-wide">Back to User Registration</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-3xl shadow-2xl">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
              <Settings size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight">Election Setup</h2>
              <p className="text-gray-400 text-sm">Configure candidates and voting schedule.</p>
              <input
                type="text"
                value={electionId}
                onChange={(e) => setElectionId(e.target.value)}
                className="mt-2 bg-transparent border-b border-white/20 text-xs text-indigo-300 w-full outline-none"
                placeholder="Confirm Election ID"
              />
            </div>
          </div>

          <div className="space-y-8">
            {/* SECTION 1: CANDIDATE INFO */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 ml-1">Candidate Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="group">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input
                      type="text"
                      value={newCandidate.candidate_name}
                      onChange={(e) => setNewCandidate({ ...newCandidate, candidate_name: e.target.value })}
                      placeholder="Candidate Name"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="group">
                  <div className="relative">
                    <Flag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                    <input
                      type="text"
                      value={newCandidate.symbol_name}
                      onChange={(e) => setNewCandidate({ ...newCandidate, symbol_name: e.target.value })}
                      placeholder="Symbol Name"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddCandidate}
                className="w-full py-3 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Add Candidate to List
              </button>

              {/* Added Candidates List */}
              {candidates.length > 0 && (
                <div className="space-y-2 mt-4">
                  {candidates.map((c, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                      <span className="text-sm font-medium text-gray-300">{c.candidate_name} ({c.symbol_name})</span>
                      <Trash2 size={16} className="text-red-400 cursor-pointer" onClick={() => setCandidates(candidates.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4 border-t border-white/5 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 ml-1">Authority Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="group">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 transition-colors" size={18} />
                    <input
                      type="text"
                      value={newAuthority.name}
                      onChange={(e) => setNewAuthority({ ...newAuthority, name: e.target.value })}
                      placeholder="Authority Name (Optional)"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="group">
                  <div className="relative">
                    <Settings className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 transition-colors" size={18} />
                    <input
                      type="text"
                      value={newAuthority.username}
                      onChange={(e) => setNewAuthority({ ...newAuthority, username: e.target.value })}
                      placeholder="Authority Username"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 transition-all font-medium font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddAuthority}
                className="w-full py-3 bg-indigo-600/20 border border-indigo-600/30 text-indigo-400 hover:bg-indigo-600 hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Plus size={18} /> Add Authority
              </button>

              {/* Added Authorities List */}
              {authorities.length > 0 && (
                <div className="space-y-2 mt-4">
                  {authorities.map((a, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                      <span className="text-sm font-medium text-gray-300">{a.name ? `${a.name} ` : "Authority "}({a.username})</span>
                      <Trash2 size={16} className="text-red-400 cursor-pointer" onClick={() => setAuthorities(authorities.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SECTION 2: TIMELINE */}
            <section className="space-y-4 pt-4 border-t border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 ml-1">Election Timeline</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DateInput label="Start Date" value={timings.start_time} onChange={(v) => setTimings({ ...timings, start_time: v })} />
                <DateInput label="End Date" value={timings.end_time} onChange={(v) => setTimings({ ...timings, end_time: v })} />
                <DateInput label="Results Date" value={timings.result_time} onChange={(v) => setTimings({ ...timings, result_time: v })} />
              </div>
            </section>
          </div>

          {/* COMPLETE BUTTON */}
          <button
            onClick={handleCompleteSetup}
            disabled={loading}
            className="w-full mt-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle size={20} />
            <span>{loading ? "loading..." : "Complete Election Setup"}</span>
          </button>
        </div>

        <p className="mt-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold">
          Step 3 of 3: Final Deployment
        </p>
      </motion.div>
    </div>
  );
}

// Helper Component for Date Inputs
function DateInput({ label, value, onChange }) {
  return (
    <div className="group">
      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={14} />
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-xs outline-none focus:border-indigo-500/50 transition-all [color-scheme:dark]"
        />
      </div>
    </div>
  );
}