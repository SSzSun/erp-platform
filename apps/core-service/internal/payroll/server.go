package payroll

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	pb "github.com/erp-platform/core-service/proto/payroll"
)

type Server struct {
	pb.UnimplementedPayrollServiceServer
	db *pgxpool.Pool
}

func NewServer(db *pgxpool.Pool) *Server {
	return &Server{db: db}
}

// ─── CalculatePayroll ────────────────────────────────────────────────────────
func (s *Server) CalculatePayroll(ctx context.Context, req *pb.CalculatePayrollRequest) (*pb.PayrollResult, error) {
	result := calculate(req)

	// Persist result to payroll_records table
	_, err := s.db.Exec(ctx, `
		INSERT INTO payroll_records (
			employee_id, year, month, base_salary, ot_pay,
			total_allowance, gross_pay, tax, social_security,
			provident_fund, total_deduction, net_pay, status, calculated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (employee_id, year, month)
		DO UPDATE SET
			gross_pay = EXCLUDED.gross_pay, net_pay = EXCLUDED.net_pay,
			tax = EXCLUDED.tax, status = EXCLUDED.status,
			calculated_at = EXCLUDED.calculated_at
	`,
		result.EmployeeId, result.Year, result.Month,
		result.BaseSalary, result.OtPay,
		result.TotalAllowance, result.GrossPay,
		result.Tax, result.SocialSecurity,
		result.ProvidentFund, result.TotalDeduction,
		result.NetPay, result.Status, time.Now(),
	)
	if err != nil {
		result.Status = "error"
		result.ErrorMessage = err.Error()
	}

	return result, nil
}

// ─── ProcessPayrollBatch ─────────────────────────────────────────────────────
// Fan-out ด้วย goroutines — คำนวณพนักงานหลายคนพร้อมกัน
func (s *Server) ProcessPayrollBatch(req *pb.PayrollBatchRequest, stream pb.PayrollService_ProcessPayrollBatchServer) error {
	ctx := stream.Context()

	var employeeIDs []string
	if len(req.EmployeeIds) > 0 {
		employeeIDs = req.EmployeeIds
	} else {
		// Fetch all active employees with salary from DB
		rows, err := s.db.Query(ctx, `
			SELECT e.id, e.salary
			FROM employees e
			JOIN users u ON u.id = e.user_id
			WHERE e.status = 'active' AND u.is_active = true
		`)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id string
			var _ float64
			if err := rows.Scan(&id, &_); err == nil {
				employeeIDs = append(employeeIDs, id)
			}
		}
	}

	type result struct {
		res *pb.PayrollResult
		err error
	}

	resultCh := make(chan result, len(employeeIDs))

	for _, empID := range employeeIDs {
		go func(id string) {
			// Fetch salary from DB for each employee
			var salary float64
			err := s.db.QueryRow(ctx, `SELECT salary FROM employees WHERE id = $1`, id).Scan(&salary)
			if err != nil {
				resultCh <- result{err: err}
				return
			}

			res, err := s.CalculatePayroll(ctx, &pb.CalculatePayrollRequest{
				EmployeeId: id,
				BaseSalary: salary,
				Year:       req.Year,
				Month:      req.Month,
			})
			resultCh <- result{res: res, err: err}
		}(empID)
	}

	for range employeeIDs {
		r := <-resultCh
		if r.err != nil {
			continue
		}
		if err := stream.Send(r.res); err != nil {
			return err
		}
	}

	return nil
}

// ─── GetPayrollHistory ───────────────────────────────────────────────────────
func (s *Server) GetPayrollHistory(ctx context.Context, req *pb.PayrollHistoryRequest) (*pb.PayrollHistoryResponse, error) {
	query := `
		SELECT employee_id, year, month, base_salary, ot_pay,
		       total_allowance, gross_pay, tax, social_security,
		       provident_fund, total_deduction, net_pay, status
		FROM payroll_records
		WHERE employee_id = $1
	`
	args := []any{req.EmployeeId}

	if req.Year > 0 {
		query += ` AND year = $2`
		args = append(args, req.Year)
	}
	query += ` ORDER BY year DESC, month DESC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*pb.PayrollResult
	for rows.Next() {
		r := &pb.PayrollResult{}
		if err := rows.Scan(
			&r.EmployeeId, &r.Year, &r.Month,
			&r.BaseSalary, &r.OtPay, &r.TotalAllowance,
			&r.GrossPay, &r.Tax, &r.SocialSecurity,
			&r.ProvidentFund, &r.TotalDeduction, &r.NetPay, &r.Status,
		); err == nil {
			records = append(records, r)
		}
	}

	return &pb.PayrollHistoryResponse{Records: records}, nil
}

// ──────────────────────────────────────────────────
// Thai payroll calculation logic
// ──────────────────────────────────────────────────

const (
	socialSecurityRate = 0.05
	socialSecurityCap  = 750.0
	otMultiplier       = 1.5
	workHoursPerDay    = 8.0
	workDaysPerMonth   = 26.0
)

func calculate(req *pb.CalculatePayrollRequest) *pb.PayrollResult {
	base := req.BaseSalary

	hourlyRate := base / (workDaysPerMonth * workHoursPerDay)
	otPay := hourlyRate * otMultiplier * req.OtHours

	dailyRate := base / workDaysPerMonth
	adjustedBase := base - (dailyRate * float64(req.UnpaidLeaveDays))

	var totalAllowance float64
	for _, a := range req.Allowances {
		totalAllowance += a.Amount
	}

	grossPay := adjustedBase + otPay + totalAllowance
	ss := math.Min(base*socialSecurityRate, socialSecurityCap)
	tax := calculateTax(grossPay * 12)
	totalDeduction := ss + tax
	netPay := grossPay - totalDeduction

	return &pb.PayrollResult{
		EmployeeId:     req.EmployeeId,
		Year:           req.Year,
		Month:          req.Month,
		BaseSalary:     base,
		OtPay:          otPay,
		TotalAllowance: totalAllowance,
		GrossPay:       grossPay,
		Tax:            tax,
		SocialSecurity: ss,
		TotalDeduction: totalDeduction,
		NetPay:         roundTwo(netPay),
		Status:         "calculated",
	}
}

// Thai progressive PIT (ภาษีเงินได้บุคคลธรรมดา)
func calculateTax(annualIncome float64) float64 {
	deduction := math.Min(annualIncome*0.5, 100_000) + 60_000
	taxable := annualIncome - deduction
	if taxable <= 0 {
		return 0
	}

	brackets := []struct {
		limit float64
		rate  float64
	}{
		{150_000, 0},
		{300_000, 0.05},
		{500_000, 0.10},
		{750_000, 0.15},
		{1_000_000, 0.20},
		{2_000_000, 0.25},
		{5_000_000, 0.30},
		{math.MaxFloat64, 0.35},
	}

	var annualTax, prev float64
	for _, b := range brackets {
		if taxable <= prev {
			break
		}
		annualTax += (math.Min(taxable, b.limit) - prev) * b.rate
		prev = b.limit
	}

	return roundTwo(annualTax / 12)
}

func roundTwo(v float64) float64 { return math.Round(v*100) / 100 }

var _ = fmt.Sprintf
