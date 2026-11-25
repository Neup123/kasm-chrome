FROM python:3.13-slim AS signed-extension
WORKDIR /verify
COPY scripts/verify-xpi.py /verify/verify-xpi.py
COPY extension/ /verify/extension/
COPY artifacts/kasm-agent-signed.xpi /verify/kasm-agent-signed.xpi
COPY artifacts/signed-artifact.json /verify/signed-artifact.json
RUN python3 /verify/verify-xpi.py /verify/kasm-agent-signed.xpi \
    --require-signature --source /verify/extension \
    --metadata /verify/signed-artifact.json

FROM kasmweb/firefox:1.18.0-rolling-weekly

USER root

# Kasm documents this policy path. The native managed-storage directory receives
# a runtime Compose secret; its contents are never part of this image.
RUN mkdir -p /etc/firefox/policies /usr/lib/mozilla/managed-storage /opt/kasm-driver
COPY firefox/policies.json /etc/firefox/policies/policies.json

# Intentionally fails before build/deploy until AMO has returned the signed XPI.
COPY --from=signed-extension /verify/kasm-agent-signed.xpi /opt/kasm-driver/companion.xpi
RUN test -s /opt/kasm-driver/companion.xpi \
    && chmod 0644 /etc/firefox/policies/policies.json /opt/kasm-driver/companion.xpi

USER 1000

# Inherit the base image's ENTRYPOINT, CMD, HOME, APP_ARGS/LAUNCH_URL support,
# and unmodified /dockerstartup/custom_startup.sh. Never create another profile.
