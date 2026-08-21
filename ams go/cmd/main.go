package main

import (
	"context"
	"html/template"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"ams-go-system/config"
	"ams-go-system/handlers"
)
func main() {
	ctx,cancel:=signal.NotifyContext(context.Background(),os.Interrupt,syscall.SIGTERM); defer cancel()
	db,err:=config.Open(ctx); if err!=nil { log.Fatal(err) }; defer db.Close()
	tpl:=template.Must(template.ParseGlob("templates/*.html")); q:=handlers.NewWriteQueue(db,2048); defer q.Close()
	auth:=&handlers.Auth{DB:db,Templates:tpl,SecureCookie:strings.EqualFold(os.Getenv("SESSION_COOKIE_SECURE"),"true")}; app:=&handlers.Dashboard{DB:db,Templates:tpl,Writes:q}
	public:=http.NewServeMux(); auth.Routes(public); public.HandleFunc("/healthz",app.Health)
	protected:=http.NewServeMux(); protected.Handle("/",auth.Require(http.HandlerFunc(app.Home))); public.Handle("/",protected)
	srv:=&http.Server{Addr:env("HTTP_ADDR",":8080"),Handler:logging(public),ReadHeaderTimeout:5*time.Second,ReadTimeout:15*time.Second,WriteTimeout:30*time.Second,IdleTimeout:60*time.Second}
	go func(){ log.Printf("AMS Go listening on %s",srv.Addr); if err:=srv.ListenAndServe(); err!=nil && err!=http.ErrServerClosed { log.Fatal(err) } }(); <-ctx.Done(); shutdown,_:=context.WithTimeout(context.Background(),10*time.Second); defer shutdown(); _=srv.Shutdown(shutdown)
}
func env(k,f string)string{if v:=os.Getenv(k);v!=""{return v};return f}
func logging(next http.Handler)http.Handler{return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){start:=time.Now();next.ServeHTTP(w,r);log.Printf("%s %s %s",r.Method,r.URL.Path,time.Since(start))})}
