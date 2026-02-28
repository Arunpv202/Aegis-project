const { MerkleTree } = require('merkletreejs');
const { buildPoseidon } = require('circomlibjs');

let poseidon;

class MerkleTreeService {
    constructor(commitments = []) {
        this.commitments = commitments;
        this.tree = null;
    }

    async init() {
        if (!poseidon) {
            poseidon = await buildPoseidon();
        }

        // Poseidon Hash Function for Merkle Tree (2 children)
        // Circuit uses Poseidon(2) for tree, so inputs must be array of 2
        // merkletreejs passes (left, right) -> we return hash
        const hashFn = (val) => {
            // merkletreejs might pass Buffer or string data.
            // ZK commitments are BigInts (strings in JS usually).
            // We need to ensure we parse them correctly.
            // If val is a leaf (commitment), it's a BigInt string.
            // If it's a node, it's a BigInt (poseidon result).

            // Standardizing inputs to BigInt
            // Note: merkletreejs concatenates buffers for standard hashers.
            // For custom function, it passes data.
            // We'll see... usually it's cleaner to handle ourselves or pass custom `hashLeaves: false`.
            return poseidon.F.toString(poseidon(val)); // NO. This is wrong signature for merkletreejs.
        };

        // Actually, let's implement a simple Merkle logic or configure merkletreejs carefully.
        // For ZK, usually we use a specific "incremental" tree or a fixed logic.
        // vote.circom logic:
        // currentHash[i+1] <== Poseidon([currentHash[i], pathElements[i]]) (depending on index)
        // This implies Standard Merkle Tree where Parent = Poseidon([Left, Right]).

        this.hasher = (left, right) => {
            if (!left || !right) return left || right; // Handle odd leaves? Or fill with 0?
            // ZK usually fills with 0.
            // Circuit: if odd, structure matters. Fixed levels usually.
            // Simple generic tree:
            // Input: BigInts.
            const l = BigInt(left);
            const r = BigInt(right);
            return poseidon.F.toString(poseidon([l, r]));
        };

        // Prepare leaves
        // Commitments are hex or digit strings.
        const leaves = this.commitments.map(c => BigInt(c));

        // We use a simplified tree construction since merkletreejs + poseidon async is tricky (constructor is sync).
        // WE MUST BUILD IT MANUALLY or use sync valid inputs.
        // Since `init()` is async, we can build it here.

        // Manual Simple Construction (matches `merkletreejs` default structure usually)
        // But for ZK verify, we need the PATH.
        // `merkletreejs` is good for path.
        // Let's use `merkletreejs` with custom hash.

        // Hashing function for lib
        const poseidonHash = (data) => {
            // Data might be inputs?
            // merkletreejs concat logic: Buffer.concat([left, right]) -> hash(concat)
            // We override `duplicateLeaves`, `sort`, `hashLeaves`.

            // Wait, passing custom function:
            // new MerkleTree(leaves, hashFn, options)
            // hashFn takes (data).
            // If we use `concatenator` option?
            return poseidon.F.toString(poseidon(data)); // Assumes data is [L, R] array? No.
        };

        // WORKAROUND: merkletreejs is hard to adapt to ZK Poseidon (BigInts) easily without buffer mess.
        // Better to use `fixed-merkle-tree` or simple recursion if small.
        // Or specific `hashLeaves: false`, `sort: false`, `isBitcoinTree: false`.
        // And `hashFn` receiving Buffer -> parse -> BigInt -> Poseidon -> Buffer?
        // Too slow/complex.

        // Let's assume standard "mimc-merkle" style is okay?
        // Or just implement `getProof` manually if list is small?
        // For <1000 voters, manual is instant.

        this.leaves = leaves;
        // ... proceeding with manual implementation for reliability ...
    }

    // RE-IMPLEMENTING simple array-based tree for clarity and ZK match
    async build() {
        if (!poseidon) poseidon = await buildPoseidon();
        this.levels = [];

        // Standardize leaves to BigInt Strings
        let currentLevel = this.commitments.map(c => BigInt(c));
        this.levels.push(currentLevel);

        // FIXED DEPTH: 20
        const MAX_LEVELS = 20;

        // Build up to Root (Level 20)
        // If we run out of elements, we hash with 0 (Zero Node)
        // Ideally we should precompute Zero Hashes (Sparse Tree), but for efficiency we can computing them on fly or just hash(0, 0)

        while (this.levels.length <= MAX_LEVELS) {
            const currentLevel = this.levels[this.levels.length - 1];
            const nextLevel = [];

            // If current level is empty (impossible if we started with leaves), handled by loop
            // If current level has 1 item, we still hash it with 0 to go up

            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : BigInt(0);

                const hash = poseidon([left, right]);
                nextLevel.push(BigInt(poseidon.F.toString(hash)));
            }

            // If level was odd, we processed all. 
            // Now, if we haven't reached MAX_LEVELS, the next level might need to be filled/hashed further?
            // Actually, in a sparse tree, you only hash the active path.
            // But here we are building the full effective tree for the populated part.
            // Wait, if we have 1 node at level 3, and we need to go to level 20.
            // Level 4 Node = Hash(Level3Node, ZeroHash_L3).
            // Level 5 Node = Hash(Level4Node, ZeroHash_L4)... etc.

            // So if nextLevel has 1 elements, we must continue.
            // Even if it has 1 element, we treat it as Left and Right is 0-subtree-root?
            // Using BigInt(0) as naive default for empty branches.
            // Standard sparse tree uses precomputed zeros. 
            // For simplicitly here, we stick to "0" as the empty value.

            // Exception: If currentLevel has 1 element, nextLevel will have 1 element (Hash(L, 0)).
            // We repeat until levels.length == MAX_LEVELS + 1.

            this.levels.push(nextLevel);
        }

        // The Root is the single element at the top level
        this.root = this.levels[MAX_LEVELS][0];
    }

    getRoot() {
        return "0x" + BigInt(this.root).toString(16);
    }

    getProof(commitment) {
        // Find index
        const commBig = BigInt(commitment);
        let idx = this.levels[0].findIndex(c => c === commBig);
        if (idx === -1) return [];

        const proof = [];
        for (let i = 0; i < this.levels.length - 1; i++) {
            const isRightNode = idx % 2 === 1;
            const siblingIdx = isRightNode ? idx - 1 : idx + 1;

            // Get sibling (or 0 if out of bounds)
            let sibling = BigInt(0);
            if (siblingIdx < this.levels[i].length) {
                sibling = this.levels[i][siblingIdx];
            }

            proof.push({
                data: "0x" + sibling.toString(16),
                position: isRightNode ? 'left' : 'right' // Circuit expects "pathElement" (value) + "pathIndices" (0 or 1 selector)
                // VoteCircuit:
                // L <== current; R <== proof; sel <== index;
                // if sel=0 (Left): OutL = L, OutR = R -> Hash(L, R)
                // if sel=1 (Right): OutL = R, OutR = L -> Hash(R, L) -> This swaps them!
                // So if we are at idx 4 (Even, Left), we need Right Sibling. sel=0.
                // If we are at idx 5 (Odd, Right), we need Left Sibling. sel=1.
            });

            idx = Math.floor(idx / 2);
        }
        return proof;
    }
}

module.exports = MerkleTreeService;
