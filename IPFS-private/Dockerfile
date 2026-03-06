# Use the official IPFS Kubo image as the base
FROM ipfs/kubo:latest

USER root

# Create a custom directory for IPFS data.
# The base image declares VOLUME ["/data/ipfs"], which creates anonymous host volumes
# when running docker-compose up. We avoid this by using a different path
# entirely within the container's R/W filesystem.
RUN mkdir -p /ipfs_data && chown ipfs:users /ipfs_data

# Copy custom configs
COPY swarm.key /custom/swarm.key
COPY entrypoint.sh /custom/entrypoint.sh
RUN chmod 400 /custom/swarm.key && \
    chmod +x /custom/entrypoint.sh && \
    chown -R ipfs:users /custom

USER ipfs

# Redirect the IPFS daemon to strictly use our new directory inside container FS
ENV IPFS_PATH=/ipfs_data

# Environment flag to enforce private network checking
ENV LIBP2P_FORCE_PNET=1

ENTRYPOINT ["/custom/entrypoint.sh"]
