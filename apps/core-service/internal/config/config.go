package config

import (
	"os"
)

type Config struct {
	GRPCPort    string
	DatabaseURL string
	RedisURL    string
	Env         string
}

func Load() *Config {
	return &Config{
		GRPCPort:    getEnv("GRPC_PORT", "50051"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		RedisURL:    getEnv("REDIS_URL", ""),
		Env:         getEnv("ENV", "development"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
