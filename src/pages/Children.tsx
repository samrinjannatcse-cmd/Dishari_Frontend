import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/client";
import { Chip, Empty, PageHeader, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n/I18n";
import { Page } from "@/motion";
import Progress from "./Progress";
import { WeeklySummary } from "./WeeklyReport";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui";

export default function Children() {
  const { t } = useI18n();
  const kids = useQuery({ queryKey: ["children"], queryFn: () => api<{ id: number; name: string; class_level: string | null }[]>("/parents/me/children") });
  const [sel, setSel] = useState<number | null>(null);
  const cur = sel ?? kids.data?.[0]?.id;
  return (
    <Page>
      <PageHeader title={t("nav_children")} actions={kids.data && kids.data.length > 1 && <div className="flex gap-2">{kids.data.map((k) => <Chip key={k.id} active={cur === k.id} onClick={() => setSel(k.id)}>{k.name}</Chip>)}</div>} />
      {kids.isLoading ? <Skeleton className="h-64" /> : !kids.data?.length ? <div className="card"><Empty icon="heart" title={t("children_none")} sub={t("child_code_hint")} action={<Link to="/app/profile"><Button icon="plus">{t("link_child")}</Button></Link>} /></div>
        : cur && <div className="space-y-6"><WeeklySummary sid={cur} /><Progress studentId={cur} embedded /></div>}
    </Page>
  );
}
