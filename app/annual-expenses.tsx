"use client";

import { useMemo, useState, type FormEvent } from "react";

export type AnnualPayment = {
  id: string;
  date: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  paidAt?: string;
};

export type AnnualExpense = {
  id: string;
  year: number;
  name: string;
  category: string;
  subcategory?: string;
  frequency: "Una vez" | "Semanal" | "Mensual" | "Anual" | "Semestral" | "Trimestral" | "Personalizado";
  interval?: number;
  payments: AnnualPayment[];
  huchaId?: string;
  programId?: string;
};

type Account = { id: string; name: string; kind: string; balance: number; goal?: number };
type Category = { name: string; subcategories: { name: string }[] };
type Program = { id: string; name: string; kind: string; amount: number };
type NewProgram = {
  name: string;
  amount: number;
  date: string;
  frequency: AnnualExpense["frequency"];
  interval?: number;
  accountId: string;
  category: string;
  subcategory: string;
};

type Props = {
  year: number;
  expenses: AnnualExpense[];
  accounts: Account[];
  categories: Category[];
  programs: Program[];
  onChange: (expenses: AnnualExpense[]) => void;
  onCreateCategory: () => void;
  onCreateHucha: (name: string, goal: number) => string;
  onCreateProgram: (program: NewProgram) => string;
  onRegisterPayment: (expense: AnnualExpense, payment: AnnualPayment, accountId: string) => void;
};

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const money = (value: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function buildPayments(year: number, firstDate: string, amount: number, frequency: AnnualExpense["frequency"], interval = 1, customMonths: number[] = []): AnnualPayment[] {
  if (frequency === "Personalizado") {
    const day = Math.min(28, Math.max(1, new Date(`${firstDate}T12:00:00`).getDate()));
    return [...new Set(customMonths)].sort((a, b) => a - b).map((month) => ({
      id: uid(), date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, amount, status: "pending",
    }));
  }
  const dates: string[] = [];
  const step = frequency === "Semestral" ? 6 : frequency === "Trimestral" ? 3 : frequency === "Mensual" ? 1 : 12;
  const cursor = new Date(`${firstDate}T12:00:00`);
  do {
    if (cursor.getFullYear() === year) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
    }
    if (frequency === "Una vez") break;
    if (frequency === "Semanal") cursor.setDate(cursor.getDate() + 7 * interval);
    else cursor.setMonth(cursor.getMonth() + step * interval);
  } while (cursor.getFullYear() === year);
  return dates.map((date) => ({ id: uid(), date, amount, status: "pending" }));
}

export default function AnnualExpenses({ year, expenses, accounts, categories, programs, onChange, onCreateCategory, onCreateHucha, onCreateProgram, onRegisterPayment }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingExpense, setEditingExpense] = useState<AnnualExpense | null>(null);
  const [category, setCategory] = useState("Vivienda");
  const [huchaMode, setHuchaMode] = useState<"none" | "existing" | "create">("none");
  const [programMode, setProgramMode] = useState<"none" | "existing" | "create">("none");
  const [frequency, setFrequency] = useState<AnnualExpense["frequency"]>("Una vez");
  const [interval, setInterval] = useState(1);
  const [customMonths, setCustomMonths] = useState<number[]>([]);
  const [paymentPrompt, setPaymentPrompt] = useState<{ expense: AnnualExpense; payment: AnnualPayment } | null>(null);
  const [paymentAccount, setPaymentAccount] = useState("");
  const yearExpenses = expenses.filter((expense) => expense.year === year);
  const huchas = accounts.filter((account) => account.kind === "hucha");
  const paymentAccounts = accounts.filter((account) => account.kind === "corriente");
  const expensePrograms = programs.filter((program) => program.kind === "gasto");
  const expenseCategories = [...new Map(categories.filter((item) => !["Ingresos", "Traspasos", "Deudas"].includes(item.name)).map((item) => [item.name.trim().toLocaleLowerCase("es"), item])).values()];
  const selectedCategory = expenseCategories.find((item) => item.name === category) ?? expenseCategories[0];
  const payments = yearExpenses.flatMap((expense) => expense.payments.map((payment) => ({ expense, payment })));
  const activePayments = payments.filter(({ payment }) => payment.status !== "cancelled");
  const total = activePayments.reduce((sum, { payment }) => sum + payment.amount, 0);
  const paid = activePayments.filter(({ payment }) => payment.status === "paid").reduce((sum, { payment }) => sum + payment.amount, 0);
  const uniqueHuchas = [...new Set(yearExpenses.map((expense) => expense.huchaId).filter(Boolean))];
  const reserved = uniqueHuchas.reduce((sum, huchaId) => sum + Math.max(0, accounts.find((account) => account.id === huchaId)?.balance ?? 0), 0);
  const next = activePayments.filter(({ payment }) => payment.status === "pending" && payment.date >= todayISO()).sort((a, b) => a.payment.date.localeCompare(b.payment.date))[0];
  const grouped = useMemo(() => months.map((_, month) => payments.filter(({ payment }) => new Date(`${payment.date}T12:00:00`).getMonth() === month)), [payments]);

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const amount = Number(form.get("amount"));
    const date = String(form.get("date") ?? "");
    const chosenFrequency = String(form.get("frequency")) as AnnualExpense["frequency"];
    const chosenInterval = Math.max(1, Number(form.get("interval")) || 1);
    if (!name || !amount || !date || (chosenFrequency === "Personalizado" && customMonths.length === 0)) return;
    const chosenCategory = String(form.get("category") ?? "");
    const chosenSubcategory = String(form.get("subcategory") ?? "");
    let huchaId = huchaMode === "existing" ? String(form.get("huchaId") ?? "") || undefined : undefined;
    if (huchaMode === "create") huchaId = onCreateHucha(String(form.get("huchaName") ?? "").trim() || name, amount);
    let programId = programMode === "existing" ? String(form.get("programId") ?? "") || undefined : undefined;
    if (programMode === "create") {
      const accountId = String(form.get("paymentAccount") ?? "");
      if (accountId) programId = onCreateProgram({ name, amount, date, frequency: chosenFrequency, interval: chosenInterval, accountId, category: chosenCategory, subcategory: chosenSubcategory });
    }
    const generatedPayments = buildPayments(year, date, amount, chosenFrequency, chosenInterval, customMonths);
    const payments = editingExpense ? generatedPayments.map((payment) => {
      const previous = editingExpense.payments.find((item) => item.date === payment.date);
      return previous ? { ...payment, id: previous.id, status: previous.status, paidAt: previous.paidAt } : payment;
    }) : generatedPayments;
    const expense: AnnualExpense = {
      id: editingExpense?.id ?? uid(), year, name, category: chosenCategory, subcategory: chosenSubcategory || undefined,
      frequency: chosenFrequency, interval: chosenInterval, payments, huchaId, programId,
    };
    onChange(editingExpense ? expenses.map((item) => item.id === editingExpense.id ? expense : item) : [...expenses, expense]);
    setAdding(false);
    setEditingExpense(null);
    setHuchaMode("none");
    setProgramMode("none");
    setFrequency("Una vez");
    setInterval(1);
    setCustomMonths([]);
  }

  function openNewExpense() {
    setEditingExpense(null);
    setCategory("Vivienda");
    setHuchaMode("none");
    setProgramMode("none");
    setFrequency("Una vez");
    setInterval(1);
    setCustomMonths([]);
    setAdding(true);
  }

  function editExpense(expense: AnnualExpense) {
    setEditingExpense(expense);
    setCategory(expense.category);
    setHuchaMode(expense.huchaId ? "existing" : "none");
    setProgramMode(expense.programId ? "existing" : "none");
    setFrequency(expense.frequency);
    setInterval(expense.interval ?? 1);
    setCustomMonths(expense.frequency === "Personalizado" ? [...new Set(expense.payments.map((payment) => new Date(`${payment.date}T12:00:00`).getMonth()))] : []);
    setAdding(true);
  }

  function closeExpenseForm() {
    setAdding(false);
    setEditingExpense(null);
  }

  function updatePayment(expenseId: string, paymentId: string, status: AnnualPayment["status"]) {
    onChange(expenses.map((expense) => expense.id !== expenseId ? expense : {
      ...expense,
      payments: expense.payments.map((payment) => payment.id !== paymentId ? payment : { ...payment, status, paidAt: status === "paid" ? todayISO() : undefined }),
    }));
    setPaymentPrompt(null);
  }

  function askToPay(expense: AnnualExpense, payment: AnnualPayment) {
    if (payment.status === "paid") return updatePayment(expense.id, payment.id, "pending");
    if (payment.status === "cancelled") return updatePayment(expense.id, payment.id, "pending");
    setPaymentAccount(paymentAccounts[0]?.id ?? "");
    setPaymentPrompt({ expense, payment });
  }

  return <section className="annual-expenses">
    <section className="annual-expense-summary">
      <div><span>Gastos importantes</span><strong>{money(total)}</strong></div>
      <div><span>Ya pagado</span><strong>{money(paid)}</strong></div>
      <div><span>Reservado en huchas</span><strong>{money(reserved)}</strong></div>
      <div><span>Próximo pago</span><strong>{next ? `${next.expense.name} · ${money(next.payment.amount)}` : "Nada pendiente"}</strong></div>
    </section>

    <div className="annual-expense-heading">
      <div><span>Tu año de un vistazo</span><h2>Gastos del año</h2><p>Planifica pagos importantes sin alterar tus movimientos ni tu presupuesto mensual.</p></div>
      <button type="button" className="button-primary" onClick={openNewExpense}>+ Añadir gasto</button>
    </div>

    {yearExpenses.length === 0 ? <div className="budget-empty"><strong>Todavía no has añadido gastos importantes</strong><p>Añade seguros, impuestos, tasas u otros pagos que quieras preparar con tiempo.</p></div> : <div className="annual-month-grid">
      {months.map((month, index) => <article className={`annual-month ${grouped[index].length ? "has-payments" : ""}`} key={month}>
        <header><strong>{month}</strong><span>{grouped[index].length ? money(grouped[index].filter(({ payment }) => payment.status !== "cancelled").reduce((sum, { payment }) => sum + payment.amount, 0)) : "Sin pagos"}</span></header>
        {grouped[index].map(({ expense, payment }) => {
          const hucha = accounts.find((account) => account.id === expense.huchaId);
          const pct = hucha ? Math.min(100, Math.max(0, hucha.balance / payment.amount * 100)) : 0;
          return <div className={`annual-payment ${payment.status}`} key={payment.id}>
            <button type="button" className="annual-check" aria-label={payment.status === "paid" ? `Marcar ${expense.name} como pendiente` : `Marcar ${expense.name} como pagado`} onClick={() => askToPay(expense, payment)}>{payment.status === "paid" ? "✓" : payment.status === "cancelled" ? "—" : ""}</button>
            <div className="annual-payment-copy"><strong>{expense.name}</strong><small>{new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(`${payment.date}T12:00:00`))} · {expense.frequency === "Una vez" || expense.frequency === "Personalizado" ? expense.frequency : `Cada ${expense.interval ?? 1} ${expense.frequency === "Semanal" ? (expense.interval ?? 1) === 1 ? "semana" : "semanas" : expense.frequency === "Mensual" ? (expense.interval ?? 1) === 1 ? "mes" : "meses" : expense.frequency === "Trimestral" ? (expense.interval ?? 1) === 1 ? "trimestre" : "trimestres" : expense.frequency === "Semestral" ? (expense.interval ?? 1) === 1 ? "semestre" : "semestres" : (expense.interval ?? 1) === 1 ? "año" : "años"}`}</small></div>
            <div className="annual-payment-actions"><strong>{money(payment.amount)}</strong>{payment.id === expense.payments[0]?.id && <><button type="button" className="edit" aria-label={`Editar ${expense.name}`} title="Editar gasto" onClick={() => editExpense(expense)}>✎</button><button type="button" aria-label={`Eliminar ${expense.name}`} title="Eliminar gasto" onClick={() => { if (window.confirm(`¿Seguro que quieres eliminar «${expense.name}» de Gastos del año?`)) onChange(expenses.filter((item) => item.id !== expense.id)); }}>×</button></>}</div>
            {hucha ? <div className="annual-hucha"><span>Hucha «{hucha.name}» · {money(hucha.balance)} de {money(payment.amount)}</span><div><i style={{ width: `${pct}%` }} /></div><small>{pct >= 100 ? "Preparado" : `Faltan ${money(Math.max(0, payment.amount - hucha.balance))}`}</small></div> : <small className="annual-no-link">Sin hucha asociada</small>}
            {expense.programId && <small className="annual-program-link">Movimiento recurrente vinculado</small>}
            {payment.status === "paid" && <small className="annual-paid-label">Pagado{payment.paidAt ? ` el ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(`${payment.paidAt}T12:00:00`))}` : ""}</small>}
          </div>;
        })}
      </article>)}
    </div>}

    {adding && <div className="budget-overlay" onClick={(event) => event.target === event.currentTarget && closeExpenseForm()}><form className="budget-dialog annual-dialog" onSubmit={addExpense}>
      <header><div><span>{editingExpense ? "Editar planificación" : "Nueva planificación"}</span><h2>Gasto del año</h2></div><button type="button" onClick={closeExpenseForm}>×</button></header>
      <label>Nombre del gasto<input name="name" placeholder="Ej. Seguro del coche" defaultValue={editingExpense?.name} required /></label>
      <div className="annual-form-grid"><label>Importe de cada pago<input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00 €" defaultValue={editingExpense?.payments[0]?.amount} required /></label><label>Primer pago<input name="date" type="date" min={`${year}-01-01`} max={`${year}-12-31`} defaultValue={editingExpense?.payments[0]?.date} required /></label></div>
      <div className="annual-form-grid"><label>Periodicidad<select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as AnnualExpense["frequency"])}><option>Una vez</option><option>Semanal</option><option>Mensual</option><option>Trimestral</option><option>Semestral</option><option>Anual</option><option>Personalizado</option></select></label>{!["Una vez", "Personalizado"].includes(frequency) && <label>Repetir cada<input name="interval" type="number" min="1" step="1" inputMode="numeric" value={interval} onChange={(event) => setInterval(Math.max(1, Number(event.target.value) || 1))} /><small>{frequency === "Semanal" ? interval === 1 ? "semana" : "semanas" : frequency === "Mensual" ? interval === 1 ? "mes" : "meses" : frequency === "Trimestral" ? interval === 1 ? "trimestre" : "trimestres" : frequency === "Semestral" ? interval === 1 ? "semestre" : "semestres" : interval === 1 ? "año" : "años"}</small></label>}</div>
      {frequency === "Personalizado" && <fieldset className="annual-custom-months"><legend>Meses de pago</legend><p>Selecciona todos los meses en los que se cobrará este gasto.</p><div>{months.map((month, index) => <label key={month}><input type="checkbox" checked={customMonths.includes(index)} onChange={() => setCustomMonths((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} /><span>{month.slice(0, 3)}</span></label>)}</div>{customMonths.length === 0 && <small>Selecciona al menos un mes.</small>}</fieldset>}
      <div className="annual-form-grid"><label>Categoría<select name="category" value={selectedCategory?.name ?? ""} onChange={(event) => { if (event.target.value === "__create__") onCreateCategory(); else setCategory(event.target.value); }} required>{expenseCategories.map((item) => <option key={item.name}>{item.name}</option>)}<option value="__create__">+ Crear categoría</option></select></label><label><span className="annual-field-label">Subcategoría <small>opcional</small></span><select name="subcategory" defaultValue={editingExpense?.subcategory ?? ""}><option value="">Sin subcategoría</option>{selectedCategory?.subcategories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label></div>
      <fieldset><legend>Hucha <span>opcional</span></legend><div className="annual-choice"><button type="button" className={huchaMode === "none" ? "selected" : ""} onClick={() => setHuchaMode("none")}>Sin hucha</button><button type="button" className={huchaMode === "existing" ? "selected" : ""} onClick={() => setHuchaMode("existing")} disabled={!huchas.length}>Vincular</button><button type="button" className={huchaMode === "create" ? "selected" : ""} onClick={() => setHuchaMode("create")}>Crear hucha</button></div>{huchaMode === "existing" && <select name="huchaId" defaultValue={editingExpense?.huchaId} required>{huchas.map((hucha) => <option value={hucha.id} key={hucha.id}>{hucha.name} · {money(hucha.balance)}</option>)}</select>}{huchaMode === "create" && <input name="huchaName" placeholder="Nombre de la nueva hucha" />}</fieldset>
      <fieldset><legend>Movimiento recurrente <span>opcional</span></legend><div className="annual-choice"><button type="button" className={programMode === "none" ? "selected" : ""} onClick={() => setProgramMode("none")}>No crear</button><button type="button" className={programMode === "existing" ? "selected" : ""} onClick={() => setProgramMode("existing")} disabled={!expensePrograms.length}>Vincular</button><button type="button" className={programMode === "create" ? "selected" : ""} onClick={() => setProgramMode("create")} disabled={!paymentAccounts.length || frequency === "Personalizado"}>Crear recurrente</button></div>{frequency === "Personalizado" && <small>Para meses personalizados puedes vincular un recurrente existente; los pagos seguirán apareciendo correctamente en Gastos del año.</small>}{programMode === "existing" && <select name="programId" defaultValue={editingExpense?.programId} required>{expensePrograms.map((program) => <option value={program.id} key={program.id}>{program.name} · {money(program.amount)}</option>)}</select>}{programMode === "create" && <label>Cuenta de pago<select name="paymentAccount" required>{paymentAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>}</fieldset>
      <button className="button-primary" disabled={frequency === "Personalizado" && customMonths.length === 0}>{editingExpense ? "Guardar cambios" : "Añadir a Gastos del año"}</button>
    </form></div>}

    {paymentPrompt && <div className="budget-overlay" onClick={(event) => event.target === event.currentTarget && setPaymentPrompt(null)}><section className="budget-dialog annual-payment-dialog">
      <header><div><span>Marcar como pagado</span><h2>{paymentPrompt.expense.name}</h2></div><button type="button" onClick={() => setPaymentPrompt(null)}>×</button></header>
      <p>¿Quieres registrar también el pago de {money(paymentPrompt.payment.amount)} como movimiento?</p>
      {paymentAccounts.length > 0 && <><label>Cuenta utilizada<select value={paymentAccount} onChange={(event) => setPaymentAccount(event.target.value)}>{paymentAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><button type="button" className="button-primary" onClick={() => { onRegisterPayment(paymentPrompt.expense, paymentPrompt.payment, paymentAccount); updatePayment(paymentPrompt.expense.id, paymentPrompt.payment.id, "paid"); }}>Sí, registrar movimiento</button></>}
      <button type="button" className="budget-secondary" onClick={() => updatePayment(paymentPrompt.expense.id, paymentPrompt.payment.id, "paid")}>Ya está registrado</button>
      <button type="button" className="annual-text-action" onClick={() => updatePayment(paymentPrompt.expense.id, paymentPrompt.payment.id, "paid")}>Solo marcar como pagado</button>
      <button type="button" className="annual-text-action muted" onClick={() => updatePayment(paymentPrompt.expense.id, paymentPrompt.payment.id, "cancelled")}>Este pago no se realizará</button>
    </section></div>}
  </section>;
}
