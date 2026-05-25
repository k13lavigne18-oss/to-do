package main

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync" // ←【追加】並列処理の同期に使うパッケージ
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

func main() {
	var err error
	
	connStr := "postgres://localhost/todo_db?sslmode=disable"
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	// 【追加】Goroutineで一斉にDBにアクセスするため、接続数の上限を上げておく
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
	http.HandleFunc("POST /todos", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		var newTodo Todo
		json.NewDecoder(r.Body).Decode(&newTodo)

		now := time.Now().Format("2006/01/02 15:04")

		err := db.QueryRow(
			"INSERT INTO todos_v3 (task, created_at, deadline, priority, details, link) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
			newTodo.Task, now, newTodo.Deadline, newTodo.Priority, newTodo.Details, newTodo.Link,
		).Scan(&newTodo.ID)
		
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}))

	// [R] GET: 一覧取得 (★バックエンド検索対応版)
	http.HandleFunc("GET /todos", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		// 1. Reactから送られてきた検索ワードを受け取る
		searchQuery := r.URL.Query().Get("q")
		
		var rows *sql.Rows
		var err error

		if searchQuery != "" {
			// 2. 検索ワードがある場合は、タスク名か詳細にその文字が含まれるものを探して100件返す
			searchTerm := "%" + searchQuery + "%"
			rows, err = db.Query("SELECT id, task, is_done, created_at, deadline, priority, details, link FROM todos_v3 WHERE task ILIKE $1 OR details ILIKE $1 ORDER BY id DESC LIMIT 100", searchTerm)
		} else {
			// 3. 検索ワードがない場合は、最新の100件を返す
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
	http.HandleFunc("PUT /todos/{id}", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.Atoi(r.PathValue("id"))
		_, err := db.Exec("UPDATE todos_v3 SET is_done = NOT is_done WHERE id = $1", id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	// [D] DELETE: タスク削除
	http.HandleFunc("DELETE /todos/{id}", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		id, _ := strconv.Atoi(r.PathValue("id"))
		_, err := db.Exec("DELETE FROM todos_v3 WHERE id = $1", id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))

	// CSVエクスポート
	http.HandleFunc("GET /todos/export", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment;filename=todos.csv")
		writer := csv.NewWriter(w)
		writer.Write([]string{"task", "is_done", "created_at", "deadline", "priority", "details", "link"})

		rows, _ := db.Query("SELECT task, is_done, created_at, deadline, priority, details, link FROM todos_v3 ORDER BY id DESC")
		defer rows.Close()

		for rows.Next() {
			var t Todo
			rows.Scan(&t.Task, &t.IsDone, &t.CreatedAt, &t.Deadline, &t.Priority, &t.Details, &t.Link)
			writer.Write([]string{
				t.Task, strconv.FormatBool(t.IsDone), t.CreatedAt,
				t.Deadline, strconv.Itoa(t.Priority), t.Details, t.Link,
			})
		}
		writer.Flush()
	}))

	// CSVインポート (★Goroutineによる超高速並列処理版)
	http.HandleFunc("POST /todos/import", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		file, _, err := r.FormFile("csv_file")
		if err != nil {
			http.Error(w, "ファイルの読み込みに失敗しました", http.StatusBadRequest)
			return
		}
		defer file.Close()

		reader := csv.NewReader(file)
		reader.FieldsPerRecord = -1
		reader.Read()
		records, err := reader.ReadAll()
		if err != nil {
			http.Error(w, "CSVの解析に失敗しました", http.StatusBadRequest)
			return
		}

		// 安全なデータだけを抽出
		var validRecords [][]string
		for _, record := range records {
			if len(record) >= 7 {
				validRecords = append(validRecords, record)
			}
		}

		// --- ここからGoroutineの魔法 ---
		chunkSize := 5000 // 5000件ずつに切り分ける
		var wg sync.WaitGroup
		sem := make(chan struct{}, 10) // 同時に走るGoroutineを「最大10人」に制限（DBパンク防止）

		// データをチャンクごとに切り分けて並列実行
		for i := 0; i < len(validRecords); i += chunkSize {
			end := i + chunkSize
			if end > len(validRecords) {
				end = len(validRecords)
			}
			chunk := validRecords[i:end] // 5000件の塊

			wg.Add(1) // 作業員を1人追加
			sem <- struct{}{} // チケットを取る（10人埋まっていたらここで待機）

			go func(c [][]string) {
				defer wg.Done() // 終わったら作業員を減らす
				defer func() { <-sem }() // チケットを返す

				// このGoroutine専用のトランザクションを開始
				tx, _ := db.Begin()
				stmt, _ := tx.Prepare("INSERT INTO todos_v3 (task, is_done, created_at, deadline, priority, details, link) VALUES ($1, $2, $3, $4, $5, $6, $7)")
				
				for _, record := range c {
					isDone := record[ 1 ] == "true"
					priority, _ := strconv.Atoi(record[ 4 ])
					stmt.Exec(record[ 0 ], isDone, record[ 2 ], record[ 3 ], priority, record[ 5 ], record[ 6 ])
				}
				
				stmt.Close()
				tx.Commit() // 5000件を一気に書き込む！
			}(chunk)
		}

		wg.Wait() // 全員（すべてのGoroutine）の作業が終わるまで待つ
		// --- 魔法ここまで ---

		w.WriteHeader(http.StatusOK)
	}))

	fmt.Println("サーバー起動: http://localhost:8080")
	http.ListenAndServe(":8080", nil)
}