FROM nginx:1.30.4-alpine

# Build-time version, recorded as an OCI label (this is a static site).
ARG APP_VERSION=dev
LABEL org.opencontainers.image.version=$APP_VERSION

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY src/ /usr/share/nginx/html/

EXPOSE 80
