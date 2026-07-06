# Dev image for the CKA Trainer app: Next.js frontend + terminal bridge.
# The terminal PTY runs bash/kubectl/vim from THIS image — keep those installed.

# kubectl comes from the pinned kind node image: exact version match with the
# cluster, no dependency on dl.k8s.io (kubectl is static, works anywhere).
FROM kindest/node:v1.35.5@sha256:ce977ae6d65918d0b58a5f8b5e940429c2ce42fa3a5619ec2bbc60b949c0ac95 AS k8s-bins

FROM node:24-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends vim less \
  && rm -rf /var/lib/apt/lists/*

COPY --from=k8s-bins /usr/bin/kubectl /usr/local/bin/kubectl

# docker CLI (static) — node-level scenarios shell into the kind node
# containers via `docker exec` (host socket mounted by compose).
COPY --from=docker:28-cli /usr/local/bin/docker /usr/local/bin/docker

WORKDIR /app

# Dependency layer — node-pty compiles its native module here, against the
# container's Node. Source is bind-mounted at runtime; node_modules lives in a
# named volume so this build survives the mount.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000 3001
CMD ["npm", "run", "dev"]
