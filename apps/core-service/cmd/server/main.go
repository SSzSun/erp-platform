package main

import (
	"fmt"
	"log"
	"net"
	"os"

	"github.com/joho/godotenv"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	attendancepb "github.com/erp-platform/core-service/proto/attendance"
	payrollpb "github.com/erp-platform/core-service/proto/payroll"

	"github.com/erp-platform/core-service/internal/attendance"
	"github.com/erp-platform/core-service/internal/payroll"
)

func main() {
	_ = godotenv.Load()

	port := os.Getenv("GRPC_PORT")
	if port == "" {
		port = "50051"
	}

	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	srv := grpc.NewServer()

	payrollpb.RegisterPayrollServiceServer(srv, payroll.NewServer())
	attendancepb.RegisterAttendanceServiceServer(srv, attendance.NewServer())

	// expose gRPC reflection for grpcurl / Postman debugging
	reflection.Register(srv)

	log.Printf("Core Service (gRPC) listening on :%s", port)
	if err := srv.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
