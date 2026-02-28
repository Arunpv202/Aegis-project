import { openDB } from 'idb';
import CryptoJS from 'crypto-js';

const DB_NAME = 'ZkVotingDB';
const STORE_NAME = 'secrets';

// Note: DB version incremented to 2 to support schema change
export async function initDB() {
    return openDB(DB_NAME, 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
            // If migrating from v1, we might lose data or need complex migration.
            // For development simplicity, we'll recreate the store if schema doesn't match desire,
            // but `createObjectStore` throws if it exists.

            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }

            // New schema: Key is composite 'storage_key'
            db.createObjectStore(STORE_NAME, { keyPath: 'storage_key' });
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
