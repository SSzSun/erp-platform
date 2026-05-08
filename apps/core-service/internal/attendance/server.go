package attendance

import (
	"context"
	"time"

	pb "github.com/erp-platform/core-service/proto/attendance"
)

type Server struct {
	pb.UnimplementedAttendanceServiceServer
}

func NewServer() *Server {
	return &Server{}
}

func (s *Server) RecordScan(
	ctx context.Context,
	req *pb.ScanRequest,
) (*pb.ScanResponse, error) {
	now := time.Now().UnixMilli()
	// TODO: persist scan log to DB and push real-time event via Redis pub/sub
	return &pb.ScanResponse{
		Success:    true,
		Message:    "scan recorded",
		RecordedAt: now,
	}, nil
}

func (s *Server) GetDailySummary(
	ctx context.Context,
	req *pb.DailySummaryRequest,
) (*pb.DailySummaryResponse, error) {
	// TODO: query attendance_logs, aggregate check-in/out, compute hours
	return &pb.DailySummaryResponse{
		Record: &pb.AttendanceRecord{
			EmployeeId: req.EmployeeId,
			Date:       req.Date,
		},
	}, nil
}

func (s *Server) GetMonthlySummary(
	ctx context.Context,
	req *pb.MonthlySummaryRequest,
) (*pb.MonthlySummaryResponse, error) {
	// TODO: aggregate daily records for the month
	return &pb.MonthlySummaryResponse{
		EmployeeId: req.EmployeeId,
		Year:       req.Year,
		Month:      req.Month,
	}, nil
}

func (s *Server) WatchAttendance(
	req *pb.WatchRequest,
	stream pb.AttendanceService_WatchAttendanceServer,
) error {
	// TODO: subscribe to Redis pub/sub channel and forward events to stream
	// Blocks until client disconnects or context is cancelled
	<-stream.Context().Done()
	return nil
}
