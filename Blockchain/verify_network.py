import subprocess
import json
import time

NODES = {
    "geth-node1": {"role": "signer", "address": "0x32ee2b6031a8d780c907c9196fa1a6ccef38d180"},
    "geth-node2": {"role": "signer", "address": "0xb348436362e96655c41fcb5ab3fe25dc54c22b66"},
    "geth-node3": {"role": "signer", "address": "0x078962a2d159bcc3f982540b021bddcd192add7b"},
    "geth-node4": {"role": "observer"},
    "geth-node5": {"role": "observer"},
    "geth-node6": {"role": "observer"},
}

def run_js(node, cmd):
    full_cmd = f'docker exec {node} geth attach --exec "{cmd}" /data/geth.ipc'
    retries = 5
    for i in range(retries):
        try:
            result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True)
            if result.returncode == 0:
                output = result.stdout.strip()
                if output:  # Ensure we have output
                    return output
        except Exception as e:
            pass
        
        if i < retries - 1:
            time.sleep(2)
            
    return None

def verify_network():
    print(f"{'Node':<12} | {'Role':<8} | {'Peers':<5} | {'Block':<8} | {'Mining':<6} | {'Status'}")
    print("-" * 75)

    node_stats = {}
    
    all_fine = True

    for node_name, info in NODES.items():
        peers = run_js(node_name, "net.peerCount")
        block = run_js(node_name, "eth.blockNumber")
        mining = run_js(node_name, "eth.mining")
        
        if peers is None: peers = "ERR"
        if block is None: block = "ERR"
        if mining is None: mining = "ERR"

        status = "OK"
        if peers != '5':
            status = f"WARN: Peer count {peers} != 5"
            all_fine = False
        
        if info['role'] == 'signer' and mining != 'true':
            status = f"ERROR: Signer mining status: {mining}"
            all_fine = False

        print(f"{node_name:<12} | {info['role']:<8} | {peers:<5} | {block:<8} | {mining:<6} | {status}")
        
        node_stats[node_name] = {"block": int(block) if block and block.isdigit() else 0}

    print("\n[ Checking recent blocks for signer activity ]")
    # Check last 10 blocks to see if all signers are active
    active_signers = set()
    print(f"Scanning last 10 blocks for signer activity...")
    
    latest_block = node_stats["geth-node1"]["block"]
    start_block = max(1, latest_block - 9)

    for b in range(start_block, latest_block + 1):
        # get block hash
        block_hash = run_js("geth-node1", f"eth.getBlock({b}).hash")
        if not block_hash: continue
        block_hash = block_hash.replace('"', '')
        
        # get snapshot at hash
        cmd = f"JSON.stringify(clique.getSnapshotAtHash('{block_hash}'))"
        snapshot_json = run_js("geth-node1", cmd)
        
        if snapshot_json:
            try:
                snapshot = json.loads(snapshot_json)
                if isinstance(snapshot, str):
                    snapshot = json.loads(snapshot)
                
                recents = snapshot.get("recents", {})
                # The signer of block b is in recents[b]
                signer = recents.get(str(b))
                if signer:
                    active_signers.add(signer.lower())
                    # print(f"Block {b}: {signer}")
            except:
                pass

    print("\n[ Signer Verification ]")
    signers_found = 0
    for node_name, info in NODES.items():
        if info['role'] == 'signer':
            address = info['address'].lower()
            if address in active_signers:
                print(f"✔ Node {node_name} ({address[:10]}...) mined blocks recently.")
                signers_found += 1
            else:
                print(f"❌ Node {node_name} ({address[:10]}...) has NOT mined recently!")
                all_fine = False
    
    if signers_found == 3:
        print("\nSUCCESS: All 3 signers are active.")
    else:
        print(f"\nWARNING: Only {signers_found}/3 signers are active.")
        
    if all_fine:
        print("\nOVERALL STATUS: ✅ PASSED. All checks green.")
    else:
        print("\nOVERALL STATUS: ⚠️ ISSUES DETECTED. Review above.")

if __name__ == "__main__":
    verify_network()
