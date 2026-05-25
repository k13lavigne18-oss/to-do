export interface Todo {
  id: number;
  task: string;
  is_done: boolean;
  created_at: string;
  deadline: string;
  priority: number;
  details: string;
  link: string;
}

export type SortField = 'created_at' | 'deadline' | 'priority';
export type SortOrder = 'asc' | 'desc';