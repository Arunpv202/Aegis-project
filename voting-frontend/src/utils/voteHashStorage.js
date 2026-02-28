/**
 * voteHashStorage.js
 *
 * Persists the voter's locally-computed encrypted-vote hash + nullifier in
 * IndexedDB so it can later be compared against the on-chain record in the
 * Block Explorer.
 *
 * DB  : VotingApp
 * Store: voteHashes
 * Key  : "<electionId>"
 * Value: { electionId, voteHash, nullifier, storedAt }
 */

const DB_NAME = "VotingApp";
const DB_VERSION = 1;
const STORE_NAME = "voteHashes";

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME); // key path = explicit key below
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = e => reject(e.target.error);
    });
}

/** Store voteHash + nullifier for a given election. */
export async function saveVoteHash(electionId, voteHash, nullifier) {
    const db = await openDB();
    const key = `${electionId}`;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ electionId, voteHash, nullifier, storedAt: Date.now() }, key);
        tx.oncomplete = resolve;
        tx.onerror = e => reject(e.target.error);
    });
}

/** Retrieve the stored record for a given election, or null if not found. */
export async function getVoteHash(electionId) {
    const db = await openDB();
    const key = `${electionId}`;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror = e => reject(e.target.error);
    });
}
