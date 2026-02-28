import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../../store/useAuthStore";
import {
  ArrowLeft,
  PlusCircle,
  User,
  FileText,
  Fingerprint,
  ArrowRight
} from "lucide-react";

export default function CreateElection() {
  const navigate = useNavigate();
  const { username, token } = useAuthStore();
  const [formData, setFormData] = useState({
    election_name: "",
    election_id: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    if (!username) {
      alert("You must be logged in to create an election.");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...formData }; // creator_name is extracted from token on backend

      const response = await fetch("/api/elections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Pass election_id to next page or store in context/localstorage
        // specific to this flow. For now, we can pass via navigation state if needed,
        // or just let the user re-enter it (as per UI design).
        // Let's store in localStorage for convenience in this session
        localStorage.setItem("current_election_id", formData.election_id);
        navigate("/admin/register-users");
      } else {
        const error = await response.json();
        alert("Error: " + error.message);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create election.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Aesthetic Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Navigation Control */}
        <button
          onClick={() => navigate("/admin/dashboard")}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium tracking-wide">Back to Dashboard</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-3xl shadow-2xl relative">
          {/* Header Section */}
          <div className="mb-10 text-center">
            <div className="inline-flex p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 mb-4">
              <PlusCircle size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-2">Create Election</h2>
            <p className="text-gray-400 text-sm">Enter the specific details to initialize your ballot.</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">

            {/* ELECTION NAME */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Election Name</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
                <input
                  type="text"
                  name="election_name"
                  value={formData.election_name}
                  onChange={handleChange}
                  placeholder="e.g. Student Council 2024"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium"
                />
              </div>
            </div>

            {/* ELECTION ID */}
            <div className="group">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Election ID</label>
              <div className="relative">
                <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
                <input
                  type="text"
                  name="election_id"
                  value={formData.election_id}
                  onChange={handleChange}
                  placeholder="Unique ID or Reference"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-medium"
                />
              </div>
            </div>
          </div>


          {/* Action Button */}
          <button
            onClick={handleNext}
            disabled={loading}
            className="w-full mt-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
          >
            {loading ? "Creating..." : (
              <>
                <span>Next: Register Users</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>

        {/* Informational Footer */}
        <p className="mt-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold">
          Step 1 of 2: Initialization
        </p>
      </motion.div >
    </div >
  );
}