#!/usr/bin/env bash
#ddev-generated
# Shared by commands/host/aws and commands/host/s3-init: everything needed to point the
# host's aws CLI at this project's RustFS. Sourced, not executed.
#
# Sets RUSTFS_ENDPOINT and exports the AWS_* variables the CLI needs.

rustfs_env() {
  # Credentials match docker-compose.rustfs.yaml. A local throwaway emulator, so they
  # are fixed rather than configurable -- there is nothing here worth protecting, and a
  # configurable secret is one more thing to get out of sync.
  export AWS_ACCESS_KEY_ID=rustfs
  export AWS_SECRET_ACCESS_KEY=rustfs123

  # RustFS ignores the region, but the CLI refuses to sign a request without one.
  export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"

  # The https port from HTTPS_EXPOSE. DDEV_PRIMARY_URL, not DDEV_HOSTNAME: the latter is
  # a comma-separated list of every hostname, so on a project with additional_hostnames
  # it yields https://a,b:10101 and curl rejects the URL outright.
  RUSTFS_ENDPOINT="${DDEV_PRIMARY_URL:?must be run through ddev}:10101"

  # aws-cli v2 bundles its own CA store and does not consult the macOS keychain, so
  # DDEV's mkcert-issued certificate fails verification with "unable to get local issuer
  # certificate" even though curl and the browser trust it. Point the CLI at mkcert's
  # root. Without mkcert, fall back to the plain-http port rather than failing: this is
  # a local emulator either way.
  local caroot
  if caroot="$(mkcert -CAROOT 2>/dev/null)" && [ -f "$caroot/rootCA.pem" ]; then
    export AWS_CA_BUNDLE="$caroot/rootCA.pem"
  else
    RUSTFS_ENDPOINT="http://${DDEV_HOSTNAME%%,*}:10100"
    echo "rustfs: mkcert root not found, using $RUSTFS_ENDPOINT" >&2
  fi
}
