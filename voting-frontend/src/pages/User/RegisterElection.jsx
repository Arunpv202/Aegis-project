import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import CryptoJS from "crypto-js";
import { storeSecrets } from "../../utils/zkStorage";
import {
  ArrowLeft,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Loader2,
  X
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";
import LoadingScreen from "../../components/UI/LoadingScreen";
import InlineMessage from "../../components/UI/InlineMessage";

export default function RegisterElection() {
  const navigate = useNavigate();
  const { username, token } = useAuthStore();

  const [formData, setFormData] = useState({
    election_id: "",
    token: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalPassword, setModalPassword] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleInitialSubmit = () => {
    setError(null);
    if (!formData.election_id || !formData.token) {
      setError("Please fill in Election Reference ID and Access Token.");
      return;
    }
    setShowPasswordModal(true);
  };

  const handleFinalRegister = async () => {
    // Close modal
    setShowPasswordModal(false);
    setError(null);

    if (!modalPassword) {
      setError("Encryption password is required.");
      return;
    }

    setLoading(true);
    try {
      if (!username) {
        throw new Error("User not logged in.");
      }

      // 1. Derive Encryption Key (Client-Side)
      const saltInput = `${username}-${formData.election_id}-VOTING_APP_SCURE_SALT`;
      const encryptionKey = CryptoJS.PBKDF2(modalPassword, saltInput, {
        keySize: 256 / 32,
        iterations: 10000
      }).toString();

      // 2. Generate ZK Identity
      const zkSecret = CryptoJS.lib.WordArray.random(32).toString();

      // 3. Compute Commitment (Poseidon)
      const { generateCommitment } = await import("../../utils/cryptoVoting");
      const commitment = await generateCommitment(zkSecret);
      console.log("Generated Commitment (Poseidon):", commitment);

      // Send to Backend
      // Token is already retrieved from useAuthStore hook
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          election_id: formData.election_id.trim(),
          token: formData.token.trim(),
          commitment: commitment
          // username removed from body as it is extracted from token in backend
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Registration failed");
      }

      // 4. Store Secrets Encrypted (Only after backend confirms)
      await storeSecrets(formData.election_id, { zkSecret }, encryptionKey, username);
      console.log("Secrets stored securely after backend success.");

      setSuccess("Registration Successful! Redirecting...");

      // Delay navigation slightly to show success
      setTimeout(() => {
        navigate("/user/dashboard");
      }, 1500);

    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
      // Clear password logic here if needed
      setModalPassword("");
    }
  };

  if (loading && !success) return <LoadingScreen text="Verifying Credientials & Generating Zero-Knowledge Proof..." />;

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl relative z-10"
      >
        {/* Back Navigation */}
        <button
          onClick={() => navigate("/user/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-all group px-4 py-2 hover:bg-white/5 rounded-lg w-fit"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-10 md:p-14 rounded-[3rem] shadow-2xl relative">
          {/* Decorative Corner Glow */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex p-5 bg-indigo-500/10 rounded-3xl text-indigo-400 mb-6 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
              <ShieldCheck size={40} />
            </div>
            <h2 className="text-4xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Register for Election</h2>
            <p className="text-gray-400 text-base leading-relaxed max-w-lg mx-auto">
              Enter the specific election ID and your unique access token to securely link your digital wallet.
            </p>
          </div>

          {/* Messages */}
          <InlineMessage type="error" message={error} onClose={() => setError(null)} />
          <InlineMessage type="success" message={success} />

          {/* Input Fields */}
          <div className="space-y-8">
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 ml-2">
                Election Identifier
              </label>
              <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                <Fingerprint
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors"
                  size={24}
                />
                <input
                  type="text"
                  name="election_id"
                  value={formData.election_id}
                  onChange={handleChange}
                  placeholder="e.g. ELEC-2024-X"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 pl-16 pr-6 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium font-mono text-lg text-white"
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 ml-2">
                Secure Access Token
              </label>
              <div className="relative transform transition-all group-focus-within:scale-[1.01]">
                <KeyRound
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors"
                  size={24}
                />
                <input
                  type="text"
                  name="token"
                  value={formData.token}
                  onChange={handleChange}
                  placeholder="Paste your token here..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-6 pl-16 pr-6 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium font-mono text-lg text-white"
                />
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-10 flex gap-4 p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-sm text-blue-300 leading-relaxed items-start">
            <ShieldAlert size={20} className="shrink-0 opacity-80 mt-0.5" />
            <p>Ensure your token is kept private. It will be mapped to your wallet address permanently for this session. Do not share this token with anyone.</p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleInitialSubmit}
            disabled={loading || success}
            className="w-full mt-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                <span>Submit & Continue</span>
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Technical Metadata */}
        <p className="mt-10 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold">
          Verification Stage: Access Control Layer 1
        </p>
      </motion.div>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 p-10 rounded-[2.5rem] max-w-md w-full relative shadow-2xl"
            >
              <button
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
                  <KeyRound size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white">Set Encryption Password</h3>
                <p className="text-gray-400 text-sm leading-relaxed px-2">
                  Create a secure password. You will need this to <strong>decrypt your ZK-Proof</strong> when voting.
                </p>
              </div>

              <div className="mb-8 relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                <input
                  type="password"
                  autoFocus
                  className="w-full bg-black/40 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-lg placeholder:text-gray-700"
                  placeholder="Enter secure password"
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFinalRegister()}
                />
              </div>

              <button
                onClick={handleFinalRegister}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <span>Encrypt & Register</span>
                <ArrowRight size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}