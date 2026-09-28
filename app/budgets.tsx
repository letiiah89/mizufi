"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import AnnualExpenses, { type AnnualExpense, type AnnualPayment } from "./annual-expenses";

export type BudgetBucket = "ingreso" | "gasto" | "hucha" | "ahorro" | "inversion" | "deuda";
export type BudgetItem = {
  id: string;
  year: number;
  month: number;
  bucket: BudgetBucket;
  label: string;
  amount: number;
  category?: string;
  subcategory?: string;
};
type Movement = { date: string; amount: number; kind: string; account?: string; category: string; subcategory: string; target?: string; planned?: boolean };
type Category = { name: string; subcategories: { name: string }[]; bucket?: "needs" | "wants" | "savings" };
type Account = { id: string; name: string; kind: string; balance: number; goal?: number; bucket?: "needs" | "wants" | "savings" };
type Props = {
  items: BudgetItem[];
  movements: Movement[];
  categories: Category[];
  accounts: Account[];
  initialYear?: number;
  initialMonth?: number;
  onViewChange?: (year: number, month: number) => void;
  onChange: (items: BudgetItem[]) => void;
  onCreateCategory: () => void;
  annualExpenses: AnnualExpense[];
  programs: { id: string; name: string; kind: string; amount: number }[];
  onAnnualChange: (expenses: AnnualExpense[]) => void;
  onCreateHucha: (name: string, goal: number) => string;
  onCreateProgram: (program: { name: string; amount: number; date: string; frequency: AnnualExpense["frequency"]; accountId: string; category: string; subcategory: string }) => string;
  onRegisterAnnualPayment: (expense: AnnualExpense, payment: AnnualPayment, accountId: string) => void;
  ruleTargets: { needs: number; wants: number; savings: number };
};

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const buckets: { id: BudgetBucket; label: string; color: string }[] = [
  { id: "ingreso", label: "Ingresos", color: "#4f8d7e" },
  { id: "gasto", label: "Gastos", color: "#bd806f" },
  { id: "hucha", label: "Huchas", color: "#a18194" },
  { id: "ahorro", label: "Ahorro", color: "#678d86" },
  { id: "inversion", label: "Inversión", color: "#778ba3" },
  { id: "deuda", label: "Deudas", color: "#a46f67" },
];
const money = (value: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
const id = () => Math.random().toString(36).slice(2, 10);
const categoryKey = (name: string) => name.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/s$/, "");
const defaultNeedsCategoryKeys = new Set(["Alimentación", "Vivienda", "Transporte", "Salud", "Deudas"].map(categoryKey));
const huchaLabel = (name: string) => /^hucha(?:\s|\s*·)/i.test(name.trim()) ? name : `Hucha · ${name}`;

export default function BudgetPlanner({ items, movements, categories, accounts, initialYear, initialMonth, onViewChange, onChange, onCreateCategory, annualExpenses, programs, onAnnualChange, onCreateHucha, onCreateProgram, onRegisterAnnualPayment, ruleTargets }: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const today = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [selectedYear, setSelectedYear] = useState(initialYear ?? currentYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? currentMonth);
  const [adding, setAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [copying, setCopying] = useState(false);
  const [bucket, setBucket] = useState<BudgetBucket>("gasto");
  const [category, setCategory] = useState("Alimentación");
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [copyTargetYear, setCopyTargetYear] = useState(initialYear ?? currentYear);
  const [copyMode, setCopyMode] = useState<"replace" | "add">("replace");
  const [view, setView] = useState<"budget" | "annual">("budget");
  const [collapsedSections, setCollapsedSections] = useState<BudgetBucket[]>([]);
  const [openRuleBucket, setOpenRuleBucket] = useState<"needs" | "wants" | "savings" | null>(null);

  useEffect(() => {
    if (initialYear != null) setSelectedYear(initialYear);
    if (initialMonth != null) setSelectedMonth(initialMonth);
  }, [initialYear, initialMonth]);

  const selectView = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    onViewChange?.(year, month);
  };
  const yearItems = items.filter((item) => item.year === selectedYear);
  const monthItems = yearItems.filter((item) => item.month === selectedMonth);
  const actualFor = (month: number, targetBucket: BudgetBucket, item?: BudgetItem) =>
    movements.filter((movement) => {
      const date = new Date(`${movement.date}T12:00:00`);
      if (movement.planned || movement.date > today || date.getFullYear() !== selectedYear || date.getMonth() !== month) return false;
      if (targetBucket === "ingreso" && movement.kind !== "ingreso") return false;
      if (targetBucket === "gasto" && !["gasto", "devolucion"].includes(movement.kind)) return false;
      if (targetBucket === "deuda" && movement.kind !== "deuda") return false;
      if (["ingreso", "gasto", "deuda"].includes(targetBucket)) {
        if (!item) return true;
        if (item.category && movement.category !== item.category) return false;
        return !item.subcategory || movement.subcategory === item.subcategory;
      }
      const destination = movement.kind === "traspaso"
        ? accounts.find((account) => account.id === movement.target)
        : movement.kind === "ingreso"
          ? accounts.find((account) => account.id === movement.account)
          : undefined;
      return destination?.kind === targetBucket && (!item?.category || destination.name === item.category);
    });
  const actualTotal = (month: number, targetBucket: BudgetBucket, item?: BudgetItem) =>
    actualFor(month, targetBucket, item).reduce((sum, movement) => sum + (movement.kind === "devolucion" ? -movement.amount : movement.amount), 0);
  const planned = (month: number, targetBucket?: BudgetBucket) =>
    yearItems.filter((item) => item.month === month && (!targetBucket || item.bucket === targetBucket)).reduce((sum, item) => sum + item.amount, 0);

  const plannedIncome = yearItems.filter((item) => item.bucket === "ingreso").reduce((sum, item) => sum + item.amount, 0);
  const plannedOut = yearItems.filter((item) => item.bucket !== "ingreso").reduce((sum, item) => sum + item.amount, 0);
  const monthPlannedIncome = planned(selectedMonth, "ingreso");
  const monthPlannedOut = planned(selectedMonth) - monthPlannedIncome;
  const monthActualIncome = actualTotal(selectedMonth, "ingreso");
  const monthActualOut = buckets.filter((item) => item.id !== "ingreso").reduce((sum, item) => sum + actualTotal(selectedMonth, item.id), 0);
  const plannedMargin = monthPlannedIncome - monthPlannedOut;
  const actualMargin = monthActualIncome - monthActualOut;
  const ruleBudget = ([
    { id: "needs", label: "Sobrevivir", target: ruleTargets.needs, color: "#43aa8b" },
    { id: "wants", label: "Disfrutar", target: ruleTargets.wants, color: "#e9ae19" },
    { id: "savings", label: "Ahorro e inversión", target: ruleTargets.savings, color: "#2eaaa3" },
  ] as const).map((rule) => {
    const matching = monthItems.filter((item) => {
      if (item.bucket === "ingreso") return false;
      if (["ahorro", "inversion"].includes(item.bucket)) return rule.id === "savings";
      if (item.bucket === "hucha") {
        const hucha = accounts.find((account) => account.kind === "hucha" && categoryKey(account.name) === categoryKey(item.category ?? item.label));
        return (hucha?.bucket ?? "savings") === rule.id;
      }
      const storedCategory = item.category?.trim();
      const categoryFromLabel = item.label.split(" · ")[0]?.trim();
      const categoryDefinition = [storedCategory, categoryFromLabel]
        .filter((name): name is string => Boolean(name))
        .map((name) => categories.find((entry) => categoryKey(entry.name) === categoryKey(name)))
        .find(Boolean);
      const categoryName = categoryDefinition?.name ?? storedCategory ?? categoryFromLabel ?? "";
      const categoryBucket = categoryDefinition?.bucket ?? (defaultNeedsCategoryKeys.has(categoryKey(categoryName)) ? "needs" : "wants");
      return categoryBucket === rule.id;
    });
    const amount = matching.reduce((sum, item) => sum + item.amount, 0);
    const percentage = monthPlannedIncome > 0 ? amount / monthPlannedIncome * 100 : 0;
    const details = Object.values(matching.reduce<Record<string, { name: string; amount: number }>>((all, item) => {
      const rawName = item.category || item.label;
      const name = item.bucket === "hucha" ? huchaLabel(rawName) : rawName;
      all[name] ??= { name, amount: 0 };
      all[name].amount += item.amount;
      return all;
    }, {})).sort((a, b) => b.amount - a.amount);
    return { ...rule, amount, percentage, details };
  });

  const availableCategories = useMemo(
    () => categories.filter((item) => bucket === "ingreso" ? item.name === "Ingresos" : bucket === "deuda" ? item.name === "Deudas" : !["Ingresos", "Traspasos", "Deudas"].includes(item.name)),
    [categories, bucket],
  );
  const selectedCategory = availableCategories.find((item) => item.name === category) ?? availableCategories[0];
  const destinationAccounts = accounts.filter((account) => account.kind === bucket);
  const difference = (targetBucket: BudgetBucket, budgeted: number, real: number) => {
    const spending = targetBucket === "gasto" || targetBucket === "deuda";
    if (Math.abs(real - budgeted) < 0.005) return { text: "Objetivo cumplido", tone: "good" };
    if (spending) return real < budgeted
      ? { text: `Quedan ${money(budgeted - real)}`, tone: "good" }
      : { text: `Exceso de ${money(real - budgeted)}`, tone: "bad" };
    return real < budgeted
      ? { text: `Faltan ${money(budgeted - real)}`, tone: "pending" }
      : { text: targetBucket === "ingreso" ? `${money(real - budgeted)} más` : `Superado en ${money(real - budgeted)}`, tone: "good" };
  };

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    if (!amount) return;
    const chosenCategory = String(form.get("category") ?? "");
    const chosenSubcategory = String(form.get("subcategory") ?? "");
    const label = [chosenCategory, chosenSubcategory].filter(Boolean).join(" · ") || buckets.find((item) => item.id === bucket)?.label || "Partida";
    const nextItem = { id: editingItem?.id ?? id(), year: selectedYear, month: selectedMonth, bucket, label, amount, category: chosenCategory || undefined, subcategory: chosenSubcategory || undefined };
    onChange(editingItem ? items.map((item) => item.id === editingItem.id ? nextItem : item) : [...items, nextItem]);
    setAdding(false);
    setEditingItem(null);
  }
  function copyMonth() {
    if (selectedTargets.length === 0) return;
    let next = items;
    if (copyMode === "replace") next = next.filter((item) => item.year !== copyTargetYear || !selectedTargets.includes(item.month));
    const copies = selectedTargets.flatMap((month) => monthItems.map((item) => ({ ...item, id: id(), year: copyTargetYear, month })));
    onChange([...next, ...copies]);
    setCopying(false);
    setSelectedTargets([]);
  }
  const editItem = (item: BudgetItem) => {
    setEditingItem(item);
    setBucket(item.bucket);
    setCategory(item.category ?? (item.bucket === "ingreso" ? "Ingresos" : item.bucket === "deuda" ? "Deudas" : "Alimentación"));
    setAdding(true);
  };
  const removeItem = (item: BudgetItem) => {
    if (window.confirm(`¿Seguro que quieres eliminar «${item.label}» del presupuesto?`)) onChange(items.filter((entry) => entry.id !== item.id));
  };

  return <section className="budget-planner">
    <div className="budget-year-bar">
      <button type="button" onClick={() => selectView(selectedYear - 1, selectedMonth)} aria-label="Año anterior">‹</button>
      <div><span>Planificación anual</span><strong>{selectedYear}</strong></div>
      <button type="button" onClick={() => selectView(selectedYear + 1, selectedMonth)} aria-label="Año siguiente">›</button>
      {(selectedYear !== currentYear || selectedMonth !== currentMonth) && <button type="button" className="budget-current-button" onClick={() => selectView(currentYear, currentMonth)}>Mes actual</button>}
    </div>

    <div className="budget-view-tabs" role="tablist" aria-label="Vista de presupuestos">
      <button type="button" role="tab" aria-selected={view === "budget"} className={view === "budget" ? "selected" : ""} onClick={() => setView("budget")}>Presupuesto mensual</button>
      <button type="button" role="tab" aria-selected={view === "annual"} className={view === "annual" ? "selected" : ""} onClick={() => setView("annual")}>Gastos del año</button>
    </div>

    {view === "annual" ? <AnnualExpenses year={selectedYear} expenses={annualExpenses} accounts={accounts} categories={categories} programs={programs} onChange={onAnnualChange} onCreateCategory={onCreateCategory} onCreateHucha={onCreateHucha} onCreateProgram={onCreateProgram} onRegisterPayment={onRegisterAnnualPayment} /> : <>

    <section className="budget-annual-summary" aria-label={`Resumen anual de ${selectedYear}`}>
      <div><span>Resumen anual</span><strong>{selectedYear}</strong></div>
      <dl>
        <div><dt>Ingresos previstos</dt><dd>{money(plannedIncome)}</dd></div>
        <div><dt>Salidas planificadas</dt><dd>{money(plannedOut)}</dd></div>
        <div className={plannedIncome - plannedOut < 0 ? "budget-warning" : ""}><dt>Margen anual</dt><dd>{money(plannedIncome - plannedOut)}</dd></div>
      </dl>
    </section>

    <div className="budget-months" role="tablist" aria-label="Meses del presupuesto">
      {months.map((name, month) => {
        const income = planned(month, "ingreso");
        const out = planned(month) - income;
        const count = yearItems.filter((item) => item.month === month).length;
        const isCurrent = month === currentMonth && selectedYear === currentYear;
        return <button type="button" role="tab" aria-selected={selectedMonth === month} className={selectedMonth === month ? "selected" : ""} key={name} onClick={() => selectView(selectedYear, month)}>
          <span>{name.slice(0, 3)}</span><strong>{money(out)}</strong>
          <small>{count === 0 ? `Sin planificar${isCurrent ? " · actual" : ""}` : isCurrent ? `Mes actual · ${count} partidas` : `${count} partidas`}</small>
        </button>;
      })}
    </div>

    <div className="budget-month-heading">
      <div><span>Plan de {months[selectedMonth].toLowerCase()}</span><h2>{months[selectedMonth]} {selectedYear}</h2></div>
      <div><button type="button" className="budget-secondary" onClick={() => { setCopyTargetYear(selectedYear); setCopying(true); }} disabled={monthItems.length === 0}>Copiar mes</button><button type="button" className="button-primary" onClick={() => { setEditingItem(null); setAdding(true); }}>+ Añadir partida</button></div>
    </div>

    <section className="budget-month-comparison" aria-label="Comparación mensual">
      <div className="budget-comparison-head"><span>Resumen mensual</span><strong>Presupuestado</strong><strong>Real</strong></div>
      <div><span>Ingresos</span><strong>{money(monthPlannedIncome)}</strong><strong>{money(monthActualIncome)}</strong></div>
      <div><span>Salidas</span><strong>{money(monthPlannedOut)}</strong><strong>{money(monthActualOut)}</strong></div>
      <div><span>Margen</span><strong>{money(plannedMargin)}</strong><strong className={actualMargin < 0 ? "negative" : "positive"}>{money(actualMargin)}</strong></div>
      <p className={actualMargin - plannedMargin < 0 ? "bad" : "good"}>
        {Math.abs(actualMargin - plannedMargin) < 0.005 ? "El margen real coincide con el presupuestado." : actualMargin > plannedMargin ? `Tu margen real es ${money(actualMargin - plannedMargin)} mayor que el previsto.` : `Tu margen real es ${money(plannedMargin - actualMargin)} menor que el previsto.`}
      </p>
    </section>

    <section className="budget-rule" aria-label="Regla de distribución del presupuesto">
      <header><div><span>Regla del presupuesto</span><strong>{ruleTargets.needs}/{ruleTargets.wants}/{ruleTargets.savings}</strong></div><small>Calculada sobre los ingresos presupuestados</small></header>
      <div className="budget-rule-list">
        {ruleBudget.map((rule) => {
          const open = openRuleBucket === rule.id;
          return <article key={rule.id} className={open ? "open" : ""}>
            <button type="button" className="budget-rule-toggle" aria-expanded={open} onClick={() => setOpenRuleBucket(open ? null : rule.id)}>
              <span><i style={{ background: rule.color }} /><strong>{rule.label}</strong><small>Objetivo {rule.target}%</small></span>
              <span className="budget-rule-values"><strong>{rule.percentage.toFixed(1).replace(".", ",")}%</strong><small>{money(rule.amount)}</small></span>
              <b aria-hidden="true">⌄</b>
            </button>
            <div className="budget-rule-track" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, rule.percentage))}%`, background: rule.color }} /><span style={{ left: `${Math.min(100, Math.max(0, rule.target))}%` }} /></div>
            {open && <div className="budget-rule-details">{rule.details.length ? rule.details.map((detail) => <div key={detail.name}><span>{detail.name}</span><strong>{money(detail.amount)}</strong><small>{monthPlannedIncome > 0 ? `${(detail.amount / monthPlannedIncome * 100).toFixed(1).replace(".", ",")}%` : "0,0%"}</small></div>) : <p>No hay partidas de este bloque en el presupuesto.</p>}</div>}
          </article>;
        })}
      </div>
      {monthPlannedIncome <= 0 && <p className="budget-rule-note">Añade ingresos al presupuesto para calcular los porcentajes.</p>}
    </section>

    {monthItems.length === 0 ? <div className="budget-empty"><strong>Este mes todavía no tiene presupuesto</strong><p>Añade las partidas de {months[selectedMonth].toLowerCase()} o copia la planificación de otro mes.</p></div> : <div className="budget-sections">
      {buckets.map((section) => {
        const sectionItems = monthItems.filter((item) => item.bucket === section.id);
        if (sectionItems.length === 0) return null;
        const sectionPlanned = sectionItems.reduce((sum, item) => sum + item.amount, 0);
        const sectionActual = actualTotal(selectedMonth, section.id);
        const sectionDifference = difference(section.id, sectionPlanned, sectionActual);
        const pct = sectionPlanned ? Math.min(100, Math.max(0, sectionActual / sectionPlanned * 100)) : 0;
        const collapsed = collapsedSections.includes(section.id);
        return <article className={`budget-section ${collapsed ? "collapsed" : ""}`} key={section.id}>
          <button type="button" className="budget-section-toggle" aria-expanded={!collapsed} onClick={() => setCollapsedSections((current) => current.includes(section.id) ? current.filter((item) => item !== section.id) : [...current, section.id])}>
            <span className="budget-dot" style={{ background: section.color }} />
            <span><strong>{section.label}</strong>{!collapsed && <small>Presupuestado {money(sectionPlanned)} · Real {money(sectionActual)}</small>}</span>
            {collapsed ? <span className="budget-section-totals">
              <span><small>Presupuestado</small><strong>{money(sectionPlanned)}</strong></span>
              <span><small>Real</small><strong>{money(sectionActual)}</strong></span>
              <span><small>Diferencia</small><strong className={`budget-difference ${sectionDifference.tone}`}>{sectionDifference.text}</strong></span>
            </span> : <span className={`budget-difference ${sectionDifference.tone}`}>{sectionDifference.text}</span>}
            <b aria-hidden="true">⌄</b>
          </button>
          {!collapsed && <><div className="budget-progress"><i style={{ width: `${pct}%`, background: sectionDifference.tone === "bad" ? "#ae7067" : section.color }} /></div>
          <div className="budget-row-labels" aria-hidden="true"><span>Partida</span><span>Presupuestado</span><span>Real</span><span>Diferencia</span><span /></div>
          {sectionItems.map((item) => {
            const actual = actualTotal(selectedMonth, item.bucket, item);
            const itemDifference = difference(item.bucket, item.amount, actual);
            return <div className="budget-row" key={item.id}>
              <div><strong>{item.label}</strong></div>
              <div><small>Presupuestado</small><strong>{money(item.amount)}</strong></div>
              <div><small>Real</small><strong>{money(actual)}</strong></div>
              <div><small>Diferencia</small><strong className={`budget-difference ${itemDifference.tone}`}>{itemDifference.text}</strong></div>
              <div className="budget-row-actions"><button type="button" className="edit" onClick={() => editItem(item)} aria-label={`Editar ${item.label}`} title="Editar partida">✎</button><button type="button" className="remove" onClick={() => removeItem(item)} aria-label={`Eliminar ${item.label}`} title="Eliminar partida">×</button></div>
            </div>;
          })}</>}
        </article>;
      })}
    </div>}

    {adding && <div className="budget-overlay" onClick={(event) => { if (event.target === event.currentTarget) { setAdding(false); setEditingItem(null); } }}><form className="budget-dialog" onSubmit={addItem}>
      <header><div><span>{editingItem ? "Editar partida" : "Nueva partida"}</span><h2>{months[selectedMonth]} {selectedYear}</h2></div><button type="button" onClick={() => { setAdding(false); setEditingItem(null); }}>×</button></header>
      <label>Tipo<select value={bucket} onChange={(event) => { const next = event.target.value as BudgetBucket; setBucket(next); setCategory(next === "ingreso" ? "Ingresos" : next === "deuda" ? "Deudas" : "Alimentación"); }}>{buckets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {["hucha", "ahorro", "inversion"].includes(bucket) ? <label>Destino<select name="category" defaultValue={editingItem?.category} required>{destinationAccounts.map((account) => <option key={account.id} value={account.name}>{account.name}</option>)}</select></label> : <>
        <label>Categoría<select name="category" value={selectedCategory?.name ?? ""} onChange={(event) => { if (event.target.value === "__create__") onCreateCategory(); else setCategory(event.target.value); }} required>{availableCategories.map((item) => <option key={item.name}>{item.name}</option>)}<option value="__create__">+ Crear categoría</option></select></label>
        <label>Subcategoría <span>opcional</span><select name="subcategory" defaultValue={editingItem?.subcategory ?? ""}><option value="">Sin subcategoría</option>{selectedCategory?.subcategories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
      </>}
      <label>Importe previsto<input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00 €" defaultValue={editingItem?.amount} required /></label><button className="button-primary">{editingItem ? "Guardar cambios" : "Añadir al presupuesto"}</button>
    </form></div>}

    {copying && <div className="budget-overlay" onClick={(event) => event.target === event.currentTarget && setCopying(false)}><section className="budget-dialog copy-dialog">
      <header><div><span>Copiar planificación</span><h2>Copiar {months[selectedMonth].toLowerCase()}</h2></div><button type="button" onClick={() => setCopying(false)}>×</button></header>
      <label>Año de destino<div className="copy-year-picker"><button type="button" onClick={() => setCopyTargetYear((year) => year - 1)}>‹</button><strong>{copyTargetYear}</strong><button type="button" onClick={() => setCopyTargetYear((year) => year + 1)}>›</button></div></label>
      <p>Selecciona los meses de destino de {copyTargetYear}.</p>
      <div className="copy-months">{months.map((name, month) => <button type="button" key={name} disabled={copyTargetYear === selectedYear && month === selectedMonth} className={selectedTargets.includes(month) ? "selected" : ""} onClick={() => setSelectedTargets((current) => current.includes(month) ? current.filter((value) => value !== month) : [...current, month])}>{name.slice(0, 3)}</button>)}</div>
      <label>Si el mes ya tiene partidas<select value={copyMode} onChange={(event) => setCopyMode(event.target.value as "replace" | "add")}><option value="replace">Sustituir el mes completo</option><option value="add">Añadir a lo existente</option></select></label>
      <button type="button" className="button-primary" disabled={selectedTargets.length === 0} onClick={copyMonth}>Copiar en {selectedTargets.length || "los"} meses</button>
    </section></div>}
    </>}
  </section>;
}
