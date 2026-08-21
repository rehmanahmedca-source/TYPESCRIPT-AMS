package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"html/template"
	"net/http"
	"sync"
)

type Dashboard struct { DB *sql.DB; Templates *template.Template; Writes *WriteQueue }
type dashboardData struct { Username, Role string; Accounts, Clients, Suppliers, Materials int }
func (h *Dashboard) Home(w http.ResponseWriter,r *http.Request) { u:=CurrentUser(r.Context()); d:=dashboardData{Username:u["username"].(string),Role:u["role"].(string)}; _=h.DB.QueryRowContext(r.Context(),"SELECT count(*) FROM account WHERE is_active").Scan(&d.Accounts); _=h.DB.QueryRowContext(r.Context(),"SELECT count(*) FROM client WHERE is_active").Scan(&d.Clients); _=h.DB.QueryRowContext(r.Context(),"SELECT count(*) FROM supplier WHERE is_active").Scan(&d.Suppliers); _=h.DB.QueryRowContext(r.Context(),"SELECT count(*) FROM material WHERE is_active").Scan(&d.Materials); h.Templates.ExecuteTemplate(w,"dashboard",d) }
func (h *Dashboard) Health(w http.ResponseWriter,r *http.Request) { if err:=h.DB.PingContext(r.Context()); err!=nil { http.Error(w,`{"ok":false}`,503); return }; w.Header().Set("Content-Type","application/json"); json.NewEncoder(w).Encode(map[string]any{"ok":true,"service":"ams-go","database":"postgres"}) }
// WriteQueue batches audit inserts so high-frequency ledger writes do not block request handlers.
type AuditEvent struct { Module, Action, EntityType, Username, Reason string; EntityID, UserID int64 }
type WriteQueue struct { db *sql.DB; ch chan AuditEvent; stop chan struct{}; once sync.Once }
func NewWriteQueue(db *sql.DB, size int) *WriteQueue { q:=&WriteQueue{db:db,ch:make(chan AuditEvent,size),stop:make(chan struct{})}; go q.run(); return q }
func (q *WriteQueue) Enqueue(e AuditEvent) { select { case q.ch<-e: default: go q.persist(e) } }
func (q *WriteQueue) persist(e AuditEvent) { _,_=q.db.Exec(`INSERT INTO audit_log(id,module,action,entity_type,entity_id,user_id,username,reason) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7)`,e.Module,e.Action,e.EntityType,e.EntityID,e.UserID,e.Username,e.Reason) }
func (q *WriteQueue) run() { for { select { case e:=<-q.ch: q.persist(e); case <-q.stop:return } } }
func (q *WriteQueue) Close() { q.once.Do(func(){close(q.stop)}) }
func (h *Dashboard) RecordAudit(ctx context.Context,e AuditEvent) { h.Writes.Enqueue(e) }
