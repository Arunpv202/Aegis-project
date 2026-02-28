import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MerkleTree } from "merkletreejs";
import { motion } from "framer-motion";
import SHA256 from "crypto-js/sha256";
import {
  ArrowLeft,
  ShieldCheck,
  UserSquare2,
  ScanFace,
  ArrowRight,
  Info
} from "lucide-react";
import useAuthStore from "../../store/useAuthStore";

export default function EnterElection() {
  const navigate = useNavigate();
  const [electionIdInput, setElectionIdInput] = useState("");

  const setElectionId = useAuthStore(state => state.setElectionId);
  const setMerkleRoot = useAuthStore(state => state.setMerkleRoot);

  /* -------------------- MERKLE HELPERS -------------------- */
  // We use the exact same library and logic as backend to ensure matching roots
  // Backend: utils/merkleTree.js -> new MerkleTree(leaves, SHA256)

  const buildMerkleRoot = async (commitments) => {
    if (!commitments.length) {
      throw new Error("No commitments received");
    }

    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();

    // 1. Prepare Leaves (BigInts)
    // Backend sorts: .sort() of strings usually
    // We must match backend sort exactly.
    const ordered = [...commitments].sort();

    let currentLevel = ordered.map(c => BigInt(c));

    // 2. Build Tree
    // 2. Build Tree (Fixed Depth: 20 levels to match backend)
    const MAX_LEVELS = 20;

    for (let level = 0; level < MAX_LEVELS; level++) {
      const nextLevel = [];
      // If currentLevel is empty (should not happen if check above passes, but safe coding)
      // If we have remaining nodes, process them pairs
      // If we have 1 node, we hash with 0

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : BigInt(0); // Pad with 0

        const hash = poseidon([left, right]);
        nextLevel.push(BigInt(poseidon.F.toString(hash)));
      }

      // If we are not at MAX_LEVELS yet, we MUST continue up. 
      // Even if nextLevel has 1 item, it needs to be hashed with 0 in the NEXT iteration 
      // UNLESS we are simply replacing the levels array.
      // Wait, backend logic:
      // while (this.levels.length <= MAX_LEVELS) ... 
      // It pushes nextLevel. 
      // So if nextLevel has 1 element, in next iter it becomes `left`, right is `0`.

      currentLevel = nextLevel;
    }

    // Root as Hex String (0x prefix)
    // After 20 iterations, currentLevel should have 1 element if we started with < 2^20 elements
    const rootBig = currentLevel.length > 0 ? currentLevel[0] : BigInt(0);
    return "0x" + rootBig.toString(16);
  };

  /* -------------------- API -------------------- */

  const fetchElectionData = async (electionId) => {
    console.log("[Client] Fetching election data:", electionId);

    const res = await fetch(`/api/elections/${electionId}/commitments`);
    const data = await res.json();

    if (!data.success) {
      console.error("[Client] Backend error:", data);
      throw new Error("Election fetch failed");
    }

    console.log("[Client] Backend Merkle Root:", data.merkle_root);
    console.log("[Client] Commitments count:", data.commitments.length);

    return data;
  };

  /* -------------------- MAIN FLOW -------------------- */

  const handleProceed = async () => {
    try {
      if (!electionIdInput.trim()) {
        alert("Election ID required");
        return;
      }

      console.log("========== ENTER ELECTION ==========");
      console.log("[Flow] Election ID:", electionIdInput);

      // 1️⃣ Fetch election data
      const { commitments, merkle_root: backendRoot } =
        await fetchElectionData(electionIdInput);

      // 2️⃣ Build client Merkle root
      const clientRoot = await buildMerkleRoot(commitments);

      console.log("[Flow] Client Merkle Root:", clientRoot);

      // 3️⃣ Consistency check 🔥
      if (clientRoot !== backendRoot) {
        console.error("[SECURITY] Merkle root mismatch!");
        alert("Election data verification failed.");
        return;
      }

      console.log("[Flow] Merkle root verified");

      // 4️⃣ Store verified data
      setElectionId(electionIdInput);
      setMerkleRoot(clientRoot);

      console.log("[Flow] Stored electionId & merkleRoot");
      console.log("===================================");

      // 5️⃣ Proceed
      navigate("/user/face-verification");

    } catch (err) {
      console.error("[Flow] Enter election failed:", err);
      alert("Failed to verify election. Check console.");
    }
  };

  /* -------------------- UI (UNCHANGED) -------------------- */

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <button
          onClick={() => navigate("/user/existing-elections")}
          className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-all group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Registry</span>
        </button>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 p-8 md:p-10 rounded-[2.5rem] shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />

          <div className="text-center mb-10">
            <div className="inline-flex p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-6 border border-indigo-500/20 shadow-[0_0_20px_rgba(79,70,229,0.1)]">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-3">
              Voter Clearance
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed px-2">
              Please enter the Election ID to initiate the biometric verification sequence.
            </p>
          </div>

          <div className="space-y-6">
            <div className="group">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
                Election ID
              </label>
              <div className="relative">
                <UserSquare2
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors"
                  size={20}
                />
                <input
                  type="text"
                  value={electionIdInput}
                  onChange={(e) => setElectionIdInput(e.target.value)}
                  placeholder="Enter Election ID"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-700 font-bold tracking-wider"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl items-center">
            <Info size={18} className="text-indigo-400 shrink-0" />
            <p className="text-[11px] text-gray-400 leading-snug">
              Your ID will be cross-referenced with the encrypted ledger before opening the camera.
            </p>
          </div>

          <button
            onClick={handleProceed}
            className="w-full mt-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
          >
            <ScanFace size={20} />
            <span>Proceed to Face Scan</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="mt-8 flex justify-center items-center gap-2 text-gray-600">
          <div className="h-px w-8 bg-white/5" />
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold">
            Protocol: Secure-Entry-v2
          </p>
          <div className="h-px w-8 bg-white/5" />
        </div>
      </motion.div>
    </div>
  );
}
