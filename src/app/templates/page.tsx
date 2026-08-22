"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { TemplateNotice } from "@/components/templates/template-notice";
import { TemplateSearchBar } from "@/components/templates/template-search-bar";
import { TemplateForm } from "@/components/templates/template-form";
import { TemplateList } from "@/components/templates/template-list";
import { defaultForm, type DeptFolder, type Template, type TemplateFormValues } from "@/components/templates/template-types";
import { filterTemplates } from "@/lib/template-utils";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [depts, setDepts] = useState<DeptFolder[]>([]);
  const [folders, setFolders] = useState<DeptFolder[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<TemplateFormValues>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [tRes, dRes, fRes] = await Promise.all([
        fetch("/api/templates"),
        fetch("/api/quick/department"),
        fetch("/api/quick/folder"),
      ]);
      if (tRes.ok) setTemplates(await tRes.json());
      if (dRes.ok) setDepts(await dRes.json());
      if (fRes.ok) setFolders(await fRes.json());
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
    setMsg(null);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? "",
      titlePattern: t.titlePattern,
      departmentId: t.departmentId?.toString() ?? "",
      folderId: t.folderId?.toString() ?? "",
      docType: t.docType ?? "",
      defaultTags: t.defaultTags ?? "",
    });
    setShowForm(true);
    setMsg(null);
  }

  function updateForm(patch: Partial<TemplateFormValues>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = editing
        ? { id: editing.id, ...form, departmentId: form.departmentId ? Number(form.departmentId) : null, folderId: form.folderId ? Number(form.folderId) : null }
        : { ...form, departmentId: form.departmentId ? Number(form.departmentId) : null, folderId: form.folderId ? Number(form.folderId) : null };

      const res = await fetch("/api/templates", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل");
      }
      setMsg({ type: "ok", text: editing ? "تم تحديث القالب بنجاح" : "تم إنشاء القالب بنجاح" });
      setShowForm(false);
      load();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "فشل" });
    } finally {
      setSaving(false);
    }
  }

  const filteredTemplates = useMemo(() => filterTemplates(templates, search), [templates, search]);

  async function handleDelete(id: number) {
    if (!confirm("هل تريد حذف هذا القالب؟")) return;
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      load();
    } catch {
      alert("فشل حذف القالب");
    }
  }

  return (
    <div className="animate-fadein">
      <PageHeader
        title="قوالب المستندات"
        subtitle="أنشئ قوالب لرفع المستندات بسرعة دون إعادة إدخال البيانات الوصفية"
        icon={<FileText className="h-5 w-5" />}
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            قالب جديد
          </button>
        }
      />

      <TemplateNotice msg={msg} />

      {/* Search / filter bar */}
      {!showForm && (
        <TemplateSearchBar search={search} onChange={setSearch} onClear={() => setSearch("")} />
      )}

      {showForm && (
        <TemplateForm
          editing={editing}
          form={form}
          saving={saving}
          depts={depts}
          folders={folders}
          onChange={updateForm}
          onSubmit={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      <TemplateList
        busy={busy}
        templates={filteredTemplates}
        search={search}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
