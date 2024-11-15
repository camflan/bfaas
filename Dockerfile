FROM denoland/deno:2.0.4

RUN apt-get update && apt-get install -y iproute2 procps jq curl unzip git file bsdextrautils cgroup-tools coreutils sqlite3 lsb-release && rm -rf /var/lib/apt/lists/*

WORKDIR /bfaas
ADD server.ts server.ts

ENTRYPOINT []
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-write", "--allow-run", "server.ts"]