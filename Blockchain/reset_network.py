import os
import subprocess
import shlex

NODES_DIR = "nodes"
GENESIS_FILE = "genesis.json"
GETH_IMAGE = "ethereum/client-go:v1.13.14"
ALPINE_IMAGE = "alpine"

def clean_node(node_name):
    print(f"Cleaning {node_name}...")
    # Clean using alpine to avoid permission issues
    cmd = [
        "docker", "run", "--rm",
        "-v", f"{os.getcwd()}/{NODES_DIR}/{node_name}:/data",
        ALPINE_IMAGE,
        "sh", "-c", "rm -rf /data/geth/chaindata /data/geth/lightchaindata /data/geth/ethash /data/geth/transactions.rlp"
    ]
    subprocess.run(shlex.join(cmd), shell=True, check=True)

def init_node(node_name):
    print(f"Initializing {node_name}...")
    cmd = [
        "docker", "run", "--rm",
        "-v", f"{os.getcwd()}/{NODES_DIR}/{node_name}:/data",
        "-v", f"{os.getcwd()}/{GENESIS_FILE}:/genesis.json",
        GETH_IMAGE,
        "init", "--datadir", "/data", "/genesis.json"
    ]
    subprocess.run(shlex.join(cmd), shell=True, check=True)

def main():
    for i in range(1, 7):
        node_name = f"node{i}"
        clean_node(node_name)
        init_node(node_name)
    print("Network reset complete.")

if __name__ == "__main__":
    main()
