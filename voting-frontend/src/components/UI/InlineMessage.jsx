import { AlertCircle, CheckCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function InlineMessage({ type = "error", message, onClose }) {
    if (!message) return null;

    const isError = type === "error";
    const bg = isError ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20";
    const text = isError ? "text-red-200" : "text-emerald-200";
    const iconColor = isError ? "text-red-400" : "text-emerald-400";
    const Icon = isError ? AlertCircle : CheckCircle;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`relative flex items-start gap-3 p-4 rounded-xl border ${bg} ${text} mb-6 overflow-hidden`}
            >
                <Icon className={`shake-icon shrink-0 mt-0.5 ${iconColor}`} size={18} />
                <div className="flex-1 text-sm font-medium leading-relaxed">
                    {message}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={14} className="opacity-70" />
                    </button>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
