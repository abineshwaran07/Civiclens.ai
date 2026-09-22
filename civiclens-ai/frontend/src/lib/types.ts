export type Lang = "en" | "ta";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "citizen" | "officer";
  preferred_language: Lang;
}

export interface Source {
  id: number;
  title: string;
  section: string;
  department: string | null;
  url: string | null;
  score: number;
  snippet: string;
}

export interface ChatReply {
  answer: string;
  language: Lang;
  grounded: boolean;
  mode: "gemini" | "offline";
  sources: Source[];
}

export interface Scheme {
  slug: string;
  name: string;
  name_ta: string | null;
  department: string;
  level: string;
  category: string;
  url: string | null;
  sections: Record<string, string>;
}

export type Priority = "low" | "medium" | "high" | "urgent";
export type Status = "submitted" | "in_review" | "in_progress" | "resolved" | "rejected";

export interface Analysis {
  title: string;
  category: string;
  department: string;
  priority: Priority;
  summary: string;
  draft: string;
  missing_info: string[];
  mode: "gemini" | "offline";
}

export interface GrievanceEvent {
  status: Status;
  note: string | null;
  actor_role: string;
  created_at: string;
}

export interface Grievance {
  id: number;
  tracking_id: string;
  title: string;
  description: string;
  category: string;
  department: string;
  priority: Priority;
  status: Status;
  location: string | null;
  language: Lang;
  ai_summary: string | null;
  ai_draft: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  events: GrievanceEvent[];
}

export interface OfficerGrievance extends Grievance {
  citizen_name: string;
  citizen_email: string;
}

export interface Tracked {
  tracking_id: string;
  title: string;
  category: string;
  department: string;
  priority: Priority;
  status: Status;
  created_at: string;
  updated_at: string;
  events: GrievanceEvent[];
}

export interface Stats {
  total: number;
  open: number;
  resolved: number;
  overdue: number;
  avg_resolution_hours: number | null;
  by_status: Record<string, number>;
  by_category: { name: string; count: number }[];
  by_priority: Record<string, number>;
  trend: { date: string; new: number; resolved: number }[];
}

export interface KnowledgeSource {
  title: string;
  department: string | null;
  url: string | null;
  chunks: number;
}
