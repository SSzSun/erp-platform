PROTO_DIR   := /proto
OUT_PAYROLL := ./proto/payroll
OUT_ATTEND  := ./proto/attendance

.PHONY: proto build run

proto:
	protoc \
		--go_out=$(OUT_PAYROLL) --go_opt=paths=source_relative \
		--go-grpc_out=$(OUT_PAYROLL) --go-grpc_opt=paths=source_relative \
		-I $(PROTO_DIR) $(PROTO_DIR)/payroll.proto

	protoc \
		--go_out=$(OUT_ATTEND) --go_opt=paths=source_relative \
		--go-grpc_out=$(OUT_ATTEND) --go-grpc_opt=paths=source_relative \
		-I $(PROTO_DIR) $(PROTO_DIR)/attendance.proto

build: proto
	go build -o bin/server ./cmd/server

run: proto
	go run ./cmd/server
