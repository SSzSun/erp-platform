FROM golang:1.23-alpine AS base
RUN apk add --no-cache protobuf protobuf-dev make git
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest \
 && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
ENV PATH="$PATH:/root/go/bin"
WORKDIR /app

# ── development ────────────────────────────────────
# Build context = repo root (set in docker-compose)
FROM base AS development
COPY apps/core-service/go.mod apps/core-service/go.sum* ./
RUN go mod download
COPY apps/core-service/ .
COPY proto/ /proto
RUN make proto
CMD ["go", "run", "./cmd/server"]

# ── builder ────────────────────────────────────────
FROM base AS builder
COPY apps/core-service/go.mod apps/core-service/go.sum* ./
RUN go mod download
COPY apps/core-service/ .
COPY proto/ /proto
RUN make proto && go build -o bin/server ./cmd/server

# ── production ─────────────────────────────────────
FROM alpine:3.20 AS production
WORKDIR /app
COPY --from=builder /app/bin/server .
CMD ["./server"]
