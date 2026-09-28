"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { authenticatedFetch, supabase } from "./supabase-client";
import type { BudgetItem } from "./budgets";

export type ToolAccount = { id: string; name: string; kind?: string; included?: boolean; bucket?: "needs" | "wants" | "savings" };
export type ToolMovement = { id: string; date: string; name: string; amount: number; kind: string; account: string; target?: string; category: string; subcategory?: string; notes?: string; planned?: boolean };
export type ToolCategory = { name: string; color?: string; bucket?: "needs" | "wants" | "savings"; subcategories?: Array<{ name: string }> };

const euro = (value: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
const download = (content: BlobPart, type: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const html = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const xml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
const titleKind = (kind: string) => ({ ingreso: "Ingreso", gasto: "Gasto", devolucion: "Devolución", traspaso: "Traspaso", deuda: "Deuda" })[kind] ?? kind;
const dateText = (date: string) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${date}T12:00:00`));
const categoryKey = (name: string) => name.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/s$/, "");
const defaultNeedsCategoryKeys = new Set(["Alimentación", "Vivienda", "Transporte", "Salud", "Deudas"].map(categoryKey));

export function FeedbackForm({ currentArea, onSent }: { currentArea: string; onSent: (message: string) => void }) {
  const [type, setType] = useState<"error" | "idea">("error");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const context = { area: currentArea, url: location.href, viewport: `${innerWidth}x${innerHeight}`, userAgent: navigator.userAgent, installed: matchMedia("(display-mode: standalone)").matches };
    const response = await authenticatedFetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, message, context }) });
    setBusy(false);
    if (!response.ok) return onSent("No se ha podido enviar. Inténtalo de nuevo.");
    setMessage("");
    onSent(type === "error" ? "Error enviado. Gracias por avisarnos." : "Sugerencia enviada. Gracias por ayudarnos a mejorar.");
  };
  return <form className="feedback-form" onSubmit={submit}>
    <div className="feedback-kind" role="group" aria-label="Tipo de mensaje">
      <button type="button" className={type === "error" ? "selected" : ""} onClick={() => setType("error")}>He encontrado un error</button>
      <button type="button" className={type === "idea" ? "selected" : ""} onClick={() => setType("idea")}>Quiero proponer una mejora</button>
    </div>
    <label>Cuéntanos qué ha pasado<textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={2000} placeholder="Qué estabas haciendo, qué esperabas que ocurriera y qué ocurrió…" required /></label>
    <small>Adjuntaremos automáticamente la pantalla, el dispositivo y el navegador. Nunca se envían tus importes ni datos financieros.</small>
    <button className="button-primary" disabled={busy}>{busy ? "Enviando…" : "Enviar"}</button>
  </form>;
}

export function AccountSecurity({ email, onMessage }: { email: string; onMessage: (message: string) => void }) {
  const [nextEmail, setNextEmail] = useState(email);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const changeEmail = async () => {
    if (!nextEmail || nextEmail.toLowerCase() === email.toLowerCase()) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: nextEmail }, { emailRedirectTo: location.origin });
    setBusy(false);
    onMessage(error ? "No se ha podido cambiar el correo." : "Revisa ambos correos para confirmar el cambio.");
  };
  const changePassword = async () => {
    if (password.length < 8) return onMessage("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return onMessage("Las contraseñas no coinciden.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (!error) { setPassword(""); setConfirm(""); }
    onMessage(error ? "No se ha podido cambiar la contraseña." : "Contraseña actualizada correctamente.");
  };
  const resend = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: location.origin } });
    setBusy(false);
    onMessage(error ? "No se ha podido reenviar el correo." : "Correo de verificación enviado. Revisa también spam.");
  };
  return <div className="account-security-grid">
    <div><h3>Cambiar correo</h3><label>Correo electrónico<input type="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} /></label><button type="button" className="settings-outline-button" onClick={changeEmail} disabled={busy || nextEmail.toLowerCase() === email.toLowerCase()}>Cambiar correo</button></div>
    <div><h3>Cambiar contraseña</h3><label>Nueva contraseña<input type={showPasswords ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Repite la contraseña<input type={showPasswords ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><button type="button" className="security-password-toggle" onClick={() => setShowPasswords(!showPasswords)} aria-pressed={showPasswords}>{showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}</button><button type="button" className="settings-outline-button" onClick={changePassword} disabled={busy || !password}>Guardar contraseña</button></div>
    <div className="account-verification"><h3>Verificación</h3><p>Si el enlace anterior ha caducado, solicita uno nuevo.</p><button type="button" className="settings-outline-button" onClick={resend} disabled={busy}>Reenviar verificación</button></div>
  </div>;
}

export function NotificationCenter({ movements, accounts, readScope, onOpenLatestReport }: { movements: ToolMovement[]; accounts: ToolAccount[]; readScope: string; onOpenLatestReport: () => void }) {
  const [open, setOpen] = useState(false);
  const [dismissedReport, setDismissedReport] = useState<string | null>(null);
  const [readKeys, setReadKeys] = useState<string[]>([]);
  const [readStateReady, setReadStateReady] = useState(false);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const limit = new Date(today); limit.setDate(limit.getDate() + 10);
  const notices = movements.filter((item) => item.planned && new Date(`${item.date}T12:00:00`) >= today && new Date(`${item.date}T12:00:00`) <= limit).sort((a, b) => a.date.localeCompare(b.date));
  const latestClosedPeriod = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const reportKey = `${latestClosedPeriod.getFullYear()}-${String(latestClosedPeriod.getMonth() + 1).padStart(2, "0")}`;
  const reportAvailable = dismissedReport !== reportKey;
  const storageKey = `mizufi-read-notifications:${readScope}`;
  const reportStorageKey = `mizufi-last-opened-report:${readScope}`;
  const visibleKeys = [...notices.map((item) => `movement:${item.id}:${item.date}`), ...(reportAvailable ? [`report:${reportKey}`] : [])];
  const noticeCount = readStateReady ? visibleKeys.filter((key) => !readKeys.includes(key)).length : 0;
  useEffect(() => {
    setReadStateReady(false);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      setReadKeys(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : []);
    } catch {
      setReadKeys([]);
    }
    setDismissedReport(localStorage.getItem(reportStorageKey));
    setReadStateReady(true);
  }, [reportStorageKey, storageKey]);
  const markVisibleAsRead = () => {
    setReadKeys((current) => {
      const next = Array.from(new Set([...current, ...visibleKeys])).slice(-300);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };
  const openReport = () => {
    localStorage.setItem(reportStorageKey, reportKey);
    setDismissedReport(reportKey);
    setOpen(false);
    onOpenLatestReport();
  };
  return <div className="notification-wrap">
    <button type="button" className="notification-button" onClick={() => { if (!open) markVisibleAsRead(); setOpen(!open); }} aria-label={`Mensajes${noticeCount ? `, ${noticeCount} sin leer` : ""}`} aria-expanded={open}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>{noticeCount > 0 && <b>{noticeCount}</b>}</button>
    {open && <div className="notification-panel"><header><strong>Avisos</strong><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar avisos">×</button></header>{reportAvailable && <button type="button" className="notification-report" onClick={openReport}><span>✓</span><div><strong>Tu informe ya está disponible</strong><small>Consulta el último periodo cerrado</small></div><b>Ver informe</b></button>}{notices.map((item) => <article key={item.id}><span>{new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(`${item.date}T12:00:00`))}</span><div><strong>{item.name}</strong><small>{accounts.find((account) => account.id === item.account)?.name ?? item.category}</small></div><b className={item.kind === "ingreso" ? "positive" : "negative"}>{item.kind === "ingreso" ? "+" : "−"}{euro(item.amount)}</b></article>)}{!reportAvailable && !notices.length && <p>No tienes avisos pendientes.</p>}</div>}
  </div>;
}

export function MonthlyReview({ movements, planned }: { movements: ToolMovement[]; accounts: ToolAccount[]; planned: ToolMovement[] }) {
  const income = movements.filter((m) => m.kind === "ingreso").reduce((sum, m) => sum + m.amount, 0);
  const refunds = movements.filter((m) => m.kind === "devolucion").reduce((sum, m) => sum + m.amount, 0);
  const expenses = movements.filter((m) => m.kind === "gasto" || m.kind === "deuda").reduce((sum, m) => sum + m.amount, 0) - refunds;
  const plannedExpenses = planned.filter((m) => m.kind !== "ingreso" && m.kind !== "traspaso").reduce((sum, m) => sum + m.amount, 0);
  const net = income - expenses;
  const top = Object.values(movements.filter((m) => m.kind === "gasto" || m.kind === "deuda").reduce<Record<string, { name: string; total: number }>>((all, m) => { all[m.category] ??= { name: m.category, total: 0 }; all[m.category].total += m.amount; return all; }, {})).sort((a, b) => b.total - a.total).slice(0, 3);
  return <section className="monthly-review">
    <header><div><span>REVISIÓN DEL PERIODO</span><h2>Tu mes, explicado sin rollos</h2></div><strong className={net < 0 ? "negative" : "positive"}>{net >= 0 ? "+" : ""}{euro(net)}</strong></header>
    <div className="monthly-review-grid"><article><span>Entró</span><strong className="positive">+{euro(income)}</strong></article><article><span>Salió</span><strong className="negative">−{euro(Math.max(0, expenses))}</strong></article><article><span>Devoluciones</span><strong>{euro(refunds)}</strong></article><article><span>Todavía previsto</span><strong>{euro(plannedExpenses)}</strong></article></div>
    <div className="monthly-review-copy"><p>{income || expenses ? net >= 0 ? `Después de tus movimientos realizados, el periodo lleva un margen de ${euro(net)}.` : `Has gastado ${euro(Math.abs(net))} más de lo ingresado en este periodo.` : "Cuando registres movimientos, aquí encontrarás el resumen de lo que entró, salió y queda por venir."}</p>{top.length > 0 && <p>Las categorías con más gasto son <strong>{top.map((item) => `${item.name} (${euro(item.total)})`).join(", ")}</strong>.</p>}<p>{plannedExpenses ? `Aún quedan ${euro(plannedExpenses)} en pagos previstos. Lo importante es que no te pillen por sorpresa.` : "No quedan pagos previstos en el periodo seleccionado."}</p></div>
  </section>;
}

export function DataTools({ movements, accounts, budgets, categories = [], ruleTargets = { needs: 50, wants: 30, savings: 20 }, periodLabel, periodStart, periodEnd, mode = "all", onImport, onMessage }: { movements: ToolMovement[]; accounts: ToolAccount[]; budgets: BudgetItem[]; categories?: ToolCategory[]; ruleTargets?: { needs: number; wants: number; savings: number }; periodLabel: string; periodStart: string; periodEnd: string; mode?: "all" | "import" | "reports"; onImport: (rows: Array<Omit<ToolMovement, "id">>) => void; onMessage: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const current = new Date();
  const [reportRange, setReportRange] = useState<"day" | "month" | "year" | "previous" | "custom">("month");
  const [reportDay, setReportDay] = useState(current.toISOString().slice(0, 10));
  const [reportMonth, setReportMonth] = useState(current.toISOString().slice(0, 7));
  const [reportYear, setReportYear] = useState(current.getFullYear());
  const [customStart, setCustomStart] = useState(periodStart);
  const [customEnd, setCustomEnd] = useState(periodEnd);
  const monthLastDay = (year: number, month: number) => new Date(year, month, 0).getDate();
  let effectiveStart = periodStart, effectiveEnd = periodEnd, effectiveLabel = periodLabel;
  if (reportRange === "day") effectiveStart = effectiveEnd = reportDay, effectiveLabel = dateText(reportDay);
  if (reportRange === "month") { const [year, month] = reportMonth.split("-").map(Number); effectiveStart = `${reportMonth}-01`; effectiveEnd = `${reportMonth}-${String(monthLastDay(year, month)).padStart(2, "0")}`; effectiveLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1)); }
  if (reportRange === "year" || reportRange === "previous") { const year = reportRange === "previous" ? current.getFullYear() - 1 : reportYear; effectiveStart = `${year}-01-01`; effectiveEnd = `${year}-12-31`; effectiveLabel = `Año ${year}`; }
  if (reportRange === "custom") { effectiveStart = customStart <= customEnd ? customStart : customEnd; effectiveEnd = customStart <= customEnd ? customEnd : customStart; effectiveLabel = `${dateText(effectiveStart)} – ${dateText(effectiveEnd)}`; }
  const reportMovements = movements.filter((movement) => !movement.planned && movement.date >= effectiveStart && movement.date <= effectiveEnd);
  const exportRows = reportMovements.map((m) => [dateText(m.date), m.name, titleKind(m.kind), m.amount, accounts.find((a) => a.id === m.account)?.name ?? "", m.category, m.subcategory ?? "", m.notes ?? ""]);
  const headers = ["Fecha", "Concepto", "Tipo", "Importe", "Cuenta", "Categoría", "Subcategoría", "Notas"];
  const csv = [headers, ...exportRows].map((row) => row.map(cell).join(";")).join("\n");
  const exportCsv = () => download(`\ufeff${csv}`, "text/csv;charset=utf-8", `mizufi-movimientos-${effectiveStart}-${effectiveEnd}.csv`);
  const inSelectedPeriod = (item: BudgetItem) => {
    const monthStart = `${item.year}-${String(item.month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${item.year}-${String(item.month + 1).padStart(2, "0")}-${new Date(item.year, item.month + 1, 0).getDate()}`;
    return monthStart <= effectiveEnd && monthEnd >= effectiveStart;
  };
  const selectedBudgets = budgets.filter(inSelectedPeriod);
  const realForBudget = (item: BudgetItem) => reportMovements.filter((movement) => {
    const date = new Date(`${movement.date}T12:00:00`);
    if (date.getFullYear() !== item.year || date.getMonth() !== item.month) return false;
    if (item.bucket === "ingreso" && movement.kind !== "ingreso") return false;
    if (item.bucket === "gasto" && !["gasto", "devolucion"].includes(movement.kind)) return false;
    if (item.bucket === "deuda" && movement.kind !== "deuda") return false;
    if (["ingreso", "gasto", "deuda"].includes(item.bucket)) return (!item.category || movement.category === item.category) && (!item.subcategory || movement.subcategory === item.subcategory);
    const destinationId = movement.kind === "traspaso" ? movement.target : movement.kind === "ingreso" ? movement.account : undefined;
    const destination = accounts.find((account) => account.id === destinationId);
    return destination?.kind === item.bucket && (!item.category || destination.name === item.category);
  }).reduce((sum, movement) => sum + (movement.kind === "devolucion" ? -movement.amount : movement.amount), 0);
  const budgetRows = selectedBudgets.map((item) => {
    const real = realForBudget(item);
    return { item, real, difference: item.amount - real, used: item.amount ? real / item.amount : 0 };
  });
  const income = reportMovements.filter((m) => m.kind === "ingreso").reduce((sum, m) => sum + m.amount, 0);
  const refunds = reportMovements.filter((m) => m.kind === "devolucion").reduce((sum, m) => sum + m.amount, 0);
  const expenses = reportMovements.filter((m) => m.kind === "gasto" || m.kind === "deuda").reduce((sum, m) => sum + m.amount, 0) - refunds;
  const net = income - expenses;
  const budgetedIncome = selectedBudgets.filter((item) => item.bucket === "ingreso").reduce((sum, item) => sum + item.amount, 0);
  const budgetedOut = selectedBudgets.filter((item) => item.bucket !== "ingreso").reduce((sum, item) => sum + item.amount, 0);
  const categoryRows = Object.values(reportMovements.filter((m) => m.kind === "gasto" || m.kind === "deuda" || m.kind === "devolucion").reduce<Record<string, { name: string; value: number; details: Record<string, number> }>>((all, m) => {
    all[m.category] ??= { name: m.category, value: 0, details: {} };
    all[m.category].value += m.kind === "devolucion" ? -m.amount : m.amount;
    const detail = m.subcategory || "Sin subcategoría"; all[m.category].details[detail] = (all[m.category].details[detail] ?? 0) + (m.kind === "devolucion" ? -m.amount : m.amount);
    return all;
  }, {})).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const incomeRows = Object.values(reportMovements.filter((m) => m.kind === "ingreso").reduce<Record<string, { name: string; value: number; details: Record<string, number> }>>((all, m) => { all[m.category] ??= { name: m.category, value: 0, details: {} }; all[m.category].value += m.amount; const detail = m.subcategory || "Sin subcategoría"; all[m.category].details[detail] = (all[m.category].details[detail] ?? 0) + m.amount; return all; }, {})).sort((a, b) => b.value - a.value);
  const bucketAmounts = reportMovements.reduce((result, movement) => { if (["gasto", "deuda", "devolucion"].includes(movement.kind)) { const movementKey = categoryKey(movement.category); const definition = categories.find((category) => categoryKey(category.name) === movementKey); const bucket = definition?.bucket ?? (defaultNeedsCategoryKeys.has(movementKey) ? "needs" : "wants"); result[bucket] += movement.kind === "devolucion" ? -movement.amount : movement.amount; } if (movement.kind === "traspaso") { const destination = accounts.find((account) => account.id === movement.target); if (destination?.kind === "hucha") result[destination.bucket ?? "savings"] += movement.amount; else if (["ahorro", "inversion"].includes(destination?.kind ?? "")) result.savings += movement.amount; } return result; }, { needs: 0, wants: 0, savings: 0 });
  const ruleRows = (["needs", "wants", "savings"] as const).map((key) => ({ key, name: { needs: "Sobrevivir", wants: "Disfrutar", savings: "Ahorro e inversión" }[key], target: ruleTargets[key], actual: income ? bucketAmounts[key] / income * 100 : 0, value: bucketAmounts[key] }));
  const exportExcel = () => {
    const excelCell = (value: unknown, style = "Text", type: "String" | "Number" = "String") => `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
    const row = (cells: string[], style?: string) => `<Row${style ? ` ss:StyleID="${style}"` : ""}>${cells.join("")}</Row>`;
    const sheet = (name: string, widths: number[], rows: string) => `<Worksheet ss:Name="${xml(name)}"><Table>${widths.map((width) => `<Column ss:Width="${width}"/>`).join("")}${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
    const summaryRows = [
      row([excelCell("MiZUFi · Informe del periodo", "Title")]), row([excelCell(effectiveLabel, "Subtitle")]), row([excelCell(`${dateText(effectiveStart)} – ${dateText(effectiveEnd)}`, "Muted")]), row([]),
      row([excelCell("RESUMEN REAL", "Section")]), row([excelCell("Ingresos"), excelCell(income, "MoneyPositive", "Number")]), row([excelCell("Gastos netos"), excelCell(expenses, "MoneyNegative", "Number")]), row([excelCell("Devoluciones"), excelCell(refunds, "Money", "Number")]), row([excelCell("Margen real"), excelCell(net, net < 0 ? "MoneyNegative" : "MoneyPositive", "Number")]), row([]),
      row([excelCell("PLANIFICACIÓN", "Section")]), row([excelCell("Ingresos presupuestados"), excelCell(budgetedIncome, "Money", "Number")]), row([excelCell("Salidas presupuestadas"), excelCell(budgetedOut, "Money", "Number")]), row([excelCell("Margen presupuestado"), excelCell(budgetedIncome - budgetedOut, "Money", "Number")]), row([]),
      row([excelCell("LECTURA RÁPIDA", "Section")]), row([excelCell(net >= 0 ? `El periodo termina con un margen de ${euro(net)}.` : `En el periodo salieron ${euro(Math.abs(net))} más de lo que entró.`, "Wrap")]),
    ].join("");
    const comparisonRows = [row(["Mes", "Partida", "Tipo", "Presupuestado", "Real", "Diferencia", "% utilizado"].map((h) => excelCell(h, "Header"))), ...budgetRows.map(({ item, real, difference, used }) => row([excelCell(new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(item.year, item.month, 1))), excelCell(item.label), excelCell(({ ingreso: "Ingreso", gasto: "Gasto", deuda: "Deuda", hucha: "Hucha", ahorro: "Ahorro", inversion: "Inversión" })[item.bucket]), excelCell(item.amount, "Money", "Number"), excelCell(real, "Money", "Number"), excelCell(difference, difference < 0 ? "MoneyNegative" : "MoneyPositive", "Number"), excelCell(used, "Percent", "Number")]))].join("");
    const breakdownRows = (items: typeof categoryRows, total: number) => [row(["Categoría", "Detalle", "Importe", "% del total"].map((h) => excelCell(h, "Header"))), ...items.flatMap((item) => Object.entries(item.details).filter(([, value]) => value > 0).map(([detail, value]) => row([excelCell(item.name), excelCell(detail), excelCell(value, "Money", "Number"), excelCell(total ? value / total : 0, "Percent", "Number")])) )].join("");
    const ruleSheetRows = [row(["Bloque", "Objetivo", "Real", "Importe", "Diferencia"].map((h) => excelCell(h, "Header"))), ...ruleRows.map((item) => row([excelCell(item.name), excelCell(item.target / 100, "Percent", "Number"), excelCell(item.actual / 100, "Percent", "Number"), excelCell(item.value, "Money", "Number"), excelCell((item.actual - item.target) / 100, "Percent", "Number")]))].join("");
    const movementRows = [row(headers.map((h) => excelCell(h, "Header"))), ...exportRows.map((values) => row(values.map((value, index) => excelCell(value, index === 3 ? "Money" : "Text", index === 3 ? "Number" : "String"))))].join("");
    const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style><Style ss:ID="Text"><Alignment ss:Vertical="Center"/></Style><Style ss:ID="Title"><Font ss:FontName="Arial" ss:Size="20" ss:Bold="1" ss:Color="#173B39"/><Interior ss:Color="#DDF3EF" ss:Pattern="Solid"/></Style><Style ss:ID="Subtitle"><Font ss:FontName="Arial" ss:Size="13" ss:Bold="1" ss:Color="#229E96"/></Style><Style ss:ID="Muted"><Font ss:Color="#6F817E"/></Style><Style ss:ID="Section"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#229E96" ss:Pattern="Solid"/></Style><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#173B39" ss:Pattern="Solid"/><Alignment ss:WrapText="1"/></Style><Style ss:ID="Money"><NumberFormat ss:Format="#,##0.00 [$€-es-ES]"/></Style><Style ss:ID="MoneyPositive"><NumberFormat ss:Format="[Green]#,##0.00 [$€-es-ES]"/><Font ss:Bold="1"/></Style><Style ss:ID="MoneyNegative"><NumberFormat ss:Format="[Red]-#,##0.00 [$€-es-ES]"/><Font ss:Bold="1"/></Style><Style ss:ID="Percent"><NumberFormat ss:Format="0%"/></Style><Style ss:ID="Wrap"><Alignment ss:WrapText="1"/></Style></Styles>${sheet("Resumen", [210, 110], summaryRows)}${sheet("Presupuesto vs real", [110, 190, 90, 105, 105, 105, 90], comparisonRows)}${sheet("Gastos por categoría", [150, 170, 110, 100], breakdownRows(categoryRows, expenses))}${sheet("Ingresos por categoría", [150, 170, 110, 100], breakdownRows(incomeRows, income))}${sheet("Regla de distribución", [150, 100, 100, 110, 100], ruleSheetRows)}${sheet("Movimientos", [85, 190, 85, 90, 130, 120, 120, 230], movementRows)}</Workbook>`;
    download(`\ufeff${workbook}`, "application/vnd.ms-excel", `mizufi-informe-${effectiveStart}-${effectiveEnd}.xml`);
  };
  const printPdf = () => {
    const popup = window.open("", "_blank");
    if (!popup) return onMessage("Permite las ventanas emergentes para crear el PDF.");
    const maxCategory = Math.max(...categoryRows.map((item) => item.value), 1);
    const maxIncomeCategory = Math.max(...incomeRows.map((item) => item.value), 1);
    const budgetTable = budgetRows.length ? `<table><thead><tr><th>Partida</th><th>Presupuestado</th><th>Real</th><th>Diferencia</th><th>Utilizado</th></tr></thead><tbody>${budgetRows.map(({ item, real, difference, used }) => `<tr><td><strong>${html(item.label)}</strong><small>${html(new Intl.DateTimeFormat("es-ES", { month: "long" }).format(new Date(item.year, item.month, 1)))}</small></td><td>${html(euro(item.amount))}</td><td>${html(euro(real))}</td><td class="${difference < 0 ? "bad" : "good"}">${difference >= 0 ? "+" : ""}${html(euro(difference))}</td><td>${Math.round(used * 100)} %</td></tr>`).join("")}</tbody></table>` : `<p class="empty">No hay partidas presupuestadas para este periodo.</p>`;
    const categoryChart = categoryRows.length ? categoryRows.slice(0, 8).map((item) => `<div class="bar-row"><span><b>${html(item.name)}</b><small>${Object.entries(item.details).filter(([, value]) => value > 0).map(([name, value]) => `${html(name)}: ${html(euro(value))}`).join(" · ")}</small></span><i><b style="width:${Math.max(3, item.value / maxCategory * 100)}%;background:#ef7264"></b></i><strong>${html(euro(item.value))}<small>${Math.round(item.value / Math.max(expenses, 1) * 100)} %</small></strong></div>`).join("") : `<p class="empty">Todavía no hay gastos registrados.</p>`;
    const incomeChart = incomeRows.length ? incomeRows.slice(0, 8).map((item) => `<div class="bar-row"><span>${html(item.name)}</span><i><b style="width:${Math.max(3, item.value / maxIncomeCategory * 100)}%"></b></i><strong>${html(euro(item.value))}<small>${Math.round(item.value / Math.max(income, 1) * 100)} %</small></strong></div>`).join("") : `<p class="empty">Todavía no hay ingresos registrados.</p>`;
    const ruleTable = `<table><thead><tr><th>Distribución</th><th>Objetivo</th><th>Real</th><th>Importe</th></tr></thead><tbody>${ruleRows.map((item) => `<tr><td><strong>${html(item.name)}</strong></td><td>${item.target} %</td><td>${Math.round(item.actual)} %</td><td>${html(euro(item.value))}</td></tr>`).join("")}</tbody></table>`;
    popup.document.write(`<html lang="es"><head><meta charset="utf-8"><title>Informe MiZUFi · ${html(periodLabel)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font:12px Arial,sans-serif;color:#173b39;background:#eef7f5}main{max-width:900px;margin:auto;background:#fff;padding:32px}.brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #38b78f;padding-bottom:20px}.brand h1{font-size:28px;margin:0;color:#173b39}.brand h1 span{color:#229e96}.brand p{margin:7px 0 0;color:#6f817e}.period{background:#ddf3ef;color:#176d66;border-radius:18px;padding:12px 18px;text-align:right}.period b,.period small{display:block}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.card{border:1px solid #d6e6e2;border-radius:15px;padding:14px;background:#fbfdfc}.card span{display:block;color:#6f817e;font-size:10px;text-transform:uppercase;letter-spacing:.7px}.card strong{display:block;margin-top:8px;font-size:18px}.positive,.good{color:#16836d}.negative,.bad{color:#b95c52}.insight{border-radius:16px;background:#173b39;color:#fff;padding:18px 20px;margin:0 0 24px}.insight strong{color:#72dbc0}.section{break-inside:avoid;margin:24px 0}.section h2{font-size:17px;margin:0 0 6px}.section>p{color:#6f817e;margin:0 0 14px}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:14px}.comparison article{padding:16px;border-radius:15px;background:#f4faf8}.comparison span{color:#6f817e}.comparison strong{display:block;font-size:19px;margin-top:7px}table{width:100%;border-collapse:collapse;border:1px solid #d6e6e2;border-radius:12px;overflow:hidden}th{background:#173b39;color:#fff;padding:9px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:9px;border-bottom:1px solid #e5eeec}td small{display:block;color:#82908e;margin-top:3px}.bar-row{display:grid;grid-template-columns:130px 1fr 90px;gap:10px;align-items:center;margin:10px 0}.bar-row i{height:10px;background:#e5f1ee;border-radius:20px;overflow:hidden}.bar-row b{display:block;height:100%;background:#38b78f;border-radius:20px}.bar-row strong{text-align:right}.empty{padding:18px;background:#f4faf8;border-radius:12px}.movements{font-size:10px}.footer{margin-top:28px;padding-top:14px;border-top:1px solid #d6e6e2;color:#7b8987;display:flex;justify-content:space-between}.print{position:fixed;right:20px;bottom:20px;border:0;border-radius:999px;background:#38b78f;color:white;padding:13px 19px;font-weight:bold;box-shadow:0 8px 25px #173b3940}@media(max-width:650px){main{padding:20px}.cards{grid-template-columns:1fr 1fr}.comparison{grid-template-columns:1fr}.movements{display:none}}@media print{body{background:#fff}main{padding:0}.print{display:none}}</style></head><body><main><header class="brand"><div><h1><span>MiZUFi</span> · Informe financiero</h1><p>Controla la marea de tus finanzas.</p></div><div class="period"><b>${html(periodLabel)}</b><small>${html(dateText(periodStart))} – ${html(dateText(periodEnd))}</small></div></header><section class="cards"><article class="card"><span>Entró</span><strong class="positive">${html(euro(income))}</strong></article><article class="card"><span>Salió</span><strong class="negative">${html(euro(expenses))}</strong></article><article class="card"><span>Devoluciones</span><strong>${html(euro(refunds))}</strong></article><article class="card"><span>Margen real</span><strong class="${net < 0 ? "negative" : "positive"}">${html(euro(net))}</strong></article></section><section class="insight"><strong>Tu periodo, explicado sin rollos.</strong> ${net >= 0 ? `Después de los movimientos realizados, te queda un margen de ${html(euro(net))}.` : `Ha salido ${html(euro(Math.abs(net)))} más de lo que ha entrado.`}</section><section class="section"><h2>Lo que presupuestaste y lo que ocurrió</h2><p>Compara tu planificación con los movimientos que realmente registraste.</p><div class="comparison"><article><span>Margen presupuestado</span><strong>${html(euro(budgetedIncome - budgetedOut))}</strong></article><article><span>Margen real</span><strong class="${net < 0 ? "negative" : "positive"}">${html(euro(net))}</strong></article></div>${budgetTable}</section><section class="section"><h2>En qué se fue el dinero</h2><p>Gasto neto por categoría, descontando las devoluciones.</p>${categoryChart}</section><section class="section movements"><h2>Detalle de movimientos</h2><table><thead><tr>${headers.slice(0, 6).map((h) => `<th>${html(h)}</th>`).join("")}</tr></thead><tbody>${exportRows.map((values) => `<tr>${values.slice(0, 6).map((value, index) => `<td>${index === 3 ? html(euro(Number(value))) : html(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></section><footer class="footer"><span>Generado por MiZUFi</span><span>${html(new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date()))}</span></footer></main><button class="print" onclick="print()">Guardar como PDF / Imprimir</button></body></html>`);
    popup.document.title = `Informe MiZUFi · ${effectiveLabel}`;
    const periodBox = popup.document.querySelector(".period");
    if (periodBox) periodBox.innerHTML = `<b>${html(effectiveLabel)}</b><small>${html(dateText(effectiveStart))} – ${html(dateText(effectiveEnd))}</small>`;
    const movementSection = popup.document.querySelector(".movements");
    movementSection?.insertAdjacentHTML("beforebegin", `<section class="section"><h2>De dónde vino el dinero</h2><p>Ingresos por categoría, con su peso sobre el total.</p>${incomeChart}</section><section class="section"><h2>Tu regla de distribución</h2><p>Comparación entre la regla elegida en Preferencias y el reparto real del periodo.</p>${ruleTable}</section>`);
    popup.document.close();
  };
  const parseFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
      const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
      const parseLine = (line: string) => { const values: string[] = []; let current = "", quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && line[i + 1] === '"') { current += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === delimiter && !quoted) { values.push(current.trim()); current = ""; } else current += char; } values.push(current.trim()); return values; };
      const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const header = parseLine(lines[0]).map(normalized);
      const indexOf = (...names: string[]) => header.findIndex((value) => names.some((name) => value.includes(name)));
      const dateIndex = indexOf("fecha", "date"), nameIndex = indexOf("concepto", "descripcion", "description"), amountIndex = indexOf("importe", "amount"), accountIndex = indexOf("cuenta", "account"), categoryIndex = indexOf("categoria", "category"), subcategoryIndex = indexOf("subcategoria"), notesIndex = indexOf("nota", "observacion");
      if (dateIndex < 0 || nameIndex < 0 || amountIndex < 0) throw new Error("columns");
      const fallbackAccount = accounts.find((a) => a.included)?.id ?? accounts[0]?.id;
      if (!fallbackAccount) throw new Error("account");
      const rows = lines.slice(1).map(parseLine).flatMap((values) => {
        const rawDate = values[dateIndex] ?? ""; const match = rawDate.match(/(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,4})/); if (!match) return [];
        const date = match[1].length === 4 ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
        const rawAmount = (values[amountIndex] ?? "").replace(/\s|€/g, ""); const decimal = rawAmount.includes(",") ? rawAmount.replaceAll(".", "").replace(",", ".") : rawAmount; const signed = Number(decimal); if (!Number.isFinite(signed) || signed === 0) return [];
        const accountName = values[accountIndex] ?? ""; const account = accounts.find((a) => normalized(a.name) === normalized(accountName))?.id ?? fallbackAccount;
        return [{ date, name: values[nameIndex] || "Movimiento importado", amount: Math.abs(signed), kind: signed > 0 ? "ingreso" : "gasto", account, category: values[categoryIndex] || (signed > 0 ? "Ingresos" : "Sin categoría"), subcategory: values[subcategoryIndex] || "", notes: values[notesIndex] || "Importado desde CSV" }];
      });
      if (!rows.length) throw new Error("rows");
      onImport(rows);
      onMessage(`${rows.length} ${rows.length === 1 ? "movimiento importado" : "movimientos importados"}. Revisa los datos antes de continuar.`);
    } catch { onMessage("No hemos podido leer el archivo. Usa columnas Fecha, Concepto e Importe."); }
    finally { if (input.current) input.current.value = ""; }
  };
  const template = () => download(`\ufeff${headers.join(";")}\n15/09/2026;Compra supermercado;gasto;-42,50;;Alimentación;Supermercado;`, "text/csv;charset=utf-8", "plantilla-mizufi.csv");
  return <div className={`data-tools ${mode !== "all" ? "single" : ""}`}>
    {mode !== "reports" && <div><h3>Importar movimientos</h3><p>Sube un CSV de tu banco o utiliza nuestra plantilla. Necesitamos al menos Fecha, Concepto e Importe.</p><div><button type="button" className="settings-outline-button" onClick={() => input.current?.click()}>Importar CSV</button><button type="button" onClick={template}>Descargar plantilla</button><input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(event) => parseFile(event.target.files?.[0])} /></div></div>}
    {mode !== "import" && <div><h3>Informe personalizado</h3><p>Elige exactamente el periodo que quieres analizar.</p><div className="report-period-picker"><label>Periodo<select value={reportRange} onChange={(event) => setReportRange(event.target.value as typeof reportRange)}><option value="day">Un día</option><option value="month">Un mes concreto</option><option value="year">Un año completo</option><option value="previous">El año pasado</option><option value="custom">Fechas personalizadas</option></select></label>{reportRange === "day" && <label>Fecha<input type="date" value={reportDay} onChange={(event) => setReportDay(event.target.value)} /></label>}{reportRange === "month" && <label>Mes<input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} /></label>}{reportRange === "year" && <label>Año<input type="number" min="2000" max="2100" value={reportYear} onChange={(event) => setReportYear(Number(event.target.value))} /></label>}{reportRange === "custom" && <><label>Desde<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label>Hasta<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></>}<small>{effectiveLabel} · {reportMovements.length} movimientos</small></div><div className="report-download-actions"><button type="button" onClick={exportCsv}>Movimientos CSV</button><button type="button" onClick={exportExcel}>Excel completo</button><button type="button" onClick={printPdf}>Informe PDF</button></div></div>}
  </div>;
}
