package db

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context, databaseURL string) *pgxpool.Pool {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		log.Fatalf("db: invalid DATABASE_URL: %v", err)
	}

	cfg.MaxConns = 20
	cfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatalf("db: failed to connect: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("db: ping failed: %v", err)
	}

	fmt.Println("db: connected to PostgreSQL")
	return pool
}
