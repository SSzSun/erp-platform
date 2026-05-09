package attendance

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/erp-platform/core-service/internal/cache"
	pb "github.com/erp-platform/core-service/proto/attendance"
)

type Server struct {
	pb.UnimplementedAttendanceServiceServer
	db    *pgxpool.Pool
	redis *redis.Client
}

func NewServer(db *pgxpool.Pool, rdb *redis.Client) *Server {
	return &Server{db: db, redis: rdb}
}

// ─── RecordScan ──────────────────────────────────────────────────────────────
// รับ log จากเครื่องสแกนนิ้ว / mobile app — high load ช่วงเช้า
func (s *Server) RecordScan(ctx context.Context, req *pb.ScanRequest) (*pb.ScanResponse, error) {
	now := time.Now()
	ts := now.UnixMilli()

	_, err := s.db.Exec(ctx, `
		INSERT INTO attendance_logs (employee_id, scan_type, scanned_at, device_id, location)
		VALUES ($1, $2, $3, $4, $5)
	`, req.EmployeeId, req.ScanType.String(), now, req.DeviceId, req.Location)
	if err != nil {
		return &pb.ScanResponse{Success: false, Message: err.Error(), RecordedAt: ts}, nil
	}

	// Publish real-time event to Redis → NestJS WebSocket gateway subscribes
	event := map[string]any{
		"employeeId": req.EmployeeId,
		"scanType":   req.ScanType.String(),
		"timestamp":  ts,
		"location":   req.Location,
	}
	payload, _ := json.Marshal(event)
	s.redis.Publish(ctx, cache.ChannelAttendance, payload)

	return &pb.ScanResponse{Success: true, Message: "scan recorded", RecordedAt: ts}, nil
}

// ─── GetDailySummary ─────────────────────────────────────────────────────────
func (s *Server) GetDailySummary(ctx context.Context, req *pb.DailySummaryRequest) (*pb.DailySummaryResponse, error) {
	row := s.db.QueryRow(ctx, `
		SELECT
			MIN(scanned_at) FILTER (WHERE scan_type = 'CHECK_IN')  AS check_in,
			MAX(scanned_at) FILTER (WHERE scan_type = 'CHECK_OUT') AS check_out
		FROM attendance_logs
		WHERE employee_id = $1
		  AND scanned_at::date = $2::date
	`, req.EmployeeId, req.Date)

	var checkIn, checkOut *time.Time
	if err := row.Scan(&checkIn, &checkOut); err != nil {
		return &pb.DailySummaryResponse{Record: &pb.AttendanceRecord{
			EmployeeId: req.EmployeeId,
			Date:       req.Date,
			IsAbsent:   true,
			Status:     "absent",
		}}, nil
	}

	record := buildRecord(req.EmployeeId, req.Date, checkIn, checkOut)
	return &pb.DailySummaryResponse{Record: record}, nil
}

// ─── GetMonthlySummary ───────────────────────────────────────────────────────
func (s *Server) GetMonthlySummary(ctx context.Context, req *pb.MonthlySummaryRequest) (*pb.MonthlySummaryResponse, error) {
	rows, err := s.db.Query(ctx, `
		SELECT
			scanned_at::date::text                                          AS date,
			MIN(scanned_at) FILTER (WHERE scan_type = 'CHECK_IN')          AS check_in,
			MAX(scanned_at) FILTER (WHERE scan_type = 'CHECK_OUT')         AS check_out
		FROM attendance_logs
		WHERE employee_id = $1
		  AND EXTRACT(YEAR  FROM scanned_at) = $2
		  AND EXTRACT(MONTH FROM scanned_at) = $3
		GROUP BY scanned_at::date
		ORDER BY scanned_at::date
	`, req.EmployeeId, req.Year, req.Month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var (
		records       []*pb.AttendanceRecord
		presentDays   int32
		absentDays    int32
		lateDays      int32
		totalWorkHrs  float64
		totalOTHrs    float64
	)

	for rows.Next() {
		var dateStr string
		var checkIn, checkOut *time.Time
		if err := rows.Scan(&dateStr, &checkIn, &checkOut); err != nil {
			continue
		}
		r := buildRecord(req.EmployeeId, dateStr, checkIn, checkOut)
		records = append(records, r)

		if r.IsAbsent {
			absentDays++
		} else {
			presentDays++
			if r.IsLate {
				lateDays++
			}
			totalWorkHrs += r.WorkHours
			totalOTHrs += r.OtHours
		}
	}

	return &pb.MonthlySummaryResponse{
		EmployeeId:      req.EmployeeId,
		Year:            req.Year,
		Month:           req.Month,
		TotalWorkDays:   presentDays + absentDays,
		PresentDays:     presentDays,
		AbsentDays:      absentDays,
		LateDays:        lateDays,
		TotalWorkHours:  totalWorkHrs,
		TotalOtHours:    totalOTHrs,
		DailyRecords:    records,
	}, nil
}

// ─── WatchAttendance ─────────────────────────────────────────────────────────
// Subscribe Redis pub/sub → stream events to client (NestJS WebSocket gateway)
func (s *Server) WatchAttendance(req *pb.WatchRequest, stream pb.AttendanceService_WatchAttendanceServer) error {
	sub := s.redis.Subscribe(stream.Context(), cache.ChannelAttendance)
	defer sub.Close()

	ch := sub.Channel()
	for {
		select {
		case <-stream.Context().Done():
			return nil
		case msg, ok := <-ch:
			if !ok {
				return nil
			}
			var data map[string]any
			if err := json.Unmarshal([]byte(msg.Payload), &data); err != nil {
				continue
			}
			empID, _ := data["employeeId"].(string)
			ts, _ := data["timestamp"].(float64)

			scanTypeStr, _ := data["scanType"].(string)
			scanType := pb.ScanType_CHECK_IN
			if scanTypeStr == "CHECK_OUT" {
				scanType = pb.ScanType_CHECK_OUT
			}

			if err := stream.Send(&pb.AttendanceEvent{
				EmployeeId: empID,
				EventType:  scanType,
				Timestamp:  int64(ts),
			}); err != nil {
				return err
			}
		}
	}
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const (
	workStartHour = 9 // 09:00 ถือว่าสาย
	standardHours = 8.0
	otThreshold   = 8.0
)

func buildRecord(empID, date string, checkIn, checkOut *time.Time) *pb.AttendanceRecord {
	r := &pb.AttendanceRecord{
		EmployeeId: empID,
		Date:       date,
	}

	if checkIn == nil {
		r.IsAbsent = true
		r.Status = "absent"
		return r
	}

	r.CheckInAt = checkIn.UnixMilli()
	r.IsLate = checkIn.Hour() > workStartHour || (checkIn.Hour() == workStartHour && checkIn.Minute() > 0)

	if checkOut != nil {
		r.CheckOutAt = checkOut.UnixMilli()
		worked := checkOut.Sub(*checkIn).Hours()
		r.WorkHours = min(worked, standardHours)
		if worked > otThreshold {
			r.OtHours = worked - otThreshold
		}
	}

	switch {
	case r.IsAbsent:
		r.Status = "absent"
	case r.IsLate:
		r.Status = "late"
	case r.WorkHours < standardHours/2:
		r.Status = "half-day"
	default:
		r.Status = "present"
	}

	return r
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

var _ = fmt.Sprintf
