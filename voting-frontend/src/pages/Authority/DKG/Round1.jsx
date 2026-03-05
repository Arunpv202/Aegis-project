import { useState, useEffect } from 'react';
import { ristretto255, ed25519 } from '@noble/curves/ed25519.js';
import CryptoJS from "crypto-js";
import useAuthStore from '../../../store/useAuthStore';
import { initDB } from '../../../utils/zkStorage';
import { motion } from 'framer-motion';
import { Shield, Fingerprint, Lock, CheckCircle2, Server, Key } from 'lucide-react';

// Helper for hex conversion
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Round1({ electionId, dkgState, refresh }) {
    const [status, setStatus] = useState('pending'); // pending, generating, submitted
    const [pk, setPk] = useState('');

    // Access store values directly
    const username = useAuthStore((state) => state.username);
    const token = useAuthStore((state) => state.token); // Destructure token
    const storeElectionId = useAuthStore((state) => state.electionId);

    // Prioritize store value as per user instruction
    const activeElectionId = storeElectionId || electionId;


    const handleGenerateAndSubmit = async () => {
        setStatus('generating');
        try {
            // 1. Generate Secret Scalar
            // Ristretto255/Ed25519 seed is just 32 random bytes
            const secret = window.crypto.getRandomValues(new Uint8Array(32));

            // Compute Ristretto Public Key: PK = Secret * BasePoint
            // We interpret the random bytes as a scalar
            const secretHex = bytesToHex(secret);

            // Ed25519 Curve Order (L)
            const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

            let secretScalar = BigInt('0x' + secretHex) % CURVE_ORDER;
            if (secretScalar === 0n) secretScalar = 1n; // Ensure strictly positive

            // NOTE: We keep secretHex as the original random bytes for storage if we want exact reconstruction,
            // BUT for the math to work, we must use the reduced scalar. 
            // Better to store the reduced scalar hex to avoid confusion.
            const validSecretHex = secretScalar.toString(16).padStart(64, '0');

            const pubKeyPoint = ristretto255.Point.BASE.multiply(secretScalar);
            const pkHex = pubKeyPoint.toHex();

            // --- GENERATE SCHNORR ZKP (Proof of Knowledge of SK) ---
            // 1. Generate Random Nonce 'r'
            const rBytes = window.crypto.getRandomValues(new Uint8Array(32));
            const rScalar = BigInt('0x' + bytesToHex(rBytes)) % CURVE_ORDER;
            const R_point = ristretto255.Point.BASE.multiply(rScalar);
            const R_Hex = R_point.toHex();

            // 2. Compute Challenge c = Hash(DomSep || R || pk || electionId)
            // Backend expects: 'Voting_Schnorr_Proof_v1' || R(bytes) || PK(bytes) || ElectionID(bytes)

            const hexToBytes = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

            const tagBytes = new TextEncoder().encode('Voting_Schnorr_Proof_v1');
            const rBytesForHash = hexToBytes(R_Hex); // 32 bytes
            const pkBytesForHash = hexToBytes(pkHex); // 32 bytes
            const idBytes = new TextEncoder().encode(String(activeElectionId));

            const totalLen = tagBytes.length + rBytesForHash.length + pkBytesForHash.length + idBytes.length;
            const concatenated = new Uint8Array(totalLen);

            let offset = 0;
            concatenated.set(tagBytes, offset); offset += tagBytes.length;
            concatenated.set(rBytesForHash, offset); offset += rBytesForHash.length;
            concatenated.set(pkBytesForHash, offset); offset += pkBytesForHash.length;
            concatenated.set(idBytes, offset);

            // Using CryptoJS instead of window.crypto.subtle to support HTTP environments
            const concatenatedHex = bytesToHex(concatenated);
            const challengeHex = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(concatenatedHex)).toString(CryptoJS.enc.Hex);
            const cScalar = BigInt('0x' + challengeHex) % CURVE_ORDER;

            // 3. Compute Response s = r + c * sk
            const sScalar = (rScalar + (cScalar * secretScalar)) % CURVE_ORDER;
            const sHex = sScalar.toString(16).padStart(64, '0');

            const proof = {
                R: R_Hex,
                s: sHex
            };

            // 3. Submit PK to Backend
            const res = await fetch('/api/dkg/round1/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                //credentials: 'include',
                body: JSON.stringify({
                    election_id: activeElectionId,
                    username: username,
                    pk: pkHex,
                    proof: proof // Include ZKP
                })
            });

            if (res.ok) {
                const data = await res.json();
                console.log('Authority ID returned:', data.authority_id);
                // Optionally store it for next steps

                // 2. Store Secret Locally (After backend success)
                // Use shared initDB to ensure 'secrets' store exists
                const db = await initDB();
                // KEY CHANGE: Use composite key 'auth_' + [electionId]_[username] for distinct authority storage
                const secretKey = `auth_${activeElectionId}_${username}`;

                await db.put('secrets', {
                    storage_key: secretKey,
                    election_id: activeElectionId, // Store actual ID separately for reference
                    secret_scalar: validSecretHex, // Store the reduced scalar
                    public_key: pkHex,
                    created_at: new Date().toISOString()
                });
                console.log('Stored secret with key: after backend success', secretKey);

                setPk(pkHex);
                setStatus('submitted');
                refresh();
            } else {
                const errorData = await res.json();
                console.error('Backend Error Response:', { status: res.status, data: errorData });
                alert(`Submission failed (${res.status}): ${errorData.message}`);
                setStatus('pending');
            }
        } catch (err) {
            console.error(err);
            alert('Error in Round 1: ' + err.message);
            setStatus('pending');
        }
    };

    return (
        <div className="text-center max-w-2xl mx-auto">
            <div className="mb-8">
                <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
                    <Fingerprint size={32} />
                </div>
                <h3 className="text-2xl font-bold uppercase tracking-wider text-white mb-2">Round 1: Digital Identity</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                    To participate in the election setup, you need to create a secure digital lock and key.
                    Your <span className="text-indigo-400 font-semibold">Secret Key</span> will be generated and safely stored <strong>only on this device</strong>.
                    Your <span className="text-blue-400 font-semibold">Public Badge</span> will be sent to the network.
                </p>
            </div>

            {status === 'pending' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left">
                        <div className="bg-slate-900/50 p-4 border border-white/5 rounded-xl flex items-start space-x-3">
                            <Lock className="text-indigo-400 mt-1" size={20} />
                            <div>
                                <h4 className="text-white font-bold text-sm">Local Generation</h4>
                                <p className="text-xs text-gray-500 mt-1">Uses your browser's secure crypto engine to create random bytes.</p>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 p-4 border border-white/5 rounded-xl flex items-start space-x-3">
                            <Shield className="text-emerald-400 mt-1" size={20} />
                            <div>
                                <h4 className="text-white font-bold text-sm">Zero-Knowledge Proof</h4>
                                <p className="text-xs text-gray-500 mt-1">Mathematically proves locally that you own the key.</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerateAndSubmit}
                        className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-indigo-600/20 transform hover:scale-[1.02]"
                    >
                        <Key size={20} />
                        Generate & Submit
                    </button>
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                        <Lock size={12} />
                        <span>256-bit Ed25519 Curve Security</span>
                    </div>
                </motion.div>
            )}

            {status === 'generating' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                    <p className="text-indigo-400 font-mono text-sm animate-pulse">Running cryptography protocol...</p>
                    <div className="text-left bg-black/50 p-4 rounded-lg border border-indigo-500/20 max-w-sm mx-auto font-mono text-xs text-indigo-300">
                        <p className="opacity-75">{'>'} Generating 32 random bytes...</p>
                        <p className="opacity-75">{'>'} Mapping scalar to Ristretto255 curve...</p>
                        <p className="opacity-75">{'>'} Generating Schnorr ZKP...</p>
                        <p className="opacity-75">{'>'} Transmitting pure Public Key...</p>
                    </div>
                </motion.div>
            )}

            {status === 'submitted' && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-emerald-500/10 p-8 rounded-2xl border border-emerald-500/20 inline-block w-full">
                    <div className="flex justify-center mb-4">
                        <CheckCircle2 size={48} className="text-emerald-400" />
                    </div>
                    <h4 className="text-white font-bold text-xl mb-2">Identity Established!</h4>
                    <p className="text-emerald-400 text-sm mb-4">Your secret is securely locked on this device. Your public key was verified by the network.</p>

                    <div className="bg-black/40 rounded-lg p-3 flex items-center gap-3 text-left">
                        <Server className="text-gray-500" size={20} />
                        <div>
                            <p className="text-xs text-gray-500">Current Status</p>
                            <p className="text-sm text-gray-300">Waiting for other authorities to finish Round 1...</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
