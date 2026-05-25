// 【変更後】（分けて、typeを明記する）
import { useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, Star, FileText, Link as LinkIcon, Plus } from 'lucide-react';

interface TodoFormProps {
  onAdd: (task: string, deadline: string, priority: number, details: string, link: string) => Promise<void>;
  onError: (msg: string) => void;
}

export default function TodoForm({ onAdd, onError }: TodoFormProps) {
  const [newTask, setNewTask] = useState<string>('');
  const [newDeadline, setNewDeadline] = useState<string>('');
  const [newPriority, setNewPriority] = useState<number>(3);
  const [newDetails, setNewDetails] = useState<string>('');
  const [newLink, setNewLink] = useState<string>('');
  
  const [customDays, setCustomDays] = useState<number>(1);
  const [customTime, setCustomTime] = useState<string>('12:00');

  const formatDateTime = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const setQuickDeadline = (type: 'tomorrow' | 'clear') => {
    if (type === 'clear') {
      setNewDeadline('');
      return;
    }
    const targetDate = new Date();
    if (type === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
    setNewDeadline(formatDateTime(targetDate));
  };

  const setCustomDeadline = () => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + customDays);
    const [h, m] = customTime.split(':');
    targetDate.setHours(Number(h), Number(m), 0, 0);
    setNewDeadline(formatDateTime(targetDate));
  };

  // ← 修正: React.FormEvent から FormEvent に変更
  //const handleSubmit = async (e: FormEvent) => { 
    // 【変更後】（HTMLのフォーム要素から発生したイベントだよ、と具体的に教える）
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTask.trim() || !newDeadline) {
      onError('「タスク名」と「期限」は必須項目です。入力してください。');
      return;
    }
    await onAdd(newTask, newDeadline, newPriority, newDetails, newLink);
    setNewTask(''); setNewDeadline(''); setNewPriority(3); setNewDetails(''); setNewLink('');
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8 bg-white/60 p-5 border border-indigo-100 rounded-3xl shadow-inner flex flex-col gap-4 relative">
      <div className="relative">
        <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="新しいタスクを入力..." className="w-full px-4 py-3 bg-white/80 border border-indigo-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-slate-700 text-lg font-medium pr-16 shadow-sm" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-md">必須</span>
      </div>
      
      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex-1 min-w-[250px] flex flex-col gap-2">
          <div className="relative flex items-center bg-white/80 border border-indigo-50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all h-[42px] shadow-sm">
            <CalendarClock className="text-indigo-400 mr-2" size={18} />
            <span className="text-sm font-bold text-slate-500 mr-2 whitespace-nowrap">期限:</span>
            <input type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="w-full bg-transparent focus:outline-none text-slate-700 text-sm font-medium pr-12" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-sm">必須</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 bg-indigo-50/50 p-2 rounded-xl">
            <button type="button" onClick={() => setQuickDeadline('tomorrow')} className="text-xs font-bold px-3 py-1.5 bg-white text-indigo-600 shadow-sm rounded-lg hover:bg-indigo-50 transition-all whitespace-nowrap">明日(現時刻)</button>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-white px-2 py-1 shadow-sm rounded-lg border border-indigo-100 flex-1 min-w-[180px]">
              <input type="number" min="0" className="w-10 text-center focus:outline-none bg-slate-50 rounded text-indigo-600" value={customDays} onChange={e => setCustomDays(Number(e.target.value))} />日後の
              <input type="time" className="focus:outline-none bg-slate-50 rounded px-1 text-indigo-600" value={customTime} onChange={e => setCustomTime(e.target.value)} />
              <button type="button" onClick={setCustomDeadline} className="ml-auto px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors">設定</button>
            </div>
            <button type="button" onClick={() => setQuickDeadline('clear')} className="text-xs font-bold px-3 py-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">クリア</button>
          </div>
        </div>
        
        <div className="flex items-center bg-white/80 border border-indigo-50 rounded-xl px-3 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all h-[42px] min-w-[120px] shadow-sm">
          <Star className="text-amber-400 mr-2" size={18} />
          <select value={newPriority} onChange={(e) => setNewPriority(Number(e.target.value))} className="appearance-none bg-transparent focus:outline-none text-slate-700 text-sm font-bold cursor-pointer w-full">
            <option value="5">5 (最高)</option><option value="4">4 (高)</option><option value="3">3 (中)</option><option value="2">2 (低)</option><option value="1">1 (最低)</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <div className="flex items-start bg-white/80 border border-indigo-50 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all shadow-sm">
          <FileText className="text-indigo-300 mr-2 mt-0.5" size={18} />
          <textarea value={newDetails} onChange={(e) => setNewDetails(e.target.value)} placeholder="タスクの詳細メモを追加 (任意)..." rows={2} className="w-full bg-transparent focus:outline-none text-slate-700 text-sm resize-none custom-scrollbar" />
        </div>
        <div className="flex items-center bg-white/80 border border-indigo-50 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all shadow-sm">
          <LinkIcon className="text-indigo-300 mr-2" size={18} />
          <input type="url" value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="参考リンクのURL (任意)..." className="w-full bg-transparent focus:outline-none text-slate-700 text-sm" />
        </div>
      </div>

      <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 flex items-center justify-center transition-all shadow-md active:scale-95 font-bold mt-2">
        <Plus size={20} className="mr-1" /> タスクを追加する
      </button>
    </form>
  );
}