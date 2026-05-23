"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type {
  CampaignLog,
  CampaignSendAPIResponse,
  CampaignTemplateSaveResponse,
  ConfirmSendResponse,
} from "@/types/api";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  Code2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from "lucide-react";

const DEFAULT_CSV = "Master Grow Email List.csv";

const SPLIT_HEIGHT = "calc(100vh - 200px)";

const PREVIEW_WRAPPER = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <style>
    body { margin: 0; padding: 0; background: #f4f4f4; }
  </style>
</head>
<body>
EDITOR_HTML_HERE
</body>
</html>`;

const EDITOR_LINE_HEIGHT_PX = 21;
const EDITOR_FONT_SIZE_PX = 13;

const AVAILABLE_INNER_OPEN =
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; background:#f9f9f9;">';

const PRE_ORDER_ANCHOR = "Place your pre-order now:</p>";
const PRE_ORDER_INNER_OPEN =
  '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">';

type InventoryRow = { id: string; strain: string; details: string; qty: string };
type InventoryCategoryType = "Clones" | "Teens" | "Seeds" | "Other";
type AddCategoryFormType = "Clones" | "Teens" | "Other";
type InventoryCategory = {
  id: string;
  categoryType: InventoryCategoryType;
  customName: string;
  header: string;
  price: string;
  /** Header bar + email table column-header row */
  headerColor: string;
  rows: InventoryRow[];
};

const CATEGORY_HEADER_COLOR_OPTIONS: ReadonlyArray<{
  hex: string;
  label: string;
  emoji: string;
}> = [
  { hex: "#dc2626", label: "Red", emoji: "🔴" },
  { hex: "#ea580c", label: "Orange", emoji: "🟠" },
  { hex: "#ca8a04", label: "Yellow", emoji: "🟡" },
  { hex: "#2d6e3e", label: "Green", emoji: "🟢" },
  { hex: "#1a4a7a", label: "Blue", emoji: "🔵" },
];
type PreOrderRow = { id: string; strain: string; genetics: string };

type CampaignDetailsAPIResponse = {
  campaign: CampaignLog;
  email_sends: Array<{
    recipient_email: string;
    success: boolean;
    sent_at: string | null;
    subject: string | null;
  }>;
  stats: {
    total_sent: number;
    total_failed: number;
    total_skipped: number;
    success_rate: number;
  };
  failed_emails: Array<{
    recipient_email: string;
    success: boolean;
    sent_at: string | null;
    subject: string | null;
  }>;
  delivery_issues: Array<{
    email: string;
    reason: string;
    occurred_at: string | null;
  }>;
};

type SendGridCampaignStatsResponse = {
  opens: number;
  clicks: number;
  bounces: number;
  spam_reports: number;
  unsubscribes: number;
  delivered: number;
  requests: number;
  error: string | null;
};

type ManagedTemplateListItem = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

function newInvRowId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function newCategoryId(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function defaultHeaderColorForType(type: InventoryCategoryType): string {
  if (type === "Clones") return "#2d6e3e";
  if (type === "Teens") return "#1a4a7a";
  if (type === "Seeds") return "#92400e";
  return "#3a3a3a";
}

function categoryDisplayName(category: InventoryCategory): string {
  return category.categoryType === "Other"
    ? category.customName.trim() || "Other"
    : category.categoryType;
}

function deliveryRatePct(sent: number, failed: number): number {
  const d = sent + failed;
  if (!d) return 0;
  return Math.round((100 * sent) / d * 10) / 10;
}

function deliveryRateClass(rate: number): string {
  if (rate > 95) return "font-semibold text-success";
  if (rate >= 80) return "font-semibold text-warning";
  return "font-semibold text-danger";
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createInitialCloneRows(): InventoryRow[] {
  const pairs: [string, string][] = [
    ["Super Boof", "200"],
    ["Black Cherry Gelato", "100"],
    ["Sherbalato", "150"],
    ["Permanent Chimera", "100"],
    ["Autumn Sunset", "50"],
    ["Sour Diesel Wedding Cake", "100"],
    ["Cap Junky", "450"],
    ["Diablo", "450"],
    ["ZG (Zero Gravity)", "450"],
    ["Baklava", "500"],
  ];
  return pairs.map(([strain, qty]) => ({
    id: newInvRowId(),
    strain,
    details: "",
    qty,
  }));
}

function createEmptyInventoryRows(count: number): InventoryRow[] {
  return Array.from({ length: count }, () => ({
    id: newInvRowId(),
    strain: "",
    details: "",
    qty: "",
  }));
}

function createInitialInventoryCategories(): InventoryCategory[] {
  return [
    {
      id: newCategoryId(),
      categoryType: "Clones",
      customName: "",
      header: "Rooted & Ready",
      price: "$5 each",
      headerColor: defaultHeaderColorForType("Clones"),
      rows: createInitialCloneRows(),
    },
    {
      id: newCategoryId(),
      categoryType: "Teens",
      customName: "",
      header: "2-3 Week Veg",
      price: "$15 each",
      headerColor: defaultHeaderColorForType("Teens"),
      rows: createEmptyInventoryRows(3),
    },
  ];
}

function createInitialPreOrderRows(): PreOrderRow[] {
  const pairs: [string, string][] = [
    ["Autumn Sunset", "Chimera x Dip N Stix"],
    ["Permanent Marker", "Biscotti x Jealousy x Sherb BX"],
    ["Mazel", "Magic Marker x Chimera"],
    ["Platinum Chimera Breathe", "Platinum Kush Breathe x Chimera"],
    ["Super Boof", "Black Cherry Punch x Tropicana Cookies"],
    ["Gelato Cake", "Wedding Cake x Gelato #33"],
    ["Rainbow Guava", "Rainbow Belts x Strawberry Guava"],
    ["Bounty Hunter", "Wedding Cake x GMO"],
    ["Space Lime", "Tahiti Lime x Oreoz"],
    ["Ferrari Runtz", "Ferrari OG x Runtz"],
    ["Lemon Gas", "All Gas OG x Lemon Magik"],
    ["Gorilla Nut", "Gorilla Butter x Peanut Butter Breathe"],
    ["Specimen X", "Project 4516 x Devil Driver"],
    ["Strawberry Gary", "Gary Payton x Red Pop"],
    ["GMO Cookies", "GSC x Chemdog"],
    ["Black Cherry Gelato", "Acai x Black Cherry Funk"],
    ["Peanut Butter Breathe", "Dos Si Dos x Mendo Breathe"],
    ["Sherblato", "Sherbet x Gelato"],
    ["Diesel Cake", "Sour Diesel x Wedding Cake"],
    ["Nag Champa", "The Big Dirty x Pineapple Sorbet"],
    ["Super Cake", "Super Dank x Powder Cakes"],
    ["Cap Junky", "Alien Cookies x Kush Mints"],
    ["Diablo", "Grapefruit x Blueberry"],
    ["Zero Gravity", "Hash Plant x Northern Lights"],
    ["Baklava", "Kosher Kush x Gelato #41"],
  ];
  return pairs.map(([strain, genetics]) => ({
    id: newInvRowId(),
    strain,
    genetics,
  }));
}

function replaceAvailableRowsInHtml(
  source: string,
  categories: InventoryCategory[]
): { ok: boolean; html: string } {
  const start = source.indexOf(AVAILABLE_INNER_OPEN);
  if (start === -1) return { ok: false, html: source };
  const bodyEnd = source.indexOf("</table>", start);
  if (bodyEnd === -1) return { ok: false, html: source };
  const end = bodyEnd + "</table>".length;

  const blocks = categories
    .map((category) => {
      const rows = category.rows.filter(
        (r) => r.strain.trim() || r.details.trim() || r.qty.trim()
      );
      if (!rows.length) return "";
      const showDetails = rows.some((r) => r.details.trim());
      const titleName = categoryDisplayName(category).toUpperCase();
      const titleHeader = category.header.trim().toUpperCase();
      const titlePrice = category.price.trim().toUpperCase();
      const titleBits = [titleName, titleHeader].filter(Boolean).join(" — ");
      const titleText = titlePrice ? `${titleBits} · ${titlePrice}` : titleBits;
      const categoryColor =
        category.headerColor ??
        defaultHeaderColorForType(category.categoryType);
      const tableRows = rows
        .map((r, i) => {
          const bg = i % 2 === 0 ? "#ffffff" : "#f4f9f5";
          const qtyClean = String(r.qty).replace(/[^0-9]/g, "") || "0";
          if (showDetails) {
            return `<tr style="background-color:${bg};"><td style="font-size:13px;color:#333333;padding:6px 12px;">${escHtml(r.strain || "—")}</td><td style="font-size:12px;color:#666666;padding:6px 12px;">${escHtml(r.details)}</td><td style="font-size:13px;color:${escHtml(categoryColor)};font-weight:bold;padding:6px 12px;">${escHtml(qtyClean)}</td></tr>`;
          }
          return `<tr style="background-color:${bg};"><td style="font-size:13px;color:#333333;padding:6px 12px;">${escHtml(r.strain || "—")}</td><td style="font-size:13px;color:${escHtml(categoryColor)};font-weight:bold;padding:6px 12px;">${escHtml(qtyClean)}</td></tr>`;
        })
        .join("\n                    ");
      const cols = showDetails
        ? `<tr style="background-color:${escHtml(categoryColor)};"><td style="font-size:13px;font-weight:bold;color:#ffffff;padding:8px 12px;">Strain</td><td style="font-size:13px;font-weight:bold;color:#ffffff;padding:8px 12px;">Details</td><td style="font-size:13px;font-weight:bold;color:#ffffff;padding:8px 12px;">Qty</td></tr>`
        : `<tr style="background-color:${escHtml(categoryColor)};"><td style="font-size:13px;font-weight:bold;color:#ffffff;padding:8px 12px;">Strain</td><td style="font-size:13px;font-weight:bold;color:#ffffff;padding:8px 12px;">Qty</td></tr>`;
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; background:#f9f9f9; margin-bottom:12px;"><tr style="background:${escHtml(categoryColor)};"><td colspan="${showDetails ? 3 : 2}" style="font-size:13px;color:#ffffff;font-weight:bold;padding:8px 12px;letter-spacing:0.2px;">${escHtml(titleText)}</td></tr>${cols}${tableRows ? `\n                    ${tableRows}` : ""}</table>`;
    })
    .filter(Boolean)
    .join("\n                  ");

  const replacement = blocks || source.slice(start, end);
  return {
    ok: true,
    html: source.slice(0, start) + replacement + source.slice(end),
  };
}

function replacePreOrderRowsInHtml(
  source: string,
  rows: { strain: string; genetics: string }[]
): { ok: boolean; html: string } {
  const anchorIdx = source.indexOf(PRE_ORDER_ANCHOR);
  if (anchorIdx === -1) return { ok: false, html: source };
  const start = source.indexOf(PRE_ORDER_INNER_OPEN, anchorIdx);
  if (start === -1) return { ok: false, html: source };
  const afterOpen = start + PRE_ORDER_INNER_OPEN.length;
  const genIdx = source.indexOf(">Genetics</td>", afterOpen);
  if (genIdx === -1) return { ok: false, html: source };
  const headerRowEnd = source.indexOf("</tr>", genIdx);
  if (headerRowEnd === -1) return { ok: false, html: source };
  const bodyStart = headerRowEnd + "</tr>".length;
  const bodyEnd = source.indexOf("</table>", bodyStart);
  if (bodyEnd === -1) return { ok: false, html: source };
  const last = rows.length - 1;
  const built = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#fffdf7";
      const isLast = i === last;
      const td2 = isLast
        ? "padding:5px 4px;"
        : "padding:5px 4px;border-bottom:1px solid #f0e8d8;";
      const td1 = isLast
        ? "padding:5px 8px 5px 0;"
        : "padding:5px 8px 5px 0;border-bottom:1px solid #f0e8d8;";
      return `<tr style="background-color:${bg};"><td style="font-size:12px;color:#333333;${td1}"><strong>${escHtml(r.strain)}</strong></td><td style="font-size:12px;color:#666666;${td2}">${escHtml(r.genetics)}</td></tr>`;
    })
    .join("\n                    ");
  const replacement = `\n                    ${built}`;
  return {
    ok: true,
    html: source.slice(0, bodyStart) + replacement + source.slice(bodyEnd),
  };
}

export function EmailCampaignWorkspace({
  activeSection = "all",
  embedded = false,
}: {
  activeSection?: "editor" | "history" | "all";
  embedded?: boolean;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [fileName, setFileName] = useState(DEFAULT_CSV);
  const [html, setHtml] = useState("");
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templates, setTemplates] = useState<ManagedTemplateListItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateNameEdit, setTemplateNameEdit] = useState("");
  const [loadedSnapshot, setLoadedSnapshot] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [htmlModalOpen, setHtmlModalOpen] = useState(false);
  const [htmlModalDraft, setHtmlModalDraft] = useState("");
  const [htmlModalBaseline, setHtmlModalBaseline] = useState("");
  const [htmlModalScrollTop, setHtmlModalScrollTop] = useState(0);

  const [inventoryCategories, setInventoryCategories] = useState<
    InventoryCategory[]
  >(
    createInitialInventoryCategories
  );
  const [preOrderRows, setPreOrderRows] = useState<PreOrderRow[]>(
    createInitialPreOrderRows
  );

  const [campaigns, setCampaigns] = useState<CampaignLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [emailTestMode, setEmailTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const [sendOpen, setSendOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmInfo, setConfirmInfo] = useState<ConfirmSendResponse | null>(
    null
  );
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<CampaignSendAPIResponse | null>(
    null
  );

  const [csvFiles, setCsvFiles] = useState<string[]>([]);
  const [csvListLoading, setCsvListLoading] = useState(true);

  const [expandedCampaignId, setExpandedCampaignId] = useState<number | null>(
    null
  );
  const [expansionLoadingId, setExpansionLoadingId] = useState<number | null>(
    null
  );
  const [campaignDetailsById, setCampaignDetailsById] = useState<
    Record<number, CampaignDetailsAPIResponse>
  >({});
  const [sendgridStatsById, setSendgridStatsById] = useState<
    Record<number, SendGridCampaignStatsResponse>
  >({});

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addCategoryFormType, setAddCategoryFormType] =
    useState<AddCategoryFormType>("Clones");
  const [addCategoryCustomName, setAddCategoryCustomName] = useState("");

  const htmlModalLineCount = useMemo(
    () => Math.max(1, htmlModalDraft.split("\n").length),
    [htmlModalDraft]
  );

  const templateDirty = html !== loadedSnapshot;

  const templateStatus = useMemo(() => {
    if (templateDirty) {
      return { className: "text-warning", text: "● Unsaved changes" };
    }
    if (lastSavedAt) {
      return {
        className: "text-success",
        text: `✓ Saved · Last saved: ${lastSavedAt.toLocaleTimeString()}`,
      };
    }
    return { className: "text-success", text: "✓ Saved" };
  }, [templateDirty, lastSavedAt]);

  const previewSrcDoc = useMemo(
    () => PREVIEW_WRAPPER.replace("EDITOR_HTML_HERE", html),
    [html]
  );

  const templateApiPath = useMemo(
    () =>
      selectedTemplateId === "2"
        ? "/campaigns/template/simple"
        : "/campaigns/template",
    [selectedTemplateId]
  );

  const fetchAndApplyTemplate = useCallback(async (id: string) => {
    const { data } = await api.get<{
      id: string;
      name: string;
      html: string;
    }>(`/campaigns/templates/${encodeURIComponent(id)}`);
    setSelectedTemplateId(data.id);
    setTemplateNameEdit(data.name);
    setHtml(data.html);
    setLoadedSnapshot(data.html);
    setLastSavedAt(null);
  }, []);

  const loadTemplateById = useCallback(
    async (id: string) => {
      if (!id) return;
      setTemplateLoading(true);
      try {
        await fetchAndApplyTemplate(id);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        setTemplateLoading(false);
      }
    },
    [fetchAndApplyTemplate]
  );

  const refreshTemplatesList = useCallback(async () => {
    try {
      const { data } = await api.get<ManagedTemplateListItem[]>(
        "/campaigns/templates"
      );
      setTemplates(data);
      return data;
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      return [];
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get<CampaignLog[]>("/campaigns");
      setCampaigns(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadCsvFiles = useCallback(async () => {
    setCsvListLoading(true);
    try {
      const { data } = await api.get<{ files: string[] }>("/data/csv-files");
      setCsvFiles(data.files);
      setFileName((prev) => {
        if (data.files.includes(DEFAULT_CSV)) return DEFAULT_CSV;
        if (data.files.length === 0) return prev;
        if (data.files.includes(prev)) return prev;
        return data.files[0];
      });
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setCsvListLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTemplateLoading(true);
      try {
        const { data: list } = await api.get<ManagedTemplateListItem[]>(
          "/campaigns/templates"
        );
        if (cancelled) return;
        setTemplates(list);
        const pick = list.find((t) => t.id === "1") ?? list[0];
        if (!pick) {
          setSelectedTemplateId("");
          setTemplateNameEdit("");
          setHtml("");
          setLoadedSnapshot("");
          setLastSavedAt(null);
          return;
        }
        await fetchAndApplyTemplate(pick.id);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAndApplyTemplate]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadCsvFiles();
  }, [loadCsvFiles]);

  async function toggleCampaignRow(campaignId: number) {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      return;
    }
    setExpandedCampaignId(campaignId);
    setExpansionLoadingId(campaignId);
    try {
      const [dRes, sgRes] = await Promise.all([
        api.get<CampaignDetailsAPIResponse>(`/campaigns/${campaignId}/details`),
        api.get<SendGridCampaignStatsResponse>(
          `/analytics/sendgrid/campaign/${campaignId}`
        ),
      ]);
      setCampaignDetailsById((prev) => ({ ...prev, [campaignId]: dRes.data }));
      setSendgridStatsById((prev) => ({ ...prev, [campaignId]: sgRes.data }));
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setExpandedCampaignId(null);
    } finally {
      setExpansionLoadingId(null);
    }
  }

  async function refreshSendgridStats(campaignId: number) {
    try {
      const { data } = await api.get<SendGridCampaignStatsResponse>(
        `/analytics/sendgrid/campaign/${campaignId}`
      );
      setSendgridStatsById((prev) => ({ ...prev, [campaignId]: data }));
      toast.success("SendGrid stats refreshed.");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  function confirmAddInventoryCategory() {
    if (addCategoryFormType === "Other" && !addCategoryCustomName.trim()) {
      toast.error("Enter a category name for Other.");
      return;
    }
    const categoryType: InventoryCategoryType =
      addCategoryFormType === "Other" ? "Other" : addCategoryFormType;
    setInventoryCategories((prev) => [
      ...prev,
      {
        id: newCategoryId(),
        categoryType,
        customName:
          addCategoryFormType === "Other" ? addCategoryCustomName.trim() : "",
        header: "",
        price: "",
        headerColor: defaultHeaderColorForType(categoryType),
        rows: createEmptyInventoryRows(3),
      },
    ]);
    setAddCategoryOpen(false);
    setAddCategoryFormType("Clones");
    setAddCategoryCustomName("");
  }

  async function saveDraft() {
    setSavingDraft(true);
    try {
      const { data } = await api.post<CampaignTemplateSaveResponse>(
        templateApiPath,
        { html }
      );
      if (data.success) {
        if (selectedTemplateId) {
          const name =
            templateNameEdit.trim() ||
            templates.find((t) => t.id === selectedTemplateId)?.name ||
            "Template";
          await api.put(`/campaigns/templates/${selectedTemplateId}`, {
            name,
            html,
          });
          await refreshTemplatesList();
        }
        toast.success("Draft saved.");
        setLoadedSnapshot(html);
        setLastSavedAt(new Date());
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingDraft(false);
    }
  }

  async function saveManagedTemplate() {
    if (!selectedTemplateId) {
      toast.error("Select a template to save.");
      return;
    }
    const name = templateNameEdit.trim();
    if (!name) {
      toast.error("Template name is required.");
      return;
    }
    try {
      await api.put(`/campaigns/templates/${selectedTemplateId}`, {
        name,
        html,
      });
      await refreshTemplatesList();
      setLoadedSnapshot(html);
      setLastSavedAt(new Date());
      toast.success("Template saved");
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function commitTemplateRename() {
    if (!selectedTemplateId || templateLoading) return;
    const t = templates.find((x) => x.id === selectedTemplateId);
    const newName = templateNameEdit.trim();
    if (!newName) {
      toast.error("Template name cannot be empty.");
      if (t) setTemplateNameEdit(t.name);
      return;
    }
    if (t && newName === t.name) return;
    try {
      await api.put(`/campaigns/templates/${selectedTemplateId}`, {
        name: newName,
        html,
      });
      await refreshTemplatesList();
      setLoadedSnapshot(html);
      setLastSavedAt(new Date());
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      if (t) setTemplateNameEdit(t.name);
    }
  }

  async function confirmSaveAsNew() {
    const name = saveAsName.trim();
    if (!name) {
      toast.error("Enter a template name.");
      return;
    }
    try {
      const { data } = await api.post<{
        id: string;
        name: string;
        success: boolean;
      }>("/campaigns/templates", { name, html });
      if (data.success) {
        toast.success("Template created");
        setSaveAsOpen(false);
        setSaveAsName("");
        await refreshTemplatesList();
        await loadTemplateById(data.id);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function confirmDeleteTemplate() {
    if (!selectedTemplateId) return;
    const id = selectedTemplateId;
    try {
      await api.delete(`/campaigns/templates/${id}`);
      toast.success("Template deleted");
      setDeleteConfirmOpen(false);
      const list = await refreshTemplatesList();
      const next = list[0];
      if (next) await loadTemplateById(next.id);
      else {
        setSelectedTemplateId("");
        setTemplateNameEdit("");
        setHtml("");
        setLoadedSnapshot("");
        setLastSavedAt(null);
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function openSendModal() {
    if (!campaignName.trim()) {
      toast.error("Campaign name is required.");
      return;
    }
    if (!fileName.trim()) {
      toast.error("CSV file name is required.");
      return;
    }
    if (emailTestMode) {
      const te = testEmail.trim();
      if (!te || !te.includes("@")) {
        toast.error("Enter a valid test email address.");
        return;
      }
    }
    setSendOpen(true);
    setConfirmInfo(null);
    setConfirmLoading(true);
    try {
      const { data } = await api.get<ConfirmSendResponse>("/confirm-send", {
        params: { file_name: fileName.trim() },
      });
      setConfirmInfo(data);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setSendOpen(false);
    } finally {
      setConfirmLoading(false);
    }
  }

  async function executeSend() {
    if (!campaignName.trim() || !fileName.trim()) return;
    setSendOpen(false);
    setSending(true);
    setSendResult(null);
    try {
      await api.post<CampaignTemplateSaveResponse>(templateApiPath, {
        html,
      });
      const { data } = await api.post<CampaignSendAPIResponse>(
        "/campaigns/send",
        {
          campaign_name: campaignName.trim(),
          file_name: fileName.trim(),
          test_email:
            emailTestMode && testEmail.trim() ? testEmail.trim() : undefined,
          html_content: html,
        }
      );
      setSendResult(data);
      toast.success(
        `Sent: ${data.sent} · Failed: ${data.failed} · Skipped: ${data.skipped}`
      );
      void loadHistory();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  function updateEmailTemplateFromInventory() {
    const avail = replaceAvailableRowsInHtml(html, inventoryCategories);
    if (!avail.ok) {
      toast.error(
        "Could not find the Available Now table in the HTML. Restore the standard template or edit the source manually."
      );
      return;
    }
    const pre = replacePreOrderRowsInHtml(avail.html, preOrderRows);
    if (!pre.ok) {
      toast.error(
        "Could not find the Pre-Orders table in the HTML. Restore the standard template or edit the source manually."
      );
      return;
    }
    setHtml(pre.html);
    toast.success("Inventory updated");
  }

  const selectedTemplateLabel =
    templates.find((t) => t.id === selectedTemplateId)?.name ??
    templateNameEdit;

  function openHtmlEditorModal() {
    setHtmlModalDraft(html);
    setHtmlModalBaseline(html);
    setHtmlModalScrollTop(0);
    setHtmlModalOpen(true);
  }

  function tryCloseHtmlModal() {
    if (htmlModalDraft !== htmlModalBaseline) {
      if (!window.confirm("Discard changes?")) return;
    }
    setHtmlModalOpen(false);
  }

  function saveHtmlModalAndClose() {
    setHtml(htmlModalDraft);
    setHtmlModalOpen(false);
    toast.success("HTML saved");
  }

  return (
    <div className={embedded ? "cannacore-embedded-content" : "space-y-10"}>
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Template and inventory on the left — live preview on the right. Use{" "}
            <strong>Edit HTML</strong> in the campaign card for full source.
            Save draft persists to the server; send uses your current HTML plus
            CSV.
          </p>
        </div>
      ) : null}

      {/* SECTION 1 — split editor / live preview */}
      <section
        className={`space-y-4 ${activeSection === "history" ? "cannacore-section-hidden" : ""}`}
      >
        <Card>
          <CardHeader className="flex flex-col gap-4 space-y-0 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Campaign editor</CardTitle>
              <CardDescription>
                Templates, campaign fields, and inventory below. Open{" "}
                <strong>Edit HTML</strong> for the full source editor.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              disabled={templateLoading}
              onClick={openHtmlEditorModal}
            >
              <Code2 className="mr-2 h-4 w-4" aria-hidden />
              Edit HTML
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div
              className="flex min-h-[320px] flex-col gap-4 lg:flex-row lg:gap-6"
              style={{ minHeight: SPLIT_HEIGHT, height: SPLIT_HEIGHT }}
            >
              {/* Left — controls + inventory */}
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 lg:w-1/2">
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="shrink-0 text-sm font-medium">Template</Label>
                  <select
                    className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-2 text-sm sm:max-w-xs"
                    value={
                      templates.some((t) => t.id === selectedTemplateId)
                        ? selectedTemplateId
                        : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) void loadTemplateById(v);
                    }}
                    disabled={templateLoading || templates.length === 0}
                  >
                    {templates.length === 0 ? (
                      <option value="">No templates</option>
                    ) : (
                      templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))
                    )}
                  </select>
                  <Input
                    className="h-9 min-w-[10rem] flex-1 sm:max-w-xs"
                    placeholder="Template name"
                    value={templateNameEdit}
                    onChange={(e) => setTemplateNameEdit(e.target.value)}
                    onBlur={() => void commitTemplateRename()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    disabled={!selectedTemplateId || templateLoading}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!selectedTemplateId || templateLoading}
                    onClick={() => void saveManagedTemplate()}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={templateLoading}
                    onClick={() => {
                      setSaveAsName("");
                      setSaveAsOpen(true);
                    }}
                  >
                    Save As New
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={
                      !selectedTemplateId ||
                      templateLoading ||
                      templates.length === 0
                    }
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    Delete
                  </Button>
                </div>
                <p className={`text-xs ${templateStatus.className}`}>
                  {templateStatus.text}
                </p>
                {selectedTemplateId ? (
                  <p className="text-xs text-muted-foreground">
                    Loaded:{" "}
                    <span className="font-medium text-foreground">
                      {selectedTemplateLabel}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="grid shrink-0 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-name">
                      Campaign name{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="campaign-name"
                      placeholder="e.g. April availability blast"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="csv-name">CSV file (on server /data)</Label>
                    <div className="flex gap-2">
                      <select
                        id="csv-name"
                        className="h-10 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={
                          csvFiles.includes(fileName)
                            ? fileName
                            : (csvFiles[0] ?? "")
                        }
                        onChange={(e) => setFileName(e.target.value)}
                        disabled={csvListLoading || csvFiles.length === 0}
                      >
                        {csvFiles.length === 0 ? (
                          <option value="">—</option>
                        ) : (
                          csvFiles.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))
                        )}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        disabled={csvListLoading}
                        onClick={() => void loadCsvFiles()}
                        aria-label="Refresh CSV list"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${csvListLoading ? "animate-spin" : ""}`}
                        />
                      </Button>
                    </div>
                    {!csvListLoading && csvFiles.length === 0 ? (
                      <p className="text-sm text-warning">
                        No CSV files found in data folder
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="email-test-mode" className="text-base font-medium">
                      Test mode
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When on, every message in the batch is sent only to the test address
                      you enter (CSV is still used for the send loop and logging).
                    </p>
                  </div>
                  <Switch
                    id="email-test-mode"
                    checked={emailTestMode}
                    onCheckedChange={setEmailTestMode}
                    className="data-[state=checked]:bg-accent-green"
                  />
                </div>
                {emailTestMode ? (
                  <div className="space-y-2">
                    <Label htmlFor="test-email">Test email address</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="you@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                  </div>
                ) : null}

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={savingDraft || templateLoading}
                    onClick={() => void saveDraft()}
                  >
                    {savingDraft ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save draft
                  </Button>
                  <Button
                    className="bg-accent-green hover:bg-accent-green-hover"
                    disabled={templateLoading || sending}
                    onClick={() => void openSendModal()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {emailTestMode ? "Send Test Email" : "Send campaign"}
                  </Button>
                </div>

                <details
                  open
                  className="group shrink-0 overflow-hidden rounded-lg border border-accent-green/25 bg-card-bg shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-accent-green/8 px-4 py-3 text-sm font-semibold text-accent-green hover:bg-accent-green/12 [&::-webkit-details-marker]:hidden">
                    <span>Edit Inventory</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="max-h-[min(520px,50vh)] space-y-4 overflow-y-auto border-t border-accent-green/15 p-4">
                    <div className="space-y-4">
                      <div className="space-y-3 rounded-md border border-accent-green/20 bg-card-bg p-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-green">
                            Available Now Categories
                          </h3>
                          <div className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-accent-green/35 text-accent-green hover:bg-accent-green/10"
                              onClick={() => setAddCategoryOpen((o) => !o)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Category
                            </Button>
                            {addCategoryOpen ? (
                              <div className="absolute right-0 z-20 mt-2 w-72 rounded-md border border-border bg-card p-3 shadow-lg">
                                <p className="mb-3 text-sm font-medium">
                                  New category
                                </p>
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Category Type</Label>
                                    <select
                                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                      value={addCategoryFormType}
                                      onChange={(e) =>
                                        setAddCategoryFormType(
                                          e.target.value as AddCategoryFormType
                                        )
                                      }
                                    >
                                      <option value="Clones">Clones</option>
                                      <option value="Teens">Teens</option>
                                      <option value="Other">Other</option>
                                    </select>
                                  </div>
                                  {addCategoryFormType === "Other" ? (
                                    <div className="space-y-1">
                                      <Label className="text-xs">Category Name</Label>
                                      <Input
                                        value={addCategoryCustomName}
                                        onChange={(e) =>
                                          setAddCategoryCustomName(e.target.value)
                                        }
                                        placeholder="Custom name"
                                      />
                                    </div>
                                  ) : null}
                                  <div className="flex justify-end gap-2 pt-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setAddCategoryOpen(false);
                                        setAddCategoryCustomName("");
                                        setAddCategoryFormType("Clones");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="bg-accent-green hover:bg-accent-green-hover"
                                      onClick={() => confirmAddInventoryCategory()}
                                    >
                                      Confirm
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-4">
                          {inventoryCategories.map((cat) => (
                            <div
                              key={cat.id}
                              className="overflow-hidden rounded-lg border border-border bg-card-bg shadow-sm"
                            >
                              <div
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                                style={{
                                  backgroundColor:
                                    cat.headerColor ??
                                    defaultHeaderColorForType(cat.categoryType),
                                }}
                              >
                                <span className="text-sm font-semibold text-[var(--text-on-accent)]">
                                  {categoryDisplayName(cat)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Label className="m-0 shrink-0 text-xs font-medium text-[var(--text-on-accent)]/90">
                                    Color
                                  </Label>
                                  <select
                                    className="h-8 max-w-[min(100%,220px)] rounded border border-[var(--text-on-accent)]/40 bg-black/25 px-1.5 text-xs text-[var(--text-on-accent)] shadow-sm focus:outline-none focus:ring-1 focus:ring-[var(--text-on-accent)]/50"
                                    value={
                                      cat.headerColor ??
                                      defaultHeaderColorForType(cat.categoryType)
                                    }
                                    onChange={(e) => {
                                      const hex = e.target.value;
                                      setInventoryCategories((prev) =>
                                        prev.map((c) =>
                                          c.id === cat.id
                                            ? { ...c, headerColor: hex }
                                            : c
                                        )
                                      );
                                    }}
                                    aria-label="Category color"
                                  >
                                    {CATEGORY_HEADER_COLOR_OPTIONS.map((opt) => (
                                      <option key={opt.hex} value={opt.hex}>
                                        {opt.emoji} {opt.label} ({opt.hex})
                                      </option>
                                    ))}
                                    {!CATEGORY_HEADER_COLOR_OPTIONS.some(
                                      (o) =>
                                        o.hex ===
                                        (cat.headerColor ??
                                          defaultHeaderColorForType(
                                            cat.categoryType
                                          ))
                                    ) ? (
                                      <option
                                        value={
                                          cat.headerColor ??
                                          defaultHeaderColorForType(
                                            cat.categoryType
                                          )
                                        }
                                      >
                                        ⬛ Default (
                                        {cat.headerColor ??
                                          defaultHeaderColorForType(
                                            cat.categoryType
                                          )}
                                        )
                                      </option>
                                    ) : null}
                                  </select>
                                </div>
                              </div>
                              <div className="space-y-3 p-3">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Category name</Label>
                                    <select
                                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                      value={cat.categoryType}
                                      onChange={(e) => {
                                        const v = e.target.value as InventoryCategoryType;
                                        setInventoryCategories((prev) =>
                                          prev.map((c) =>
                                            c.id === cat.id
                                              ? {
                                                  ...c,
                                                  categoryType: v,
                                                  customName:
                                                    v === "Other" ? c.customName : "",
                                                  headerColor:
                                                    defaultHeaderColorForType(v),
                                                }
                                              : c
                                          )
                                        );
                                      }}
                                    >
                                      <option value="Clones">Clones</option>
                                      <option value="Teens">Teens</option>
                                      <option value="Seeds">Seeds</option>
                                      <option value="Other">Other</option>
                                    </select>
                                  </div>
                                  {cat.categoryType === "Other" ? (
                                    <div className="space-y-1">
                                      <Label className="text-xs">Custom category name</Label>
                                      <Input
                                        value={cat.customName}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setInventoryCategories((prev) =>
                                            prev.map((c) =>
                                              c.id === cat.id
                                                ? { ...c, customName: v }
                                                : c
                                            )
                                          );
                                        }}
                                        placeholder="Custom name"
                                      />
                                    </div>
                                  ) : null}
                                  <div className="space-y-1">
                                    <Label className="text-xs">Header / description</Label>
                                    <Input
                                      value={cat.header}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setInventoryCategories((prev) =>
                                          prev.map((c) =>
                                            c.id === cat.id ? { ...c, header: v } : c
                                          )
                                        );
                                      }}
                                      placeholder="Rooted & Ready"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Price</Label>
                                    <Input
                                      value={cat.price}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setInventoryCategories((prev) =>
                                          prev.map((c) =>
                                            c.id === cat.id ? { ...c, price: v } : c
                                          )
                                        );
                                      }}
                                      placeholder="$5 each"
                                    />
                                  </div>
                                </div>

                                <div className="overflow-x-auto rounded-md border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow
                                        className="hover:bg-transparent border-0"
                                        style={{
                                          backgroundColor:
                                            cat.headerColor ??
                                            defaultHeaderColorForType(cat.categoryType),
                                        }}
                                      >
                                        <TableHead className="text-[var(--text-on-accent)]">
                                          Strain
                                        </TableHead>
                                        <TableHead className="text-[var(--text-on-accent)]">
                                          Details / variety
                                        </TableHead>
                                        <TableHead className="w-[120px] text-[var(--text-on-accent)]">
                                          Qty
                                        </TableHead>
                                        <TableHead className="w-12 text-right text-[var(--text-on-accent)]">
                                          {""}
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {cat.rows.map((row) => (
                                        <TableRow key={row.id} className="hover:bg-muted/40">
                                          <TableCell className="py-2">
                                            <Input
                                              className="h-8 text-sm"
                                              value={row.strain}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                setInventoryCategories((prev) =>
                                                  prev.map((c) =>
                                                    c.id !== cat.id
                                                      ? c
                                                      : {
                                                          ...c,
                                                          rows: c.rows.map((r) =>
                                                            r.id === row.id
                                                              ? { ...r, strain: v }
                                                              : r
                                                          ),
                                                        }
                                                  )
                                                );
                                              }}
                                              placeholder="Strain"
                                            />
                                          </TableCell>
                                          <TableCell className="py-2">
                                            <Input
                                              className="h-8 text-sm"
                                              value={row.details}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                setInventoryCategories((prev) =>
                                                  prev.map((c) =>
                                                    c.id !== cat.id
                                                      ? c
                                                      : {
                                                          ...c,
                                                          rows: c.rows.map((r) =>
                                                            r.id === row.id
                                                              ? { ...r, details: v }
                                                              : r
                                                          ),
                                                        }
                                                  )
                                                );
                                              }}
                                              placeholder="Rooted / 3 week veg / feminized"
                                            />
                                          </TableCell>
                                          <TableCell className="py-2">
                                            <Input
                                              type="number"
                                              min={0}
                                              className="h-8 text-sm"
                                              value={row.qty}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                setInventoryCategories((prev) =>
                                                  prev.map((c) =>
                                                    c.id !== cat.id
                                                      ? c
                                                      : {
                                                          ...c,
                                                          rows: c.rows.map((r) =>
                                                            r.id === row.id
                                                              ? { ...r, qty: v }
                                                              : r
                                                          ),
                                                        }
                                                  )
                                                );
                                              }}
                                            />
                                          </TableCell>
                                          <TableCell className="py-2 text-right">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                              disabled={cat.rows.length <= 1}
                                              onClick={() =>
                                                setInventoryCategories((prev) =>
                                                  prev.map((c) =>
                                                    c.id !== cat.id
                                                      ? c
                                                      : {
                                                          ...c,
                                                          rows: c.rows.filter(
                                                            (r) => r.id !== row.id
                                                          ),
                                                        }
                                                  )
                                                )
                                              }
                                              aria-label="Remove row"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-accent-green/35 text-accent-green hover:bg-accent-green/10"
                                    onClick={() =>
                                      setInventoryCategories((prev) =>
                                        prev.map((c) =>
                                          c.id !== cat.id
                                            ? c
                                            : {
                                                ...c,
                                                rows: [
                                                  ...c.rows,
                                                  {
                                                    id: newInvRowId(),
                                                    strain: "",
                                                    details: "",
                                                    qty: "",
                                                  },
                                                ],
                                              }
                                        )
                                      )
                                    }
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Row
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Remove category "${categoryDisplayName(cat)}"?`
                                        )
                                      ) {
                                        setInventoryCategories((prev) =>
                                          prev.filter((c) => c.id !== cat.id)
                                        );
                                      }
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove Category
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 rounded-md border border-accent-green/20 bg-card-bg">
                        <div className="border-b border-accent-green/15 bg-accent-green/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-accent-green">
                          Pre-Orders
                        </div>
                        <div className="overflow-x-auto p-2">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="text-accent-green">
                                  Strain
                                </TableHead>
                                <TableHead className="min-w-[140px] text-accent-green">
                                  Genetics
                                </TableHead>
                                <TableHead className="w-12 text-right text-accent-green">
                                  {""}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {preOrderRows.map((row) => (
                                <TableRow key={row.id} className="hover:bg-muted/40">
                                  <TableCell className="py-2">
                                    <Input
                                      className="h-8 border-accent-green/25 bg-card-bg text-sm"
                                      value={row.strain}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setPreOrderRows((prev) =>
                                          prev.map((r) =>
                                            r.id === row.id ? { ...r, strain: v } : r
                                          )
                                        );
                                      }}
                                      placeholder="Strain"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Input
                                      className="h-8 border-accent-green/25 bg-card-bg text-sm"
                                      value={row.genetics}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setPreOrderRows((prev) =>
                                          prev.map((r) =>
                                            r.id === row.id
                                              ? { ...r, genetics: v }
                                              : r
                                          )
                                        );
                                      }}
                                      placeholder="Genetics"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2 text-right">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      disabled={preOrderRows.length <= 1}
                                      onClick={() =>
                                        setPreOrderRows((prev) =>
                                          prev.filter((r) => r.id !== row.id)
                                        )
                                      }
                                      aria-label="Remove row"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full bg-accent-green hover:bg-accent-green-hover sm:w-auto"
                      disabled={templateLoading}
                      onClick={updateEmailTemplateFromInventory}
                    >
                      Update Email Template
                    </Button>
                  </div>
                </details>
              </div>

              {/* Right — live preview */}
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 lg:w-1/2">
                <Label className="shrink-0 text-base font-medium">Preview</Label>
                <p className="shrink-0 text-sm text-muted-foreground">
                  Previewing: {selectedTemplateLabel || "—"}
                </p>
                <iframe
                  title="Email preview"
                  className="min-h-0 w-full flex-1 overflow-auto rounded-md border border-border bg-muted/20"
                  sandbox="allow-same-origin"
                  srcDoc={previewSrcDoc}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {sending && (
        <Card className="border-accent-green/40 bg-accent-green/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sending campaign…</CardTitle>
            <CardDescription>
              Do not close this tab. Large lists may take several minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full animate-pulse bg-accent-green/70" />
            </div>
          </CardContent>
        </Card>
      )}

      {sendResult && !sending && (
        <Card className="border-success/30 bg-success/10">
          <CardHeader>
            <CardTitle className="text-base">Send results</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Sent:</span>{" "}
              <strong>{sendResult.sent}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Failed:</span>{" "}
              <strong>{sendResult.failed}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Skipped:</span>{" "}
              <strong>{sendResult.skipped}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Campaign log ID:</span>{" "}
              <strong>{sendResult.campaign_log_id}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      {/* SECTION 2 — campaign history (same columns as Text Campaign History) */}
      <section
        className={`space-y-4 ${activeSection === "editor" ? "cannacore-section-hidden" : ""}`}
      >
        <h2 className="text-lg font-semibold tracking-tight">Email Campaign History</h2>
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>Most recent first.</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : campaigns.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No campaigns sent yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Campaign name</TableHead>
                    <TableHead>File used</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                    <TableHead className="text-right">Delivery rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((row) => {
                    const dr = deliveryRatePct(row.total_sent, row.total_failed);
                    const isOpen = expandedCampaignId === row.id;
                    const rowLoading = expansionLoadingId === row.id;
                    const details = campaignDetailsById[row.id];
                    const sg = sendgridStatsById[row.id];
                    const delivered = sg?.delivered ?? 0;
                    const requests = sg?.requests ?? 0;
                    const deliveredPct =
                      requests > 0
                        ? Math.round((10000 * delivered) / requests) / 100
                        : 0;
                    const opens = sg?.opens ?? 0;
                    const openRate =
                      delivered > 0
                        ? Math.round((10000 * opens) / delivered) / 100
                        : 0;
                    const sgBounces = sg?.bounces ?? 0;
                    const failedCount = details?.stats.total_failed ?? row.total_failed;
                    const failedList =
                      details?.failed_emails?.map((f) => f.recipient_email) ?? [];

                    return (
                      <Fragment key={row.id}>
                        <TableRow
                          className={`cursor-pointer hover:bg-muted/50 ${isOpen ? "bg-muted/30" : ""}`}
                          onClick={() => void toggleCampaignRow(row.id)}
                        >
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDateTime(row.date_sent)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.campaign_name}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {row.file_used || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.total_sent}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.total_failed}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.total_skipped}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${deliveryRateClass(dr)}`}
                          >
                            {dr.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        {isOpen ? (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={7} className="p-0">
                              <div className="border-t bg-muted/20 p-4">
                                {rowLoading ? (
                                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                    Loading campaign details…
                                  </div>
                                ) : (
                                  <div className="space-y-6">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                      <div className="rounded-lg border bg-card p-4 shadow-sm">
                                        <p className="text-xs font-medium text-muted-foreground">
                                          Delivered
                                        </p>
                                        <p className="text-2xl font-semibold tabular-nums text-success">
                                          {delivered.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {deliveredPct.toFixed(1)}% of requests
                                          {sg?.error ? (
                                            <span className="ml-1 text-warning">
                                              (SendGrid)
                                            </span>
                                          ) : null}
                                        </p>
                                      </div>
                                      <div className="rounded-lg border bg-card p-4 shadow-sm">
                                        <p className="text-xs font-medium text-muted-foreground">
                                          Opens
                                        </p>
                                        <p className="text-2xl font-semibold tabular-nums text-success">
                                          {opens.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {openRate.toFixed(1)}% open rate
                                        </p>
                                      </div>
                                      <div className="rounded-lg border bg-card p-4 shadow-sm">
                                        <p className="text-xs font-medium text-muted-foreground">
                                          Bounces
                                        </p>
                                        <p className="text-2xl font-semibold tabular-nums text-warning">
                                          {sgBounces.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          From SendGrid (campaign day)
                                        </p>
                                      </div>
                                      <div className="rounded-lg border bg-card p-4 shadow-sm">
                                        <p className="text-xs font-medium text-muted-foreground">
                                          Failed to send
                                        </p>
                                        <p className="text-2xl font-semibold tabular-nums text-danger">
                                          {failedCount}
                                        </p>
                                        {failedList.length > 0 ? (
                                          <ul className="mt-1 max-h-20 list-inside list-disc overflow-y-auto text-xs text-danger">
                                            {failedList.slice(0, 8).map((em) => (
                                              <li key={em} className="truncate">
                                                {em}
                                              </li>
                                            ))}
                                            {failedList.length > 8 ? (
                                              <li className="text-muted-foreground">
                                                +{failedList.length - 8} more…
                                              </li>
                                            ) : null}
                                          </ul>
                                        ) : (
                                          <p className="text-xs text-muted-foreground">
                                            No CRM send failures
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <h3 className="text-sm font-semibold text-foreground">
                                        Failed &amp; Bounced Emails
                                      </h3>
                                      {details &&
                                      details.delivery_issues.length > 0 ? (
                                        <div className="overflow-x-auto rounded-md border">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Email address</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead>Date/time</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {details.delivery_issues.map(
                                                (issue, idx) => (
                                                  <TableRow key={`${issue.email}-${idx}`}>
                                                    <TableCell className="font-mono text-sm">
                                                      {issue.email}
                                                    </TableCell>
                                                    <TableCell
                                                      className={
                                                        issue.reason === "Bounced"
                                                          ? "text-amber-700"
                                                          : "text-danger"
                                                      }
                                                    >
                                                      {issue.reason}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                                      {issue.occurred_at
                                                        ? formatDateTime(
                                                            issue.occurred_at
                                                          )
                                                        : "—"}
                                                    </TableCell>
                                                  </TableRow>
                                                )
                                              )}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      ) : (
                                        <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                                          No failures for this campaign
                                        </p>
                                      )}
                                    </div>

                                    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-semibold">
                                          Engagement (from SendGrid)
                                        </h3>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void refreshSendgridStats(row.id);
                                          }}
                                        >
                                          <RefreshCw className="mr-2 h-4 w-4" />
                                          Refresh
                                        </Button>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Live data from SendGrid
                                      </p>
                                      {sg?.error ? (
                                        <p className="text-sm text-warning">
                                          {sg.error}
                                        </p>
                                      ) : null}
                                      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                        <p>
                                          <span className="text-muted-foreground">
                                            Opens:
                                          </span>{" "}
                                          <strong className="text-success">
                                            {opens.toLocaleString()}
                                          </strong>{" "}
                                          <span className="text-muted-foreground">
                                            ({openRate.toFixed(1)}% rate)
                                          </span>
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">
                                            Clicks:
                                          </span>{" "}
                                          <strong className="text-success">
                                            {(sg?.clicks ?? 0).toLocaleString()}
                                          </strong>
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">
                                            Bounces:
                                          </span>{" "}
                                          <strong className="text-warning">
                                            {sgBounces.toLocaleString()}
                                          </strong>
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">
                                            Spam reports:
                                          </span>{" "}
                                          <strong className="text-warning">
                                            {(sg?.spam_reports ?? 0).toLocaleString()}
                                          </strong>
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">
                                            Unsubscribes:
                                          </span>{" "}
                                          <strong>
                                            {(sg?.unsubscribes ?? 0).toLocaleString()}
                                          </strong>
                                        </p>
                                        <p>
                                          <span className="text-muted-foreground">
                                            Delivered:
                                          </span>{" "}
                                          <strong className="text-success">
                                            {delivered.toLocaleString()}
                                          </strong>
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send this campaign?</DialogTitle>
            <DialogDescription>
              On confirm, your editor HTML is saved to{" "}
              <code className="text-xs">
                {selectedTemplateId === "2"
                  ? "data/email_template_simple.html"
                  : "data/email_template.html"}
              </code>{" "}
              (template id 2 → simple file; others → full) and the batch is sent
              using the same editor HTML body.
              {emailTestMode
                ? ` All messages go to ${testEmail.trim() || "your test address"}.`
                : " Recipients follow server TEST_MODE when no test address is set in the campaign UI."}
            </DialogDescription>
          </DialogHeader>
          {confirmLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Estimating recipient count…
            </div>
          ) : confirmInfo ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Campaign:</span>{" "}
                <strong>{campaignName.trim()}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Recipient file:</span>{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  {fileName.trim()}
                </code>
              </p>
              <p>
                <span className="text-muted-foreground">
                  Estimated send count:
                </span>{" "}
                <strong>{confirmInfo.total_valid_emails}</strong>{" "}
                <span className="text-muted-foreground">
                  (valid emails in file; actual batch may follow daily limits)
                </span>
              </p>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSendOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-accent-green hover:bg-accent-green-hover"
              disabled={sending || confirmLoading || !confirmInfo}
              onClick={() => void executeSend()}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : emailTestMode ? (
                "Send Test Email"
              ) : (
                "Confirm send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as new template</DialogTitle>
            <DialogDescription>
              Create a new managed template from the current editor HTML.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="save-as-name">Template name</Label>
            <Input
              id="save-as-name"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              placeholder="Template name"
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmSaveAsNew();
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSaveAsOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-accent-green hover:bg-accent-green-hover"
              onClick={() => void confirmSaveAsNew()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              Delete template &quot;{selectedTemplateLabel}&quot;? This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteTemplate()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={htmlModalOpen}
        onOpenChange={(open) => {
          if (open) {
            setHtmlModalOpen(true);
            return;
          }
          tryCloseHtmlModal();
        }}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90vw]">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 pr-14 text-left">
            <DialogTitle>Edit HTML Source</DialogTitle>
            <DialogDescription className="sr-only">
              Edit the email HTML. Save and close to update the preview.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex h-[min(100%,calc(90vh-8rem))] min-h-[240px] overflow-hidden rounded-md border border-border-theme bg-[var(--editor-bg)] font-mono shadow-inner">
              <div
                className="relative w-11 shrink-0 select-none overflow-hidden border-r border-border-theme bg-[var(--editor-gutter-bg)] text-[var(--editor-muted)]"
                aria-hidden
              >
                <div
                  className="absolute left-0 right-0 top-0 px-1.5 py-3 text-right"
                  style={{
                    fontSize: EDITOR_FONT_SIZE_PX,
                    lineHeight: `${EDITOR_LINE_HEIGHT_PX}px`,
                    transform: `translateY(-${htmlModalScrollTop}px)`,
                  }}
                >
                  {Array.from({ length: htmlModalLineCount }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        height: EDITOR_LINE_HEIGHT_PX,
                        lineHeight: `${EDITOR_LINE_HEIGHT_PX}px`,
                      }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
              <textarea
                id="campaign-html-modal-editor"
                className="min-h-0 flex-1 resize-none overflow-y-auto border-0 bg-[var(--editor-bg)] px-3 py-3 font-mono text-[var(--editor-text)] outline-none ring-0 placeholder:text-neutral-600 focus:ring-0"
                style={{
                  fontSize: EDITOR_FONT_SIZE_PX,
                  lineHeight: `${EDITOR_LINE_HEIGHT_PX}px`,
                  tabSize: 2,
                }}
                spellCheck={false}
                value={htmlModalDraft}
                onChange={(e) => setHtmlModalDraft(e.target.value)}
                onScroll={(e) =>
                  setHtmlModalScrollTop(e.currentTarget.scrollTop)
                }
                placeholder="<!DOCTYPE html>…"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:gap-0">
            <Button type="button" variant="outline" onClick={tryCloseHtmlModal}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-accent-green hover:bg-accent-green-hover"
              onClick={saveHtmlModalAndClose}
            >
              Save & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
