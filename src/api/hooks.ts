import { useQuery } from "@tanstack/react-query";
import { api, type Page, type Question, type S } from "./client";

export type Taxonomy = S["TaxonomyOut"];
export type Chapter = S["ChapterOut"];

/** Whole taxonomy tree, cached for the session. */
export function useTaxonomy() {
  return useQuery({ queryKey: ["taxonomy"], queryFn: () => api<Taxonomy>("/taxonomy"), staleTime: Infinity });
}

export function useMlStatus() {
  return useQuery({ queryKey: ["ml-status"], queryFn: () => api<{ status: string; version: string; impl: string; review_threshold: number }>("/ml/status"), staleTime: 60_000 });
}

export type QFilters = { q?: string; status?: string; language?: string; chapter_id?: string; level?: string; difficulty?: string; board?: boolean; mine?: boolean; bulk_job_id?: number; page?: number; page_size?: number; sort?: string };
export function useQuestions(f: QFilters) {
  return useQuery({ queryKey: ["questions", f], queryFn: () => api<Page<Question>>("/questions", { query: f as Record<string, unknown> }), placeholderData: (p) => p });
}

export type Dashboard = {
  roles: string[];
  ml: { status: string; version: string };
  questions?: { total: number; by_status: Record<string, number>; by_level: Record<string, number>; mine: number };
  review?: { queue: number; open_reports: number };
  admin?: { users: number; board_questions: number; pending_untagged: number; pending_teachers: number; questions_tagged: number; teacher_corrections: number };
  teacher?: { pending_review: number; bank: number; exams: number; tests: number; papers: number; class_average: number | null;
    weak_topics: { name_en: string | null; name_bn: string | null; accuracy: number; total: number }[];
    recent_uploads: { id: number; filename: string; status: string; total: number; processed: number; needs_review: number; created_at: string }[] };
  student?: { recent: { id: number; score: number; total: number; submitted_at: string }[]; sessions_done: number };
};
export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
}

/** helpers on the taxonomy tree */
export function conceptsOf(tax: Taxonomy | undefined, chapterId?: string | null) {
  return tax?.chapters.find((c) => c.id === chapterId)?.concepts ?? [];
}
export function topicsOf(tax: Taxonomy | undefined, chapterId?: string | null, conceptId?: string | null) {
  return conceptsOf(tax, chapterId).find((c) => c.id === conceptId)?.topics ?? [];
}

export type Summary = {
  student: { id: number; name: string; class_level: string | null; institution: string | null; section: string | null };
  latest: { kind: string; title: string | null; score: number; total: number; when: string; class_average: number | null } | null;
  progress: { title: string | null; kind: string; pct: number; when: string }[];
  weak_topics: { concept_id: string; name_en: string | null; name_bn: string | null; mastery: number; label: string }[];
  weak_levels: string[];
  upcoming: { id: number; title: string; start_at: string; end_at: string; duration_min: number }[];
  feedback: { id: number; from_name: string | null; context: string | null; message: string; created_at: string }[];
  unread_feedback: number;
};
export function useSummary(sid?: number | null) {
  return useQuery({ queryKey: ["summary", sid], queryFn: () => api<Summary>(`/students/${sid}/summary`), enabled: !!sid });
}
