# syntax=docker/dockerfile:1
# =============================================================================
# Blocks IDP API — production image (Kestrel + static React from wwwroot)
# Build: docker build -t blocks-idp-api .
# =============================================================================

ARG DOTNET_PUBLISH_PLATFORM=linux/amd64

# -----------------------------------------------------------------------------
# Stage: frontend — Vite build → server/Api/wwwroot (see client/vite.config.ts)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS client
WORKDIR /src/client

COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY client ./
RUN mkdir -p /src/server/Api/wwwroot \
    && npm run build

# -----------------------------------------------------------------------------
# Stage: publish — .NET SDK (glibc). Default platform linux/amd64 avoids Grpc.Tools
# protoc crashes on some arm64 build hosts; override if your CI publishes safely
# on arm64: docker build --build-arg DOTNET_PUBLISH_PLATFORM=linux/arm64 .
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS publish
WORKDIR /src

COPY server ./server
COPY --from=client /src/server/Api/wwwroot ./server/Api/wwwroot

RUN dotnet publish server/Api/Api.csproj \
    -c Release \
    -o /app/publish \
    --no-self-contained \
    -p:DebugType=None

# -----------------------------------------------------------------------------
# Stage: runtime — ASP.NET Core on Alpine
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS final

ARG BUILD_VERSION=0.0.0
LABEL org.opencontainers.image.title="blocks-idp-api" \
    org.opencontainers.image.description="ASP.NET Core IDP API; React SPA served from wwwroot." \
    org.opencontainers.image.version="${BUILD_VERSION}"

WORKDIR /app

ARG ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT} \
    ASPNETCORE_URLS=http://0.0.0.0:5000 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

EXPOSE 5000

RUN apk add --no-cache icu-libs

COPY --from=publish /app/publish .
RUN chown -R app:app /app

USER app

# Liveness only: Genesis maps /health/live with no dependency checks, so a Mongo/Redis
# outage does not mark the container unhealthy. wget is BusyBox's, part of the Alpine base.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:5000/health/live || exit 1

ENTRYPOINT ["dotnet", "Api.dll"]
