import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError, download, type Page as P, type User } from "@/api/client";
import { useMlStatus, useTaxonomy } from "@/api/hooks";
import { useAuth } from "@/auth/Auth";
import { Icon } from "@/components/Icon";
import { Button, Chip, Empty, ErrorBox, Field, FileDrop, Input, Modal, PageHeader, Pager, Select, SkeletonRows, Stat, Tabs, useToast } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import type { StrKey } from "@/i18n/strings";
import { CountUp, ease, Page } from "@/motion";

type Tab = "users" | "taxonomy" | "board" | "audit" | "models";

export default function Admin() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "users";
  return (
    <Page>
      <PageHeader title={t("admin_title")} />
      <Tabs value={tab} onChange={(v) => setSp({ tab: v })} items={[
        { id: "users", label: t("tab_users") }, { id: "taxonomy", label: t("tab_taxonomy") }, { id: "board", label: t("tab_board") },
        { id: "models", label: t("tab_models") }, { id: "audit", label: t("tab_audit") },
      ]} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease }}>
          {tab === "users" && <Users />}{tab === "taxonomy" && <Taxonomy />}{tab === "board" && <Board />}{tab === "audit" && <Audit />}{tab === "models" && <Models />}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

const ROLES = ["admin", "teacher", "moderator", "student", "parent"] as const;

function Users() {
  const { t, date } = useI18n();
  const [q, setQ] = useState(""); const [role, setRole] = useState(""); const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<User | "new" | null>(null);
  const users = useQuery({ queryKey: ["users", q, role, page], queryFn: () => api<P<User>>("/users", { query: { q, role, page, page_size: 20 } }), placeholderData: (p) => p });
  return (
    <>
      <PendingTeachers />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" /><Input className="pl-9" placeholder={`${t("name")} / ${t("email")}`} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Select className="!w-auto" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">{t("role")}: {t("all")}</option>{ROLES.map((r) => <option key={r} value={r}>{t(`r_${r}`)}</option>)}</Select>
        <Button icon="plus" onClick={() => setEdit("new")}>{t("add_user")}</Button>
      </div>
      {users.isLoading ? <SkeletonRows /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("roles")}</th><th>{t("status")}</th><th>{t("date")}</th><th></th></tr></thead>
            <tbody>{users.data?.items.map((u) => (
              <tr key={u.id}>
                <td className="font-medium"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-maroon-tint text-xs font-bold text-maroon">{u.name[0]}</span>{u.name}</td>
                <td className="text-ink-2">{u.email}</td>
                <td><div className="flex flex-wrap gap-1">{u.roles.map((r) => <span key={r} className="chip border-line bg-white text-ink-2">{t(`r_${r}` as StrKey)}</span>)}</div></td>
                <td><span className={`chip ${u.status === "active" ? "border-ok/30 bg-[#E3F1E3] text-ok" : u.status === "pending" ? "border-info/30 bg-[#E6EEF8] text-info" : u.status === "rejected" ? "border-err/30 bg-[#FBE9E9] text-err" : "border-line bg-head text-ink-3"}`}>{t(u.status === "active" ? "active" : u.status === "pending" ? "status_pending" : u.status === "rejected" ? "status_rejected" : "disabled")}</span></td>
                <td className="text-ink-3">{date(u.created_at)}</td>
                <td><button className="font-semibold text-maroon hover:underline" onClick={() => setEdit(u)}>{t("edit")}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {users.data && <Pager page={page} total={users.data.total} pageSize={20} onPage={setPage} />}
      {edit && <UserPanel user={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function UserPanel({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: user?.name || "", email: user?.email || "", password: "", roles: user?.roles || ["teacher"], status: user?.status || "active" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      if (user) await api(`/users/${user.id}`, { method: "PATCH", body: { name: f.name, email: f.email, roles: f.roles, status: f.status, ...(f.password ? { password: f.password } : {}) } });
      else await api("/users", { body: { name: f.name, email: f.email, password: f.password, roles: f.roles } });
      qc.invalidateQueries({ queryKey: ["users"] }); toast(t("saved")); onClose();
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Modal open side onClose={onClose} title={user ? t("edit_user") : t("add_user")}>
      <div className="space-y-4">
        <Field label={t("name")} error={err?.fields?.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t("email")} error={err?.fields?.email}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label={user ? t("new_pw_optional") : t("password")} hint={t("pw_rule")} error={err?.fields?.password}><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Field label={t("roles")}><div className="flex flex-wrap gap-2">{ROLES.map((r) => <Chip key={r} active={f.roles.includes(r)} onClick={() => setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] })}>{t(`r_${r}`)}</Chip>)}</div></Field>
        {user && <Field label={t("status")}><div className="flex gap-2">{(["active", "disabled"] as const).map((s) => <Chip key={s} active={f.status === s} onClick={() => setF({ ...f, status: s })}>{t(s)}</Chip>)}</div></Field>}
        {err && !Object.keys(err.fields).length && <p className="text-sm text-err">{err.message}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="ghost" onClick={onClose}>{t("cancel")}</Button><Button loading={busy} disabled={!f.roles.length} onClick={save}>{t("save")}</Button></div>
      </div>
    </Modal>
  );
}

function Taxonomy() {
  const { t, n } = useI18n();
  const tax = useTaxonomy();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState<string[]>(["1"]);
  const [ren, setRen] = useState<{ kind: string; id: string; name_en: string; name_bn: string } | null>(null);
  const save = async () => {
    if (!ren) return;
    await api(`/taxonomy/${ren.kind}/${encodeURIComponent(ren.id)}`, { method: "PATCH", body: { name_en: ren.name_en, name_bn: ren.name_bn } });
    qc.invalidateQueries({ queryKey: ["taxonomy"] }); toast(t("saved")); setRen(null);
  };
  const Row = ({ kind, item, depth }: { kind: string; item: { id: string; name_en: string; name_bn: string }; depth: number }) => (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-head" style={{ paddingLeft: 8 + depth * 22 }}>
      <code className="rounded bg-maroon-tint px-1.5 text-[11px] font-semibold text-maroon">{item.id}</code>
      <span className="truncate text-sm">{item.name_bn}</span><span className="hidden truncate text-sm text-ink-3 md:inline">· {item.name_en}</span>
      <button className="ml-auto text-xs font-semibold text-maroon opacity-0 transition group-hover:opacity-100" onClick={() => setRen({ kind, id: item.id, name_en: item.name_en, name_bn: item.name_bn })}>{t("rename")}</button>
    </div>
  );
  if (!tax.data) return <SkeletonRows />;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-white/80"><span className="flex items-center gap-2 rounded-lg bg-[#FBF1DE] px-3 py-2 text-warn"><Icon name="alert" className="h-4 w-4" />{t("ids_locked")}</span>
        <span className="ml-auto">{n(Number(tax.data.counts.chapters))} {t("stat_chapters")} · {n(Number(tax.data.counts.concepts))} {t("stat_concepts")} · {n(Number(tax.data.counts.topics))} {t("stat_topics")}</span></div>
      <div className="card !p-3">
        {tax.data.chapters.map((c) => {
          const on = open.includes(c.id);
          return (
            <div key={c.id} className="border-b border-line/60 last:border-0">
              <div className="flex items-center">
                <button onClick={() => setOpen(on ? open.filter((x) => x !== c.id) : [...open, c.id])} className="grid h-8 w-8 place-items-center"><motion.span animate={{ rotate: on ? 90 : 0 }}><Icon name="right" className="h-4 w-4" /></motion.span></button>
                <div className="flex-1 font-semibold"><Row kind="chapters" item={c} depth={0} /></div>
              </div>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pb-2">
                    {c.concepts.map((co) => <div key={co.id}><Row kind="concepts" item={co} depth={1} />{co.topics.map((tp) => <Row key={tp.id} kind="topics" item={tp} depth={2} />)}</div>)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <Modal open={!!ren} onClose={() => setRen(null)} title={`${t("rename")} · ${ren?.id}`}>
        {ren && <div className="space-y-3">
          <Field label="English"><Input value={ren.name_en} onChange={(e) => setRen({ ...ren, name_en: e.target.value })} /></Field>
          <Field label="বাংলা"><Input value={ren.name_bn} onChange={(e) => setRen({ ...ren, name_bn: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setRen(null)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></div>
        </div>}
      </Modal>
    </>
  );
}

function Board() {
  const { t, n } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const [res, setRes] = useState<{ added: number; duplicates_skipped: number; invalid: number } | null>(null);
  const [err, setErr] = useState<ApiError | null>(null); const [busy, setBusy] = useState(false);
  const list = useQuery({ queryKey: ["board", q, page], queryFn: () => api<P<BoardQ>>("/board-questions", { query: { q, page, page_size: 15 } }), placeholderData: (p) => p });
  const [edit, setEdit] = useState<BoardQ | "new" | null>(null);
  const remove = async (id: number) => { if (!window.confirm(t("remove") + "?")) return; await api(`/board-questions/${id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["board"] }); };
  const up = async (f: File) => {
    setBusy(true); setErr(null);
    try { const fd = new FormData(); fd.append("file", f); setRes(await api("/board-questions/import", { form: fd })); qc.invalidateQueries({ queryKey: ["board"] }); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
      <div className="space-y-3">
        <FileDrop accept=".xlsx,.csv" onFile={up} busy={busy} label={t("import_board")} sub={t("file_rules")} />
        <div className="flex flex-wrap gap-2"><Button icon="plus" onClick={() => setEdit("new")}>{t("add_question")}</Button>
        <Button variant="secondary" icon="download" onClick={() => download("/board-questions/template", undefined, "board_template.xlsx")}>{t("get_template")}</Button></div>
        {edit && <BoardEditor item={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
        {err && <ErrorBox error={err} />}
        {res && <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-[#E3F1E3] px-3 py-2 text-sm text-ok">{t("imported", { a: res.added, d: res.duplicates_skipped, i: res.invalid })}</motion.p>}
      </div>
      <div>
        <div className="relative mb-3"><Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" /><Input className="pl-9" placeholder={t("search_stem")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        {list.data && !list.data.items.length ? <div className="card"><Empty icon="book" title={t("empty")} /></div> : (
          <div className="table-wrap"><table className="tbl"><thead><tr><th>{t("board")}</th><th>{t("year")}</th><th>{t("q_no")}</th><th>{t("question")}</th><th>{t("action")}</th></tr></thead>
            <tbody>{list.data?.items.map((b) => <tr key={b.id}><td className="whitespace-nowrap font-medium">{b.board}</td><td>{n(String(b.year))}</td><td>{b.q_no ? n(b.q_no) : "–"}</td><td className="max-w-md"><span className="line-clamp-2">{b.stem}</span></td>
              <td className="whitespace-nowrap"><button className="font-medium text-maroon underline" onClick={() => setEdit(b)}>{t("edit")}</button> · <button className="font-medium text-maroon underline" onClick={() => remove(b.id)}>{t("remove")}</button></td></tr>)}</tbody></table></div>
        )}
        {list.data && <Pager page={page} total={list.data.total} pageSize={15} onPage={setPage} />}
      </div>
    </div>
  );
}

function Audit() {
  const { t, date } = useI18n();
  const [page, setPage] = useState(1); const [action, setAction] = useState("");
  const logs = useQuery({ queryKey: ["audit", page, action], queryFn: () => api<P<{ id: number; actor_id: number | null; action: string; entity: string; entity_id: string | null; created_at: string; ip: string | null }>>("/admin/audit-logs", { query: { page, action, page_size: 30 } }), placeholderData: (p) => p });
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">{["", "auth", "question", "review", "bulk", "user", "board", "model", "taxonomy"].map((a) => <Chip key={a} active={action === a} onClick={() => { setAction(a); setPage(1); }}>{a || t("all")}</Chip>)}</div>
      {logs.isLoading ? <SkeletonRows /> : (
        <div className="table-wrap"><table className="tbl"><thead><tr><th>{t("date")}</th><th>{t("action")}</th><th>{t("entity")}</th><th>{t("actor")}</th><th>IP</th></tr></thead>
          <tbody>{logs.data?.items.map((l) => <tr key={l.id}><td className="whitespace-nowrap text-ink-2">{date(l.created_at)} {new Date(l.created_at).toLocaleTimeString()}</td><td><code className="text-xs font-semibold text-maroon">{l.action}</code></td><td>{l.entity}{l.entity_id ? ` #${l.entity_id}` : ""}</td><td>{l.actor_id ?? "–"}</td><td className="text-ink-3">{l.ip}</td></tr>)}</tbody></table></div>
      )}
      {logs.data && <Pager page={page} total={logs.data.total} pageSize={30} onPage={setPage} />}
    </>
  );
}

type Agreement = { reviewed: number; accepted: number; changed: number; rejected: number; acceptance_rate: number | null; level_macro_f1: number | null; fields: Record<string, { agree: number; total: number; rate: number | null }>; level_confusion: Record<string, Record<string, number>> };

function Models() {
  const { t, n, date } = useI18n();
  const { has } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const ml = useMlStatus();
  const models = useQuery({ queryKey: ["models"], queryFn: () => api<{ id: number; version: string; impl: string; is_active: boolean; deployed_at: string; metrics: Record<string, number> }[]>("/admin/models") });
  const ag = useQuery({ queryKey: ["agreement"], queryFn: () => api<Agreement>("/ml/agreement") });
  const [f, setF] = useState({ version: "", impl: "dishari_ml.tagger:Tagger", path: "/app/ml_models/current" });
  const [err, setErr] = useState<ApiError | null>(null); const [busy, setBusy] = useState(false);
  const deploy = async () => {
    setBusy(true); setErr(null);
    try { await api("/admin/models", { body: { ...f, activate: true } }); toast(t("saved")); qc.invalidateQueries({ queryKey: ["models"] }); qc.invalidateQueries({ queryKey: ["ml-status"] }); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  const a = ag.data;
  const L = ["K1", "K2", "K3", "K4"];
  const max = a ? Math.max(1, ...L.flatMap((r) => L.map((c) => a.level_confusion[r]?.[c] || 0))) : 1;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("model_status")} value={ml.data?.status === "ready" ? t("ready") : t("offline")} icon="cpu" tone={ml.data?.status === "ready" ? "ok" : "warn"} />
        <Stat label={t("reviewed_n")} value={<CountUp to={a?.reviewed || 0} />} icon="shield" delay={0.05} />
        <Stat label={t("acceptance")} value={a?.acceptance_rate != null ? <CountUp to={Math.round(a.acceptance_rate * 100)} suffix="%" /> : "–"} icon="check" tone="gold" delay={0.1} />
        <Stat label={t("macro_f1")} value={a?.level_macro_f1 != null ? n(a.level_macro_f1, { minimumFractionDigits: 2 }) : "–"} icon="target" tone="info" delay={0.15} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="mb-1 flex items-center justify-between"><h2 className="h3">{t("agreement")}</h2>{has("admin") && <Button size="sm" variant="ghost" icon="download" onClick={() => download("/ml/agreement", { format: "xlsx" }, "agreement.xlsx")}>Excel</Button>}</div>
          <p className="mb-4 text-sm text-ink-3">{t("agreement_sub")}</p>
          {a && <div className="space-y-2.5">{Object.entries(a.fields).map(([k, v], i) => (
            <div key={k} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 text-sm"><span className="text-ink-2">{t((k.replace("_id", "") === "cognitive_level" ? "level" : k.replace("_id", "")) as StrKey)}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-head"><motion.div className="h-full rounded-full bg-gradient-to-r from-gold to-maroon" initial={{ width: 0 }} animate={{ width: `${(v.rate || 0) * 100}%` }} transition={{ delay: i * 0.08, duration: 0.8, ease }} /></div>
              <span className="text-right tabular-nums">{v.rate != null ? `${n(Math.round(v.rate * 100))}%` : "–"}</span></div>
          ))}</div>}
          <h3 className="label mb-2 mt-6">{t("confusion")}</h3>
          {a && (
            <div className="inline-grid grid-cols-[40px_repeat(4,52px)] gap-1 text-center text-xs">
              <span />{L.map((c) => <b key={c} className="py-1">{c}</b>)}
              {L.map((r) => [<b key={r} className="grid place-items-center">{r}</b>, ...L.map((c) => {
                const v = a.level_confusion[r]?.[c] || 0;
                return <motion.div key={r + c} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid h-11 place-items-center rounded-md font-semibold"
                  style={{ background: r === c ? `rgba(122,15,30,${0.12 + 0.8 * (v / max)})` : `rgba(184,137,43,${0.08 + 0.6 * (v / max)})`, color: v / max > 0.55 && r === c ? "#fff" : "#1F1F1F" }}>{n(v)}</motion.div>;
              })])}
            </div>
          )}
        </section>
        <section className="card space-y-4">
          <h2 className="h3">{t("deploy_model")}</h2>
          <Field label={t("version")}><Input value={f.version} placeholder="xlmr-v1-2026-11" onChange={(e) => setF({ ...f, version: e.target.value })} /></Field>
          <Field label={t("impl")} hint='"mock" · "dishari_ml.tagger:Tagger"'><Input value={f.impl} onChange={(e) => setF({ ...f, impl: e.target.value })} /></Field>
          <Field label={t("path")}><Input value={f.path} onChange={(e) => setF({ ...f, path: e.target.value })} /></Field>
          {err && <ErrorBox error={err} />}
          <div className="flex flex-wrap gap-2"><Button loading={busy} disabled={!f.version} icon="cpu" onClick={deploy}>{t("deploy_model")}</Button>
            <Button variant="secondary" icon="refresh" onClick={async () => { const r = await api<{ queued: number }>("/admin/retag-pending", { method: "POST" }).catch((e) => { toast((e as ApiError).message, "err"); return null; }); if (r) toast(`${t("retag_pending")}: ${n(r.queued)}`); }}>{t("retag_pending")}</Button></div>
          <div className="border-t border-line pt-4">
            {models.data?.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${m.is_active ? "bg-ok shadow-[0_0_0_4px_rgba(45,106,45,.15)]" : "bg-line"}`} />
                <b>{m.version}</b><code className="text-xs text-ink-3">{m.impl}</code><span className="ml-auto text-ink-3">{date(m.deployed_at)}</span>
                {m.is_active && <span className="chip border-ok/30 bg-[#E3F1E3] text-ok">{t("active_model")}</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------- teacher sign-up approvals */
export function PendingTeachers({ compact }: { compact?: boolean }) {
  const { t, date } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ["pending-teachers"], queryFn: () => api<User[]>("/admin/pending-teachers") });
  const [rej, setRej] = useState<User | null>(null);
  const [reason, setReason] = useState("");
  const done = () => { qc.invalidateQueries({ queryKey: ["pending-teachers"] }); qc.invalidateQueries({ queryKey: ["users"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const approve = async (u: User) => {
    try { await api(`/users/${u.id}/approve`, { method: "POST" }); toast(t("approved_ok", { n: u.name })); done(); } catch (e) { toast((e as ApiError).message, "err"); }
  };
  const reject = async () => {
    if (!rej) return;
    try { await api(`/users/${rej.id}/reject`, { body: { reason: reason || null } }); setRej(null); setReason(""); done(); } catch (e) { toast((e as ApiError).message, "err"); }
  };
  const items = (list.data || []).filter((u) => u.status === "pending");
  if (compact && !items.length) return (
    <section className="card"><h2 className="h3 mb-2">{t("pending_teachers")}</h2><p className="text-sm text-ink-3">{t("none_pending")}</p></section>
  );
  if (!compact && !items.length) return null;
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`card ${compact ? "" : "mb-5 ring-2 ring-gold/60"}`}>
      <div className="mb-3 flex items-center gap-2"><h2 className="h3 flex-1">{t("pending_teachers")}</h2><span className="grid h-6 min-w-6 place-items-center rounded-full bg-maroon px-2 text-xs font-bold text-white">{items.length}</span></div>
      <p className="-mt-2 mb-3 text-sm text-ink-3">{t("pending_teachers_sub")}</p>
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>{items.map((u) => {
          const p = (u.profile || {}) as Record<string, string>;
          return (
            <motion.div key={u.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30, height: 0 }}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/80 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#E2B862] to-gold font-bold text-[#2A1A00]">{u.name[0]}</span>
              <div className="min-w-0 flex-1 text-sm"><b className="block">{u.name}</b>
                <span className="text-ink-3">{u.email}</span>
                <span className="block text-ink-2">{[u.institution, p.subjects, p.classes_taught && `${t("class_level")} ${p.classes_taught}`, p.designation].filter(Boolean).join(" · ")}</span>
                <span className="text-xs text-ink-3">{date(u.created_at)}</span></div>
              <div className="flex gap-2"><Button size="sm" icon="check" onClick={() => approve(u)}>{t("approve")}</Button><Button size="sm" variant="secondary" onClick={() => setRej(u)}>{t("reject")}</Button></div>
            </motion.div>
          );
        })}</AnimatePresence>
      </div>
      <Modal open={!!rej} onClose={() => setRej(null)} title={t("reject_title")}>
        <p className="mb-3 text-sm"><b>{rej?.name}</b> · {rej?.email}</p>
        <Field label={`${t("reason")} (${t("optional")})`} hint={t("reject_hint")}><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setRej(null)}>{t("cancel")}</Button><Button variant="danger" onClick={reject}>{t("reject")}</Button></div>
      </Modal>
    </motion.section>
  );
}

/* ---------------------------------------------------------------- board question add / edit */
export type BoardQ = { id: number; board: string; year: number; q_no?: number | null; language: string; stem: string; options?: Record<string, string>; answer?: string | null };
const BOARDS = ["Dhaka", "Rajshahi", "Comilla", "Jessore", "Chittagong", "Barisal", "Sylhet", "Dinajpur", "Mymensingh", "Madrasah", "Technical"];
export function BoardEditor({ item, onClose }: { item: BoardQ | null; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({ board: item?.board || "Dhaka", year: String(item?.year || new Date().getFullYear() - 1), q_no: String(item?.q_no || ""),
    language: item?.language || "bn", stem: item?.stem || "", A: item?.options?.A || "", B: item?.options?.B || "", C: item?.options?.C || "", D: item?.options?.D || "", answer: item?.answer || "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    const body = { board: f.board, year: Number(f.year), q_no: f.q_no ? Number(f.q_no) : null, stem: f.stem, answer: f.answer || null,
      options: Object.fromEntries((["A", "B", "C", "D"] as const).filter((k) => f[k].trim()).map((k) => [k, f[k].trim()])), ...(item ? {} : { language: f.language }) };
    try { await api(item ? `/board-questions/${item.id}` : "/board-questions", { method: item ? "PATCH" : "POST", body }); qc.invalidateQueries({ queryKey: ["board"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); onClose(); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={item ? t("edit") : t("add_question")} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={t("board")}><Select value={f.board} onChange={set("board")}>{BOARDS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label={t("year")}><Input type="number" value={f.year} onChange={set("year")} /></Field>
          <Field label={t("q_no")}><Input type="number" value={f.q_no} onChange={set("q_no")} /></Field>
          <Field label={t("language")}><Select value={f.language} onChange={set("language")} disabled={!!item}><option value="bn">বাংলা</option><option value="en">English</option></Select></Field>
        </div>
        <Field label={t("question")} error={err?.fields?.stem ? err.message : undefined}><textarea className="textarea" rows={3} value={f.stem} onChange={set("stem")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">{(["A", "B", "C", "D"] as const).map((k) => <Field key={k} label={k}><Input value={f[k]} onChange={set(k)} /></Field>)}</div>
        <Field label={t("answer")}><Select value={f.answer} onChange={set("answer")}><option value="">–</option>{["A", "B", "C", "D"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
        {err && !err.fields?.stem && <p className="text-sm text-err">{err.message}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("cancel")}</Button><Button loading={busy} disabled={f.stem.trim().length < 3} onClick={save}>{t("save")}</Button></div>
      </div>
    </Modal>
  );
}
