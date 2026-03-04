import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import CryptoJS from "crypto-js";
import { ristretto255 } from '@noble/curves/ed25519.js';
import { initDB, encryptData } from '../../../utils/zkStorage';
import useAuthStore from '../../../store/useAuthStore';
import { X, KeyRound, ArrowRight, ShieldCheck, Lock } from "lucide-react";

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
        <div className="text-center">
            <h3 className="text-lg font-bold uppercase tracking-wider text-purple-500 mb-6">Round 2: Share Distribution</h3>

            <div className="mb-4 text-sm text-gray-400">
                <p>Status: <span className="text-white font-mono">{dkgState?.status}</span></p>
                <p>Degree: <span className="text-white font-mono">{dkgState?.polynomial_degree}</span></p>
                <p>Peers: <span className="text-white font-mono">{peers.length}</span></p>
            </div>

            {status === 'pending' && dkgState?.status === 'round2' && (
                <button
                    onClick={handleComputeAndSubmit}
                    className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all transform hover:scale-105"
                >
                    Compute & Distribute Shares
                </button>
            )}

            {status === 'computing' && <p className="text-purple-400 animate-pulse font-mono">Computing Polynomials & Encrypting...</p>}

            {(status === 'submitted' || dkgState?.status === 'completed' || dkgState?.allRound2Done) && finalStatus !== 'done' && (
                <div className="mt-8 animate-slideUp">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-white/5">
                        <div className="text-left">
                            <h4 className="text-blue-300 font-bold mb-1">Finalize Calculation</h4>
                            <p className="text-gray-400 text-xs">
                                {dkgState?.status === 'completed' || dkgState?.allRound2Done
                                    ? "All authorities submitted. Safe to compute."
                                    : "Warning: Calculate only after ALL authorities have submitted."}
                            </p>
                        </div>
                        <button
                            onClick={handleCalculateSecret}
                            disabled={!dkgState?.allRound2Done && dkgState?.status !== 'completed'}
                            className={`px-6 py-3 font-bold rounded-xl shadow-lg transition-all transform ${dkgState?.status === 'completed' || dkgState?.allRound2Done
                                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 hover:scale-105"
                                : "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50 border border-white/5"
                                }`}
                        >
                            Calculate My Secret
                        </button>
                    </div>
                </div>
            )}

            {dkgState?.status === 'round2' && status === 'pending' && (
                <div className="mt-8 text-xs text-gray-500">
                    <p>Tip: Ensure you have at least 1 peer before computing.</p>
                </div>
            )}

            {finalStatus === 'done' && (
                <div className="mt-6 bg-blue-500/10 p-6 rounded-xl border border-blue-500/20 inline-block">
                    <p className="text-blue-400 font-bold text-xl">Secret Calculated & Stored</p>
                    <p className="text-gray-400 text-sm mt-2">Your share is encrypted and saved securely.</p>
                </div>
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
