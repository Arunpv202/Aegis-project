import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  UserPlus,
  User,
  Fingerprint,
  Camera,
  ArrowRight,
  UploadCloud,
  X,
  Copy
} from "lucide-react";

export default function RegisterUsers() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    voter_id: "",
    election_id: "",
  });
  const [generatedToken, setGeneratedToken] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill election_id if available
    const savedId = localStorage.getItem("current_election_id");
    if (savedId) setFormData(prev => ({ ...prev, election_id: savedId }));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tokens/register-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedToken(data.token.token); // Display this token
        setFormData(prev => ({ ...prev, voter_id: "" })); // Clear voter_id for next user
      } else {
        const error = await response.json();
        alert("Error: " + error.message);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to register user.");
    } finally {
      setLoading(false);
    }
  };

  const closePopup = () => setGeneratedToken(null);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Aesthetic Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        {/* Navigation */}
        <button
          onClick={() => navigate("/admin/create-election")}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium tracking-wide">Back to Initialization</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-3xl shadow-2xl relative">
          {/* Header Section */}
          <div className="mb-10 text-center">
            <div className="inline-flex p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 mb-4">
              <UserPlus size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-2">Register User</h2>
            <p className="text-gray-400 text-sm">Enroll authorized voters into the election ledger.</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">


            {/* VOTER ID */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Voter ID (Roll No)</label>
              <div className="relative">
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-emerald-400 transition-colors" size={20} />
                <input
                  type="text"
                  name="voter_id"
                  value={formData.voter_id}
                  onChange={handleChange}
                  placeholder="e.g. 123456"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-gray-700 font-medium"
                />
              </div>
            </div>

            {/* ELECTION ID */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Election ID</label>
              <div className="relative">
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-emerald-400 transition-colors" size={20} />
                <input
                  type="text"
                  name="election_id"
                  value={formData.election_id}
                  onChange={handleChange}
                  placeholder="Reference existing Election ID"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-gray-700 font-medium"
                />
              </div>
            </div>

            {/* FACE UPLOAD FIELD (Visual only for now per prompt not mentioning facial rec backend yet, just registration token) */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Biometric Enrollment (Face)</label>
              <div className="relative border-2 border-dashed border-white/10 rounded-xl p-8 bg-black/20 hover:bg-black/40 hover:border-emerald-500/50 transition-all cursor-pointer text-center group">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/*"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-white/5 rounded-full text-gray-500 group-hover:text-emerald-400 transition-colors">
                    <Camera size={24} />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">Click to capture or upload image</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-tighter">PNG, JPG up to 5MB</p>
                </div>
              </div>
            </div>
          </div>

          {/* ADD USER BUTTON */}
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl mt-8 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <UploadCloud size={20} />
            <span>{loading ? "Registering..." : "Add User to Registry"}</span>
          </button>

          {/* NEXT: SETUP ELECTION */}
          <button
            onClick={() => navigate("/admin/election-setup")}
            className="w-full mt-4 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group"
          >
            <span>Next: Setup Election</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Informational Footer */}
        <p className="mt-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold">
          Step 2 of 3: Identity Management
        </p>

        {/* Token Popup */}
        <AnimatePresence>
          {generatedToken && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
              >
                <button onClick={closePopup} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                  <X size={24} />
                </button>

                <h3 className="text-2xl font-bold mb-2 text-center text-white">Voter Registered!</h3>
                <p className="text-gray-400 text-center mb-6 text-sm">Use this secure token. Share it OFFLINE.</p>

                <div className="bg-black/50 p-4 rounded-xl border border-emerald-500/30 flex items-center justify-between gap-2 overflow-hidden">
                  <code className="text-emerald-400 font-mono text-lg truncate block w-full">{generatedToken}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedToken).then(() => alert("Copied!")).catch(err => console.error("Copy failed", err));
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <Copy size={20} />
                  </button>
                </div>

                <button onClick={closePopup} className="w-full mt-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                  Done
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}