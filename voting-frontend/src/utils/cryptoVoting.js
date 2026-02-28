import { ristretto255, ed25519 } from '@noble/curves/ed25519.js';
import { MerkleTree } from 'merkletreejs';
import SHA256 from 'crypto-js/sha256';
import { buildPoseidon } from 'circomlibjs';

/* -------------------- RISTRETTO255 HELPERS -------------------- */

// Convert BigInt/Uint8Array to Hex String (32 bytes / 64 chars)
export const toHex = (pointOrScalar) => {
    if (typeof pointOrScalar === 'string') return pointOrScalar; // Already hex?
    if (pointOrScalar instanceof Uint8Array) {
        return Buffer.from(pointOrScalar).toString('hex');
    }
    // If it's a Point from noble
    if (pointOrScalar.toHex) {
        return pointOrScalar.toHex();
    }
    return pointOrScalar.toString(16); // Fallback
};

// Generate random scalar (private key r)
export const randomScalar = () => {
    const array = new Uint8Array(32);
    (window.crypto || window.msCrypto).getRandomValues(array);
    return array;
};

/* -------------------- ELGAMAL ENCRYPTION -------------------- */
export const encryptVote = (candidates, selectedCandidateName, electionPKHex) => {
    const G = ristretto255.Point.BASE;

    let PK;
    try {
        let cleanHex = electionPKHex;
        if (cleanHex.startsWith('0x')) {
            cleanHex = cleanHex.slice(2);
        }
        PK = ristretto255.Point.fromHex(cleanHex);
    } catch (e) {
        console.error("Invalid Election PK:", electionPKHex, e);
        throw new Error("Invalid Election Public Key");
    }

    const C1 = [];
    const C2 = [];
    const randomness = [];
    const votes = [];

    // FIXED CANDIDATES: 10 (Matches Circuit)
    const MAX_CANDIDATES = 10;

    for (let i = 0; i < MAX_CANDIDATES; i++) {
        let v_val = 0n;

        // If real candidate
        if (i < candidates.length) {
            const candidate = candidates[i];
            const isSelected = candidate.candidate_name === selectedCandidateName;
            v_val = isSelected ? 1n : 0n;
        }
        // Else dummy candidate (v=0)

        votes.push(Number(v_val));

        const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
        const r_bytes = randomScalar();
        // Convert Uint8Array to BigInt and MODULO Curve Order
        let r_bigint = BigInt("0x" + Buffer.from(r_bytes).toString('hex')) % CURVE_ORDER;

        // Ensure strictly positive
        if (r_bigint === 0n) r_bigint = 1n;

        randomness.push(r_bigint.toString());

        const c1_point = G.multiply(r_bigint);
        const term1 = PK.multiply(r_bigint);

        let term2;
        if (v_val === 0n) {
            term2 = ristretto255.Point.ZERO;
        } else {
            term2 = G;
        }

        const c2_point = term1.add(term2);

        C1.push(c1_point.toHex());
        C2.push(c2_point.toHex());
    }

    return {
        encryptedVote: { c1: C1, c2: C2 },
        randomness,
        votes
    };
};


// Reconstruct Merkle Tree Locally (Poseidon)
export const getMerkleProof = async (commitments, myCommitment) => {
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();

    // 1. Prepare Leaves (BigInts)
    let levels = [];
    let currentLevel = commitments.map(c => {
        const s = c.toString();
        // If strict hex (contains a-f) and no 0x prefix, add it
        if (!s.startsWith("0x") && /[a-fA-F]/.test(s)) {
            return BigInt("0x" + s);
        }
        return BigInt(s);
    });
    // Note: Commitments come from backend ALREADY sorted lexicographically (String sort).
    // Backend: .sort() on strings.
    // If we sort BigInts here, we break the order (e.g. "10" < "2" in string, but 2 < 10 in BigInt).
    // So we MUST PRESERVE the order from backend.

    // currentLevel.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); // REMOVED to match backend order

    levels.push(currentLevel);

    // 2. Build Tree (Fixed Depth 20)
    const MAX_LEVELS = 20;

    while (levels.length <= MAX_LEVELS) {
        const currentLevel = levels[levels.length - 1];
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : BigInt(0); // Pad 0

            const hash = poseidon([left, right]);
            nextLevel.push(BigInt(poseidon.F.toString(hash)));
        }
        levels.push(nextLevel);
    }

    const root = "0x" + levels[MAX_LEVELS][0].toString(16);

    // 3. Generate Witness
    const commBig = BigInt(myCommitment);
    let idx = levels[0].findIndex(c => c === commBig);

    if (idx === -1) {
        throw new Error("My commitment not found in the list!");
    }

    const pathElements = [];
    const pathIndices = [];

    for (let i = 0; i < levels.length - 1; i++) {
        const isRightNode = idx % 2 === 1;
        const siblingIdx = isRightNode ? idx - 1 : idx + 1;

        let sibling = BigInt(0);
        if (siblingIdx < levels[i].length) {
            sibling = levels[i][siblingIdx];
        }

        pathElements.push(sibling.toString()); // Decimal string for snarkjs
        pathIndices.push(isRightNode ? 1 : 0);

        idx = Math.floor(idx / 2);
    }

    return {
        pathElements,
        pathIndices,
        root // Hex root for comparison
    };
};

// Helper to Map String -> BigInt (Field Element)
// We use SHA256 to hash the string, then BigInt.
// Circuit inputs are usually 254-bit fields. SHA256 is 256 bits.
// We must mask or modulo to fit Field?
// Field size ~2.18e77. 256 bits is ~1.15e77.
// Actually BN128 Scalar Field (r) is ~2.18e77.
// SHA256 output (256 bits) usually fits or slightly overflows.
// We should take modulo or shift.
// Poseidon inputs in circomlibjs usually handle BigInts.
// Safer: Modulo SNARK_FIELD_SIZE.
// Futhark/CircomLib defines F.
export const stringToField = async (str) => {
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();

    // Hash string to hex
    const hashHexString = SHA256(str).toString();
    const bigIntVal = BigInt("0x" + hashHexString);

    // Modulo Field Size (F.p)
    return bigIntVal % poseidon.F.p;
};

// Generate Commitment: Poseidon(secret)
export const generateCommitment = async (secret) => {
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();

    // 1. Convert Inputs to Field Elements
    // Secret is likely BigInt strings or Hex. Ensure they are BigInts.
    let sBig = BigInt(secret.startsWith("0x") ? secret : "0x" + secret);

    // Modulo check just in case
    sBig = sBig % poseidon.F.p;

    // 2. Poseidon Hash
    const hash = poseidon([sBig]);

    // 3. Return as Decimal String (for ZK inputs) or Hex?
    return poseidon.F.toString(hash);
};

// Generate Nullifier: Poseidon(secret, electionId)
export const generateNullifier = async (secret, electionId) => {
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();

    const eIdField = await stringToField(electionId);
    let sBig = BigInt(secret.startsWith("0x") ? secret : "0x" + secret);
    sBig = sBig % poseidon.F.p;

    const hash = poseidon([sBig, eIdField]);
    return poseidon.F.toString(hash);
};

/* -------------------- CHAUM-PEDERSEN ZK PROOFS -------------------- */

// Helper: Hash Points to Scalar (Fiat-Shamir)
const hashToScalar = (values) => {
    // values is array of hex strings or BigInts
    const str = values.map(v => v.toString()).join("::");
    const hashHex = SHA256(str).toString();
    const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
    return BigInt("0x" + hashHex) % CURVE_ORDER;
};

// 1. Disjunctive Chaum-Pedersen Proof (Proves v is 0 OR 1)
// C1 = r*G, C2 = r*PK + v*G
export const proveZeroOrOne = (rStr, vVal, pkHex, c1Hex, c2Hex) => {
    const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
    const G = ristretto255.Point.BASE;

    let cleanPkHex = pkHex;
    if (cleanPkHex.startsWith('0x')) cleanPkHex = cleanPkHex.slice(2);
    const PK = ristretto255.Point.fromHex(cleanPkHex);

    const C1 = ristretto255.Point.fromHex(c1Hex);
    const C2 = ristretto255.Point.fromHex(c2Hex);

    const r = BigInt(rStr);
    const v = BigInt(vVal); // 0n or 1n

    // We generate a "Simulated" proof for the false value, and "Real" proof for true value.

    // Random scalars for simulation check
    // We need 3 randoms: w (real commitment), u, c (fake challenge)
    const w = BigInt("0x" + Buffer.from(randomScalar()).toString('hex')) % CURVE_ORDER;
    const u = BigInt("0x" + Buffer.from(randomScalar()).toString('hex')) % CURVE_ORDER;
    const c_fake = BigInt("0x" + Buffer.from(randomScalar()).toString('hex')) % CURVE_ORDER;

    let A0, B0, A1, B1, c0, c1, r0, r1;

    if (v === 1n) {
        // Real Value is 1. Fake Value is 0.
        // Simulate Proof for v=0 (Fake)
        // c0 is fake challenge. r0 is fake response (u).
        // Verification Eq for 0: 
        // A0 = r0*G - c0*C1
        // B0 = r0*PK - c0*C2 (since v=0 implies C2 = r*PK)

        A0 = G.multiply(u).subtract(C1.multiply(c_fake));
        B0 = PK.multiply(u).subtract(C2.multiply(c_fake));

        c0 = c_fake;
        r0 = u;

        // Commit for v=1 (Real)
        // A1 = w*G
        // B1 = w*PK
        A1 = G.multiply(w);
        B1 = PK.multiply(w);

        // Challenge Calculation
        const c_total = hashToScalar([PK.toHex(), C1.toHex(), C2.toHex(), A0.toHex(), B0.toHex(), A1.toHex(), B1.toHex()]);

        // Real Challenge: c1 = c_total - c0
        c1 = (c_total - c0) % CURVE_ORDER;
        if (c1 < 0n) c1 += CURVE_ORDER;

        // Response for v=1: r1 = w + c1*r
        r1 = (w + c1 * r) % CURVE_ORDER;

    } else {
        // Real Value is 0. Fake Value is 1.
        // Simulate Proof for v=1 (Fake)
        // Verification Eq for 1:
        // A1 = r1*G - c1*C1
        // B1 = r1*PK - c1*(C2 - G)

        const C2_minus_G = C2.subtract(G);
        A1 = G.multiply(u).subtract(C1.multiply(c_fake));
        B1 = PK.multiply(u).subtract(C2_minus_G.multiply(c_fake));

        c1 = c_fake;
        r1 = u;

        // Commit for v=0 (Real)
        // A0 = w*G
        // B0 = w*PK
        A0 = G.multiply(w);
        B0 = PK.multiply(w);

        // Challenge Calculation
        const c_total = hashToScalar([PK.toHex(), C1.toHex(), C2.toHex(), A0.toHex(), B0.toHex(), A1.toHex(), B1.toHex()]);

        // Real Challenge: c0 = c_total - c1
        c0 = (c_total - c1) % CURVE_ORDER;
        if (c0 < 0n) c0 += CURVE_ORDER;

        // Response for v=0: r0 = w + c0*r
        r0 = (w + c0 * r) % CURVE_ORDER;
    }

    return {
        a0: A0.toHex(), b0: B0.toHex(),
        a1: A1.toHex(), b1: B1.toHex(),
        c0: c0.toString(), c1: c1.toString(),
        r0: r0.toString(), r1: r1.toString()
    };
};

// 2. Sum Proof (Chaum-Pedersen for Sum=1)
// We sum all r's -> R_total. Sum all votes -> 1.
// Proves that Sum(C1) = R_total*G AND Sum(C2) = R_total*PK + 1*G
// Essentially proves Decrypt(SumC) == 1
export const proveSumOfOne = (totalRStr, pkHex, sumC1Hex, sumC2Hex) => {
    const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
    const G = ristretto255.Point.BASE;

    let cleanPkHex = pkHex;
    if (cleanPkHex.startsWith('0x')) cleanPkHex = cleanPkHex.slice(2);
    const PK = ristretto255.Point.fromHex(cleanPkHex);

    const SumC1 = ristretto255.Point.fromHex(sumC1Hex);
    const SumC2 = ristretto255.Point.fromHex(sumC2Hex);
    const TotalR = BigInt(totalRStr);

    // We claim: SumC2 - G = TotalR * PK
    // And SumC1 = TotalR * G
    // Standard Chaum Pedersen for Log Equality
    const M_G = SumC2.subtract(G); // (SumC2 - G)

    // Commitment
    const w = BigInt("0x" + Buffer.from(randomScalar()).toString('hex')) % CURVE_ORDER;
    const A = G.multiply(w);
    const B = PK.multiply(w);

    // Challenge
    const c = hashToScalar([PK.toHex(), SumC1.toHex(), M_G.toHex(), A.toHex(), B.toHex()]);

    // Response
    const r_resp = (w + c * TotalR) % CURVE_ORDER;

    return {
        a: A.toHex(),
        b: B.toHex(),
        c: c.toString(),
        r: r_resp.toString()
    };
};

/* -------------------- DECRYPTION PROOFS -------------------- */
// Proves: log_G(Y) == log_C1(D) == x
// Y = Public Share, D = Decrypted Share, x = Secret Share
export const proveDecryptionShare = (xStr, yHex, c1Hex, dHex) => {
    const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
    const G = ristretto255.Point.BASE;
    const Y = ristretto255.Point.fromHex(yHex);
    const C1 = ristretto255.Point.fromHex(c1Hex);
    const D = ristretto255.Point.fromHex(dHex);
    const x = BigInt(xStr); // Secret

    // Commitment
    const w = BigInt("0x" + Buffer.from(randomScalar()).toString('hex')) % CURVE_ORDER;
    const A = G.multiply(w);  // A = w*G
    const B = C1.multiply(w); // B = w*C1

    // Challenge
    // Hash(Y, C1, D, A, B)
    const c = hashToScalar([Y.toHex(), C1.toHex(), D.toHex(), A.toHex(), B.toHex()]);

    // Response
    // r = w + c*x
    const r = (w + c * x) % CURVE_ORDER;

    return {
        a: A.toHex(),
        b: B.toHex(),
        c: c.toString(),
        r: r.toString()
    };
};
