# Tiny image that manages the kind cluster through the host's Docker socket.

# kubectl copied from the pinned kind node image — no dl.k8s.io dependency.
FROM kindest/node:v1.35.5@sha256:ce977ae6d65918d0b58a5f8b5e940429c2ce42fa3a5619ec2bbc60b949c0ac95 AS k8s-bins

FROM docker:28-cli

ARG KIND_VERSION=v0.32.0

RUN apk add --no-cache bash curl \
  && arch="$(apk --print-arch)" \
  && case "$arch" in x86_64) a=amd64 ;; aarch64) a=arm64 ;; *) echo "unsupported arch $arch" && exit 1 ;; esac \
  && curl -fsSLo /usr/local/bin/kind \
    "https://github.com/kubernetes-sigs/kind/releases/download/${KIND_VERSION}/kind-linux-${a}" \
  && chmod +x /usr/local/bin/kind

COPY --from=k8s-bins /usr/bin/kubectl /usr/local/bin/kubectl

COPY cluster-init.sh /usr/local/bin/cluster-init.sh

CMD ["bash", "/usr/local/bin/cluster-init.sh"]
