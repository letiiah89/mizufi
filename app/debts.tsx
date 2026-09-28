"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

export type AmortizationRow = {
  number: number;
  date: string;
  payment: number;
  interest: number;
  principal: number;
  remaining: number;
};
export type DebtProfile = {
  id: string;
  accountId: string;
  type: "loan" | "card";
  name: string;
  principal: number;
  initialPrincipal?: number;
  tin: number;
  monthlyPayment: number;
  remainingTerms?: number;
  nextPaymentDate: string;
  paymentAccount: string;
  maturityDate?: string;
  creditLimit?: number;
  closingDay?: number;
  paymentDay?: number;
  paymentMethod?: "full" | "fixed" | "percentage" | "minimum";
  paymentPercent?: number;
  schedule?: AmortizationRow[];
};
export type ExtraDebtPayment = {
  amount: number;
  fee: number;
  feePercent?: number;
  date: string;
  account: string;
  mode: "term" | "payment" | "cancel";
};
export type DebtAdjustment = {
  id: string;
  debtAccountId: string;
  date: string;
  principal: number;
  fee: number;
  feePercent?: number;
  mode?: "term" | "payment" | "cancel";
  account?: string;
  previousDebt?: DebtProfile;
  cancelled?: boolean;
};
type PaymentAccount = { id: string; name: string };

const money = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    value,
  );

function PrivacyEye({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
      <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a15.7 15.7 0 0 1-2.3 2.8" />
      <path d="M6.6 6.6C4.3 8.1 3 10 3 10s3.5 5 9 5a10.3 10.3 0 0 0 3.4-.6" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const prettyDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "Sin fecha";

function loanSchedule(debt: DebtProfile) {
  if (debt.schedule?.length) return debt.schedule;
  const rate = debt.tin / 100 / 12;
  let remaining = debt.principal;
  const rows: AmortizationRow[] = [];
  const start = new Date(`${debt.nextPaymentDate}T12:00:00`);
  let guard = 0;
  while (remaining > 0.005 && guard++ < 600) {
    const interest = remaining * rate;
    const payment = Math.min(debt.monthlyPayment, remaining + interest);
    const principal = Math.max(0, payment - interest);
    remaining = Math.max(0, remaining - principal);
    const date = new Date(start);
    date.setMonth(date.getMonth() + rows.length);
    rows.push({
      number: rows.length + 1,
      date: iso(date),
      payment: Math.round(payment * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
    });
    if (principal <= 0) break;
  }
  return rows;
}

function recalculateLoan(debt: DebtProfile, payment: ExtraDebtPayment) {
  const currentRows = loanSchedule(debt);
  const past = currentRows.filter((row) => row.date < payment.date);
  const remaining = Math.max(
    0,
    Math.round((debt.principal - payment.amount) * 100) / 100,
  );
  if (payment.mode === "cancel" || remaining <= 0.005)
    return {
      ...debt,
      principal: 0,
      remainingTerms: 0,
      maturityDate: payment.date,
      schedule: past,
    };
  const existingFuture = currentRows.filter((row) => row.date > payment.date);
  let nextDate = existingFuture[0]?.date ?? debt.nextPaymentDate;
  let next = new Date(`${nextDate}T12:00:00`);
  while (iso(next) <= payment.date) next.setMonth(next.getMonth() + 1);
  nextDate = iso(next);
  const rate = debt.tin / 100 / 12;
  const terms = Math.max(1, existingFuture.length || debt.remainingTerms || 1);
  const fixedPayment =
    payment.mode === "payment"
      ? rate
        ? (remaining * rate) / (1 - Math.pow(1 + rate, -terms))
        : remaining / terms
      : debt.monthlyPayment;
  let balance = remaining;
  const future: AmortizationRow[] = [];
  let guard = 0;
  while (balance > 0.005 && guard++ < 600) {
    const interest = balance * rate;
    const amount = Math.min(fixedPayment, balance + interest);
    const principal = Math.max(0, amount - interest);
    balance = Math.max(0, balance - principal);
    const date = new Date(`${nextDate}T12:00:00`);
    date.setMonth(date.getMonth() + future.length);
    future.push({
      number: past.length + future.length + 1,
      date: iso(date),
      payment: Math.round(amount * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      remaining: Math.round(balance * 100) / 100,
    });
    if (principal <= 0) break;
  }
  return {
    ...debt,
    principal: remaining,
    monthlyPayment: Math.round(fixedPayment * 100) / 100,
    remainingTerms: future.length,
    nextPaymentDate: future[0]?.date ?? nextDate,
    maturityDate: future.at(-1)?.date,
    schedule: [...past, ...future],
  };
}

export default function DebtPlanner({
  debts,
  paymentAccounts,
  onChange,
  onExtraPayment,
  onDeleteAdjustment,
  adjustments = [],
  createRequest = 0,
  initialOpenId,
  onOpenChange,
  amountsHidden = false,
  onAmountsHiddenChange,
}: {
  debts: DebtProfile[];
  paymentAccounts: PaymentAccount[];
  onChange: (debts: DebtProfile[]) => void;
  onExtraPayment: (
    original: DebtProfile,
    updated: DebtProfile,
    payment: ExtraDebtPayment,
    replacingId?: string,
  ) => void;
  onDeleteAdjustment?: (id: string) => void;
  adjustments?: DebtAdjustment[];
  createRequest?: number;
  initialOpenId?: string | null;
  onOpenChange?: (id: string | null) => void;
  amountsHidden?: boolean;
  onAmountsHiddenChange?: (hidden: boolean) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const changeOpenId = (id: string | null) => {
    setOpenId(id);
    onOpenChange?.(id);
  };
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DebtProfile | null>(null);
  const [tableDebt, setTableDebt] = useState<DebtProfile | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<DebtProfile | null>(
    null,
  );
  const [extraPayment, setExtraPayment] = useState<{
    debt: DebtProfile;
    kind: "extra" | "cancel";
    editingId?: string;
    defaults?: { amount: number; feePercent: number; date: string; account: string; mode: "term" | "payment" | "cancel" };
  } | null>(null);
  const [type, setType] = useState<"loan" | "card">("loan");
  const [formError, setFormError] = useState("");
  const total = debts.reduce((sum, debt) => sum + debt.principal, 0);
  const privateMoney = (value: number) =>
    amountsHidden ? "**** €" : money(value);
  const opened = debts.find((debt) => debt.id === openId);
  const schedule = useMemo(
    () => (tableDebt?.type === "loan" ? loanSchedule(tableDebt) : []),
    [tableDebt],
  );
  const displayedSchedule = useMemo(() => {
    if (!tableDebt || tableDebt.type !== "loan") return [];
    const events = [
      ...schedule.map((row, index) => ({
        type: "installment" as const,
        row,
        index,
        date: row.date,
      })),
      ...adjustments
        .filter((item) => item.debtAccountId === tableDebt.accountId)
        .map((item) => ({
          type: "adjustment" as const,
          adjustment: item,
          date: item.date,
        })),
    ].sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.type === "installment" ? -1 : 1),
    );
    let remaining = tableDebt.initialPrincipal ?? tableDebt.principal;
    return events.map((event) => {
      const principal =
        event.type === "installment"
          ? event.row.principal
          : event.adjustment.principal;
      remaining = Math.max(0, Math.round((remaining - principal) * 100) / 100);
      return { ...event, remaining };
    });
  }, [tableDebt, schedule, adjustments]);
  useEffect(() => {
    if (createRequest > 0) {
      setEditing(null);
      setType("loan");
      setCreating(true);
    }
  }, [createRequest]);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    const debtType = String(form.get("type")) as "loan" | "card";
    const principal = Number(form.get("principal"));
    const payment = Number(form.get("payment"));
    const nextPaymentDate = String(form.get("nextPaymentDate"));
    const terms = Number(form.get("terms")) || undefined;
    const maturity = terms
      ? (() => {
          const date = new Date(`${nextPaymentDate}T12:00:00`);
          date.setMonth(date.getMonth() + terms - 1);
          return iso(date);
        })()
      : undefined;
    let next: DebtProfile = {
      id: editing?.id ?? uid(),
      accountId: editing?.accountId ?? `debt-${uid()}`,
      type: debtType,
      name: String(form.get("name")),
      principal,
      initialPrincipal: editing?.initialPrincipal ?? principal,
      tin: Number(form.get("tin")) || 0,
      monthlyPayment: payment,
      remainingTerms: terms,
      nextPaymentDate,
      paymentAccount: String(form.get("paymentAccount")),
      maturityDate: maturity,
      creditLimit:
        debtType === "card"
          ? Number(form.get("creditLimit")) || undefined
          : undefined,
      closingDay:
        debtType === "card"
          ? Number(form.get("closingDay")) || undefined
          : undefined,
      paymentDay:
        debtType === "card"
          ? Number(form.get("paymentDay")) || undefined
          : undefined,
      paymentMethod:
        debtType === "card"
          ? (String(form.get("paymentMethod")) as DebtProfile["paymentMethod"])
          : undefined,
      paymentPercent:
        debtType === "card"
          ? Number(form.get("paymentPercent")) || undefined
          : undefined,
      schedule: debtType === "loan" ? undefined : editing?.schedule,
    };
    if (debtType === "loan") {
      const schedule = loanSchedule(next);
      const last = schedule.at(-1);
      if (!last || last.remaining > 0.005) {
        setFormError("Con esa cuota no se llega a amortizar el préstamo. Revisa la cuota mensual o el TIN.");
        return;
      }
      next = {
        ...next,
        schedule,
        remainingTerms: terms ?? schedule.length,
        maturityDate: maturity ?? last.date,
      };
    }
    onChange(
      editing
        ? debts.map((debt) => (debt.id === editing.id ? next : debt))
        : [...debts, next],
    );
    setCreating(false);
    setEditing(null);
    changeOpenId(next.id);
  }
  function updateRow(
    index: number,
    field: "payment" | "interest" | "principal",
    value: number,
  ) {
    if (!tableDebt) return;
    const rows = [...schedule];
    rows[index] = { ...rows[index], [field]: value };
    let remaining = tableDebt.principal;
    for (let i = 0; i < rows.length; i++) {
      if (i === index && field !== "principal")
        rows[i].principal = Math.max(0, rows[i].payment - rows[i].interest);
      remaining = Math.max(0, remaining - rows[i].principal);
      rows[i] = { ...rows[i], remaining: Math.round(remaining * 100) / 100 };
    }
    const updated = { ...tableDebt, schedule: rows };
    setTableDebt(updated);
    onChange(debts.map((debt) => (debt.id === updated.id ? updated : debt)));
  }
  function remove(debt: DebtProfile) {
    setPendingRemoval(debt);
  }
  function confirmRemoval() {
    if (!pendingRemoval) return;
    onChange(debts.filter((item) => item.id !== pendingRemoval.id));
    changeOpenId(null);
    setPendingRemoval(null);
  }
  function submitExtraPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!extraPayment) return;
    const form = new FormData(event.currentTarget);
    const amount = extraPayment.kind === "cancel" ? extraPayment.debt.principal : Number(form.get("amount"));
    const feePercent = Math.max(0, Number(form.get("feePercent")) || 0);
    const payment: ExtraDebtPayment = {
      amount:
        extraPayment.kind === "cancel"
          ? extraPayment.debt.principal
          : amount,
      fee: Math.round(amount * feePercent) / 100,
      feePercent,
      date: String(form.get("date")),
      account: String(form.get("account")),
      mode:
        extraPayment.kind === "cancel"
          ? "cancel"
          : (String(form.get("mode")) as "term" | "payment"),
    };
    if (payment.amount <= 0 || payment.amount > extraPayment.debt.principal)
      return;
    onExtraPayment(
      extraPayment.debt,
      recalculateLoan(extraPayment.debt, payment),
      payment,
      extraPayment.editingId,
    );
    setExtraPayment(null);
  }
  return (
    <section className="debt-planner">
      <div className="debt-summary">
        <div>
          <span>Capital pendiente total</span>
          <strong>{privateMoney(total)}</strong>
          <small>
            {debts.length}{" "}
            {debts.length === 1 ? "deuda registrada" : "deudas registradas"}
          </small>
        </div>
        <button
          type="button"
          className="privacy-toggle debt-privacy-toggle"
          onClick={() => onAmountsHiddenChange?.(!amountsHidden)}
          aria-label={amountsHidden ? "Mostrar importes de deudas" : "Ocultar importes de deudas"}
          title={amountsHidden ? "Mostrar importes" : "Ocultar importes"}
        >
          <PrivacyEye hidden={amountsHidden} />
        </button>
      </div>
      <div className="debt-grid">
        {debts.length === 0 && (
          <div className="empty-onboarding">
            <h2>Todavía no tienes deudas registradas</h2>
            <p>Añade un préstamo, una financiación o una tarjeta para ver su evolución y anticipar las cuotas.</p>
            <button type="button" className="button-primary" onClick={() => { setEditing(null); setType("loan"); setCreating(true); }}>Añadir mi primera deuda</button>
          </div>
        )}
        {debts.map((debt) => {
          const isOpen = openId === debt.id;
          const rows = debt.type === "loan" ? loanSchedule(debt) : [];
          const forecast =
            debt.paymentMethod === "full"
              ? debt.principal
              : debt.paymentMethod === "percentage"
                ? Math.max(
                    debt.monthlyPayment,
                    (debt.principal * (debt.paymentPercent ?? 5)) / 100,
                  )
                : debt.monthlyPayment;
          return (
            <article
              className={`debt-card${isOpen ? " open" : ""}`}
              key={debt.id}
            >
              <button
                className="debt-card-main"
                onClick={() => changeOpenId(isOpen ? null : debt.id)}
              >
                <span className={`debt-kind-icon ${debt.type}`}>
                  {debt.type === "loan" ? "▤" : "▭"}
                </span>
                <span>
                  <strong>{debt.name}</strong>
                  <small>
                    {debt.type === "loan"
                      ? "Préstamo o financiación"
                      : "Tarjeta de crédito"}
                  </small>
                </span>
                <span className="debt-capital">
                  <small>Capital pendiente</small>
                  <strong>{privateMoney(debt.principal)}</strong>
                </span>
                <i>›</i>
              </button>
              {isOpen && (
                <div className="debt-details">
                  <div className="debt-facts">
                    <div>
                      <span>Importe inicial</span>
                      <strong>
                        {privateMoney(debt.initialPrincipal ?? debt.principal)}
                      </strong>
                    </div>
                    <div>
                      <span>
                        {debt.type === "loan"
                          ? "Cuota mensual"
                          : "Próximo pago estimado"}
                      </span>
                      <strong>
                        {privateMoney(
                          debt.type === "loan" ? debt.monthlyPayment : forecast,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>TIN</span>
                      <strong>{debt.tin.toFixed(2).replace(".", ",")} %</strong>
                    </div>
                    <div>
                      <span>
                        {debt.type === "loan"
                          ? "Plazos pendientes"
                          : "Crédito disponible"}
                      </span>
                      <strong>
                        {debt.type === "loan"
                          ? (debt.remainingTerms ?? rows.length)
                          : privateMoney(
                              Math.max(
                                0,
                                (debt.creditLimit ?? 0) - debt.principal,
                              ),
                            )}
                      </strong>
                    </div>
                    <div>
                      <span>
                        {debt.type === "loan"
                          ? "Vencimiento"
                          : "Fecha de cobro"}
                      </span>
                      <strong>
                        {debt.type === "loan"
                          ? prettyDate(debt.maturityDate ?? rows.at(-1)?.date)
                          : `Día ${debt.paymentDay ?? "—"}`}
                      </strong>
                    </div>
                  </div>
                  {debt.type === "card" && (
                    <p className="card-forecast-note">
                      La previsión supone que no se realizan nuevas compras. Se
                      recalculará cuando cambie el saldo.
                    </p>
                  )}
                  <div className="debt-actions">
                    <button
                      onClick={() => {
                        setEditing(debt);
                        setType(debt.type);
                        setCreating(true);
                      }}
                    >
                      Editar datos
                    </button>
                    <button
                      className="debt-table-button"
                      onClick={() => setTableDebt(debt)}
                    >
                      {debt.type === "loan"
                        ? "Cuadro de amortización"
                        : "Previsión de pago"}
                    </button>
                    {debt.type === "loan" && debt.principal > 0 && (
                      <>
                        <button
                          className="debt-extra"
                          onClick={() =>
                            setExtraPayment({ debt, kind: "extra" })
                          }
                        >
                          Amortización extra
                        </button>
                        <button
                          className="debt-cancel"
                          onClick={() =>
                            setExtraPayment({ debt, kind: "cancel" })
                          }
                        >
                          Cancelar préstamo
                        </button>
                      </>
                    )}
                    <button
                      className="debt-delete"
                      onClick={() => remove(debt)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {opened?.type === "card" && (
        <p className="debt-helper">
          Las compras con tarjeta aumentarán su capital pendiente; los pagos y
          devoluciones lo reducirán.
        </p>
      )}
      {pendingRemoval && (
        <div
          className="debt-overlay"
          onClick={(event) =>
            event.target === event.currentTarget && setPendingRemoval(null)
          }
        >
          <section
            className="debt-dialog debt-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="debt-delete-title"
          >
            <header>
              <div>
                <span>
                  Eliminar{" "}
                  {pendingRemoval.type === "loan"
                    ? "préstamo"
                    : "tarjeta de crédito"}
                </span>
                <h2 id="debt-delete-title">{pendingRemoval.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>
            <p>
              Se eliminarán esta deuda y sus próximos pagos programados. Los
              movimientos ya realizados conservarán su historial.
            </p>
            <div className="debt-delete-actions">
              <button type="button" onClick={() => setPendingRemoval(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="debt-delete-confirm"
                onClick={confirmRemoval}
              >
                Eliminar definitivamente
              </button>
            </div>
          </section>
        </div>
      )}
      {creating && (
        <div
          className="debt-overlay"
          onClick={(event) =>
            event.target === event.currentTarget &&
            (setCreating(false), setEditing(null))
          }
        >
          <form className="debt-dialog" onSubmit={save}>
            <header>
              <div>
                <span>{editing ? "Editar deuda" : "Nueva deuda"}</span>
                <h2>
                  {type === "loan"
                    ? "Préstamo o financiación"
                    : "Tarjeta de crédito"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                ×
              </button>
            </header>
            <div className="debt-type-selector">
              <button
                type="button"
                className={type === "loan" ? "selected" : ""}
                onClick={() => setType("loan")}
              >
                Préstamo
              </button>
              <button
                type="button"
                className={type === "card" ? "selected" : ""}
                onClick={() => setType("card")}
              >
                Tarjeta de crédito
              </button>
            </div>
            <input type="hidden" name="type" value={type} />
            <label>
              Nombre
              <input
                name="name"
                defaultValue={editing?.name}
                placeholder={
                  type === "loan" ? "Préstamo del coche" : "Visa crédito"
                }
                required
              />
            </label>
            <div className="debt-form-grid">
              <label>
                Capital pendiente
                <input
                  name="principal"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editing?.principal}
                  required
                />
              </label>
              <label>
                TIN anual
                <input
                  name="tin"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editing?.tin}
                />
              </label>
            </div>
            {type === "loan" ? (
              <div className="debt-form-grid">
                <label>
                  Cuota mensual
                  <input
                    name="payment"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={extraPayment.defaults?.amount}
                    defaultValue={editing?.monthlyPayment}
                    required
                  />
                </label>
                <label>
                  Plazos pendientes <span>opcional · si lo dejas vacío, MiZUFi lo calcula</span>
                  <input
                    name="terms"
                    type="number"
                    min="1"
                    defaultValue={editing?.remainingTerms}
                  />
                </label>
              </div>
            ) : (
              <>
                <label>
                  Límite de crédito
                  <input
                    name="creditLimit"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editing?.creditLimit}
                    required
                  />
                </label>
                <div className="debt-form-grid">
                  <label>
                    Día de cierre
                    <input
                      name="closingDay"
                      type="number"
                      min="1"
                      max="31"
                      defaultValue={editing?.closingDay}
                    />
                  </label>
                  <label>
                    Día de cobro
                    <input
                      name="paymentDay"
                      type="number"
                      min="1"
                      max="31"
                      defaultValue={editing?.paymentDay}
                    />
                  </label>
                </div>
                <label>
                  Forma de pago
                  <select
                    name="paymentMethod"
                    defaultValue={editing?.paymentMethod ?? "full"}
                  >
                    <option value="full">Pago total mensual</option>
                    <option value="fixed">Cuota fija</option>
                    <option value="percentage">Porcentaje del saldo</option>
                    <option value="minimum">Pago mínimo</option>
                  </select>
                </label>
                <div className="debt-form-grid">
                  <label>
                    Cuota mínima o fija
                    <input
                      name="payment"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={editing?.monthlyPayment}
                    />
                  </label>
                  <label>
                    Porcentaje <span>si corresponde</span>
                    <input
                      name="paymentPercent"
                      type="number"
                      min="0"
                      step="0.1"
                      defaultValue={editing?.paymentPercent}
                    />
                  </label>
                </div>
              </>
            )}
            <div className="debt-form-grid">
              <label>
                Próximo pago
                <input
                  name="nextPaymentDate"
                  type="date"
                  defaultValue={editing?.nextPaymentDate}
                  required
                />
              </label>
              <label>
                Cuenta de pago
                <select
                  name="paymentAccount"
                  defaultValue={editing?.paymentAccount}
                  required
                >
                  {paymentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {formError && <p className="debt-form-error" role="alert">{formError}</p>}
            <button className="button-primary">Guardar deuda</button>
          </form>
        </div>
      )}
      {extraPayment && (
        <div
          className="debt-overlay"
          onClick={(event) =>
            event.target === event.currentTarget && setExtraPayment(null)
          }
        >
          <form className="debt-dialog" onSubmit={submitExtraPayment}>
            <header>
              <div>
                <span>
                  {extraPayment.kind === "cancel"
                    ? "Cancelar préstamo"
                    : "Reducir la deuda"}
                </span>
                <h2>{extraPayment.debt.name}</h2>
              </div>
              <button type="button" onClick={() => setExtraPayment(null)}>
                ×
              </button>
            </header>
            <p className="debt-payment-help">
              {extraPayment.kind === "cancel"
                ? `Se pagarán los ${money(extraPayment.debt.principal)} pendientes y se eliminarán las cuotas futuras.`
                : "El capital se restará de la deuda y el cuadro se recalculará automáticamente."}
            </p>
            {extraPayment.kind === "extra" && (
              <>
                <label>
                  Importe que amortizas
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max={extraPayment.debt.principal}
                    step="0.01"
                    required
                  />
                </label>
                <fieldset className="debt-payment-mode">
                  <legend>¿Qué quieres reducir?</legend>
                  <label>
                    <input
                      type="radio"
                      name="mode"
                      value="term"
                      defaultChecked={(extraPayment.defaults?.mode ?? "term") === "term"}
                    />
                    <span>
                      Plazo <small>Mantiene la cuota y terminas antes.</small>
                    </span>
                  </label>
                  <label>
                    <input type="radio" name="mode" value="payment" defaultChecked={extraPayment.defaults?.mode === "payment"} />
                    <span>
                      Cuota{" "}
                      <small>Mantiene el plazo y pagas menos al mes.</small>
                    </span>
                  </label>
                </fieldset>
              </>
            )}
            <div className="debt-form-grid">
              <label htmlFor="payment-date">
                Fecha
              </label>
              <input
                id="payment-date"
                name="date"
                type="date"
                defaultValue={extraPayment.defaults?.date ?? iso(new Date())}
                required
              />
              <label htmlFor="payment-account">
                Cuenta de pago
              </label>
              <select
                id="payment-account"
                name="account"
                defaultValue={extraPayment.defaults?.account ?? extraPayment.debt.paymentAccount}
                required
              >
                {paymentAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <label>
              Comisión (%) <span>opcional</span>
              <input
                name="feePercent"
                type="number"
                min="0"
                step="0.01"
                defaultValue={extraPayment.defaults?.feePercent ?? 0}
              />
            </label>
            <button className="button-primary">
              {extraPayment.kind === "cancel"
                ? "Confirmar cancelación"
                : "Registrar amortización"}
            </button>
          </form>
        </div>
      )}
      {tableDebt && (
        <div
          className="debt-overlay"
          onClick={(event) =>
            event.target === event.currentTarget && setTableDebt(null)
          }
        >
          <section className="debt-dialog amortization-dialog">
            <header>
              <div>
                <span>
                  {tableDebt.type === "loan"
                    ? "Cuadro de amortización"
                    : "Previsión de pago"}
                </span>
                <h2>{tableDebt.name}</h2>
              </div>
              <button onClick={() => setTableDebt(null)}>×</button>
            </header>
            {tableDebt.type === "loan" ? (
              <>
                <p>
                  Puedes corregir cualquier importe. El capital pendiente de las
                  cuotas posteriores se actualizará automáticamente.
                </p>
                <div className="amortization-table">
                  <div className="amortization-head">
                    <span>Cuota</span>
                    <span>Fecha</span>
                    <span>Pago</span>
                    <span>Intereses</span>
                    <span>Capital</span>
                    <span>Pendiente</span>
                  </div>
                  {displayedSchedule.map((event) =>
                    event.type === "adjustment" ? (
                      <div
                        className="amortization-row amortization-extra-row"
                        key={`extra-${event.adjustment.id}`}
                      >
                        <span>Extra</span>
                        <span>{prettyDate(event.adjustment.date)}</span>
                        <strong>
                          {money(
                            event.adjustment.principal + event.adjustment.fee,
                          )}
                        </strong>
                        <span>
                          {event.adjustment.fee
                            ? `Comisión ${(event.adjustment.feePercent ?? event.adjustment.fee / Math.max(event.adjustment.principal, .01) * 100).toFixed(2).replace(".", ",")}% · ${money(event.adjustment.fee)}`
                            : "—"}
                        </span>
                        <strong>{money(event.adjustment.principal)}</strong>
                        <span className="amortization-extra-end"><strong>{money(event.remaining)}</strong><span><button type="button" aria-label="Editar amortización" title="Editar amortización" disabled={!event.adjustment.previousDebt} onClick={() => event.adjustment.previousDebt && setExtraPayment({ debt: event.adjustment.previousDebt, kind: event.adjustment.cancelled ? "cancel" : "extra", editingId: event.adjustment.id, defaults: { amount: event.adjustment.principal, feePercent: event.adjustment.feePercent ?? event.adjustment.fee / Math.max(event.adjustment.principal, .01) * 100, date: event.adjustment.date, account: event.adjustment.account ?? event.adjustment.previousDebt.paymentAccount, mode: event.adjustment.mode ?? "term" } })}>✎</button><button type="button" aria-label="Eliminar amortización" title="Eliminar amortización" onClick={() => onDeleteAdjustment?.(event.adjustment.id)}>×</button></span></span>
                      </div>
                    ) : (
                      <div
                        className="amortization-row"
                        key={`installment-${event.row.number}-${event.row.date}`}
                      >
                        <span>{event.row.number}</span>
                        <span>{prettyDate(event.row.date)}</span>
                        <input
                          aria-label={`Pago cuota ${event.row.number}`}
                          type="number"
                          step="0.01"
                          value={event.row.payment}
                          onChange={(change) =>
                            updateRow(
                              event.index,
                              "payment",
                              Number(change.target.value),
                            )
                          }
                        />
                        <input
                          aria-label={`Intereses cuota ${event.row.number}`}
                          type="number"
                          step="0.01"
                          value={event.row.interest}
                          onChange={(change) =>
                            updateRow(
                              event.index,
                              "interest",
                              Number(change.target.value),
                            )
                          }
                        />
                        <input
                          aria-label={`Capital cuota ${event.row.number}`}
                          type="number"
                          step="0.01"
                          value={event.row.principal}
                          onChange={(change) =>
                            updateRow(
                              event.index,
                              "principal",
                              Number(change.target.value),
                            )
                          }
                        />
                        <strong>{money(event.remaining)}</strong>
                      </div>
                    ),
                  )}
                </div>
              </>
            ) : (
              <div className="card-forecast">
                <span>Si no realizas más compras</span>
                <strong>{money(tableDebt.principal)}</strong>
                <p>
                  Con la forma de pago elegida, el próximo recibo estimado será
                  de{" "}
                  {money(
                    tableDebt.paymentMethod === "full"
                      ? tableDebt.principal
                      : tableDebt.paymentMethod === "percentage"
                        ? Math.max(
                            tableDebt.monthlyPayment,
                            (tableDebt.principal *
                              (tableDebt.paymentPercent ?? 5)) /
                              100,
                          )
                        : tableDebt.monthlyPayment,
                  )}
                  .
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
