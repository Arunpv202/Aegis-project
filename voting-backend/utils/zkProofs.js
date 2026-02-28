const { ristretto255 } = require('@noble/curves/ed25519.js');
const crypto = require('crypto');

// SHA256 Helper (Node Crypto)
const sha256 = (str) => {
    return crypto.createHash('sha256').update(str).digest('hex');
};

const hashToScalar = (values) => {
    const str = values.join("::");
    const hashHex = sha256(str);
    const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
    return BigInt("0x" + hashHex) % CURVE_ORDER;
};

// 1. Verify ZeroOrOne (Disjunctive CP)
const verifyZeroOrOne = (proof, pkHex, c1Hex, c2Hex) => {
    try {
        const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
        const G = ristretto255.Point.BASE;

        const cleanHex = (hex) => hex.startsWith('0x') ? hex.slice(2) : hex;

        const PK = ristretto255.Point.fromHex(cleanHex(pkHex));
        const C1 = ristretto255.Point.fromHex(cleanHex(c1Hex));
        const C2 = ristretto255.Point.fromHex(cleanHex(c2Hex));

        const A0 = ristretto255.Point.fromHex(proof.a0);
        const B0 = ristretto255.Point.fromHex(proof.b0);
        const A1 = ristretto255.Point.fromHex(proof.a1);
        const B1 = ristretto255.Point.fromHex(proof.b1);

        const c0 = BigInt(proof.c0);
        const c1 = BigInt(proof.c1);
        const r0 = BigInt(proof.r0);
        const r1 = BigInt(proof.r1);

        // 1. Verify Challenge consistency
        // c_total = Hash(...)
        const hashInputs = [PK.toHex(), C1.toHex(), C2.toHex(), A0.toHex(), B0.toHex(), A1.toHex(), B1.toHex()];
        console.log("[ZK Debug] Hash Inputs:", hashInputs);

        const c_total_calc = hashToScalar(hashInputs);
        const c_sum = (c0 + c1) % CURVE_ORDER;

        console.log(`[ZK Debug] c_total_calc: ${c_total_calc}`);
        console.log(`[ZK Debug] c_sum (c0+c1): ${c_sum}`);
        console.log(`[ZK Debug] c0: ${c0}`);
        console.log(`[ZK Debug] c1: ${c1}`);

        if (c_total_calc !== c_sum) {
            console.error("ZeroOrOne: Challenge Sum Mismatch");
            console.error(`Expected: ${c_total_calc}, Got: ${c_sum}`);
            return false;
        }

        // 2. Verify 0-branch
        // A0 = r0*G - c0*C1  => r0*G = A0 + c0*C1
        const checkA0 = G.multiply(r0).equals(A0.add(C1.multiply(c0)));
        // B0 = r0*PK - c0*C2 => r0*PK = B0 + c0*C2
        const checkB0 = PK.multiply(r0).equals(B0.add(C2.multiply(c0)));

        if (!checkA0 || !checkB0) {
            console.error("ZeroOrOne: 0-branch verification failed");
            return false;
        }

        // 3. Verify 1-branch (C2 - G)
        // A1 = r1*G - c1*C1 => r1*G = A1 + c1*C1
        const checkA1 = G.multiply(r1).equals(A1.add(C1.multiply(c1)));
        // B1 = r1*PK - c1*(C2-G) => r1*PK = B1 + c1*(C2-G)
        const C2_minus_G = C2.subtract(G);
        const checkB1 = PK.multiply(r1).equals(B1.add(C2_minus_G.multiply(c1)));

        if (!checkA1 || !checkB1) {
            console.error("ZeroOrOne: 1-branch verification failed");
            return false;
        }

        return true;

    } catch (e) {
        console.error("VerifyZeroOrOne Exception:", e);
        return false;
    }
};

// 2. Verify SumOfOne
const verifySumOfOne = (proof, pkHex, sumC1Hex, sumC2Hex) => {
    try {
        const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
        const G = ristretto255.Point.BASE;

        const cleanHex = (hex) => hex.startsWith('0x') ? hex.slice(2) : hex;

        const PK = ristretto255.Point.fromHex(cleanHex(pkHex));
        const SumC1 = ristretto255.Point.fromHex(cleanHex(sumC1Hex));
        const SumC2 = ristretto255.Point.fromHex(cleanHex(sumC2Hex));

        const A = ristretto255.Point.fromHex(proof.a);
        const B = ristretto255.Point.fromHex(proof.b);
        const c = BigInt(proof.c);
        const r = BigInt(proof.r);

        const M_G = SumC2.subtract(G);

        // Check 1: r*G = A + c*SumC1
        const checkA = G.multiply(r).equals(A.add(SumC1.multiply(c)));

        // Check 2: r*PK = B + c*(SumC2 - G)
        const checkB = PK.multiply(r).equals(B.add(M_G.multiply(c)));

        // Verify Challenge Hash match (Optional but strict)
        const c_calc = hashToScalar([PK.toHex(), SumC1.toHex(), M_G.toHex(), A.toHex(), B.toHex()]);
        if (c_calc !== c) {
            console.error("SumOfOne: Challenge Hash Mismatch");
            return false;
        }

        return checkA && checkB;

    } catch (e) {
        console.error("VerifySumOfOne Exception:", e);
        return false;
    }
};

// 3. Verify Decryption Share (Chaum-Pedersen)
// Proves: log_G(PublicShare) == log_C1(DecryptedShare)
const verifyDecryptionShare = (proof, publicShareHex, ciphertextC1Hex, decryptionShareHex) => {
    try {
        const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
        const G = ristretto255.Point.BASE;

        const Y = ristretto255.Point.fromHex(publicShareHex); // Authority's Public Key/Share
        const C1 = ristretto255.Point.fromHex(ciphertextC1Hex);
        const D = ristretto255.Point.fromHex(decryptionShareHex); // The Share submitted

        const A = ristretto255.Point.fromHex(proof.a);
        const B = ristretto255.Point.fromHex(proof.b);
        const c = BigInt(proof.c);
        const r = BigInt(proof.r);

        // Check 1: r*G = A + c*Y
        const checkA = G.multiply(r).equals(A.add(Y.multiply(c)));

        // Check 2: r*C1 = B + c*D
        const checkB = C1.multiply(r).equals(B.add(D.multiply(c)));

        // Check Challenge Hash
        const hashInputs = [Y.toHex(), C1.toHex(), D.toHex(), A.toHex(), B.toHex()];
        const c_calc = hashToScalar(hashInputs);

        if (c_calc !== c) {
            console.error("DecryptionShare: Challenge Hash Mismatch");
            return false;
        }

        if (!checkA || !checkB) {
            console.error("DecryptionShare: Verification Equation Failed", { checkA, checkB });
            return false;
        }

        return true;

    } catch (e) {
        console.error("VerifyDecryptionShare Exception:", e);
        return false;
    }
};

module.exports = {
    verifyZeroOrOne,
    verifySumOfOne,
    verifyDecryptionShare
};
