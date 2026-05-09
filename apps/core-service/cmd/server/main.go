package main

import (
	"context"
	"fmt"
	"log"
	"net"

	"github.com/joho/godotenv"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/erp-platform/core-service/internal/cache"
	"github.com/erp-platform/core-service/internal/config"
	"github.com/erp-platform/core-service/internal/db"

	"github.com/erp-platform/core-service/internal/attendance"
	"github.com/erp-platform/core-service/internal/payroll"

	attendancepb "github.com/erp-platform/core-service/proto/attendance"
	payrollpb "github.com/erp-platform/core-service/proto/payroll"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()
	ctx := context.Background()

	pool := db.NewPool(ctx, cfg.DatabaseURL)
	defer pool.Close()

	rdb := cache.NewClient(cfg.RedisURL)
	defer rdb.Close()

	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", cfg.GRPCPort))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	srv := grpc.NewServer()

	payrollpb.RegisterPayrollServiceServer(srv, payroll.NewServer(pool))
	attendancepb.RegisterAttendanceServiceServer(srv, attendance.NewServer(pool, rdb))

	reflection.Register(srv)

	log.Printf("Core Service (gRPC) listening on :%s", cfg.GRPCPort)
	if err := srv.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
