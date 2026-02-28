# Zero-Knowledge Circuit Setup Guide

To enable real Zero-Knowledge Proofs (instead of mocked ones), you must compile the circuit and generate the trusted setup keys.

## Prerequisites

1.  **Install Circom**:
    -   Follow instructions at [docs.circom.io](https://docs.circom.io/getting-started/installation/).
    -   Verify with `circom --version`.

2.  **Install Backend Dependencies**:
    ```bash
    cd voting-backend
    npm install circomlib
    ```

## Step-by-Step Generation

Run the following commands in the `voting-backend/circuits` directory (create it if it doesn't exist):

```bash
mkdir -p build

# 1. Compile the Circuit
# This generates the .r1cs file and the 'vote_js' directory
circom vote.circom --r1cs --wasm --sym --output build

# 2. Trusted Setup (Powers of Tau) - Phase 1
# Start with a standard power of tau (12 is enough for this small circuit)
snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v
snarkjs powersoftau contribute build/pot12_0000.ptau build/pot12_0001.ptau --name="First contribution" -v -e="random text"

# Phase 2 Initialization
snarkjs powersoftau prepare phase2 build/pot12_0001.ptau build/pot12_final.ptau -v

# 3. Generate .zkey (Proving Key)
snarkjs groth16 setup build/vote.r1cs build/pot12_final.ptau build/vote_0000.zkey
snarkjs zkey contribute build/vote_0000.zkey build/vote_final.zkey --name="Second contribution" -v -e="more random text"
snarkjs zkey export verificationkey build/vote_final.zkey build/verification_key.json

# 4. Copy Artifacts to Application

# Copy Verification Key to Backend
cp build/verification_key.json ../config/zk/

# Copy Circuit (WASM) and Proving Key to Frontend
# Ensure frontend `public/circuits` directory exists
mkdir -p ../../voting-frontend/public/circuits
cp build/vote_js/vote.wasm ../../voting-frontend/public/circuits/
cp build/vote_final.zkey ../../voting-frontend/public/circuits/
```

## After setup
Once these files are in place, you can simply un-mock the ZK generation in `VotePage.jsx`!
