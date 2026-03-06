#!/bin/sh
set -e

# Data is stored in the container's R/W layer at /ipfs_data
if [ ! -f "$IPFS_PATH/config" ]; then
    echo "Initializing IPFS node..."
    # Init with server profile for better internal connectivity and lower resource usage
    ipfs init --profile=server
    
    # Copy the pre-generated swarm.key into the IPFS data directory
    echo "Configuring private network..."
    cp /custom/swarm.key "$IPFS_PATH/swarm.key"
    
    # Remove all default public bootstrap nodes to ensure the network is completely private
    ipfs bootstrap rm --all

    # The 'server' profile blocks local IP dialing. We must clear AddrFilters so nodes can connect over the Docker bridge network.
    ipfs config --json Swarm.AddrFilters '[]'

    # The 'server' profile disables mDNS, but we need it for instant local discovery inside the Docker network.
    ipfs config --json Discovery.MDNS.Enabled true
    
    # Explicitly set Routing to dht to suppress auto-routing errors and enable proper private DHT
    ipfs config Routing.Type dht

    # Disable AutoConf for private networks
    ipfs config --json AutoConf.Enabled false
fi

# Configure API and Gateway to listen on all interfaces so they can be accessed from the host if needed
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

# For docker-compose P2P to work, the daemon must listen on 4001 on all available interfaces (default)

# Determine the bootstrap node based on NODE_NAME env variable
# If this is not node1, we add node1's multiaddress to our bootstrap list dynamically.
if [ "$NODE_NAME" != "node1" ]; then
    echo "Waiting for node1 API to become available to retrieve its Peer ID..."
    
    max_retries=30
    count=0
    node1_id=""
    
    # We query node1's HTTP API for its Peer ID. node1 API is bound to port 5001 inside standard containers.
    while [ $count -lt $max_retries ]; do
        # Use simple wget included in busybox to hit node1's API
        if out=$(wget -qO- --post-data="" http://node1:5001/api/v0/id 2>/dev/null); then
            # Extract ID from JSON using string manipulation available in busybox sh
            node1_id=$(echo "$out" | sed 's/.*"ID":"\([^"]*\)".*/\1/')
            if [ -n "$node1_id" ] && [ "$node1_id" != "$out" ]; then
                echo "Found Node1 Peer ID: $node1_id"
                # Add node1 to the bootstrap peers list explicitly
                ipfs bootstrap add "/dns4/node1/tcp/4001/p2p/$node1_id"
                break
            fi
        fi
        sleep 2
        count=$((count+1))
    done
    
    if [ -z "$node1_id" ] || [ "$node1_id" = "$out" ]; then
        echo "Warning: Could not get Node1 Peer ID within timeout. Start may proceed without bootstrap peer depending on manual connection later."
    fi
fi

echo "Starting IPFS daemon..."
# Replace the current process with ipfs daemon to properly hand over signal handling
exec ipfs daemon
