import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import CryptoJS from "crypto-js";
import { ristretto255 } from '@noble/curves/ed25519.js';
import { initDB, encryptData } from '../../../utils/zkStorage';
import useAuthStore from '../../../store/useAuthStore';
import { X, KeyRound, ArrowRight, ShieldCheck, Lock, Network, Send, Puzzle, Layers, Shield, CheckCircle2, Activity } from "lucide-react";

// Helper for hex conversion
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const TIMER_DURATION = 60; // 1 minute countdown for visual effect

export default function Round2({ electionId, authorityId, dkgState, refresh }) {
    const { username, token } = useAuthStore();
    const [status, setStatus] = useState('pending'); // pending, computing, submitted, completed_wait
    const [peers, setPeers] = useState([]);
    const [mySecret, setMySecret] = useState(null);
    const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
    const [finalStatus, setFinalStatus] = useState(null); // 'done' if user finalized

    // Password Protection State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [modalPassword, setModalPassword] = useState("");
    const [tempFinalShare, setTempFinalShare] = useState(null);

    // Load Peers and My Secret
    useEffect(() => {
        const load = async () => {
            if (!username) return;

            // 1. Fetch Round 2 Data (My ID + Peers)
            try {
                const res = await fetch('/api/dkg/round2/init', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include',
                    body: JSON.stringify({ election_id: electionId, username: username })
                });

                if (res.ok) {
                    const data = await res.json();
                    setPeers(data.peers);
                    // Use returned authority ID for local logic if needed, 
                    // though prop authorityId is also passed. 
                    // User wanted backend to return it.
                    console.log("Round 2 Init: My ID =", data.authority_id);
                } else {
                    const err = await res.json();
                    console.error("Round 2 Init Failed:", err.message);
                    // If not active, maybe alert?
                    // alert(err.message); 
                }
            } catch (e) {
                console.error("Failed to init Round 2", e);
            }

            // 2. Fetch My Secret (Round 1) AND Final Secret
            try {
                const db = await initDB();
                // Round 1 Secret (Matches Round1.jsx format)
                const secretKey = `auth_${electionId}_${username}`;
                const secretRecord = await db.get('secrets', secretKey);

                if (secretRecord && secretRecord.secret_scalar) {
                    setMySecret(secretRecord.secret_scalar);
                } else {
                    console.warn("Round 1 secret not found matching:", secretKey);
                }

                // Check for FINAL Secret (to disable button if already done)
                const finalKey = `auth_FINAL_${electionId}_${username}`;
                const finalRecord = await db.get('secrets', finalKey);
                if (finalRecord) {
                    console.log("Final secret already computed.");
                    setFinalStatus('done');
                }

            } catch (e) {
                console.error("Failed to load secret", e);
            }
        };
        load();
    }, [electionId, username, token]);

    // Timer
    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    // Compute & Submit
    const handleComputeAndSubmit = async () => {
        if (!mySecret) { alert("Secret not found. Did you finish Round 1?"); return; }
        if (!peers.length) { alert("No peers found."); return; }

        setStatus('computing');

        try {
            const db = await initDB();
            const degree = dkgState.polynomial_degree || 2;
            const L = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

            // 1. Generate Polynomial
            // f(x) = a0 + a1*x + ... + ad*x^d
            const coeffs = [BigInt('0x' + mySecret)]; // a0
            for (let i = 1; i <= degree; i++) {
                const rnd = window.crypto.getRandomValues(new Uint8Array(32));
                let val = BigInt('0x' + bytesToHex(rnd)) % L;
                coeffs.push(val);
            }

            // Define commitments array
            const commitments = coeffs.map(coeff => {
                const point = ristretto255.Point.BASE.multiply(coeff);
                return point.toHex();
            });

            // Use commitments as needed
            const myCommitmentC0 = commitments[0]; // For local reference if needed

            const encryptedShares = [];

            // We must include OURSELVES in the distribution for the math to work.
            // Check if peers includes us (it usually excludes self).
            // We construct a target list including self.
            const allTargets = [...peers];
            if (!allTargets.find(p => p.authority_id === authorityId)) {
                const myPkPoint = ristretto255.Point.BASE.multiply(BigInt('0x' + mySecret));
                const myPkHex = myPkPoint.toHex();
                allTargets.push({ authority_id: authorityId, pk: myPkHex });
            }

            for (const target of allTargets) {
                // Evaluate f(target.authority_id)
                const x = BigInt(target.authority_id);
                let y = BigInt(0);

                // Horner's Method: a_d * x^d + ... + a_0
                for (let k = coeffs.length - 1; k >= 0; k--) {
                    y = (y * x + coeffs[k]) % L;
                }
                const shareScalar = y;

                // Persist self-share separately
                if (String(target.authority_id) === String(authorityId)) {
                    await db.put('secrets', {
                        storage_key: `auth_SELF_${electionId}_${username}`,
                        election_id: electionId,
                        share_scalar: shareScalar.toString(16),
                        created_at: new Date().toISOString()
                    });
                    console.log(`[DKG] Saved self-share locally. Skipping backend transmission for target ${target.authority_id}.`);
                    continue; // Skip appending self-share to backend payload
                }

                // Encrypt with Shared Key (Scalar Masking)
                // Shared Point = Target PK * My Secret
                let cleanPk = target.pk;
                if (cleanPk.startsWith('0x')) cleanPk = cleanPk.slice(2);
                console.log(`Processing PK for auth ${target.authority_id}:`, cleanPk);

                const targetPoint = ristretto255.Point.fromHex(cleanPk);
                const sharedPoint = targetPoint.multiply(BigInt('0x' + mySecret));

                // Derive Mask: Hash(SharedPoint) -> scalar
                // Use .toHex() as .toRawBytes() is undefined in this version
                const sharedHex = sharedPoint.toHex();

                // Using CryptoJS instead of window.crypto.subtle
                const maskHex = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(sharedHex)).toString(CryptoJS.enc.Hex);
                const mask = BigInt('0x' + maskHex) % L;

                // Encrypt: (Share + Mask) % L
                const encryptedVal = (shareScalar + mask) % L;
                const encryptedHex = encryptedVal.toString(16).padStart(64, '0');

                encryptedShares.push({
                    to_authority_id: target.authority_id,
                    encrypted_share: encryptedHex
                });
            }

            // 4. Submit
            // const walletAddress = localStorage.getItem('wallet'); // Using store now
            const payload = {
                election_id: electionId,
                username: username,
                commitments: commitments, // VSS Requires full vector
                shares: encryptedShares
            };

            const res = await fetch('/api/dkg/round2/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setStatus('submitted');
                refresh();
            } else {
                const err = await res.json();
                alert('Details: ' + err.message);
                setStatus('pending');
            }

        } catch (e) {
            console.error("Error in handleComputeAndSubmit", e);
            alert("Error: " + e.message);
            setStatus('pending');
        }
    };

    // Calculate My Secret (Finalize)
    const handleCalculateSecret = async () => {
        if (dkgState?.status !== 'completed' && !dkgState?.allRound2Done) {
            alert("DKG Protocol is not yet finalized. Please wait for the Admin to verify all submissions and click Finalize.");
            return;
        }

        try {
            const db = await initDB();

            // Fetch shares sent TO me
            if (!authorityId) {
                alert("Authority ID missing. Please reload.");
                return;
            }

            const res = await fetch(`/api/dkg/shares/${electionId}/${authorityId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                cache: 'no-store',
                credentials: 'include'
            });
            if (!res.ok) throw new Error("Failed to fetch shares");

            const { shares } = await res.json();

            // Debug Logs: Verify backend shares are populated correctly
            console.log(`[DKG Debug] Fetched ${shares.length} opponent shares from backend.`);
            if (shares.length > 0) {
                console.log("[DKG Debug] Raw Share Data Sample:");
                shares.forEach((s, idx) => {
                    console.log(`   Share ${idx + 1} from Auth ${s.from_authority_id}: 
        - Encrypted Share Data: ${s.encrypted_share ? s.encrypted_share.substring(0, 20) + '...' : 'NULL'}
        - Sender PK: ${s.sender_pk ? 'EXISTS' : 'NULL'}
        - Sender Commitment: ${s.sender_commitment ? 'EXISTS' : 'NULL'}`);
                });
            } else {
                console.warn("[DKG Debug] WARNING: Fetched 0 shares from backend!");
            }

            const L = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

            // 1. Load Self-Share from Local DB first
            let finalShare = BigInt(0);
            const selfShareRecord = await db.get('secrets', `auth_SELF_${electionId}_${username}`);

            if (selfShareRecord && selfShareRecord.share_scalar) {
                finalShare = BigInt('0x' + selfShareRecord.share_scalar);
                console.log(`[VSS] Loaded self-share directly from local IndexedDB.`);
            } else {
                console.error("[VSS] Critical Error: Cannot find self-share in IndexedDB.");
                alert("Critical Error: Missing self-share. Ensure you computed shares correctly.");
                return;
            }

            // [UPDATE] We now rely on the enriched share data from the API
            // which includes sender_pk and sender_commitment from the blockchain.

            // Helper to sanitize hex
            const cleanHex = (hex) => {
                let h = hex;
                if (h.startsWith('0x')) h = h.slice(2);
                if (h.length % 2 !== 0) h = '0' + h;
                return h;
            };

            for (const item of shares) {
                const validCommitment = item.sender_commitment;
                const validPk = item.sender_pk;

                if (!validPk) {
                    console.warn(`Sender PK not found for ${item.from_authority_id}`);
                    continue;
                }

                // Decrypt
                // Shared Key = Sender PK * My Secret
                // Clean input PK
                const cleanPk = cleanHex(validPk);
                const senderPoint = ristretto255.Point.fromHex(cleanPk);
                const mySecretBI = BigInt('0x' + mySecret);
                const sharedPoint = senderPoint.multiply(mySecretBI);

                // Regenerate Mask
                const sharedHex = sharedPoint.toHex();

                // Using CryptoJS instead of window.crypto.subtle
                const maskHex = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(sharedHex)).toString(CryptoJS.enc.Hex);
                const mask = BigInt('0x' + maskHex) % L;

                // Decrypt: (Encrypted - Mask) % L
                // Handle negative modulo correctly
                const cleanEncryptedShare = cleanHex(item.encrypted_share);
                const encryptedVal = BigInt('0x' + cleanEncryptedShare);
                let decryptedVal = (encryptedVal - mask) % L;
                if (decryptedVal < 0n) decryptedVal += L;

                // ---------------------------------------------------------
                // FELDMAN VERIFICATION: s * G == sum( C_k * i^k )
                // ---------------------------------------------------------
                if (validCommitment) {
                    try {
                        const commitments = JSON.parse(validCommitment);
                        if (Array.isArray(commitments) && commitments.length > 0) {
                            const i = BigInt(authorityId); // My ID (x coordinate)
                            let rhs = ristretto255.Point.ZERO;

                            // Compute RHS = sum( C_k * i^k )
                            for (let k = 0; k < commitments.length; k++) {
                                const cleanC = cleanHex(commitments[k]);
                                const C_k = ristretto255.Point.fromHex(cleanC);
                                let i_k = BigInt(1);
                                if (k > 0) i_k = i ** BigInt(k);

                                const term = C_k.multiply(i_k);
                                rhs = rhs.add(term);
                            }

                            const lhs = ristretto255.Point.BASE.multiply(decryptedVal);

                            if (!lhs.equals(rhs)) {
                                throw new Error(`Verification Failed for sender ${item.from_authority_id}`);
                            }
                            console.log(`[VSS] verified share from ${item.from_authority_id}`);
                        }
                    } catch (err) {
                        console.error("VSS Verification Error:", err);
                        alert(`Warning: Could not verify share from Authority ${item.from_authority_id}. It might be invalid.`);
                        // For strict security, one might throw; here we warn.
                    }
                } else {
                    console.warn(`No commitment found for ${item.from_authority_id}, computation insecure.`);
                }

                finalShare = (finalShare + decryptedVal) % L;
            }

            // Store Final Share logic moved to password confirmation
            // await db.put('secrets', ...); 

            setTempFinalShare(finalShare.toString(16));
            setShowPasswordModal(true);

        } catch (e) {
            console.error("Error in handleCalculateSecret", e);
            alert("Calculation failed: " + e.message);
        }
    };

    // Confirm Storage with Password
    const handleConfirmStorage = async () => {
        if (!modalPassword) { alert("Password required"); return; }
        try {
            // 1. Derive Key
            const saltInput = `${username}-${electionId}-VOTING_APP_SCURE_SALT`;
            const encryptionKey = CryptoJS.PBKDF2(modalPassword, saltInput, {
                keySize: 256 / 32,
                iterations: 10000
            }).toString();

            // 2. Encrypt The Secret
            const encryptedVal = encryptData(tempFinalShare, encryptionKey);

            // 3. Store
            const db = await initDB();
            await db.put('secrets', {
                storage_key: `auth_FINAL_${electionId}_${username}`,
                election_id: electionId,
                encrypted_secret_scalar: encryptedVal, // Storing ENCRYPTED now
                created_at: new Date().toISOString()
            });

            setFinalStatus('done');
            setShowPasswordModal(false);
            setModalPassword("");
            setTempFinalShare(null);

        } catch (e) {
            console.error("Encryption failed", e);
            alert("Failed to encrypt and store: " + e.message);
        }
    };

    // Updated useEffect for retrieval
    useEffect(() => {
        const loadSecrets = async () => {
            try {
                const db = await initDB();
                const round1Key = `auth_${electionId}_${username}`;
                const round1Record = await db.get('secrets', round1Key);
                if (round1Record) setMySecret(round1Record.secret_scalar);

                const finalKey = `auth_FINAL_${electionId}_${username}`;
                const finalRecord = await db.get('secrets', finalKey);
                if (finalRecord) setFinalStatus('done');
            } catch (e) {
                console.error("Error loading secrets", e);
            }
        };
        loadSecrets();
    }, [electionId, username]);

    return (
        <div className="text-center max-w-3xl mx-auto">
            <div className="mb-10 content-center flex flex-col items-center">
                <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-4 border border-purple-500/30 shadow-lg shadow-purple-500/20">
                    <Network size={32} />
                </div>
                <h3 className="text-2xl font-bold uppercase tracking-wider text-white mb-2">Round 2: The Web of Trust</h3>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
                    In this phase, you are building the Master Election Key. You will split your secret into <span className="text-purple-400 font-bold">{peers.length || 0}</span> encrypted puzzle pieces and trade them with the other authorities.
                </p>
            </div>

            {/* Status Panel */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
                <div className="bg-slate-900/60 border border-white/5 rounded-lg px-4 py-3 flex items-center gap-3">
                    <Activity className="text-blue-400" size={18} />
                    <div className="text-left">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Network Status</p>
                        <p className="text-sm font-mono text-white flex items-center gap-2">
                            {dkgState?.status}
                            {dkgState?.status === 'round2' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
                        </p>
                    </div>
                </div>
                <div className="bg-slate-900/60 border border-white/5 rounded-lg px-4 py-3 flex items-center gap-3">
                    <Layers className="text-purple-400" size={18} />
                    <div className="text-left">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Polynomial Degree</p>
                        <p className="text-sm font-mono text-white">{dkgState?.polynomial_degree}</p>
                    </div>
                </div>
                <div className="bg-slate-900/60 border border-white/5 rounded-lg px-4 py-3 flex items-center gap-3">
                    <Network className="text-emerald-400" size={18} />
                    <div className="text-left">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Connected Peers</p>
                        <p className="text-sm font-mono text-white">{peers.length}</p>
                    </div>
                </div>
            </div>

            {/* Phase 1: Distribute */}
            {status === 'pending' && dkgState?.status === 'round2' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 bg-gradient-to-b from-purple-900/20 to-transparent border border-purple-500/20 rounded-2xl">
                    <div className="flex justify-center mb-6 relative h-24 w-full">
                        {/* Visualization of sending out pieces */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center z-10 shadow-[0_0_20px_rgba(147,51,234,0.5)]">
                            <span className="text-white text-xs font-bold">You</span>
                        </div>
                        {peers.slice(0, 5).map((p, i) => {
                            const angle = (i / Math.min(peers.length, 5)) * Math.PI * 2;
                            const x = Math.cos(angle) * 60;
                            const y = Math.sin(angle) * 30;
                            return (
                                <motion.div
                                    key={i}
                                    className="absolute left-1/2 top-1/2 w-8 h-8 bg-slate-800 rounded-full border border-purple-500/30 flex items-center justify-center"
                                    initial={{ x: 0, y: 0, opacity: 0 }}
                                    animate={{ x, y, opacity: 1 }}
                                    transition={{ delay: 0.2 + (i * 0.1), duration: 0.5, type: 'spring' }}
                                    style={{ marginLeft: '-16px', marginTop: '-16px' }}
                                >
                                    <span className="text-purple-300 text-[10px]">{String(p.authority_id).substring(0, 2)}</span>
                                </motion.div>
                            )
                        })}
                    </div>

                    <button
                        onClick={handleComputeAndSubmit}
                        className="w-full sm:w-auto px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all transform hover:scale-105 flex items-center justify-center gap-2 mx-auto"
                    >
                        <Send size={18} />
                        Compute & Distribute Shares
                    </button>
                    <p className="mt-4 text-xs text-gray-400">
                        This mathematically splits your secret and securely encrypts exactly one piece for each peer.
                    </p>
                </motion.div>
            )}

            {status === 'computing' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8">
                    <div className="flex justify-center items-center h-16 mb-4 space-x-2">
                        {[0, 1, 2].map(i => (
                            <motion.div
                                key={i}
                                className="w-3 h-3 bg-purple-500 rounded-full"
                                animate={{ y: [-10, 10, -10], opacity: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                            />
                        ))}
                    </div>
                    <p className="text-purple-400 font-mono text-sm">Evaluating Polynomials & Encrypting Shares...</p>
                </motion.div>
            )}

            {/* Waiting State (If submitted but not all done) */}
            {status === 'submitted' && (!dkgState?.allRound2Done && dkgState?.status !== 'completed') && finalStatus !== 'done' && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900/70 py-8 px-6 rounded-2xl border border-white/5 max-w-lg mx-auto">
                    <div className="w-16 h-16 border-4 border-slate-700 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <h4 className="text-white font-bold text-lg mb-2">Pieces Distributed</h4>
                    <p className="text-gray-400 text-sm">Now waiting for the other authorities to compute and send their pieces back to you.</p>
                    <div className="mt-6 bg-black/40 rounded-lg p-3 inline-block">
                        <p className="text-xs text-purple-400 font-mono">Standby for Network Synchronization...</p>
                    </div>
                </motion.div>
            )}

            {/* Phase 2: Finalize */}
            {((dkgState?.allRound2Done || dkgState?.status === 'completed') && finalStatus !== 'done') && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-gradient-to-tr from-blue-900/30 to-purple-900/10 p-1 rounded-2xl">
                    <div className="bg-slate-900 p-6 md:p-8 rounded-xl border border-blue-500/20">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 text-blue-400">
                                <Puzzle size={32} />
                            </div>
                            <h4 className="text-white font-bold text-xl mb-2">Network Synchronized!</h4>
                            <p className="text-gray-400 text-sm max-w-md mx-auto mb-8">
                                You have received all puzzle pieces from the network. It's time to decrypt them, verify their mathematical validity (Feldman VSS), and assemble your final share.
                            </p>

                            <button
                                onClick={handleCalculateSecret}
                                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all transform hover:scale-105 flex items-center justify-center gap-2 mx-auto"
                            >
                                <KeyRound size={20} />
                                Assemble Your Master Key
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {finalStatus === 'done' && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-8 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-8 rounded-2xl border border-emerald-500/20 max-w-lg mx-auto">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                            <ShieldCheck size={40} />
                        </div>
                    </div>
                    <h4 className="text-white font-bold text-2xl mb-2">Master Key Assembled</h4>
                    <p className="text-emerald-400 font-medium mb-6">You are now ready to decrypt votes.</p>

                    <div className="bg-black/40 rounded-xl p-4 text-left border border-white/5 space-y-3">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <p className="text-xs text-gray-300">All inbound shares cryptographically verified</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <p className="text-xs text-gray-300">Final share assembled and tested</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Lock size={16} className="text-emerald-500" />
                            <p className="text-xs text-gray-300">Encrypted with your personal secure password</p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Password Modal */}
            <AnimatePresence>
                {showPasswordModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-white/10 p-6 md:p-10 rounded-[2.5rem] max-w-md w-full relative shadow-2xl"
                        >
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                            >
                                <X size={24} />
                            </button>

                            <div className="text-center mb-8">
                                <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
                                    <Lock size={40} />
                                </div>
                                <h3 className="text-2xl font-bold mb-3 text-white">Protect Your Secret</h3>
                                <p className="text-gray-400 text-sm leading-relaxed px-2">
                                    Enter a secure password to encrypt your final DKG share. <br />
                                    <strong>You must remember this password to sign/decrypt later.</strong>
                                </p>
                            </div>

                            <div className="mb-8 relative group">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                                <input
                                    type="password"
                                    autoFocus
                                    className="w-full bg-black/40 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-lg placeholder:text-gray-700"
                                    placeholder="Encryption Password"
                                    value={modalPassword}
                                    onChange={(e) => setModalPassword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmStorage()}
                                />
                            </div>

                            <button
                                onClick={handleConfirmStorage}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                            >
                                <span>Encrypt & Save</span>
                                <ArrowRight size={20} />
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}