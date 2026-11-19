#!/usr/bin/env bash
#
# Makes a VAPID key pair for TODO_PUSH_PUBLIC_KEY and TODO_PUSH_PRIVATE_KEY.
#
# Devices subscribe with the public key, so after a new pair a device's notification stays as it is
# until the app is next opened there: make one per installation and keep it, as you would any other
# secret.
#
set -euo pipefail

key=$(openssl ecparam -name prime256v1 -genkey -noout 2>/dev/null)

# The private scalar and the uncompressed public point, as hex, from OpenSSL's text dump.
hex() {
  openssl ec -text -noout 2>/dev/null <<<"$key" |
    awk -v want="$1" '
      /^[a-zA-Z]/ { section = $1 }
      section == want && /^ / { gsub(/[ :]/, ""); printf "%s", $0 }'
}

base64url() {
  xxd -r -p | base64 -w0 | tr '+/' '-_' | tr -d '='
}

private=$(hex "priv:")
public=$(hex "pub:")

# VAPID wants exactly 32 octets; OpenSSL writes the scalar with as many as its value needs.
while ((${#private} > 64)); do private=${private:2}; done
while ((${#private} < 64)); do private="00$private"; done

echo "TODO_PUSH_PUBLIC_KEY=$(base64url <<<"$public")"
echo "TODO_PUSH_PRIVATE_KEY=$(base64url <<<"$private")"
