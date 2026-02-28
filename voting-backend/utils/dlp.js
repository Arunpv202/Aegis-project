const { ristretto255 } = require('@noble/curves/ed25519.js');

/**
 * Solves M = v * G for v (Discrete Logarithm)
 * Since v is the vote count, it is relatively small (bounded by # of voters).
 * We use Baby-step Giant-step or just simple brute force if range is small enough.
 * For N < 100,000, brute force is instant.
 * For safe measure, we implement BSGS.
 */
class DLPSolver {
    constructor() {
        this.cache = new Map(); // Baby steps cache
        this.stepSize = 0n;
        this.G = ristretto255.Point.BASE;
    }

    // Precompute baby steps for range 2^16 (65536) which covers most precinct sizes
    // Or we can solve up to 1 Million votes efficiently.
    // m = sqrt(N). If N=1,000,000, m=1000.
    init(maxVotes = 100000) {
        if (this.stepSize > 0) return; // Already init

        const m = BigInt(Math.ceil(Math.sqrt(maxVotes)));
        this.stepSize = m;

        console.log(`[DLP] Initializing BSGS with m=${m}...`);

        let current = ristretto255.Point.ZERO; // 0*G
        for (let j = 0n; j < m; j++) {
            // Store pair (currentPoint.toHex(), j)
            // We use toHex() as map key
            this.cache.set(current.toHex(), j);
            current = current.add(this.G);
        }
        console.log(`[DLP] BSGS Table size: ${this.cache.size}`);
    }

    solve(pointHex) {
        // M = v*G
        // v = i*m + j
        // M = (i*m)*G + j*G  =>  M - (i*m)*G = j*G
        // We look for match in baby steps (j*G)

        const m = this.stepSize;
        const M = ristretto255.Point.fromHex(pointHex);

        // Giant Steps: iterate i
        // Check M - i*m*G
        // mG = m * G
        const mG = this.G.multiply(m);

        // We actually want: M = j*G + i*(mG)
        // M - i*(mG) = j*G
        // Rewrite: M - i*mG should be in table

        // Limit i roughly based on generic assumption (e.g. 1000 * 1000 = 1M)
        for (let i = 0n; i < m + 100n; i++) {
            let Term;
            if (i === 0n) {
                Term = ristretto255.Point.ZERO;
            } else {
                Term = mG.multiply(i); // i*mG
            }
            const CheckParams = M.subtract(Term); // M - i*mG

            const hex = CheckParams.toHex();
            if (this.cache.has(hex)) {
                const j = this.cache.get(hex);
                const v = i * m + j;
                return Number(v);
            }
        }

        return -1; // Not found (should not happen for valid tally)
    }
}

// Singleton instance
const solver = new DLPSolver();
// Initialize immediately for reasonable size
solver.init(100000);

module.exports = solver;
