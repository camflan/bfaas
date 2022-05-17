FROM denoland/deno:1.21.3

RUN apt-get update && apt-get install -y iproute2 procps jq curl && rm -rf /var/lib/apt/lists/*
RUN jq --help

WORKDIR /bfaas
ADD server.ts server.ts

ENTRYPOINT []
CMD ["deno", "run", "--allow-net", "--allow-write", "--allow-run", "server.ts"]