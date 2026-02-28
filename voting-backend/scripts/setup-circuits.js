const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CIRCUITS_DIR = path.join(__dirname, '../circuits');
const BUILD_DIR = path.join(CIRCUITS_DIR, 'build');
const NODE_MODULES = path.join(__dirname, '../node_modules');
const CIRCOM_EXE_PATH = path.join(CIRCUITS_DIR, 'circom.exe');
const CIRCUIT_NAME = 'vote';

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Helper to run commands
const run = (cmd) => {
    console.log(`\n> ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } catch (e) {
        console.error(`Command failed: ${cmd}`);
        console.error(e.message);
        process.exit(1);
    }
};

// 1. Detect Circom
console.log('--- Checking for Circom ---');
let circomCmd = 'circom';
if (process.platform === 'win32' && fs.existsSync(CIRCOM_EXE_PATH)) {
    console.log(`Using local circom: ${CIRCOM_EXE_PATH}`);
    circomCmd = `"${CIRCOM_EXE_PATH}"`;
} else {
    try {
        execSync('circom --version');
        console.log('Using global circom');
    } catch (e) {
        console.error('ERROR: circom not found. Please install circom or place circom.exe in the circuits folder.');
        process.exit(1);
    }
}

// 2. Compile Circuit
console.log('\n--- Compiling Circuit ---');
try {
    const compileCmd = `${circomCmd} "${path.join(CIRCUITS_DIR, 'vote.circom')}" --r1cs --wasm --sym --output "${BUILD_DIR}" -l "${NODE_MODULES}"`;
    console.log(`Executing: ${compileCmd}`);
    execSync(compileCmd, { stdio: 'inherit' });
    console.log('Compilation successful.');
} catch (e) {
    console.error('Compilation failed:', e.message);
    process.exit(1);
}

// 3. Trusted Setup (Groth16) via CLI
console.log('\n--- Running Trusted Setup (Groth16) ---');
const r1csPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`);
const ptau0 = path.join(BUILD_DIR, 'pot14_0000.ptau');
const ptau1 = path.join(BUILD_DIR, 'pot14_0001.ptau');
const ptauFinal = path.join(BUILD_DIR, 'pot14_final.ptau');
const zkey0 = path.join(BUILD_DIR, `${CIRCUIT_NAME}_0000.zkey`);
const zkeyFinal = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);
const vKeyPath = path.join(BUILD_DIR, 'verification_key.json');

// Use npx snarkjs
const snarkjs = 'npx snarkjs';

// 1. New Powers of Tau
run(`${snarkjs} powersoftau new bn128 14 "${ptau0}"`);

// 2. Contribute
run(`${snarkjs} powersoftau contribute "${ptau0}" "${ptau1}" --name="FirstContribution" -v -e="RandomEntropy"`);

// 3. Prepare Phase 2
run(`${snarkjs} powersoftau prepare phase2 "${ptau1}" "${ptauFinal}" -v`);

// 4. Groth16 Setup
run(`${snarkjs} groth16 setup "${r1csPath}" "${ptauFinal}" "${zkey0}"`);

// 5. Contribute to Phase 2
run(`${snarkjs} zkey contribute "${zkey0}" "${zkeyFinal}" --name="SecondContribution" -v -e="MoreRandomEntropy"`);

// 6. Export Verification Key
run(`${snarkjs} zkey export verificationkey "${zkeyFinal}" "${vKeyPath}"`);

console.log(`\n\u2705 Setup Complete! Artifacts are in ${BUILD_DIR}`);
console.log(`- Verification Key: ${vKeyPath}`);
console.log(`- Final ZKey: ${zkeyFinal}`);
