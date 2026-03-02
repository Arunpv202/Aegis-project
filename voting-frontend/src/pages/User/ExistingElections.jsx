import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import CryptoJS from "crypto-js";
import {
  ArrowLeft,
  PlayCircle,
  Timer,
  CheckCircle2,
  BarChart3,
  Clock,
  Calendar,
  Lock,
  ChevronRight,
  KeyRound,
  X,
  Loader2,
  AlertCircle
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";
import { getCommitment } from "../../utils/zkStorage";
import { useEffect } from "react";

export default function ExistingElections() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ongoing");
  const { username, token } = useAuthStore();
  const [elections, setElections] = useState({
    ongoing: [],
    upcoming: [],
    completed: []
  });
  const [loading, setLoading] = useState(true);

  // Password popup state
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);
  const [popupPassword, setPopupPassword] = useState("");
  const [popupElectionId, setPopupElectionId] = useState(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupError, setPopupError] = useState(null);

  const setElectionId = useAuthStore(state => state.setElectionId);
  const setMerkleRoot = useAuthStore(state => state.setMerkleRoot);
  const setCommitment = useAuthStore(state => state.setCommitment);

  useEffect(() => {
    const fetchElections = async () => {
      if (!username) return;
      try {
        const res = await fetch(`/api/elections/participating/${username}`, {
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          const now = new Date();

          const ongoing = [];
          const upcoming = [];
          const completed = [];

          data.forEach(e => {
            const start = new Date(e.start_time);
            const end = new Date(e.end_time);

            // Use backend status if available, fallback to time calc
            let status = e.status || 'unknown';
            if (!e.status) {
              if (end < now) status = 'completed';
              else if (start > now) status = 'upcoming';
              else status = 'ongoing';
            }

            // UI Object
            const uiElection = {
              id: e.election_id,
              name: e.election_name,
              creator: e.creator_name,
              id_ref: e.election_id,
              info: "",
              start_time: start,
              end_time: end,
              status: status,
              my_role: e.user_role,
              authority_id: e.my_authority_id
            };

            if (status === 'completed') {
              uiElection.info = e.end_time ? `Closed on ${end.toLocaleDateString()}` : 'Closed';
              completed.push(uiElection);
            } else if (status === 'upcoming') {
              uiElection.info = e.start_time ? `Opens in ${Math.ceil((start - now) / (1000 * 60 * 60 * 24))} days` : 'Not yet scheduled';
              upcoming.push(uiElection);
            } else { // ongoing
              uiElection.info = e.end_time ? `Ends in ${Math.ceil((end - now) / (1000 * 60 * 60))} hours` : 'Ongoing';
              ongoing.push(uiElection);
            }
          });

          setElections({ ongoing, upcoming, completed });
        }
      } catch (err) {
        console.error("Failed to fetch user elections", err);
      } finally {
        setLoading(false);
      }
    };
    fetchElections();
  }, [username]);

  /* ---- Password Popup Handlers ---- */

  const handleEnterElection = (electionId) => {
    setPopupElectionId(electionId);
    setPopupPassword("");
    setPopupError(null);
    setShowPasswordPopup(true);
  };

  const handlePasswordSubmit = async () => {
    if (!popupPassword) {
      setPopupError("Password is required.");
      return;
    }

    setPopupLoading(true);
    setPopupError(null);

    try {
      // 1. Derive encryption key (same PBKDF2 as registration)
      const saltInput = `${username}-${popupElectionId}-VOTING_APP_SCURE_SALT`;
      const encryptionKey = CryptoJS.PBKDF2(popupPassword, saltInput, {
        keySize: 256 / 32,
        iterations: 10000
      }).toString();

      // 2. Decrypt commitment from IndexedDB
      const commitment = await getCommitment(popupElectionId, encryptionKey, username);
      if (!commitment) {
        throw new Error("Decryption failed. Wrong password or no credentials found.");
      }

      // 3. Merkle root verification inline
      const commRes = await fetch(`/api/elections/${popupElectionId}/commitments`);
      const commData = await commRes.json();

      if (!commData.success) {
        throw new Error("Failed to fetch election commitments.");
      }

      // 4. Store verified data in auth store
      setElectionId(popupElectionId);
      setCommitment(commitment);
      setMerkleRoot(commData.merkle_root);

      console.log("[ExistingElections] Commitment decrypted, Merkle data loaded. Navigating to face verification.");

      setShowPasswordPopup(false);
      setPopupPassword("");

      // 5. Navigate directly to face verification (skipping EnterElection)
      navigate("/user/face-verification");

    } catch (err) {
      console.error("[ExistingElections] Password flow error:", err);
      setPopupError(err.message || "Decryption failed. Please try again.");
    } finally {
      setPopupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <header className="mb-12">
          <button
            onClick={() => navigate("/user/dashboard")}
            className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Portal</span>
          </button>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Election Registry</h1>
            <p className="text-gray-400">Browse and participate in decentralized voting sessions.</p>
          </div>
        </header>

        {/* Centered Status Tabs */}
        <div className="flex justify-center mb-16">
          <div className="flex gap-2 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/5 w-full max-w-xl shadow-2xl">
            <TabButton active={activeTab === "ongoing"} onClick={() => setActiveTab("ongoing")} icon={<PlayCircle size={16} />} label="Ongoing" />
            <TabButton active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")} icon={<Timer size={16} />} label="Upcoming" />
            <TabButton active={activeTab === "completed"} onClick={() => setActiveTab("completed")} icon={<CheckCircle2 size={16} />} label="Closed" />
          </div>
        </div>

        {/* Election Grid */}
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {elections[activeTab].map((election) => (
              <ElectionCard
                key={election.id}
                election={election}
                type={activeTab}
                navigate={navigate}
                onEnterElection={handleEnterElection}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Password Popup Modal */}
      <AnimatePresence>
        {showPasswordPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-10 rounded-[2.5rem] max-w-md w-full relative shadow-2xl"
            >
              <button
                onClick={() => { setShowPasswordPopup(false); setPopupError(null); }}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                  <KeyRound size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-2">Enter Password</h3>
                <p className="text-gray-400 text-sm">
                  Enter your encryption password to decrypt your credentials for election <strong className="text-white font-mono">{popupElectionId}</strong>.
                </p>
              </div>

              {popupError && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {popupError}
                </div>
              )}

              <div className="mb-8 relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                <input
                  type="password"
                  autoFocus
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-lg placeholder:text-gray-700"
                  placeholder="Enter password"
                  value={popupPassword}
                  onChange={(e) => setPopupPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !popupLoading && handlePasswordSubmit()}
                  disabled={popupLoading}
                />
              </div>

              <button
                onClick={handlePasswordSubmit}
                disabled={popupLoading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {popupLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <span>Decrypt & Proceed</span>
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${active ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 scale-[1.02]" : "text-gray-500 hover:text-gray-300"
        }`}
    >
      {icon} {label}
    </button>
  );
}

function ElectionCard({ election, type, navigate, onEnterElection }) {
  const isOngoing = type === "ongoing";
  const isUpcoming = type === "upcoming";
  const isCompleted = type === "completed";
  const { my_role, authority_id } = election;

  const showEnterElection = isOngoing && (my_role === 'voter' || my_role === 'both');
  const showCalculateResult = isCompleted && (my_role === 'authority' || my_role === 'both');
  const showViewResult = isCompleted; // Everyone (voter/auth/both) can view results

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -8 }}
      className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-7 rounded-[2.5rem] flex flex-col justify-between shadow-xl transition-all group"
    >
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className="p-3 rounded-2xl bg-white/5 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
            <BarChart3 size={24} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[10px] font-black tracking-widest px-3 py-1 rounded-full border ${isOngoing ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
              isUpcoming ? 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5' :
                'border-gray-500/30 text-gray-500 bg-gray-500/5'
              }`}>
              {type}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">ID: {election.id}</span>
            {my_role && <span className="text-[10px] text-blue-400 font-mono uppercase mt-1">{my_role}</span>}
          </div>
        </div>

        <h3 className="text-2xl font-bold mb-1 leading-tight">{election.name}</h3>
        <p className="text-gray-500 text-sm mb-6">{election.creator}</p>

        <div className="flex items-center gap-2 text-sm text-gray-400 mb-8 py-2 px-3 bg-white/5 rounded-lg w-fit">
          {isOngoing ? <Clock size={16} className="text-emerald-400 animate-pulse" /> : <Calendar size={16} />}
          <span className="font-mono">{election.info}</span>
        </div>
      </div>

      <div className="space-y-3">
        {isCompleted ? (
          <div className="flex flex-col gap-2">
            {/* Show Calculate Result ONLY if Authority or Both */}
            {showCalculateResult && (
              <button
                onClick={() => navigate(`/authority/dkg/dashboard/${election.id}`, { state: { authorityId: authority_id } })}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/20"
              >
                Calculate Result
              </button>
            )}

            {/* Show View Result for All */}
            {showViewResult && (
              <button
                onClick={() => navigate(`/results/${election.id}`)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20"
              >
                View Result
              </button>
            )}
          </div>
        ) : (
          /* Ongoing or Upcoming */
          <>
            {isUpcoming ? (
              <button
                disabled
                className="w-full py-4 bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Lock size={16} />
                <span>Starts Soon</span>
              </button>
            ) : (
              /* Ongoing */
              showEnterElection ? (
                <button
                  onClick={() => onEnterElection(election.id)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 group/btn relative overflow-hidden"
                >
                  <span>Enter Election</span>
                  <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              ) : (
                /* Ongoing but not voter (Authority only) */
                <div className="w-full py-4 text-center text-gray-500 text-sm font-mono border border-white/5 rounded-2xl">
                  Authority View Only
                </div>
              )
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}