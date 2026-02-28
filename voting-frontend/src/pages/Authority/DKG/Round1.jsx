import { useState, useEffect } from 'react';
import { ristretto255, ed25519 } from '@noble/curves/ed25519.js';
import CryptoJS from "crypto-js";
import useAuthStore from '../../../store/useAuthStore';
import { initDB } from '../../../utils/zkStorage';




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
        <div className="text-center">
            <h3 className="text-lg font-bold uppercase tracking-wider text-indigo-500 mb-6">Round 1: Public Key Commitment</h3>



            {status === 'pending' && (
                <button
                    onClick={handleGenerateAndSubmit}
                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                    Generate & Submit Public Key
                </button>
            )}

            {status === 'generating' && <p className="text-indigo-400 animate-pulse">Generating Cryptographic Material...</p>}

            {status === 'submitted' && (
                <div className="bg-emerald-500/10 p-6 rounded-xl border border-emerald-500/20 inline-block">
                    <p className="text-emerald-400 font-bold mb-2">Public Key Submitted Successfully!</p>
                    <p className="text-sm text-gray-400 mt-4">Waiting for other authorities to finish...</p>
                </div>
            )}
        </div>
    );
}
