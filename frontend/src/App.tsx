import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, Server, Database, Code2, Settings, AlertTriangle, AlertCircle, Search, ArrowDownAZ, ArrowUpZA, FileText } from 'lucide-react';

import type { Todo, SortField, SortOrder } from './types';
import TodoForm from './components/TodoForm';
import TodoList from './components/TodoList';

// 環境変数から本番環境のURLを取得
const API_URL = import.meta.env.VITE_API_URL || '';

// ★あなたの指摘から生まれた神リファクタリング！
// APIのパスを渡すだけで、自動的に正しいURLを作ってくれる専用関数
const endpoint = (path: string) => `${API_URL}${path}`;

const authHeaders = {
  'Authorization': 'Basic ' + btoa('admin:password'),
  'Content-Type': 'application/json'
};

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string>(''); 

  const [isDeleteConfirmEnabled, setIsDeleteConfirmEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('isDeleteConfirmEnabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('isDeleteConfirmEnabled', JSON.stringify(isDeleteConfirmEnabled));
  }, [isDeleteConfirmEnabled]);


  // --- API通信系（endpoint関数を使って劇的にスッキリ！） ---

  const fetchTodos = async (query: string = '') => {
    try {
      const urlPath = query ? `/api/todos?q=${encodeURIComponent(query)}` : '/api/todos';
      // ★ 5回書いていた複雑な記述が、たったこれだけに！
      const res = await fetch(endpoint(urlPath), { headers: authHeaders });
      
      if (!res.ok) throw new Error('Network error');
      const data: Todo[] = await res.json();
      setTodos(data);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTodos(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addTodo = async (task: string, deadline: string, priority: number, details: string, link: string) => {
    try {
      await fetch(endpoint('/api/todos'), { // ★ スッキリ！
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ task, deadline, priority, details, link })
      });
      fetchTodos(searchQuery);
    } catch (error) { console.error(error); }
  };

  const toggleTodo = async (id: number) => {
    try {
      await fetch(endpoint(`/api/todos/${id}`), { method: 'PUT', headers: authHeaders }); // ★ スッキリ！
      fetchTodos(searchQuery);
    } catch (error) { console.error(error); }
  };

  const requestDelete = (id: number) => {
    if (isDeleteConfirmEnabled) setPendingDeleteId(id);
    else executeDelete(id);
  };

  const executeDelete = async (id: number) => {
    try {
      await fetch(endpoint(`/api/todos/${id}`), { method: 'DELETE', headers: authHeaders }); // ★ スッキリ！
      setPendingDeleteId(null);
      fetchTodos(searchQuery);
    } catch (error) { console.error(error); }
  };

  // --- CSV機能 ---
  const exportCSV = async () => {
    try {
      const res = await fetch(endpoint('/api/todos/export'), { headers: authHeaders }); // ★ スッキリ！
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'todos_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); }
  };

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const file = files ? files[ 0 ] : null;
    if (!file) return;
    
    setIsLoading(true);
    const formData = new FormData();
    formData.append('csv_file', file);

    try {
      const uploadHeaders = new Headers();
      uploadHeaders.set('Authorization', 'Basic ' + btoa('admin:password'));

      await fetch(endpoint('/api/todos/import'), { // ★ スッキリ！
        method: 'POST',
        headers: uploadHeaders,
        body: formData
      });
      fetchTodos();
      setSearchQuery('');
    } catch (error) { console.error(error); }
  };

  // --- 検索・並び替え処理 ---
  const processedTodos = [...todos].sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;

    let valA: any = a[sortField];
    let valB: any = b[sortField];
    
    if (sortField === 'deadline') {
      valA = a.deadline || '9999-12-31T23:59';
      valB = b.deadline || '9999-12-31T23:59';
    }
    
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4 font-sans text-slate-800 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/30 rounded-full blur-[100px]" />

      <button onClick={() => setIsSettingsOpen(true)} className="absolute top-6 right-20 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all shadow-lg border border-white/10 z-10">
        <Settings size={24} />
      </button>
      <button onClick={() => setIsModalOpen(true)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all shadow-lg border border-white/10 z-10">
        <Info size={24} />
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-[2rem] w-full max-w-2xl p-8 border border-white/40 z-10 flex flex-col max-h-[90vh]"
      >
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-8 text-center tracking-tight shrink-0">
          Modern Tasks
        </h1>

        <TodoForm onAdd={addTodo} onError={setValidationError} />

        <div className="mb-4 flex gap-3 shrink-0">
          <label className="flex-1 flex items-center justify-center gap-2 text-sm px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors cursor-pointer shadow-sm">
            <Database size={16} />
            CSVインポート (一括登録)
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>
          <button onClick={exportCSV} className="flex-1 flex items-center justify-center gap-2 text-sm px-4 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm">
            <FileText size={16} />
            CSVエクスポート (DL)
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 bg-white/40 p-3 rounded-2xl border border-white/50 shrink-0">
          <div className="flex-1 flex items-center bg-white border border-indigo-100 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all shadow-sm min-w-[200px]">
            <Search className="text-indigo-300 mr-2" size={18} />
            <input type="text" placeholder="タスク・詳細を検索 (バックエンド検索)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent focus:outline-none text-slate-700 text-sm font-medium" />
          </div>
          <div className="flex items-center bg-white border border-indigo-100 rounded-xl px-3 py-2 shadow-sm">
            <select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)} className="bg-transparent focus:outline-none text-slate-700 text-sm font-bold cursor-pointer pr-2">
              <option value="created_at">作成日時</option><option value="deadline">期限</option><option value="priority">重要度</option>
            </select>
            <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="ml-2 p-1 text-indigo-500 hover:bg-indigo-50 rounded-md transition-colors" title={sortOrder === 'asc' ? "昇順" : "降順"}>
              {sortOrder === 'asc' ? <ArrowUpZA size={18} /> : <ArrowDownAZ size={18} />}
            </button>
          </div>
        </div>

        <TodoList todos={processedTodos} isLoading={isLoading} onToggle={toggleTodo} onDelete={requestDelete} />
      </motion.div>

      {/* --- モーダル群 (省略せずに完全なままです) --- */}
      <AnimatePresence>
        {validationError && (
          <motion.div key="validation" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setValidationError('')} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative z-10 text-center border-2 border-rose-100">
              <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">入力エラー</h3>
              <p className="text-slate-600 mb-6 font-medium text-sm">{validationError}</p>
              <button onClick={() => setValidationError('')} className="w-full py-3 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-colors shadow-sm shadow-rose-500/30">OK</button>
            </motion.div>
          </motion.div>
        )}

        {isModalOpen && (
          <motion.div key="info" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative z-10">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Info className="text-indigo-500" /> Architecture Overview</h2>
              <div className="space-y-6">
                <div className="flex gap-4"><div className="bg-blue-50 text-blue-600 p-3 rounded-2xl h-fit"><Code2 size={24} /></div><div><h3 className="font-bold text-slate-800">Frontend (React + TS)</h3><p className="text-sm text-slate-600 mt-1">コンポーネント分割によるスケーラブルな設計。</p></div></div>
                <div className="flex gap-4"><div className="bg-cyan-50 text-cyan-600 p-3 rounded-2xl h-fit"><Server size={24} /></div><div><h3 className="font-bold text-slate-800">Backend (Go REST API)</h3><p className="text-sm text-slate-600 mt-1">Goroutineによる超高速並列処理。DBバックエンド検索実装済。</p></div></div>
                <div className="flex gap-4"><div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl h-fit"><Database size={24} /></div><div><h3 className="font-bold text-slate-800">Database & Infra</h3><p className="text-sm text-slate-600 mt-1">PostgreSQLで永続化。Split Deployアーキテクチャ採用。</p></div></div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isSettingsOpen && (
          <motion.div key="settings" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative z-10">
              <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"><X size={24} /></button>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Settings className="text-slate-500" /> Settings</h2>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" className="sr-only" checked={isDeleteConfirmEnabled} onChange={(e) => setIsDeleteConfirmEnabled(e.target.checked)} />
                  <div className={`w-11 h-6 rounded-full transition-colors ${isDeleteConfirmEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                  <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${isDeleteConfirmEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
                <span className="text-slate-700 font-medium group-hover:text-slate-900 transition-colors">削除時に確認ポップアップを表示</span>
              </label>
            </motion.div>
          </motion.div>
        )}

        {pendingDeleteId !== null && (
          <motion.div key="delete" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPendingDeleteId(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 relative z-10 text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">タスクを削除しますか？</h3>
              <p className="text-slate-500 mb-6 text-sm">この操作は取り消せません。<br/>本当に削除してもよろしいですか？</p>
              <div className="flex gap-3">
                <button onClick={() => setPendingDeleteId(null)} className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors">キャンセル</button>
                <button onClick={() => executeDelete(pendingDeleteId)} className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition-colors shadow-sm shadow-rose-500/30">削除する</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}