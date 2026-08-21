package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"html/template"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type Auth struct { DB *sql.DB; Templates *template.Template; SecureCookie bool }
type userKey struct{}
func (a *Auth) Routes(mux *http.ServeMux) { mux.HandleFunc("/login", a.login); mux.HandleFunc("/logout", a.logout) }
func (a *Auth) login(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet { a.Templates.ExecuteTemplate(w,"login",nil); return }
	if r.Method != http.MethodPost { http.Error(w,"method not allowed",405); return }
	username := strings.TrimSpace(r.FormValue("username")); password := r.FormValue("password")
	var id int64; var hash, role, status string
	err := a.DB.QueryRowContext(r.Context(), `SELECT id,password_hash,role,status FROM app_user WHERE lower(username)=lower($1)`, username).Scan(&id,&hash,&role,&status)
	if err == sql.ErrNoRows && strings.EqualFold(username,"admin") { // safe first-run bootstrap; password never stored in plaintext
		adminPassword := os.Getenv("DEFAULT_ADMIN_PASSWORD"); if adminPassword=="" { adminPassword="Admin@fbm12345" }
		h, _ := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		_, _ = a.DB.ExecContext(r.Context(), `INSERT INTO app_user(username,password_hash,role,status,can_manage_accounts,can_view_cash_flow) VALUES($1,$2,'admin','active',true,true) ON CONFLICT(username) DO NOTHING`, "Admin", h)
		err = a.DB.QueryRowContext(r.Context(), `SELECT id,password_hash,role,status FROM app_user WHERE lower(username)=lower($1)`, username).Scan(&id,&hash,&role,&status)
	}
	if err != nil || status != "active" || bcrypt.CompareHashAndPassword([]byte(hash),[]byte(password)) != nil { a.Templates.ExecuteTemplate(w,"login",map[string]string{"Error":"Invalid credentials"}); return }
	sidBytes:=make([]byte,32); if _,err=rand.Read(sidBytes); err!=nil { http.Error(w,"session error",500); return }; sid:=hex.EncodeToString(sidBytes)
	now:=time.Now().UTC(); _,err=a.DB.ExecContext(r.Context(),`INSERT INTO user_login_session(sid,user_id,username,role,ip,user_agent,created_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7)`,sid,id,username,role,r.RemoteAddr,r.UserAgent(),now); if err!=nil { http.Error(w,"session error",500); return }
	http.SetCookie(w,&http.Cookie{Name:"ams_session",Value:sid,Path:"/",HttpOnly:true,Secure:a.SecureCookie,SameSite:http.SameSiteLaxMode,MaxAge:14*86400}); http.Redirect(w,r,"/",http.StatusSeeOther)
}
func (a *Auth) logout(w http.ResponseWriter,r *http.Request) { if c,err:=r.Cookie("ams_session"); err==nil { _,_=a.DB.ExecContext(r.Context(),`UPDATE user_login_session SET ended_at=now() WHERE sid=$1`,c.Value) }; http.SetCookie(w,&http.Cookie{Name:"ams_session",MaxAge:-1,Path:"/"}); http.Redirect(w,r,"/login",http.StatusSeeOther) }
func (a *Auth) Require(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request) { c,err:=r.Cookie("ams_session"); if err!=nil || c.Value=="" { http.Redirect(w,r,"/login",http.StatusSeeOther); return }; var id int64; var username,role string; err=a.DB.QueryRowContext(r.Context(),`SELECT u.id,u.username,u.role FROM user_login_session s JOIN app_user u ON u.id=s.user_id WHERE s.sid=$1 AND s.ended_at IS NULL AND u.status='active' AND s.last_seen_at>now()-interval '14 days'`,c.Value).Scan(&id,&username,&role); if err!=nil { http.Redirect(w,r,"/login",http.StatusSeeOther); return }; _,_=a.DB.ExecContext(r.Context(),`UPDATE user_login_session SET last_seen_at=now() WHERE sid=$1`,c.Value); next.ServeHTTP(w,r.WithContext(context.WithValue(r.Context(),userKey{},map[string]any{"id":id,"username":username,"role":role}))) }) }
func CurrentUser(ctx context.Context) map[string]any { v,_:=ctx.Value(userKey{}).(map[string]any); return v }
