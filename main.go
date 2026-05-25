package main

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

var db *sql.DB

type Todo struct {
	ID        int    `json:"id"`
	Task      string `json:"task"`
	IsDone    bool   `json:"is_done"`
	CreatedAt string `json:"created_at"`
	Deadline  string `json:"deadline"`
	Priority  int    `json:"priority"`
	Details   string `json:"details"`
	Link      string `json:"link"`
}

// 外部（React）からのアクセスを許可するCORS設定
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

// パスワード認証設定
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "admin" || pass != "password" {
			w.Header().Set("WWW-Authenticate", `Basic realm="Restricted"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func main() {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = "postgres://localhost/todo_db?sslmode=disable"
	}

	var err error
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		panic(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(20)

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS todos_v3 (
		id SERIAL PRIMARY KEY,
		task TEXT NOT NULL,
		is_done BOOLEAN DEFAULT FALSE,
		created_at TEXT NOT NULL,
		deadline TEXT,
		priority INTEGER DEFAULT 3,
		details TEXT,
		link TEXT
	)`)
	if err != nil {
		panic(err)
	}

	// [C] POST: タスク追加
	http.HandleFunc("POST /todos", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		var newTodo Todo
		json.NewDecoder(r.Body).Decode(&newTodo)
		now := time.Now().Format("2006/01/02 15:04")
		err := db.QueryRow("INSERT INTO todos_v3 (task, created_at, deadline, priority, details, link) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", newTodo.Task, now, newTodo.Deadline, newTodo.Priority, newTodo.Details, newTodo.Link).Scan(&newTodo.ID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	})))

	// [R] GET: 一覧取得 (バックエンド検索)
	http.HandleFunc("GET /todos", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		searchQuery := r.URL.Query().Get("q")
		var rows *sql.Rows
		var err error

		if searchQuery != "" {
			searchTerm := "%" + searchQuery + "%"
			rows, err = db.Query("SELECT id, task, is_done, created_at, deadline, priority, details, link FROM todos_v3 WHERE task ILIKE $1 OR details ILIKE $1 ORDER BY id DESC LIMIT 100", searchTerm)
		} else {
			rows, err = db.Query("SELECT id, task, is_done, created_at, deadline, priority, details, link FROM todos_v3 ORDER BY id DESC LIMIT 100")
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var todos []Todo
		for rows.Next() {
			var t Todo
			rows.Scan(&t.ID, &t.Task, &t.IsDone, &t.CreatedAt, &t.Deadline, &t.Priority, &t.Details, &t.Link)
			todos = append(todos, t)
		}
		if todos == nil {
			todos = []Todo{}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(todos)
	})))

	// [U] PUT: 完了状態切り替え
	http.HandleFunc("PUT /todos/{id}", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.Atoi(r.PathValue("id"))
		_, err := db.Exec("UPDATE todos_v3 SET is_done = NOT is_done WHERE id = $1", id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})))

	// [D] DELETE: タスク削除
	http.HandleFunc("DELETE /todos/{id}", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.Atoi(r.PathValue("id"))
		_, err := db.Exec("DELETE FROM todos_v3 WHERE id = $1", id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})))

	// CSVエクスポート
	http.HandleFunc("GET /todos/export", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment;filename=todos.csv")
		writer := csv.NewWriter(w)
		writer.Write([]string{"task", "is_done", "created_at", "deadline", "priority", "details", "link"})
		rows, _ := db.Query("SELECT task, is_done, created_at, deadline, priority, details, link FROM todos_v3 ORDER BY id DESC")
		defer rows.Close()
		for rows.Next() {
			var t Todo
			rows.Scan(&t.Task, &t.IsDone, &t.CreatedAt, &t.Deadline, &t.Priority, &t.Details, &t.Link)
			writer.Write([]string{t.Task, strconv.FormatBool(t.IsDone), t.CreatedAt, t.Deadline, strconv.Itoa(t.Priority), t.Details, t.Link})
		}
		writer.Flush()
	})))

	// CSVインポート (Goroutine)
	http.HandleFunc("POST /todos/import", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		file, _, err := r.FormFile("csv_file")
		if err != nil {
			http.Error(w, "File error", http.StatusBadRequest)
			return
		}
		defer file.Close()

		reader := csv.NewReader(file)
		reader.FieldsPerRecord = -1
		reader.Read()
		records, _ := reader.ReadAll()

		var validRecords [][]string
		for _, record := range records {
			if len(record) >= 7 {
				validRecords = append(validRecords, record)
			}
		}

		chunkSize := 5000
		var wg sync.WaitGroup
		sem := make(chan struct{}, 10)

		for i := 0; i < len(validRecords); i += chunkSize {
			end := i + chunkSize
			if end > len(validRecords) {
				end = len(validRecords)
			}
			chunk := validRecords[i:end]

			wg.Add(1)
			sem <- struct{}{}

			go func(c [][]string) {
				defer wg.Done()
				defer func() { <-sem }()
				tx, _ := db.Begin()
				stmt, _ := tx.Prepare("INSERT INTO todos_v3 (task, is_done, created_at, deadline, priority, details, link) VALUES ($1, $2, $3, $4, $5, $6, $7)")
				for _, record := range c {
					isDone := record[ 1 ] == "true"
					priority, _ := strconv.Atoi(record[ 4 ])
					stmt.Exec(record[ 0 ], isDone, record[ 2 ], record[ 3 ], priority, record[ 5 ], record[ 6 ])
				}
				stmt.Close()
				tx.Commit()
			}(chunk)
		}
		wg.Wait()
		w.WriteHeader(http.StatusOK)
	})))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Println("サーバー起動: http://localhost:" + port)
	http.ListenAndServe(":"+port, nil)
}