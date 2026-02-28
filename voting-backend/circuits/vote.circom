pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

/*
    Helper Template: Switcher
    Outputs [L, R] = sel ? [R, L] : [L, R]
*/
template Switcher() {
    signal input L;
    signal input R;
    signal input sel;
    signal output outL;
    signal output outR;

    signal aux;
    aux <== (R - L) * sel;

    outL <== aux + L;
    outR <== -aux + R;
}

template VoteCircuit(levels, nCandidates) {
    // ---------------------------------------------------------
    // PUBLIC INPUTS
    // ---------------------------------------------------------
    signal input root;              // Merkle Root
    signal input nullifier;         // Public Nullifier
    signal input electionId;        // To bind commitment

    // Encrypted Vote Points
    signal input C1[nCandidates];   
    signal input C2[nCandidates];

    // ---------------------------------------------------------
    // PRIVATE INPUTS
    // ---------------------------------------------------------
    signal input secret;            // zkSecret
    // salt has been removed
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input votes[nCandidates]; // 0 or 1
    signal input r[nCandidates];     // randomness

    // ---------------------------------------------------------
    // 1. COMMITMENT GENERATION
    // commitment = Poseidon(secret)
    // ---------------------------------------------------------
    component commHasher = Poseidon(1);
    commHasher.inputs[0] <== secret;
    
    signal commitment;
    commitment <== commHasher.out;

    // ---------------------------------------------------------
    // 2. MERKLE TREE VERIFICATION
    // ---------------------------------------------------------
    component treeHasher[levels];
    component switchers[levels];
    
    signal currentHash[levels + 1];
    currentHash[0] <== commitment;

    for(var i = 0; i < levels; i++) {
        switchers[i] = Switcher();
        switchers[i].L <== currentHash[i];
        switchers[i].R <== pathElements[i];
        switchers[i].sel <== pathIndices[i];

        treeHasher[i] = Poseidon(2);
        treeHasher[i].inputs[0] <== switchers[i].outL;
        treeHasher[i].inputs[1] <== switchers[i].outR;
        
        currentHash[i+1] <== treeHasher[i].out;
    }

    // Constraint: Computed Root must match Public Root
    root === currentHash[levels];

    // ---------------------------------------------------------
    // 3. NULLIFIER CHECK
    // nullifier = Poseidon(secret, electionId)
    // ---------------------------------------------------------
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== electionId; 
    
    nullifier === nullifierHasher.out;

    // ---------------------------------------------------------
    // 4. VOTE VALIDITY (Binary & Sum=1)
    // ---------------------------------------------------------
    signal voteSum[nCandidates + 1];
    voteSum[0] <== 0;

    for (var i = 0; i < nCandidates; i++) {
        // Binary Check: v * (v-1) = 0
        votes[i] * (votes[i] - 1) === 0;
        
        // Accumulate Sum
        voteSum[i+1] <== voteSum[i] + votes[i];
    }
    
    // Sum must be exactly 1
    voteSum[nCandidates] === 1;

    // ---------------------------------------------------------
    // 5. ENCRYPTION BINDING (Dummy)
    // ---------------------------------------------------------
    signal rSquare;
    rSquare <== r[0] * r[0]; 
}

// Instantiate
component main {public [root, nullifier, electionId, C1, C2]} = VoteCircuit(20, 10);
