import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ScanUpload from "./ScanUpload";
import { api, ApiError, download, type Page as P, type S } from "@/api/client";
import { Icon } from "@/components/Icon";
import { Button, ErrorBox, FileDrop, PageHeader, Tabs } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { CountUp, ease, Page } from "@/motion";

type Job = S["BulkJobOut"];

export default function Bulk() {
  const { t, n, date } = useI18n();
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<number | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sp, setSp] = useSearchParams();
  const mode = (sp.get("tab") === "excel" ? "excel" : "scan") as "scan" | "excel";

  const job = useQuery({
    queryKey: ["job", jobId], enabled: !!jobId, queryFn: () => api<Job>(`/bulk/jobs/${jobId}`),
    refetchInterval: (q) => (q.state.data && ["done", "failed"].includes(q.state.data.status) ? false : 1200),
  });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => api<P<Job>>("/bulk/jobs", { query: { page_size: 8 } }) });

  const upload = async (file: File) => {
    setErr(null); setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const j = await api<Job>("/bulk/upload", { form: fd });
      setJobId(j.id); qc.invalidateQueries({ queryKey: ["jobs"] });
    } catch (x) { setErr(x as ApiError); } finally { setUploading(false); }
  };
  const j = job.data;
  const done = j?.status === "done";
  useEffect(() => { if (done) qc.invalidateQueries({ queryKey: ["jobs"] }); }, [done, qc]);

  return (
    <Page>
      <PageHeader title={t("nav_upload")} sub={mode === "scan" ? t("scan_sub") : t("bulk_sub")}
        actions={mode === "excel" && <Button variant="secondary" icon="download" onClick={() => download("/bulk/template", undefined, "dishari_template.xlsx")}>{t("get_template")}</Button>} />
      <Tabs value={mode} onChange={(m) => setSp({ tab: m }, { replace: true })} items={[{ id: "scan", label: t("tab_scan") }, { id: "excel", label: t("tab_excel") }]} />
      {mode === "scan" ? <ScanUpload /> : (
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <FileDrop accept=".xlsx,.xlsm,.csv" onFile={upload} busy={uploading} label={t("drop_file")} sub={t("file_rules")} />
          {err && <ErrorBox error={err} />}
          <AnimatePresence>
            {j && (
              <motion.section key={j.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ ease }} className="card">
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${done ? "bg-[#E3F1E3] text-ok" : j.status === "failed" ? "bg-[#FBE7E5] text-err" : "bg-maroon-tint text-maroon"}`}>
                    <Icon name={done ? "check" : j.status === "failed" ? "alert" : "spinner"} className={`h-5 w-5 ${!done && j.status !== "failed" ? "animate-spin" : ""}`} />
                  </span>
                  <div className="min-w-0 flex-1"><b className="block truncate">{j.filename}</b>
                    <span className="text-sm text-ink-2">{done ? t("job_done") : j.status === "failed" ? t("job_failed") : t("job_running", { p: j.processed, n: j.total || 0 })}</span></div>
                  <span className="text-2xl font-bold tabular-nums text-maroon">{n(Math.round((j.progress || 0) * 100))}%</span>
                </div>
                <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-head">
                  <motion.div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold to-maroon" animate={{ width: `${(j.progress || 0) * 100}%` }} transition={{ duration: 0.6, ease }} />
                  {!done && <motion.div className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/60 to-transparent" animate={{ x: ["-100px", "600px"] }} transition={{ repeat: Infinity, duration: 1.4 }} />}
                </div>
                {done && (
                  <>
                    <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                      {[[t("ok_rows"), j.succeeded - j.needs_review, "text-ok"], [t("review_rows"), j.needs_review, "text-warn"], [t("err_rows"), j.failed, "text-err"]].map(([l, v, c]) => (
                        <div key={l as string} className="rounded-card bg-head p-3"><div className={`text-2xl font-bold ${c}`}><CountUp to={v as number} /></div><div className="text-xs text-ink-2">{l}</div></div>
                      ))}
                    </div>
                    {j.errors.length > 0 && (
                      <div className="mt-4 max-h-48 overflow-auto rounded-lg border border-line">
                        <table className="tbl"><thead><tr><th>{t("row")}</th><th>Code</th><th>{t("comment")}</th></tr></thead>
                          <tbody>{(j.errors as { row: number; code: string; message: string }[]).slice(0, 50).map((e, i) => <tr key={i}><td>{n(e.row)}</td><td><code className="text-xs text-err">{e.code}</code></td><td>{e.message}</td></tr>)}</tbody></table>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {j.result_url && <Button icon="download" onClick={() => download(`/bulk/jobs/${j.id}/results`, undefined, "results.xlsx")}>{t("download_results")}</Button>}
                      <Link to={`/app/questions?bulk_job_id=${j.id}`}><Button variant="secondary" icon="database">{t("view_questions")}</Button></Link>
                    </div>
                  </>
                )}
              </motion.section>
            )}
          </AnimatePresence>
        </div>
        <section className="card self-start">
          <h2 className="h3 mb-3">{t("recent_jobs")}</h2>
          {jobs.data?.items.length ? (
            <ul className="divide-y divide-line">
              {jobs.data.items.map((x) => (
                <li key={x.id}><button onClick={() => setJobId(x.id)} className="flex w-full items-center gap-3 py-3 text-left hover:text-maroon">
                  <Icon name="file" className="h-4 w-4 text-ink-3" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{x.filename}</span><span className="text-xs text-ink-3">{date(x.created_at)} · {n(x.succeeded)}/{n(x.total)}</span></span>
                  <span className={`chip ${x.status === "done" ? "border-ok/30 bg-[#E3F1E3] text-ok" : x.status === "failed" ? "border-err/30 bg-[#FBE7E5] text-err" : "border-line bg-head text-ink-2"}`}>{x.status}</span>
                </button></li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-sm text-ink-3">{t("empty")}</p>}
        </section>
      </div>)}
    </Page>
  );
}
