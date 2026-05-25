import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Trash2, CalendarClock, Star, Link as LinkIcon } from 'lucide-react';
import type { Todo } from '../types';

interface TodoListProps {
  todos: Todo[];
  isLoading: boolean;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function TodoList({ todos, isLoading, onToggle, onDelete }: TodoListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
      {/* 【変更1】mode="popLayout" を削除し、連打時のアニメーション衝突を防ぐ */}
      <AnimatePresence>
        {todos.map((todo) => (
          <motion.li
            // 【変更2】layout を "position" にし、位置の移動アニメーションだけに集中させる
            layout="position"
            key={todo.id}
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`group flex items-start justify-between p-4 rounded-2xl border transition-all duration-300 ${
              todo.is_done ? 'bg-slate-50/50 border-transparent shadow-sm' : 'bg-white border-indigo-50 shadow-md hover:shadow-lg hover:border-indigo-100'
            }`}
          >
            <div className="flex items-start gap-4 flex-1 cursor-pointer" onClick={() => onToggle(todo.id)}>
              <motion.div whileTap={{ scale: 0.8 }} className="mt-1">
                {todo.is_done ? <CheckCircle2 className="text-indigo-400 w-7 h-7 drop-shadow-sm" /> : <Circle className="text-slate-300 w-7 h-7 group-hover:text-indigo-300 transition-colors" />}
              </motion.div>
              
              <div className="flex flex-col flex-1 min-w-0">
                <span className={`text-lg font-medium transition-all duration-300 ${todo.is_done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {todo.task}
                </span>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2 text-xs font-semibold">
                  <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded-md">作成: {todo.created_at || '日時なし'}</span>
                  {todo.deadline && (
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-md ${todo.is_done ? 'text-slate-500 bg-slate-100' : 'text-rose-600 bg-rose-50'}`}>
                      <CalendarClock size={12} /> 期限: {todo.deadline.replace('T', ' ')}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                    <Star size={12} fill="currentColor" /> 重要度: {todo.priority || 3}
                  </span>
                </div>

                {todo.details && (
                  <div className={`mt-3 text-sm p-3 rounded-xl whitespace-pre-wrap border ${todo.is_done ? 'text-slate-400 bg-slate-100/50 border-slate-100' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                    {todo.details}
                  </div>
                )}

                {todo.link && (
                  <a href={todo.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`mt-3 inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg transition-colors w-fit ${todo.is_done ? 'text-slate-400 bg-slate-100 hover:bg-slate-200' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}>
                    <LinkIcon size={14} /> リンクを開く
                  </a>
                )}
              </div>
            </div>

            <button onClick={() => onDelete(todo.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 mt-1">
              <Trash2 size={20} />
            </button>
          </motion.li>
        ))}
        
        {todos.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 text-slate-400 font-medium">
            タスクが見つかりません
          </motion.div>
        )}
      </AnimatePresence>
    </ul>
  );
}