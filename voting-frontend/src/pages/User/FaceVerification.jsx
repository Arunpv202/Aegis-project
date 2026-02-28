import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Scan,
  ShieldCheck,
  Camera,
  RefreshCw,
  Info
} from "lucide-react";

import useAuthStore from "../../store/useAuthStore";

export default function FaceVerification() {
  const navigate = useNavigate();
  const { electionId } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Navigation */}
        <button
          onClick={() => navigate("/user/enter-election")}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Cancel & Return</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[3rem] shadow-2xl relative text-center">

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-black tracking-tight mb-2">Biometric Scan</h2>
            <p className="text-gray-400 text-sm">Position your face within the frame for live verification.</p>
          </div>

          {/* Scanner Viewport */}
          <div className="relative mx-auto w-64 h-64 md:w-80 md:h-80 mb-10 group">
            {/* The "Camera" Placeholder */}
            <div className="absolute inset-0 bg-black/60 rounded-[3rem] border-2 border-white/5 overflow-hidden flex items-center justify-center">
              <Camera size={48} className="text-white/10 group-hover:text-emerald-500/20 transition-colors duration-700" />

              {/* Simulated Camera Feed Noise/Texture */}
              <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat"></div>
            </div>

            {/* Scanning Laser Line Animation */}
            <motion.div
              initial={{ top: "0%" }}
              animate={{ top: "100%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,0.8)] z-20"
            />

            {/* Viewfinder Corners */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-3xl"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-3xl"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-3xl"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-3xl"></div>

            {/* Center Target Icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <Scan size={120} className="text-emerald-500" strokeWidth={0.5} />
            </div>
          </div>

          {/* Instruction Box */}
          <div className="flex gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl items-center mb-10 text-left">
            <Info size={18} className="text-emerald-400 shrink-0" />
            <p className="text-[11px] text-gray-400 leading-tight">
              Please ensure you are in a well-lit environment. Avoid wearing glasses or hats during the scanning process.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={() => navigate(`/user/vote/${electionId}`)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
            >
              <ShieldCheck size={20} />
              <span>Verify & Continue</span>
            </button>

            <button className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-white mx-auto transition-colors py-2 font-bold uppercase tracking-widest">
              <RefreshCw size={14} />
              Retry Camera Initialization
            </button>
          </div>
        </div>

        {/* Status Meta */}
        <p className="mt-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.3em] font-bold">
          AI Model: Neural-Identity-Check v4.2
        </p>
      </motion.div>
    </div>
  );
}