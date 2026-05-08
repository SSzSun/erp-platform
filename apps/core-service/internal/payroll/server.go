package payroll

import (
	"context"
	"fmt"
	"math"

	pb "github.com/erp-platform/core-service/proto/payroll"
)

type Server struct {
	pb.UnimplementedPayrollServiceServer
}

func NewServer() *Server {
	return &Server{}
}

func (s *Server) CalculatePayroll(
	ctx context.Context,
	req *pb.CalculatePayrollRequest,
) (*pb.PayrollResult, error) {
	result := calculate(req)
	return result, nil
}

func (s *Server) ProcessPayrollBatch(
	req *pb.PayrollBatchRequest,
	stream pb.PayrollService_ProcessPayrollBatchServer,
) error {
	// TODO: fetch employees from DB and fan-out via goroutines
	// Placeholder: stream back empty response to validate wiring
	_ = req
	return nil
}

func (s *Server) GetPayrollHistory(
	ctx context.Context,
	req *pb.PayrollHistoryRequest,
) (*pb.PayrollHistoryResponse, error) {
	// TODO: query payroll_records table
	return &pb.PayrollHistoryResponse{}, nil
}

// ──────────────────────────────────────────────────
// Thai payroll calculation logic
// ──────────────────────────────────────────────────

const (
	socialSecurityRate = 0.05
	socialSecurityCap  = 750.0  // max 750 THB/month
	otMultiplier       = 1.5    // OT = 1.5x hourly rate
	workHoursPerDay    = 8.0
	workDaysPerMonth   = 26.0
)

func calculate(req *pb.CalculatePayrollRequest) *pb.PayrollResult {
	base := req.BaseSalary

	// OT pay
	hourlyRate := base / (workDaysPerMonth * workHoursPerDay)
	otPay := hourlyRate * otMultiplier * req.OtHours

	// Deduct unpaid leave
	dailyRate := base / workDaysPerMonth
	unpaidDeduction := dailyRate * float64(req.UnpaidLeaveDays)
	adjustedBase := base - unpaidDeduction

	// Allowances
	var totalAllowance float64
	for _, a := range req.Allowances {
		totalAllowance += a.Amount
	}

	grossPay := adjustedBase + otPay + totalAllowance

	// Social security (ประกันสังคม)
	ss := math.Min(base*socialSecurityRate, socialSecurityCap)

	// Income tax — progressive rate (simplified Thai PIT)
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
		NetPay:         netPay,
		Status:         "calculated",
	}
}

// calculateTax returns monthly tax based on annual income (Thai PIT 2024)
func calculateTax(annualIncome float64) float64 {
	// Standard deduction 50% (max 100,000) + personal exemption 60,000
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

	var annualTax float64
	prev := 0.0
	for _, b := range brackets {
		if taxable <= prev {
			break
		}
		chunk := math.Min(taxable, b.limit) - prev
		annualTax += chunk * b.rate
		prev = b.limit
	}

	return roundTwoDecimals(annualTax / 12)
}

func roundTwoDecimals(v float64) float64 {
	return math.Round(v*100) / 100
}

var _ = fmt.Sprintf // avoid unused import warning during scaffold
