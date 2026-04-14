"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import type {
  CampaignLog,
  CampaignSendAPIResponse,
  CampaignTemplateResponse,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
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

type AvailableRow = { id: string; strain: string; qty: string };
type PreOrderRow = { id: string; strain: string; genetics: string };

function newInvRowId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createInitialAvailableRows(): AvailableRow[] {
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
    qty,
  }));
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
  rows: { strain: string; qty: string }[]
): { ok: boolean; html: string } {
  const start = source.indexOf(AVAILABLE_INNER_OPEN);
  if (start === -1) return { ok: false, html: source };
  const afterOpen = start + AVAILABLE_INNER_OPEN.length;
  const qtyIdx = source.indexOf(">Qty</td>", afterOpen);
  if (qtyIdx === -1) return { ok: false, html: source };
  const headerRowEnd = source.indexOf("</tr>", qtyIdx);
  if (headerRowEnd === -1) return { ok: false, html: source };
  const bodyStart = headerRowEnd + "</tr>".length;
  const bodyEnd = source.indexOf("</table>", bodyStart);
  if (bodyEnd === -1) return { ok: false, html: source };
  const built = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f4f9f5";
      const qtyClean = String(r.qty).replace(/[^0-9]/g, "") || "0";
      return `<tr style="background-color:${bg};"><td style="font-size:13px;color:#333333;padding:6px 12px;">${escHtml(r.strain)}</td><td style="font-size:13px;color:#2d6e3e;font-weight:bold;padding:6px 12px;">${escHtml(qtyClean)}</td></tr>`;
    })
    .join("\n                    ");
  const replacement = `\n                    ${built}`;
  return {
    ok: true,
    html: source.slice(0, bodyStart) + replacement + source.slice(bodyEnd),
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

export default function CampaignsPage() {
  const [campaignName, setCampaignName] = useState("");
  const [fileName, setFileName] = useState(DEFAULT_CSV);
  const [html, setHtml] = useState("");
  const [templateLoading, setTemplateLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);

  const [availableRows, setAvailableRows] = useState<AvailableRow[]>(
    createInitialAvailableRows
  );
  const [preOrderRows, setPreOrderRows] = useState<PreOrderRow[]>(
    createInitialPreOrderRows
  );

  const [campaigns, setCampaigns] = useState<CampaignLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmInfo, setConfirmInfo] = useState<ConfirmSendResponse | null>(
    null
  );
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<CampaignSendAPIResponse | null>(
    null
  );

  const lineCount = useMemo(
    () => Math.max(1, html.split("\n").length),
    [html]
  );

  const previewSrcDoc = useMemo(
    () => PREVIEW_WRAPPER.replace("EDITOR_HTML_HERE", html),
    [html]
  );

  const loadTemplate = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const { data } = await api.get<CampaignTemplateResponse>(
        "/campaigns/template"
      );
      setHtml(data.html);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setTemplateLoading(false);
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

  useEffect(() => {
    void loadTemplate();
    void loadHistory();
  }, [loadTemplate, loadHistory]);

  async function saveDraft() {
    setSavingDraft(true);
    try {
      const { data } = await api.post<CampaignTemplateSaveResponse>(
        "/campaigns/template",
        { html }
      );
      if (data.success) {
        toast.success("Draft saved.");
        await loadTemplate();
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setSavingDraft(false);
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
      await api.post<CampaignTemplateSaveResponse>("/campaigns/template", {
        html,
      });
      const { data } = await api.post<CampaignSendAPIResponse>(
        "/campaigns/send",
        {
          campaign_name: campaignName.trim(),
          file_name: fileName.trim(),
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

  function toggleRow(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function updateEmailTemplateFromInventory() {
    const avail = replaceAvailableRowsInHtml(html, availableRows);
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground">
          Edit HTML on the left — preview updates live on the right. Save draft
          persists to the server; send uses the saved file plus your CSV.
        </p>
      </div>

      {/* SECTION 1 — split editor / live preview */}
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Campaign editor</CardTitle>
            <CardDescription>
              Plain HTML editor with live preview. Save draft writes to{" "}
              <code className="text-xs">data/email_template.html</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div
              className="flex min-h-[320px] flex-col gap-4 lg:flex-row lg:gap-6"
              style={{ minHeight: SPLIT_HEIGHT, height: SPLIT_HEIGHT }}
            >
              {/* Left — HTML textarea */}
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 lg:w-1/2">
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
                    <Label htmlFor="csv-name">
                      CSV file name (on server /data)
                    </Label>
                    <Input
                      id="csv-name"
                      placeholder={DEFAULT_CSV}
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                    />
                  </div>
                </div>

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
                    className="bg-[#2d6e3e] hover:bg-[#256035]"
                    disabled={templateLoading || sending}
                    onClick={() => void openSendModal()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send campaign
                  </Button>
                </div>

                <details
                  open
                  className="group shrink-0 overflow-hidden rounded-lg border border-[#2d6e3e]/25 bg-white shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-[#2d6e3e]/8 px-4 py-3 text-sm font-semibold text-[#2d6e3e] hover:bg-[#2d6e3e]/12 [&::-webkit-details-marker]:hidden">
                    <span>Edit Inventory</span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="max-h-[min(520px,50vh)] space-y-4 overflow-y-auto border-t border-[#2d6e3e]/15 p-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 rounded-md border border-[#2d6e3e]/20 bg-white">
                        <div className="border-b border-[#2d6e3e]/15 bg-[#2d6e3e]/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#2d6e3e]">
                          Available Now
                        </div>
                        <div className="overflow-x-auto p-2">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="text-[#2d6e3e]">
                                  Strain
                                </TableHead>
                                <TableHead className="w-[120px] text-[#2d6e3e]">
                                  Qty
                                </TableHead>
                                <TableHead className="w-12 text-right text-[#2d6e3e]">
                                  {""}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {availableRows.map((row) => (
                                <TableRow key={row.id} className="hover:bg-muted/40">
                                  <TableCell className="py-2">
                                    <Input
                                      className="h-8 border-[#2d6e3e]/25 bg-white text-sm"
                                      value={row.strain}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setAvailableRows((prev) =>
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
                                      type="number"
                                      min={0}
                                      className="h-8 border-[#2d6e3e]/25 bg-white text-sm"
                                      value={row.qty}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setAvailableRows((prev) =>
                                          prev.map((r) =>
                                            r.id === row.id ? { ...r, qty: v } : r
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
                                      disabled={availableRows.length <= 1}
                                      onClick={() =>
                                        setAvailableRows((prev) =>
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
                        <div className="border-t border-[#2d6e3e]/10 p-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full border-[#2d6e3e]/35 text-[#2d6e3e] hover:bg-[#2d6e3e]/10"
                            onClick={() =>
                              setAvailableRows((prev) => [
                                ...prev,
                                {
                                  id: newInvRowId(),
                                  strain: "",
                                  qty: "0",
                                },
                              ])
                            }
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add row
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-md border border-[#2d6e3e]/20 bg-white">
                        <div className="border-b border-[#2d6e3e]/15 bg-[#2d6e3e]/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#2d6e3e]">
                          Pre-Orders
                        </div>
                        <div className="overflow-x-auto p-2">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="text-[#2d6e3e]">
                                  Strain
                                </TableHead>
                                <TableHead className="min-w-[140px] text-[#2d6e3e]">
                                  Genetics
                                </TableHead>
                                <TableHead className="w-12 text-right text-[#2d6e3e]">
                                  {""}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {preOrderRows.map((row) => (
                                <TableRow key={row.id} className="hover:bg-muted/40">
                                  <TableCell className="py-2">
                                    <Input
                                      className="h-8 border-[#2d6e3e]/25 bg-white text-sm"
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
                                      className="h-8 border-[#2d6e3e]/25 bg-white text-sm"
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
                      className="w-full bg-[#2d6e3e] hover:bg-[#256035] sm:w-auto"
                      disabled={templateLoading}
                      onClick={updateEmailTemplateFromInventory}
                    >
                      Update Email Template
                    </Button>
                  </div>
                </details>

                <div className="flex min-h-0 flex-1 flex-col space-y-2">
                  <Label className="shrink-0">HTML source</Label>
                  {templateLoading ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center rounded-md border bg-muted/30">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 overflow-hidden rounded-md border border-neutral-700 bg-[#1e1e1e] font-mono shadow-inner">
                      {/* Line gutter — scroll position synced with textarea */}
                      <div
                        className="relative w-11 shrink-0 select-none overflow-hidden border-r border-neutral-700 bg-[#252526] text-[#858585]"
                        aria-hidden
                      >
                        <div
                          className="absolute left-0 right-0 top-0 px-1.5 py-3 text-right"
                          style={{
                            fontSize: EDITOR_FONT_SIZE_PX,
                            lineHeight: `${EDITOR_LINE_HEIGHT_PX}px`,
                            transform: `translateY(-${editorScrollTop}px)`,
                          }}
                        >
                          {Array.from({ length: lineCount }, (_, i) => (
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
                        id="campaign-html-editor"
                        className="min-h-0 flex-1 resize-none overflow-y-auto border-0 bg-[#1e1e1e] px-3 py-3 font-mono text-[#d4d4d4] outline-none ring-0 placeholder:text-neutral-600 focus:ring-0"
                        style={{
                          fontSize: EDITOR_FONT_SIZE_PX,
                          lineHeight: `${EDITOR_LINE_HEIGHT_PX}px`,
                          tabSize: 2,
                        }}
                        spellCheck={false}
                        value={html}
                        onChange={(e) => setHtml(e.target.value)}
                        onScroll={(e) =>
                          setEditorScrollTop(e.currentTarget.scrollTop)
                        }
                        placeholder="<!DOCTYPE html>…"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right — live preview */}
              <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 lg:w-1/2">
                <Label className="shrink-0 text-base font-medium">Preview</Label>
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
        <Card className="border-[#2d6e3e]/40 bg-[#2d6e3e]/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sending campaign…</CardTitle>
            <CardDescription>
              Do not close this tab. Large lists may take several minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full animate-pulse bg-[#2d6e3e]/70" />
            </div>
          </CardContent>
        </Card>
      )}

      {sendResult && !sending && (
        <Card className="border-emerald-200 bg-emerald-50/50">
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

      {/* SECTION 2 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Past Campaigns</h2>
        <Card>
          <CardContent className="pt-6">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : campaigns.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No campaigns sent yet.
              </p>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Date</TableHead>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>File Used</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Skipped</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((row) => (
                      <Fragment key={row.id}>
                        <TableRow
                          className={cn("cursor-pointer hover:bg-muted/50")}
                          onClick={() => toggleRow(row.id)}
                        >
                          <TableCell className="w-10 align-middle">
                            {expandedId === row.id ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDateTime(row.date_sent)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.campaign_name}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                            {row.file_used || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.total_sent}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.total_failed}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.total_skipped}
                          </TableCell>
                        </TableRow>
                        {expandedId === row.id && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={7} className="p-4 text-sm">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <p>
                                  <span className="text-muted-foreground">
                                    ID:
                                  </span>{" "}
                                  {row.id}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Date:
                                  </span>{" "}
                                  {formatDateTime(row.date_sent)}
                                </p>
                                <p className="sm:col-span-2">
                                  <span className="text-muted-foreground">
                                    Campaign:
                                  </span>{" "}
                                  {row.campaign_name}
                                </p>
                                <p className="sm:col-span-2">
                                  <span className="text-muted-foreground">
                                    File:
                                  </span>{" "}
                                  {row.file_used || "—"}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Sent:
                                  </span>{" "}
                                  {row.total_sent}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Failed:
                                  </span>{" "}
                                  {row.total_failed}
                                </p>
                                <p>
                                  <span className="text-muted-foreground">
                                    Skipped:
                                  </span>{" "}
                                  {row.total_skipped}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send this campaign?</DialogTitle>
            <DialogDescription>
              On confirm, your editor content is saved to{" "}
              <code className="text-xs">data/email_template.html</code>, then the
              campaign is sent. Respects server TEST_MODE.
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
              className="bg-[#2d6e3e] hover:bg-[#256035]"
              disabled={sending || confirmLoading || !confirmInfo}
              onClick={() => void executeSend()}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Confirm send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
