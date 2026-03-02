import subprocess
import json
import time

# Define the nodes and their expected roles
NODES = {
    "geth-node1": {"role": "signer", "address": "0x32ee2b6031a8d780c907c9196fa1a6ccef38d180"},
    "geth-node2": {"role": "signer", "address": "0xb348436362e96655c41fcb5ab3fe25dc54c22b66"},
    "geth-node3": {"role": "signer", "address": "0x078962a2d159bcc3f982540b021bddcd192add7b"},
    "geth-node4": {"role": "observer"},
    "geth-node5": {"role": "observer"},
    "geth-node6": {"role": "observer"},
}

def run_js_command(node, js_code):
    """Executes a JS command on the geth node via docker exec."""
    # Using 'geth attach --exec' to run JS commands
    cmd = f'docker exec {node} geth attach --exec "{js_code}" /data/geth.ipc'
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            return None
        return result.stdout.strip()
    except Exception as e:
        return None

def verify_network():
    print(f"{'Node':<12} | {'Role':<8} | {'Peers':<6} | {'Block':<8} | {'Mining':<6} | {'Status'}")
    print("-" * 75)

    node_data = {}
    all_healthy = True
    
    latest_block = 0

    # 1. Check basic status of each node
    for node_name, info in NODES.items():
        peer_count = run_js_command(node_name, "net.peerCount")
        if peer_count: peer_count = peer_count.strip('"')
        
        block_num = run_js_command(node_name, "eth.blockNumber")
        if block_num: block_num = block_num.strip('"')
        
        is_mining = run_js_command(node_name, "eth.mining") 
        if is_mining: is_mining = is_mining.strip('"')
        
        status = "OK"
        if peer_count != '5':
            status = "WARN: Peers != 5"
            all_healthy = False
        
        if info['role'] == 'signer':
            if is_mining != 'true':
                status = "ERROR: Signer NOT mining"
                all_healthy = False
        
        print(f"{node_name:<12} | {info['role']:<8} | {peer_count:<6} | {block_num:<8} | {is_mining:<6} | {status}")
        
        if block_num and block_num.isdigit():
             b_int = int(block_num)
             node_data[node_name] = b_int
             if b_int > latest_block:
                 latest_block = b_int
        else:
             node_data[node_name] = 0

    # 2. Verify recent signers using Clique Snapshots
    print("\n[ Analyzing recent blocks for Signer Activity ]")
    if latest_block < 10:
        print("Chain is too short to verify rotation.")
    else:
        # Check snapshots for last 15 blocks
        start_check = max(1, latest_block - 15)
        print(f"Sampling Clique snapshots from block {start_check} to {latest_block}...")
        
        seen_signers = set()
        
        # We don't need to check every single block, checking a few spread out is enough, 
        # but inspecting all helps confirm continuous operation.
        for b in range(start_check, latest_block + 1):
             # Get hash of block b
             h_cmd = f"eth.getBlock({b}).hash"
             block_hash = run_js_command("geth-node1", h_cmd)
             if not block_hash: continue
             block_hash = block_hash.strip('"')

             # Get snapshot at hash
             s_cmd = f"clique.getSnapshotAtHash('{block_hash}')"
             snapshot_json_str = run_js_command("geth-node1", f"JSON.stringify({s_cmd})")
             
             if snapshot_json_str:
                 try:
                     # The output is like "JSONstring" usually with quotes if we didn't strip properly
                     # But we need parsing. Python's subprocess stdout is string.
                     # `geth attach` output might be weird.
                     # Simplified: just use regex or extract addresses manually?
                     # Better: JSON.parse in JS side? No, python parse.
                     # The output from geth with JSON.stringify is usually a valid JSON string
                     # but might be wrapped in quotes
                     if snapshot_json_str.startswith('"') and snapshot_json_str.endswith('"'):
                         snapshot_json_str = json.loads(snapshot_json_str) # Decode the outer string
                     
                     snapshot = json.loads(snapshot_json_str)
                     
                     # Extract recents
                     recents = snapshot.get("recents", {})
                     for _, signer in recents.items():
                         seen_signers.add(signer.lower())
                         
                 except Exception as e:
                     pass # Ignore parsing errors
        
        print(f"Found {len(seen_signers)} unique signers in recent snapshots.")
        
        signers_ok = 0
        for node_name, info in NODES.items():
            if info['role'] == 'signer':
                addr = info['address'].lower()
                if addr in seen_signers:
                    print(f"  [x] Node {node_name} ({addr[:10]}...) is active.")
                    signers_ok += 1
                else:
                    print(f"  [ ] Node {node_name} ({addr[:10]}...) has NOT signed recently.")
                    all_healthy = False
        
        if signers_ok == 3:
            print("SUCCESS: All 3 signers are rotating correctly.")
        else:
            print("WARNING: Not all signers are active.")

    if all_healthy:
        print("\nOVERALL: ✅ NETWORK IS HEALTHY")
    else:
        print("\nOVERALL: ⚠️ ISSUES DETECTED")

if __name__ == "__main__":
    verify_network()
