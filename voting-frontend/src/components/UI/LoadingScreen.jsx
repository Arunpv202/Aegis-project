import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function LoadingScreen({ text = "Processing..." }) {
    return (
        <div className="fixed inset-0 bg-[#020617] z-50 flex flex-col items-center justify-center text-white">
            <div className="absolute inset-0 bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />

            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mb-8"
            >
                <div className="relative">
                    <Loader2 size={64} className="text-indigo-500" />
                    <div className="absolute inset-0 border-4 border-t-indigo-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                </div>
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold tracking-tight mb-2"
            >
                {text}
            </motion.h2>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-gray-400 uppercase tracking-widest"
            >
                Please wait
            </motion.p>
        </div>
    );
}
