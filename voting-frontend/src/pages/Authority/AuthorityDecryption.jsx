import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, ShieldCheck, CheckCircle2, X, KeyRound, ArrowRight } from "lucide-react";
import { ristretto255 } from '@noble/curves/ed25519.js';
import axios from "axios";
import CryptoJS from "crypto-js";
import useAuthStore from "../../store/useAuthStore";
import { initDB, decryptData } from "../../utils/zkStorage";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthorityDecryption() {
    const { id } = useParams(); // electionId
    // authorityId might be in state or useAuthStore. 
    // ExistingElections passed it in state.
    const location = useLocation();
    const navigate = useNavigate();
    const { username } = useAuthStore();

    const [authorityId, setAuthorityId] = useState(location.state?.authorityId || null);
    const [election, setElection] = useState(null);
    const [status, setStatus] = useState("idle"); // idle, computing, submitted, error
    const [logs, setLogs] = useState([]);

    // Password Protection State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [modalPassword, setModalPassword] = useState("");

    const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    useEffect(() => {
        // Fetch Election Data (Tally)
        const fetchElection = async () => {
            try {
                // Check if already submitted first
                if (authorityId) {
                    try {
                        const statusRes = await axios.get(`/api/elections/${id}/decrypt/${authorityId}/status`);
                        if (statusRes.data.hasSubmitted) {
                            setStatus('submitted');
                            addLog("Info: You have already submitted your share properly.");
                        }
                    } catch (ignore) { /* Status check failure shouldn't block */ }
                }

                const res = await axios.get(`/api/elections/${id}`);
                setElection(res.data);

                // If authorityId missing from state (direct link), try to fetch from backend 
                // via participating route logic, or assume user knows.
                // For now, rely on state.
                if (!authorityId) {
                    addLog("Warning: Authority ID missing from navigation.");
                }

            } catch (e) {
                addLog("Error fetching election data: " + e.message);
            }
        };
        fetchElection();
    }, [id, authorityId]);

    const handleDecryption = () => {
        if (!election || !authorityId) return;
        setShowPasswordModal(true);
    };

    const executeDecryption = async () => {
        if (!modalPassword) { alert("Password required"); return; }
        setShowPasswordModal(false);

        setStatus("computing");
        addLog("Starting Decryption Process...");

        try {
            // 1. Load Private Key Share
            const db = await initDB();
            const key = `auth_FINAL_${id}_${username}`;
            const record = await db.get('secrets', key);

            if (!record || (!record.secret_scalar && !record.encrypted_secret_scalar)) {
                // Debug: List all keys
                const allKeys = await db.getAllKeys('secrets');
                console.error("Available Keys in DB:", allKeys);
                addLog(`Error: Private Key not found. Looked for: ${key}`);
                addLog(`Available keys: ${allKeys.join(', ')}`);
                throw new Error("Private Key Share not found in device storage!");
            }

            let finalSecretScalarStr = record.secret_scalar;

            // Decrypt if it's protected
            if (record.encrypted_secret_scalar) {
                try {
                    const saltInput = `${username}-${id}-VOTING_APP_SCURE_SALT`;
                    const encryptionKey = CryptoJS.PBKDF2(modalPassword, saltInput, {
                        keySize: 256 / 32,
                        iterations: 10000
                    }).toString();

                    const decryptedSecret = decryptData(record.encrypted_secret_scalar, encryptionKey);
                    if (!decryptedSecret) throw new Error("Decryption returned null");
                    finalSecretScalarStr = decryptedSecret;
                } catch (err) {
                    addLog("Error: Invalid password or corrupted encrypted share.");
                    setStatus("error");
                    return;
                }
            }

            if (!finalSecretScalarStr) {
                throw new Error("Could not retrieve the secret share.");
            }

            const secretScalar = BigInt("0x" + finalSecretScalarStr);
            addLog("Private Key Share decrypted and loaded successfully.");

            // 2. Parse Encrypted Tally
            // election.encrypted_tally is JSON { c1: [...], c2: [...] }
            const tally = election.encrypted_tally;
            // Backend stores JSON object directly if type is JSON. 
            // If string, parse it.
            const encryptedTally = typeof tally === 'string' ? JSON.parse(tally) : tally;

            if (!encryptedTally || !encryptedTally.c1) {
                throw new Error("Encrypted Tally data missing from election.");
            }

            const c1_strings = encryptedTally.c1;
            const decryptedShares = [];
            const proofs = [];

            addLog(`Computing shares for ${c1_strings.length} candidate components...`);

            // 3. Compute Partial Decryption & Proof for each component
            // D_i = x_i * C1

            // Helper: Lazy load crypto utils
            const { proveDecryptionShare } = await import("../../utils/cryptoVoting");

            for (let i = 0; i < c1_strings.length; i++) {
                const C1_point = ristretto255.Point.fromHex(c1_strings[i]);

                // D_i
                const D_i = C1_point.multiply(secretScalar);

                // Proof
                // Proves: log_G(PublicShare) == log_C1(D_i) == secretScalar
                // We need PublicShare (Y_i) for proof generation variables
                // Y_i = secretScalar * G
                const Y_i = ristretto255.Point.BASE.multiply(secretScalar);

                if (i === 0) addLog(`[DEBUG] My Public Key (Frontend): ${Y_i.toHex()}`);

                const proof = proveDecryptionShare(
                    secretScalar.toString(),
                    Y_i.toHex(),
                    c1_strings[i],
                    D_i.toHex()
                );

                decryptedShares.push(D_i.toHex());
                proofs.push(proof);
            }

            addLog("ZK Proofs generated successfully.");

            // 4. Submit to Backend
            addLog("Submitting shares to backend...");

            await axios.post(`/api/elections/${id}/decrypt`, {
                election_id: id,
                authority_id: authorityId,
                share_data: { c1_components: decryptedShares },
                proof: proofs
            });

            setStatus("submitted");
            addLog("Decryption Share Submitted Successfully!");

        } catch (e) {
            console.error(e);

            if (e.response && e.response.status === 409) {
                setStatus("submitted");
                addLog("Status: Already Submitted. Server confirmed receipt.");
            } else {
                setStatus("error");
                addLog("Error: " + (e.response?.data?.message || e.message));
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white p-6 font-sans">
            <div className="max-w-2xl mx-auto">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8">
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Authority Decryption Interface</h1>
                            <p className="text-gray-400 text-sm">Election ID: {id}</p>
                        </div>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 mb-8 font-mono text-xs text-gray-300 h-64 overflow-y-auto border border-white/5">
                        {logs.length === 0 && <span className="text-gray-600">Waiting for action...</span>}
                        {logs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                    </div>

                    {status === 'submitted' ? (
                        <div className="text-center p-6 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-emerald-400">Submission Complete</h2>
                            <p className="text-gray-400 text-sm mt-2">Your share has been verified and stored.</p>
                        </div>
                    ) : (
                        <button
                            onClick={handleDecryption}
                            disabled={status === 'computing'}
                            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${status === 'computing' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                                }`}
                        >
                            {status === 'computing' ? (
                                <>Processing Crypto...</>
                            ) : (
                                <>
                                    <Lock size={20} /> Calculate & Submit Result
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

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
                                <h3 className="text-2xl font-bold mb-3 text-white">Unlock Your Secret</h3>
                                <p className="text-gray-400 text-sm leading-relaxed px-2">
                                    Enter the password you created during Round 2 to decrypt your Final DKG share.
                                </p>
                            </div>

                            <div className="mb-8 relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                                <input
                                    type="password"
                                    autoFocus
                                    className="w-full bg-black/40 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-lg placeholder:text-gray-700"
                                    placeholder="Encryption Password"
                                    value={modalPassword}
                                    onChange={(e) => setModalPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && executeDecryption()}
                                />
                            </div>

                            <button
                                onClick={executeDecryption}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                            >
                                <span>Decrypt & Compute Tally</span>
                                <ArrowRight size={20} />
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
