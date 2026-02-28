import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  User,
  Flag,
  ArrowRight,
  ShieldCheck,
  Trophy,
  Loader2,
  KeyRound,
  X,
  ArrowLeft
} from "lucide-react";
import axios from "axios";
import * as snarkjs from "snarkjs";
import CryptoJS from "crypto-js";
import { ethers } from "ethers";
import { saveVoteHash } from "../../utils/voteHashStorage";

import useAuthStore from "../../store/useAuthStore";
import { getSecrets } from "../../utils/zkStorage";
import { getMerkleProof, encryptVote, generateCommitment, stringToField } from "../../utils/cryptoVoting";
import LoadingScreen from "../../components/UI/LoadingScreen";

export default function VotePage() {
  const navigate = useNavigate();
  const { election_id } = useParams();
  const { username } = useAuthStore(); // Use username instead of walletAddress

  const [voted, setVoted] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingVote, setProcessingVote] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingCandidate, setPendingCandidate] = useState(null);

  // Election Public Key (Fetched from backend)
  const [electionPK, setElectionPK] = useState(null);
  const [merkleData, setMerkleData] = useState(null);

  useEffect(() => {
    const fetchElectionData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Candidates
        const candRes = await axios.get(`/api/elections/${election_id}/candidates`);
        setCandidates(candRes.data);

        // 2. Fetch Election Details (PK)
        const electionRes = await axios.get(`/api/elections/${election_id}`);
        // Response should now include ElectionCrypto
        if (electionRes.data.ElectionCrypto && electionRes.data.ElectionCrypto.election_pk) {
          setElectionPK(electionRes.data.ElectionCrypto.election_pk);
        } else {
          console.warn("[Vote] Election Public Key NOT found in response!", electionRes.data);
          setError("Election configuration incomplete (Missing Public Key)");
        }

        // 3. Fetch Commitments & Root
        const commRes = await axios.get(`/api/elections/${election_id}/commitments`);
        setMerkleData(commRes.data); // { commitments: [], merkle_root: ... }

      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load election data.");
      } finally {
        setLoading(false);
      }
    };

    if (election_id) {
      fetchElectionData();
    }
  }, [election_id]);

  const initiateVote = (candidateName) => {
    setPendingCandidate(candidateName);
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    setShowPasswordModal(false);
    if (pendingCandidate && password) {
      await processVote(pendingCandidate, password);
    }
  };

  const processVote = async (candidateName, passwordInput) => {
    if (processingVote) return;

    try {
      setProcessingVote(true);
      setSelectedCandidate(candidateName);
      setStatusMessage("Initializing Secure Voting Environment...");

      // 1. Get User Secrets via Password Decryption
      console.log("[Vote] Step 1: Deriving Keys & Retrieving Secrets...");

      setStatusMessage("Decrypting Identity Credentials...");

      if (!username) {
        throw new Error("User session invalid. Please log in.");
      }

      // Re-derive Encryption Key
      // Must match Registration logic: username + election_id + "VOTING_APP_SCURE_SALT"
      const saltInput = `${username}-${election_id}-VOTING_APP_SCURE_SALT`;
      const encryptionKey = CryptoJS.PBKDF2(passwordInput, saltInput, {
        keySize: 256 / 32,
        iterations: 10000
      }).toString();

      // Retrieve Secrets
      const secrets = await getSecrets(election_id, encryptionKey, username);

      if (!secrets || !secrets.zkSecret) { // Check validity
        console.error("[Vote] Secrets verification failed. Invalid Password or No credentials.");
        throw new Error("Decryption failed! Wrong password or no credentials found on this device.");
      }
      console.log("[Vote] Secrets retrieved successfully.");

      // Wipe password from memory var (basic hygiene, though React state persists until GC)
      setPassword("");

      // 2. Reconstruct Merkle Tree & Witness
      console.log("[Vote] Step 2: Reconstructing Merkle Tree...");
      setStatusMessage("Reconstructing Merkle Tree...");

      // Re-calculate Commitment to find index
      const commitment = await generateCommitment(secrets.zkSecret);

      // Generate Merkle Witness
      console.log("[Vote] Generating Merkle Proof...");
      const witness = await getMerkleProof(merkleData.commitments, commitment);
      console.log("[Vote] Witness generated");

      // 3. Generate Encryption (ElGamal)
      console.log("[Vote] Step 3: Encrypting Vote...");
      setStatusMessage("Encryp ting Vote (Multi-Column ElGamal)...");

      if (!electionPK) {
        throw new Error("Election Public Key is missing. Cannot encrypt vote.");
      }

      const { encryptedVote, randomness, votes } = encryptVote(candidates, candidateName, electionPK);

      // -----------------------------------------------------------------------
      // GENERATE CHAUM-PEDERSEN PROOFS (VALIDITY)
      // -----------------------------------------------------------------------
      setStatusMessage("Generating Encryption Validity Proofs...");

      const { proveZeroOrOne, proveSumOfOne } = await import("../../utils/cryptoVoting");
      const { ristretto255 } = await import("@noble/curves/ed25519.js");

      const candidateProofs = [];
      let totalR = 0n;
      let sumC1 = ristretto255.Point.ZERO;
      let sumC2 = ristretto255.Point.ZERO;
      const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

      for (let i = 0; i < encryptedVote.c1.length; i++) {
        const rVal = randomness[i];
        const vVal = votes[i];
        const c1Hex = encryptedVote.c1[i];
        const c2Hex = encryptedVote.c2[i];

        const proof = proveZeroOrOne(rVal, vVal, electionPK, c1Hex, c2Hex);
        candidateProofs.push(proof);

        totalR = (totalR + BigInt(rVal)) % CURVE_ORDER;
        sumC1 = sumC1.add(ristretto255.Point.fromHex(c1Hex));
        sumC2 = sumC2.add(ristretto255.Point.fromHex(c2Hex));
      }

      const sumProof = proveSumOfOne(totalR.toString(), electionPK, sumC1.toHex(), sumC2.toHex());
      const validityProofs = { candidateProofs, sumProof };

      // 4. Generate Nullifier (Poseidon)
      const { generateNullifier } = await import("../../utils/cryptoVoting");
      const nullifier = await generateNullifier(secrets.zkSecret, election_id);
      console.log("[Vote] Derived Nullifier:", nullifier);

      // 5. Generate ZK Proof
      console.log("[Vote] Step 5: Generating ZK Proof...");
      setStatusMessage("Generating Zero-Knowledge Proof...");

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        {
          root: merkleData.merkle_root,
          nullifier: nullifier,
          electionId: (await stringToField(election_id)).toString(),
          C1: encryptedVote.c1.map(c => c.startsWith("0x") ? c : "0x" + c),
          C2: encryptedVote.c2.map(c => c.startsWith("0x") ? c : "0x" + c),
          secret: BigInt(secrets.zkSecret.startsWith("0x") ? secrets.zkSecret : "0x" + secrets.zkSecret),
          pathElements: witness.pathElements,
          pathIndices: witness.pathIndices,
          votes: votes,
          r: randomness
        },
        "/circuits/vote.wasm",
        "/circuits/vote_final.zkey"
      );

      // 6. Submit Vote
      setStatusMessage("Broadcasting Vote to Blockchain...");

      await axios.post(`/api/elections/${election_id}/vote`, {
        proof,
        publicSignals,
        encryptedVote: {
          c1: encryptedVote.c1,
          c2: encryptedVote.c2
        },
        nullifier: nullifier,
        validityProofs: validityProofs
      });

      // 7. Compute & store encrypted vote hash locally (mirrors backend formula)
      setStatusMessage("Securing Your Vote Receipt...");
      try {
        const combinedString = encryptedVote.c1.join('') + encryptedVote.c2.join('');
        const voteHash = ethers.keccak256(ethers.toUtf8Bytes(combinedString));
        await saveVoteHash(election_id, voteHash, nullifier);
        console.log("[Vote] Vote hash stored in IndexedDB:", voteHash);
      } catch (hashErr) {
        // Non-fatal – user can still proceed
        console.warn("[Vote] Could not store vote hash:", hashErr);
      }

      setVoted(true);
      setProcessingVote(false);

      setTimeout(() => {
        navigate("/user/existing-elections");
      }, 3000);

    } catch (err) {
      console.error("Voting failed:", err);
      const backendMsg = err.response?.data?.message || err.message || "Voting failed";
      setError(backendMsg);
      setProcessingVote(false);
      setStatusMessage("");
      // Clear password if failed
      setPassword("");
    }
  };

  if (loading) return <LoadingScreen text="Loading Ballot..." />;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Navigation Bar */}
        <div className="mb-12 flex justify-between items-center">
          <button
            onClick={() => navigate("/user/existing-elections")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-all group px-4 py-2 hover:bg-white/5 rounded-lg"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Elections</span>
          </button>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20"
          >
            <ShieldCheck size={16} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Authenticated Ballot</span>
          </motion.div>
        </div>

        {/* Header */}
        <header className="text-center mb-16 max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">Cast Your Vote</h1>
          <p className="text-gray-400 text-lg">Select one candidate below. This action performs a Zero-Knowledge Proof and is cryptographically irreversible once signed.</p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-10 max-w-2xl mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-center flex items-center justify-center gap-3">
            <ShieldCheck size={20} />
            {error}
          </div>
        )}

        {/* Candidate Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {candidates.map((candidate, index) => (
            <motion.div
              key={candidate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={!processingVote ? { y: -10, scale: 1.02 } : {}}
              className={`bg-slate-900/40 backdrop-blur-2xl border ${selectedCandidate === candidate.candidate_name ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-white/10 hover:border-indigo-500/30'} p-8 rounded-[2rem] flex flex-col items-center text-center group relative overflow-hidden shadow-2xl transition-all duration-300 ${processingVote ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="w-28 h-28 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-8 border border-white/10 group-hover:border-indigo-500/50 transition-colors shadow-inner">
                <User size={48} className="text-gray-400 group-hover:text-indigo-400 transition-colors" />
              </div>

              <div className="mb-8 w-full">
                <h3 className="text-2xl font-bold mb-2 text-white truncate px-2">{candidate.candidate_name}</h3>
                <div className="flex items-center justify-center gap-2 text-indigo-400 font-medium bg-indigo-500/5 py-1 px-3 rounded-full w-fit mx-auto border border-indigo-500/10">
                  <Flag size={12} />
                  <span className="text-[10px] uppercase tracking-widest">Official Candidate</span>
                </div>
              </div>

              <div className="text-5xl mb-8 p-6 bg-black/20 rounded-2xl border border-white/5 w-full font-serif text-white/90">
                {candidate.symbol_name}
              </div>

              <button
                onClick={() => initiateVote(candidate.candidate_name)}
                disabled={processingVote}
                className="w-full py-4 bg-white/5 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group-hover:bg-indigo-600 border border-white/5 hover:border-transparent"
              >
                <span>Vote for Candidate</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          ))}
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
                <button onClick={() => setShowPasswordModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                  <X size={24} />
                </button>

                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                    <KeyRound size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Confirm Identity</h3>
                  <p className="text-gray-400 text-sm">Enter your encryption password to authorize this vote. This decrypts your ZK-proof credentials locally.</p>
                </div>

                <div className="mb-8 relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                  <input
                    type="password"
                    autoFocus
                    className="w-full bg-black/40 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-lg"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                  />
                </div>

                <button
                  onClick={handlePasswordSubmit}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20 text-lg flex items-center justify-center gap-2"
                >
                  <span>Sign & Vote</span>
                  <ShieldCheck size={20} />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Processing/Success Modal */}
        <AnimatePresence>
          {(processingVote || voted) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-900 border border-indigo-500/30 p-12 rounded-[3rem] max-w-sm w-full text-center shadow-[0_0_50px_rgba(79,70,229,0.15)] relative overflow-hidden"
              >
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-500/5 blur-3xl pointer-events-none" />

                {voted ? (
                  <>
                    <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-3xl font-black mb-3 text-white">Vote Cast!</h2>
                    <p className="text-gray-400 mb-8 leading-relaxed">Your private proof has been verified and your encrypted vote stored on the blockchain.</p>
                    <div className="flex items-center justify-center gap-3 text-sm text-indigo-300 font-mono animate-pulse bg-indigo-900/30 py-2 px-4 rounded-full w-fit mx-auto">
                      <Trophy size={16} /> Redirecting to Elections...
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-8 border border-indigo-500/30 relative">
                      <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin"></div>
                      <Loader2 size={40} className="animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-white">Processing Vote</h2>
                    <p className="text-indigo-300 font-mono text-xs bg-indigo-900/30 py-2 px-4 rounded-lg inline-block">{statusMessage}</p>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}