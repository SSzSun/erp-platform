package cache

import (
	"context"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
)

func NewClient(redisURL string) *redis.Client {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("cache: invalid REDIS_URL: %v", err)
	}

	client := redis.NewClient(opts)

	if err := client.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("cache: ping failed: %v", err)
	}

	fmt.Println("cache: connected to Redis")
	return client
}

const (
	ChannelAttendance = "erp:attendance:events"
)
