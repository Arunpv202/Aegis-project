import { openDB } from 'idb';
import CryptoJS from 'crypto-js';

const DB_NAME = 'ZkVotingDB';
const STORE_NAME = 'secrets';
const COMMITMENT_STORE = 'commitments';

// Note: DB version incremented to 3 to add commitments store
export async function initDB() {
    return openDB(DB_NAME, 3, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // Handle secrets store
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'storage_key' });
            }

            // Add commitments store (new in v3)
            if (!db.objectStoreNames.contains(COMMITMENT_STORE)) {
                db.createObjectStore(COMMITMENT_STORE, { keyPath: 'storage_key' });
            }
        },
    });
}

// Encrypt data using a key derived from signature
export function encryptData(data, key) {
    if (typeof data === 'object') {
        data = JSON.stringify(data);
    }
    return CryptoJS.AES.encrypt(data, key).toString();
}

export function decryptData(ciphertext, key) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

export async function storeSecrets(election_id, secrets, encryptionKey, walletAddress) {
    const db = await initDB();

    // Clean Election ID (remove _0x...)
    const cleanElectionId = election_id.split('_')[0];
    const storageKey = `${cleanElectionId}_${walletAddress}`;

    // Encrypt separately
    const encryptedZkSecret = encryptData(secrets.zkSecret, encryptionKey);
    const encryptedSalt = encryptData(secrets.salt, encryptionKey);

    await db.put(STORE_NAME, {
        storage_key: storageKey,
        election_id: cleanElectionId,
        zk_secret: encryptedZkSecret,
        salt: encryptedSalt,
        created_at: new Date().toISOString()
    });
}

export async function getSecrets(election_id, encryptionKey, walletAddress) {
    const db = await initDB();
    // Clean Election ID just in case
    const cleanElectionId = election_id.split('_')[0];
    const storageKey = `${cleanElectionId}_${walletAddress}`;

    const record = await db.get(STORE_NAME, storageKey);
    if (!record) {
        console.warn(`[zkStorage] No secrets found for key: ${storageKey}`);
        return null;
    }

    try {
        const zkSecret = decryptData(record.zk_secret, encryptionKey);
        const salt = decryptData(record.salt, encryptionKey);

        console.log(`[zkStorage] Secrets decrypted successfully for ${cleanElectionId}`);
        return { zkSecret, salt };
    } catch (err) {
        console.error(`[zkStorage] Error decrypting secrets for ${cleanElectionId}:`, err);
        return null;
    }
}

// ==================== COMMITMENT STORAGE ====================

export async function storeCommitment(election_id, commitment, username) {
    const db = await initDB();
    const cleanElectionId = election_id.split('_')[0];
    const storageKey = `${cleanElectionId}_${username}`;

    await db.put(COMMITMENT_STORE, {
        storage_key: storageKey,
        election_id: cleanElectionId,
        commitment: commitment, // stored as plain text (not encrypted)
        created_at: new Date().toISOString()
    });
    console.log(`[zkStorage] Commitment stored for ${cleanElectionId}`);
}

export async function getCommitment(election_id, username) {
    const db = await initDB();
    const cleanElectionId = election_id.split('_')[0];
    const storageKey = `${cleanElectionId}_${username}`;

    const record = await db.get(COMMITMENT_STORE, storageKey);
    if (!record) {
        console.warn(`[zkStorage] No commitment found for key: ${storageKey}`);
        return null;
    }

    console.log(`[zkStorage] Commitment retrieved for ${cleanElectionId}`);
    return record.commitment;
}

