package config

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

//go:embed schema.sql
var schemaFS embed.FS

func Open(ctx context.Context) (*sql.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { return nil, fmt.Errorf("DATABASE_URL is required (PostgreSQL is the production datastore)") }
	db, err := sql.Open("pgx", dsn); if err != nil { return nil, err }
	db.SetMaxOpenConns(envInt("DB_MAX_OPEN_CONNS", 40)); db.SetMaxIdleConns(envInt("DB_MAX_IDLE_CONNS", 10)); db.SetConnMaxLifetime(30*time.Minute)
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second); defer cancel()
	if err := db.PingContext(ctx); err != nil { db.Close(); return nil, err }
	if _, err := db.ExecContext(ctx, mustSchema()); err != nil { db.Close(); return nil, fmt.Errorf("schema migration: %w", err) }
	return db, nil
}
func mustSchema() string { b, err := schemaFS.ReadFile("schema.sql"); if err != nil { panic(err) }; return string(b) }
func envInt(key string, fallback int) int { var n int; if _, err := fmt.Sscanf(os.Getenv(key), "%d", &n); err != nil || n < 1 { return fallback }; return n }
