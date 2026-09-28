"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BudgetPlanner, { type BudgetItem } from "./budgets";
import type { AnnualExpense, AnnualPayment } from "./annual-expenses";
import DebtPlanner, {
  type DebtProfile,
  type ExtraDebtPayment,
  type DebtAdjustment,
} from "./debts";
import { authenticatedFetch } from "./supabase-client";
import { AccountSecurity, DataTools, FeedbackForm, NotificationCenter, type ToolMovement } from "./product-tools";

type AccountKind = "corriente" | "ahorro" | "hucha" | "deuda" | "inversion";
type FinanceSpace = {
  id: string;
  name: string;
  kind: "personal" | "demo" | "shared";
  role: "owner" | "editor" | "viewer";
  ownerEmail: string;
  memberCount: number;
  updatedAt: number;
};
type MovementKind = "gasto" | "ingreso" | "traspaso" | "deuda" | "devolucion";
type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  balance: number;
  included: boolean;
  icon: string;
  color: string;
  detail?: string;
  goal?: number;
  archived?: boolean;
  bucket?: "needs" | "wants" | "savings";
};
type Movement = {
  id: string;
  date: string;
  name: string;
  amount: number;
  kind: MovementKind;
  account: string;
  target?: string;
  category: string;
  subcategory: string;
  notes?: string;
  scheduled?: boolean;
  planned?: boolean;
  principal?: number;
  interest?: number;
  refundOf?: string;
  debtAdjustment?: {
    mode: "term" | "payment" | "cancel";
    fee: number;
    feePercent?: number;
    previousDebt: DebtProfile;
  };
};
type Program = {
  id: string;
  name: string;
  amount: number;
  kind: MovementKind;
  account: string;
  target?: string;
  category: string;
  subcategory: string;
  notes?: string;
  frequency: string;
  interval?: number;
  occurrences?: number;
  start: string;
  end?: string;
  day: number;
  active: boolean;
  principal?: number;
  interest?: number;
  archived?: boolean;
  debtId?: string;
};
type SubcategoryDefinition = { name: string; archived?: boolean };
type CategoryDefinition = {
  id: string;
  name: string;
  icon: string;
  color: string;
  subcategories: SubcategoryDefinition[];
  archived?: boolean;
  bucket?: "needs" | "wants" | "savings";
};
type AssetValuation = { date: string; value: number };
type RuleDetail = {
  id: string;
  date: string;
  name: string;
  context: string;
  category: string;
  amount: number;
};
type ManualAsset = {
  id: string;
  name: string;
  kind: string;
  value: number;
  valuations: AssetValuation[];
};
type TrashKind = "account" | "movement" | "program" | "debt" | "budget" | "category" | "subcategory" | "asset";
type TrashItem = {
  id: string;
  kind: TrashKind;
  label: string;
  deletedAt: string;
  expiresAt: string;
  payload: {
    accounts?: Account[];
    movements?: Movement[];
    programs?: Program[];
    debts?: DebtProfile[];
    budgets?: BudgetItem[];
    categories?: CategoryDefinition[];
    manualAssets?: ManualAsset[];
    overrides?: Data["overrides"];
    skippedOccurrences?: string[];
  };
};
type Data = {
  accounts: Account[];
  movements: Movement[];
  programs: Program[];
  categories?: CategoryDefinition[];
  budgets?: BudgetItem[];
  annualExpenses?: AnnualExpense[];
  debts?: DebtProfile[];
  preferences?: {
    period?: string;
    cycleStartDay?: number;
    needsTarget?: number;
    wantsTarget?: number;
    savingsTarget?: number;
    budgetYear?: number;
    budgetMonth?: number;
    displayName?: string;
    profilePhoto?: string;
    currency?: "EUR";
    dateFormat?: "dd/mm/yyyy" | "yyyy-mm-dd";
    theme?: "light" | "dark" | "auto";
    hideAmountsOnOpen?: boolean;
    debtAmountsHidden?: boolean;
    firstDayOfWeek?: 0 | 1;
    defaultPeriod?: string;
    rememberLastPeriod?: boolean;
    upcomingOpen?: boolean;
    collapsedAccountGroups?: AccountKind[];
    collapsedMovementDays?: string[];
    showArchivedAccounts?: boolean;
    showArchivedPrograms?: boolean;
    openBalancePanels?: string[];
    openDebtId?: string | null;
    expandedManagedCategory?: string | null;
    onboardingCompleted?: boolean;
    onboardingStep?: number;
    lastTab?: Tab;
    lastMovementSection?: "movimientos" | "recurrentes";
  };
  manualAssets?: ManualAsset[];
  investmentValuations?: Record<string, AssetValuation[]>;
  overrides?: Record<
    string,
    {
      date: string;
      amount: number;
      account: string;
      name: string;
      target?: string;
      category?: string;
      subcategory?: string;
      notes?: string;
      principal?: number;
      interest?: number;
    }
  >;
  skippedOccurrences?: string[];
  trash?: TrashItem[];
};
type Tab =
  | "cuentas"
  | "programados"
  | "movimientos"
  | "deudas"
  | "presupuestos"
  | "categorias";

const today = new Date();
const dateAt = (day: number, offset = 0) => {
  const d = new Date(today.getFullYear(), today.getMonth() + offset, day, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const todayISO = dateAt(today.getDate());
const tutorialSteps: Array<{
  title: string;
  text: string;
  tab?: Tab;
  target?: string;
  movementSection?: "movimientos" | "recurrentes";
}> = [
  { title: "Bienvenida a Mizufi", text: "Vamos a enseñarte lo esencial para saber dónde va tu dinero y anticiparte a lo que viene." },
  { title: "Empieza por tus cuentas", text: "Añade tus cuentas, ahorros, huchas e inversiones. Activa solo las cuentas corrientes que quieras incluir en el dinero disponible.", tab: "cuentas", target: "accounts" },
  { title: "Tu dinero disponible", text: "Mizufi toma el saldo de tus cuentas activadas y resta todos los pagos previstos del periodo. Los ingresos futuros no se suman hasta que llegan.", tab: "movimientos", target: "available", movementSection: "movimientos" },
  { title: "Automatiza con Recurrentes", text: "Aquí programas ingresos, gastos y traspasos que se repiten, como la nómina, el alquiler o una aportación mensual. Mizufi creará sus previsiones automáticamente para que no tengas que introducirlos cada vez.", tab: "movimientos", target: "recurrentes", movementSection: "recurrentes" },
  { title: "Movimientos y previsiones", text: "Registra ingresos, gastos y traspasos. Los recurrentes generan previsiones para que puedas ver lo que viene antes de gastarlo.", tab: "movimientos", target: "upcoming", movementSection: "movimientos" },
  { title: "Entiende tus deudas", text: "Mizufi separa cuota, intereses y amortización. Puedes consultar el capital pendiente y el cuadro de amortización.", tab: "deudas", target: "debts" },
  { title: "Planifica tu presupuesto", text: "Presupuesta cada mes, copia meses parecidos y compara lo planificado con lo que ocurre realmente.", tab: "presupuestos", target: "budgets" },
  { title: "Consulta tu Balance", text: "Aquí encontrarás patrimonio, distribución de gastos e ingresos y tu regla personalizada. Es una zona informativa: no necesitas usarla todos los días.", tab: "categorias", target: "balance" },
  { title: "Hazla tuya desde Preferencias", text: "En Ajustes → Preferencias puedes elegir tu moneda, el formato de fecha, la apariencia y adaptar la regla de distribución a tu realidad. Los informes utilizarán automáticamente esos porcentajes." },
  { title: "Ya puedes empezar", text: "No hace falta configurarlo todo hoy. Añade primero tus cuentas y continúa poco a poco. Puedes repetir este tutorial desde Ajustes → Ayuda." },
];
const trashExpiry = () => {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  return expires.toISOString();
};
const addTrashItem = (
  data: Data,
  kind: TrashKind,
  label: string,
  payload: TrashItem["payload"],
) => ({
  ...data,
  trash: [
    ...(data.trash ?? []).filter((item) => new Date(item.expiresAt).getTime() > Date.now()),
    {
      id: crypto.randomUUID(),
      kind,
      label,
      deletedAt: new Date().toISOString(),
      expiresAt: trashExpiry(),
      payload,
    },
  ],
});
const seed: Data = {
  accounts: [
    {
      id: "ing",
      name: "ING · Cuenta nómina",
      kind: "corriente",
      balance: 1240,
      included: true,
      icon: "bank",
      color: "#f47c39",
      detail: "Cuenta principal",
    },
    {
      id: "bbva",
      name: "BBVA · Día a día",
      kind: "corriente",
      balance: 685,
      included: true,
      icon: "card",
      color: "#3479a2",
      detail: "Gastos compartidos",
    },
    {
      id: "efectivo",
      name: "Efectivo",
      kind: "corriente",
      balance: 85,
      included: true,
      icon: "wallet",
      color: "#708d76",
      detail: "Cartera",
    },
    {
      id: "ahorro",
      name: "Cuenta remunerada",
      kind: "ahorro",
      balance: 3450,
      included: false,
      icon: "piggy",
      color: "#68877b",
      detail: "Intereses reinvertidos",
    },
    {
      id: "seguro",
      name: "Seguro del coche",
      kind: "hucha",
      balance: 350,
      included: false,
      icon: "shield",
      color: "#ba8767",
      goal: 500,
      detail: "Objetivo: 500 €",
    },
    {
      id: "veterinario",
      name: "Veterinario",
      kind: "hucha",
      balance: 180,
      included: false,
      icon: "paw",
      color: "#9b8296",
      goal: 300,
      detail: "Objetivo: 300 €",
    },
    {
      id: "vacaciones",
      name: "Vacaciones",
      kind: "hucha",
      balance: 420,
      included: false,
      icon: "plane",
      color: "#6c91a0",
      goal: 1200,
      detail: "Objetivo: 1.200 €",
    },
    {
      id: "prestamo",
      name: "Préstamo personal",
      kind: "deuda",
      balance: 4200,
      included: false,
      icon: "card",
      color: "#ad7067",
      detail: "Cuota mensual · 250 €",
    },
    {
      id: "acciones",
      name: "Cartera de acciones",
      kind: "inversion",
      balance: 1250,
      included: false,
      icon: "chart",
      color: "#87799e",
      detail: "Capital aportado",
    },
  ],
  movements: [
    {
      id: "m1",
      date: dateAt(1),
      name: "Nómina",
      amount: 1800,
      kind: "ingreso",
      account: "ing",
      category: "Ingresos",
      subcategory: "Nómina",
    },
    {
      id: "m2",
      date: dateAt(3),
      name: "Compra Mercadona",
      amount: 64.8,
      kind: "gasto",
      account: "ing",
      category: "Alimentación",
      subcategory: "Supermercado",
    },
    {
      id: "m3",
      date: dateAt(5),
      name: "Cuota gimnasio",
      amount: 45,
      kind: "gasto",
      account: "ing",
      category: "Deporte",
      subcategory: "Gimnasio",
      scheduled: true,
    },
    {
      id: "m4",
      date: dateAt(8),
      name: "Hucha seguro coche",
      amount: 50,
      kind: "traspaso",
      account: "ing",
      target: "seguro",
      category: "Traspasos",
      subcategory: "Huchas",
      scheduled: true,
    },
    {
      id: "m5",
      date: dateAt(12),
      name: "Pilates",
      amount: 60,
      kind: "gasto",
      account: "bbva",
      category: "Deporte",
      subcategory: "Pilates",
    },
    {
      id: "m6",
      date: dateAt(16),
      name: "Luz · Iberdrola",
      amount: 72.35,
      kind: "gasto",
      account: "bbva",
      category: "Vivienda",
      subcategory: "Luz",
    },
    {
      id: "m7",
      date: dateAt(19),
      name: "Cena con amigas",
      amount: 38,
      kind: "gasto",
      account: "ing",
      category: "Ocio",
      subcategory: "Restaurantes",
    },
    {
      id: "m8",
      date: dateAt(Math.max(1, today.getDate() - 1)),
      name: "Supermercado",
      amount: 41.2,
      kind: "gasto",
      account: "ing",
      category: "Alimentación",
      subcategory: "Supermercado",
    },
  ].filter((m) => m.date <= todayISO) as Movement[],
  programs: [
    {
      id: "p1",
      name: "Cuota gimnasio",
      amount: 45,
      kind: "gasto",
      account: "ing",
      category: "Deporte",
      subcategory: "Gimnasio",
      frequency: "Mensual",
      start: dateAt(5, -3),
      day: 5,
      active: true,
    },
    {
      id: "p2",
      name: "Préstamo personal",
      amount: 250,
      kind: "deuda",
      account: "bbva",
      target: "prestamo",
      category: "Deudas",
      subcategory: "Préstamo personal",
      frequency: "Mensual",
      start: dateAt(28, -5),
      end: dateAt(28, 18),
      day: 28,
      active: true,
      principal: 215,
      interest: 35,
    },
    {
      id: "p3",
      name: "Hucha seguro coche",
      amount: 50,
      kind: "traspaso",
      account: "ing",
      target: "seguro",
      category: "Traspasos",
      subcategory: "Huchas",
      frequency: "Mensual",
      start: dateAt(27, -4),
      day: 27,
      active: true,
    },
    {
      id: "p4",
      name: "Ahorro mensual",
      amount: 200,
      kind: "traspaso",
      account: "ing",
      target: "ahorro",
      category: "Traspasos",
      subcategory: "Ahorro",
      frequency: "Mensual",
      start: dateAt(26, -4),
      day: 26,
      active: true,
    },
    {
      id: "p5",
      name: "Nómina",
      amount: 1800,
      kind: "ingreso",
      account: "ing",
      category: "Ingresos",
      subcategory: "Nómina",
      frequency: "Mensual",
      start: dateAt(1, -6),
      day: 1,
      active: true,
    },
    {
      id: "p6",
      name: "Seguro Mapfre",
      amount: 500,
      kind: "gasto",
      account: "seguro",
      category: "Transporte",
      subcategory: "Seguro coche",
      frequency: "Anual",
      start: dateAt(15, 2),
      day: 15,
      active: true,
    },
    {
      id: "p7",
      name: "Internet",
      amount: 39.9,
      kind: "gasto",
      account: "bbva",
      category: "Vivienda",
      subcategory: "Internet",
      frequency: "Mensual",
      start: dateAt(29, -6),
      day: 29,
      active: true,
    },
  ],
  debts: [
    {
      id: "debt-loan",
      accountId: "prestamo",
      type: "loan",
      name: "Préstamo personal",
      principal: 4200,
      tin: 5.25,
      monthlyPayment: 250,
      remainingTerms: 18,
      nextPaymentDate: dateAt(28, 1),
      paymentAccount: "bbva",
      maturityDate: dateAt(28, 18),
    },
    {
      id: "debt-card",
      accountId: "visa-credito",
      type: "card",
      name: "Visa crédito",
      principal: 640,
      tin: 19.9,
      monthlyPayment: 100,
      nextPaymentDate: dateAt(5, 1),
      paymentAccount: "ing",
      creditLimit: 2500,
      closingDay: 25,
      paymentDay: 5,
      paymentMethod: "fixed",
    },
  ],
};
seed.accounts.push({
  id: "visa-credito",
  name: "Visa crédito",
  kind: "deuda",
  balance: 640,
  included: false,
  icon: "card",
  color: "#8b6f91",
  detail: "Tarjeta de crédito",
});
const createEmptyData = (): Data => ({
  accounts: [],
  movements: [],
  programs: [],
  budgets: [],
  annualExpenses: [],
  debts: [],
  manualAssets: [],
  investmentValuations: {},
  overrides: {},
  skippedOccurrences: [],
  trash: [],
});
const groups: { id: AccountKind; title: string; subtitle: string }[] = [
  {
    id: "corriente",
    title: "Cuentas corrientes",
    subtitle: "Dinero para el día a día",
  },
  { id: "ahorro", title: "Ahorros", subtitle: "Tu tranquilidad a largo plazo" },
  { id: "hucha", title: "Huchas", subtitle: "Dinero reservado con intención" },
  { id: "inversion", title: "Inversiones", subtitle: "Capital aportado" },
];
const defaultCategories: Record<string, string[]> = {
  Alimentación: ["Supermercado", "Restaurantes", "Comida a domicilio"],
  Compras: ["Amazon", "Ropa", "Belleza", "Hogar"],
  Vivienda: ["Alquiler", "Luz", "Agua", "Internet"],
  Transporte: ["Gasolina", "Seguro coche", "Aparcamiento"],
  Deporte: ["Pilates", "Gimnasio", "Baloncesto"],
  Ocio: ["Restaurantes", "Cine", "Viajes"],
  Salud: ["Farmacia", "Fisioterapia", "Seguro médico"],
  Mascotas: ["Veterinario", "Alimentación", "Accesorios"],
  Deudas: ["Préstamo personal", "Tarjeta de crédito"],
  Ingresos: ["Nómina", "Otros ingresos", "Intereses"],
  Traspasos: ["Huchas", "Ahorro", "Inversiones", "Entre cuentas"],
};
const categoryColorGroups = [
  { name: "Verdes", colors: ["#2f6f5e", "#4f8a72", "#68877b", "#82a88f", "#a8c7b2"] },
  { name: "Aguamarinas", colors: ["#287f7b", "#4b9893", "#6baca7", "#91c3bd", "#b7d9d4"] },
  { name: "Azules", colors: ["#356c91", "#527fa0", "#6c91a9", "#8aa9be", "#afc5d3"] },
  { name: "Morados", colors: ["#65557f", "#7d6b96", "#9281a8", "#aa9abb", "#c5b8cf"] },
  { name: "Rosas", colors: ["#935b72", "#ad7084", "#c48799", "#d8a2af", "#e8bec7"] },
  { name: "Rojos y corales", colors: ["#9f554f", "#b8675d", "#ca7c6f", "#dc9789", "#e9b7ad"] },
  { name: "Naranjas y amarillos", colors: ["#a86535", "#bd7c45", "#ca945d", "#d6ad79", "#e5c99e"] },
  { name: "Neutros", colors: ["#4f5753", "#6f7772", "#8e948f", "#aaa9a1", "#c7c3b9"] },
];
const categoryColors = categoryColorGroups.flatMap((group) => group.colors);
const categoryIconGroups = [
  { name: "Finanzas", icons: ["euro", "bank", "piggy", "wallet", "chart", "card", "coins", "calculator", "receipt", "safe"] },
  { name: "Hogar y servicios", icons: ["home", "building", "light", "phone", "wifi", "water", "plug", "tools", "sofa", "key"] },
  { name: "Compras", icons: ["cart", "bag", "gift", "tag", "shirt", "box", "store", "basket", "beauty", "package"] },
  { name: "Comida y restaurantes", icons: ["food", "coffee", "restaurant", "pizza", "burger", "cake", "icecream", "wine", "apple", "delivery"] },
  { name: "Transporte y viajes", icons: ["car", "plane", "bus", "train", "bike", "fuel", "parking", "ship", "suitcase", "map"] },
  { name: "Trabajo y educación", icons: ["study", "briefcase", "laptop", "book", "pencil", "school", "id", "presentation", "factory", "calendar"] },
  { name: "Ocio y deporte", icons: ["film", "music", "game", "sport", "ball", "running", "swim", "ticket", "camera", "party"] },
  { name: "Salud y personal", icons: ["health", "heart", "shield", "pill", "doctor", "tooth", "glasses", "spa", "baby", "accessibility"] },
  { name: "Mascotas y naturaleza", icons: ["paw", "bone", "bird", "fish", "leaf", "flower", "tree", "sun", "moon", "star"] },
];
const categoryIconChoices = categoryIconGroups.flatMap((group) => group.icons);
const defaultAccountIcons: Record<AccountKind, string> = {
  corriente: "bank",
  ahorro: "piggy",
  hucha: "wallet",
  deuda: "card",
  inversion: "chart",
};
const legacySymbols: Record<string, string> = {
  "🏠": "home",
  "🚗": "car",
  "€": "euro",
  "💶": "euro",
  "🏦": "bank",
  "🐷": "piggy",
  "💰": "wallet",
  "📈": "chart",
  "🛒": "cart",
  "🛍️": "bag",
  "🍽️": "food",
  "☕": "coffee",
  "💊": "health",
  "🐶": "paw",
  "🐱": "paw",
  "🏋️": "sport",
  "⚽": "ball",
  "✈️": "plane",
  "🎁": "gift",
  "💡": "light",
  "📱": "phone",
  "🎬": "film",
  "🎓": "study",
  "🛡️": "shield",
  "💳": "card",
  "🌿": "leaf",
  "❤️": "heart",
  "⭐": "star",
};
const symbolLabels: Record<string, string> = {
  home: "Casa",
  car: "Coche",
  euro: "Euro",
  bank: "Banco",
  piggy: "Hucha",
  wallet: "Dinero",
  chart: "Inversión",
  cart: "Compra",
  bag: "Bolsa",
  food: "Comida",
  coffee: "Café",
  health: "Salud",
  paw: "Mascotas",
  sport: "Deporte",
  ball: "Balón",
  plane: "Viajes",
  gift: "Regalo",
  light: "Suministros",
  phone: "Teléfono",
  film: "Ocio",
  study: "Estudios",
  shield: "Seguro",
  card: "Tarjeta",
  leaf: "Naturaleza",
  heart: "Corazón",
  star: "Estrella",
  coins: "Monedas", calculator: "Calculadora", receipt: "Recibo", safe: "Caja fuerte",
  building: "Edificio", wifi: "Internet", water: "Agua", plug: "Electricidad", tools: "Reparaciones", sofa: "Muebles", key: "Llaves",
  tag: "Etiqueta", shirt: "Ropa", box: "Caja", store: "Tienda", basket: "Cesta", beauty: "Belleza", package: "Paquete",
  restaurant: "Restaurante", pizza: "Pizza", burger: "Hamburguesa", cake: "Tarta", icecream: "Helado", wine: "Bebidas", apple: "Alimentación", delivery: "Comida a domicilio",
  bus: "Autobús", train: "Tren", bike: "Bicicleta", fuel: "Gasolina", parking: "Aparcamiento", ship: "Barco", suitcase: "Maleta", map: "Mapa",
  briefcase: "Trabajo", laptop: "Ordenador", book: "Libros", pencil: "Material escolar", school: "Centro educativo", id: "Identificación", presentation: "Formación", factory: "Empresa", calendar: "Agenda",
  music: "Música", game: "Videojuegos", running: "Correr", swim: "Natación", ticket: "Entradas", camera: "Fotografía", party: "Celebraciones",
  pill: "Medicamentos", doctor: "Médico", tooth: "Dentista", glasses: "Óptica", spa: "Cuidado personal", baby: "Bebé", accessibility: "Accesibilidad",
  bone: "Accesorios para mascotas", bird: "Aves", fish: "Peces", flower: "Flores", tree: "Naturaleza", sun: "Sol", moon: "Noche",
};
const categorySymbols: Record<string, string> = {
  Alimentación: "cart",
  Compras: "bag",
  Vivienda: "home",
  Transporte: "car",
  Deporte: "sport",
  Ocio: "film",
  Salud: "health",
  Mascotas: "paw",
  Deudas: "card",
  Ingresos: "euro",
  Traspasos: "wallet",
};
const defaultCategoryDefinitions: CategoryDefinition[] = Object.entries(
  defaultCategories,
).map(([name, subcategories], index) => ({
  id: `default-${index}`,
  name,
  icon: categorySymbols[name] ?? "⭐",
  color: categoryColors[index % categoryColors.length],
  subcategories: subcategories.map((subcategory) => ({ name: subcategory })),
}));
const categoryCatalogKey = (name: string) =>
  name
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/s$/, "");

function currentCategoryCatalog(categories: CategoryDefinition[]) {
  const latestByName = new Map<string, CategoryDefinition>();
  categories.forEach((category) => {
    latestByName.set(categoryCatalogKey(category.name), category);
  });
  return categories.filter(
    (category) =>
      latestByName.get(categoryCatalogKey(category.name))?.id === category.id,
  );
}
const money = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    v,
  );
const huchaLabel = (name: string) =>
  /^hucha(?:\s|\s*·)/i.test(name.trim()) ? name : `Hucha · ${name}`;
const friendly = (v: string, long = false) =>
  new Intl.DateTimeFormat(
    "es-ES",
    long
      ? { weekday: "long", day: "numeric", month: "long" }
      : { day: "numeric", month: "short" },
  ).format(new Date(`${v}T12:00:00`));
function periodBounds(period: string, cycleStartDay = 28, offset = 0, firstDayOfWeek: 0 | 1 = 1) {
  if (period === "personalizado") {
    const anchor = (year: number, month: number) =>
      new Date(
        year,
        month,
        Math.min(cycleStartDay, new Date(year, month + 1, 0).getDate()),
        12,
      );
    let start = anchor(today.getFullYear(), today.getMonth());
    if (today.getDate() < start.getDate())
      start = anchor(today.getFullYear(), today.getMonth() - 1);
    start = anchor(start.getFullYear(), start.getMonth() + offset);
    const end = anchor(start.getFullYear(), start.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    return { start, end };
  }
  if (period === "año") {
    const start = new Date(today.getFullYear() + offset, 0, 1, 12);
    return { start, end: new Date(today.getFullYear() + offset, 11, 31, 12) };
  }
  if (period === "semana") {
    const daysSinceStart = (today.getDay() - firstDayOfWeek + 7) % 7;
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - daysSinceStart + offset * 7,
      12,
    );
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1, 12);
  return {
    start,
    end: new Date(start.getFullYear(), start.getMonth() + 1, 0, 12),
  };
}
function periodRange(period: string, cycleStartDay = 28, offset = 0, firstDayOfWeek: 0 | 1 = 1) {
  const { start, end } = periodBounds(period, cycleStartDay, offset, firstDayOfWeek);
  if (period === "año") return String(start.getFullYear());
  const format = (date: Date) => {
    const parts = new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    }).formatToParts(date);
    return ["day", "month", "year"]
      .map((type) =>
        parts.find((part) => part.type === type)?.value.replace(".", ""),
      )
      .join(" ");
  };
  return `${format(start)} - ${format(end)}`;
}
function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function normalizedProgramEnd(start: string, end?: string) {
  if (!end || end >= start) return end;
  const date = new Date(`${end}T12:00:00`);
  const startDate = new Date(`${start}T12:00:00`);
  while (date < startDate) date.setFullYear(date.getFullYear() + 1);
  return isoDate(date);
}
function programOccurrences(p: Program, start: Date, end: Date) {
  const occurrence = new Date(`${p.start}T12:00:00`);
  const normalizedEnd = normalizedProgramEnd(p.start, p.end);
  const finish = normalizedEnd
    ? new Date(`${normalizedEnd}T12:00:00`)
    : null;
  const results: string[] = [];
  let guard = 0;
  while (occurrence <= end && guard < 2400 && (!p.occurrences || guard < p.occurrences)) {
    guard++;
    if (occurrence >= start && (!finish || occurrence <= finish))
      results.push(isoDate(occurrence));
    const interval = Math.max(1, p.interval ?? 1);
    if (p.frequency === "Semanal") occurrence.setDate(occurrence.getDate() + 7 * interval);
    else
      occurrence.setMonth(
        occurrence.getMonth() +
          (p.frequency === "Anual"
            ? 12
            : p.frequency === "Semestral"
              ? 6
              : p.frequency === "Trimestral"
                ? 3
                : 1) * interval,
      );
  }
  return results;
}
function programOccurrencePosition(p: Program, date: string) {
  if (!p.occurrences) return null;
  const dates = programOccurrences(p, new Date(`${p.start}T12:00:00`), new Date(`${date}T12:00:00`));
  const index = dates.indexOf(date);
  return index >= 0 ? `${index + 1}/${p.occurrences}` : null;
}
const uid = () => Math.random().toString(36).slice(2, 10);
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    cuentas: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18m-13 5h3" />
      </>
    ),
    programados: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18m-10 4h4m-2-2v4" />
      </>
    ),
    calculator: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
      </>
    ),
    movimientos: <path d="M17 3v18m0 0-4-4m4 4 4-4M7 21V3m0 0L3 7m4-4 4 4" />,
    deudas: (
      <>
        <path d="M5 7h14v12H5zM8 7V4h8v3" />
        <path d="M8 12h8m-5 4h2" />
      </>
    ),
    presupuestos: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h5M8 16h3" />
      </>
    ),
    categorias: <path d="M3 3v18h18M8 16v-4m5 4V8m5 8V5" />,
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.7" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18M10.6 6.1A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.1 2.8M6.4 6.4C3.9 8.1 2.5 12 2.5 12s3.5 6 9.5 6c1 0 1.9-.2 2.8-.5" />
      </>
    ),
    plus: <path d="M12 5v14m-7-7h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    down: <path d="m6 9 6 6 6-6" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    check: <path d="m5 12 4 4L19 6" />,
    trash: (
      <>
        <path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14M10 11v6m4-6v6" />
      </>
    ),
    wave: (
      <>
        <path d="M3 15c2.4 0 3.2-2.2 5.6-2.2s3.2 2.2 5.6 2.2 3.2-2.2 5.8-2.2" />
        <path d="M4 10.5c1.7 0 2.5-1.5 4.2-1.5s2.5 1.5 4.2 1.5 2.5-1.5 4.2-1.5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {p[name]}
    </svg>
  );
}
function CategoryIcon({ name, size = 20 }: { name: string; size?: number }) {
  const key = legacySymbols[name] ?? name;
  const p: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    car: (
      <>
        <path d="m5 17-1-5 2-5h12l2 5-1 5" />
        <path d="M4 12h16M7 17v2m10-2v2M7 15h.01M17 15h.01" />
      </>
    ),
    euro: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M16 8.5A5 5 0 1 0 16 15.5M7 10h7M7 14h7" />
      </>
    ),
    bank: (
      <>
        <path d="m3 9 9-5 9 5M5 10h14M6 10v8m4-8v8m4-8v8m4-8v8M4 20h16" />
      </>
    ),
    piggy: (
      <>
        <path d="M5 11a7 7 0 0 1 12-4h3v5l-2 1a7 7 0 0 1-5 5H7a5 5 0 0 1-2-7Z" />
        <path d="M8 18v2m7-2v2M9 8h.01M4 10 2 8" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" />
        <path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V4M4 20h17M7 15l4-4 3 2 5-6" />
        <path d="M16 7h3v3" />
      </>
    ),
    cart: (
      <>
        <path d="M3 4h2l2 11h10l3-7H6M9 20h.01M17 20h.01" />
      </>
    ),
    bag: (
      <>
        <path d="M5 8h14l-1 12H6L5 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </>
    ),
    food: (
      <>
        <path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M17 3c-3 2-3 8 0 9" />
      </>
    ),
    coffee: (
      <>
        <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
        <path d="M17 10h2a2 2 0 0 1 0 4h-2M7 4h7" />
      </>
    ),
    health: (
      <>
        <path d="M10 4h4v5h5v4h-5v5h-4v-5H5V9h5V4Z" />
      </>
    ),
    paw: (
      <>
        <circle cx="12" cy="15" r="4" />
        <circle cx="6" cy="10" r="2" />
        <circle cx="10" cy="6" r="2" />
        <circle cx="14" cy="6" r="2" />
        <circle cx="18" cy="10" r="2" />
      </>
    ),
    sport: (
      <>
        <path d="M6 5v14M3 8v8m15-11v14m3-11v8M6 12h12" />
      </>
    ),
    ball: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 3-2 3 2-1 4h-4L9 9Zm1 4-3 3m7-3 3 3M7 8l2 1m8-1-2 1" />
      </>
    ),
    plane: (
      <>
        <path d="m3 11 18-7-7 16-3-6-8-3Z" />
        <path d="m11 14 4-4" />
      </>
    ),
    gift: (
      <>
        <rect x="3" y="9" width="18" height="12" rx="1" />
        <path d="M12 9v12M3 13h18M12 9H7a2 2 0 1 1 2-3l3 3Zm0 0h5a2 2 0 1 0-2-3l-3 3Z" />
      </>
    ),
    light: (
      <>
        <path d="M9 18h6M10 22h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z" />
      </>
    ),
    phone: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 18h4" />
      </>
    ),
    film: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 5v14M17 5v14M3 9h4m10 0h4M3 15h4m10 0h4" />
      </>
    ),
    study: (
      <>
        <path d="m3 9 9-5 9 5-9 5-9-5Z" />
        <path d="M7 12v5c3 2 7 2 10 0v-5M21 9v6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v6c0 5 3 8 7 9 4-1 7-4 7-9V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4c-9 0-15 5-15 13 0 2 2 3 4 3 8 0 11-7 11-16Z" />
        <path d="M5 20c3-6 7-9 12-12" />
      </>
    ),
    heart: (
      <path d="M20 8c0 6-8 11-8 11S4 14 4 8a4 4 0 0 1 7-3 4 4 0 0 1 9 3Z" />
    ),
    coins: <><circle cx="9" cy="9" r="5" /><circle cx="15" cy="15" r="5" /><path d="M7 9h4m2 6h4" /></>,
    calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6m-6 4h6m-6 4h4" /></>,
    safe: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 9v3l2 1M18 8h.01" /></>,
    building: <><path d="M5 21V4h14v17M3 21h18" /><path d="M8 8h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2" /></>,
    wifi: <><path d="M4 9a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0m-7 4a3 3 0 0 1 4 0" /><circle cx="12" cy="20" r=".5" /></>,
    water: <path d="M12 3S6 10 6 15a6 6 0 0 0 12 0c0-5-6-12-6-12Z" />,
    plug: <><path d="M8 3v6m8-6v6M6 9h12v2a6 6 0 0 1-6 6v4m-3 0h6" /></>,
    tools: <><path d="m14 7 3-3 3 3-3 3M4 20l9-9M5 4l4 4-2 2-4-4 2-2Zm9 10 6 6" /></>,
    sofa: <><path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" /><path d="M4 10a2 2 0 0 0-2 2v6h20v-6a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-2-2Zm1 8v3m14-3v3" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-3 3 3 3m-6 0 3 3" /></>,
    tag: <><path d="M3 12V4h8l10 10-7 7L3 12Z" /><circle cx="8" cy="8" r="1" /></>,
    shirt: <path d="m8 4 4 2 4-2 5 4-3 4-2-2v11H8V10l-2 2-3-4 5-4Z" />,
    box: <><path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" /><path d="m4 7 8 4 8-4m-8 4v10" /></>,
    store: <><path d="M4 10v10h16V10M3 10l2-6h14l2 6" /><path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2M9 20v-5h6v5" /></>,
    basket: <><path d="M3 10h18l-2 10H5L3 10Z" /><path d="m8 10 4-6 4 6M8 14v3m4-3v3m4-3v3" /></>,
    beauty: <><path d="M9 3h6v5l2 3v10H7V11l2-3V3Z" /><path d="M9 7h6M8 13h8" /></>,
    package: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 5v5m6-5v5" /></>,
    restaurant: <><path d="M4 4h16v16H4zM8 8v8m-2-8v3a2 2 0 0 0 4 0V8m5 0v8m0-8c3 2 3 5 0 6" /></>,
    pizza: <><path d="m4 19 8-16 8 16H4Z" /><path d="M7 14h10M11 10h.01M15 15h.01" /></>,
    burger: <><path d="M4 10c1-5 15-5 16 0H4Zm0 4h16M5 14l1 5h12l1-5" /><path d="M7 12h10" /></>,
    cake: <><path d="M5 11h14v9H5zM8 11V8h8v3M9 8V5m6 3V5M9 5c1-2 2-2 2 0m4 0c1-2 2-2 2 0" /></>,
    icecream: <><path d="M7 10h10l-5 11-5-11Z" /><path d="M7 10a5 5 0 0 1 10 0" /></>,
    wine: <><path d="M6 3h12l-2 8a4 4 0 0 1-8 0L6 3Zm6 12v6m-4 0h8" /></>,
    apple: <><path d="M12 8c-5-4-9 0-7 7 1 4 4 6 7 4 3 2 6 0 7-4 2-7-2-11-7-7Z" /><path d="M12 8c0-3 2-5 5-5m-5 4c-2-2-4-2-5-1" /></>,
    delivery: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
    bus: <><rect x="5" y="3" width="14" height="16" rx="3" /><path d="M5 10h14M8 15h.01M16 15h.01M8 19v2m8-2v2" /></>,
    train: <><rect x="6" y="3" width="12" height="15" rx="3" /><path d="M6 10h12M9 14h.01M15 14h.01M8 21l4-3 4 3" /></>,
    bike: <><circle cx="6" cy="17" r="4" /><circle cx="18" cy="17" r="4" /><path d="m6 17 4-8 4 8h-8Zm4-8h5l3 8m-10-8H6" /></>,
    fuel: <><path d="M5 3h9v18H5zM7 7h5" /><path d="M14 8h3l2 2v7a2 2 0 0 0 2 2V9l-2-2" /></>,
    parking: <><circle cx="12" cy="12" r="9" /><path d="M10 17V7h4a3 3 0 0 1 0 6h-4" /></>,
    ship: <><path d="m3 15 9-5 9 5-3 5H6l-3-5ZM8 12V5h8v7M6 21c2 1 4 1 6 0 2 1 4 1 6 0" /></>,
    suitcase: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V4h6v3M8 11v5m8-5v5" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2" /></>,
    laptop: <><rect x="5" y="4" width="14" height="12" rx="1" /><path d="m3 20 2-4h14l2 4H3Z" /></>,
    book: <><path d="M4 5a7 7 0 0 1 8 1v14a7 7 0 0 0-8-1V5Zm16 0a7 7 0 0 0-8 1v14a7 7 0 0 1 8-1V5Z" /></>,
    pencil: <><path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z" /><path d="m14 7 3 3" /></>,
    school: <><path d="m3 10 9-6 9 6M5 10v10h14V10M9 20v-6h6v6" /><path d="M12 7h.01" /></>,
    id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M5 16c1-3 5-3 6 0m3-6h4m-4 4h4" /></>,
    presentation: <><path d="M4 4h16v12H4zM8 20l4-4 4 4" /><path d="m8 12 3-3 2 2 3-4" /></>,
    factory: <><path d="M3 21V9l6 4V9l6 4V5h6v16H3Z" /><path d="M7 17h2m4 0h2m4 0h2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" /></>,
    music: <><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    game: <><path d="M7 8h10a5 5 0 0 1 4 8l-2 3-4-3H9l-4 3-2-3a5 5 0 0 1 4-8Z" /><path d="M7 12v4m-2-2h4m7-1h.01m2 2h.01" /></>,
    running: <><circle cx="15" cy="4" r="2" /><path d="m13 8-3 4 4 3-2 6m1-13 4 3 3-1M10 12l-4-1-3 3m11 1 4 5" /></>,
    swim: <><path d="M4 10l4-3 4 3 3-2 5 3M3 15c2 1 4 1 6 0 2 1 4 1 6 0 2 1 4 1 6 0M3 19c2 1 4 1 6 0 2 1 4 1 6 0 2 1 4 1 6 0" /><circle cx="8" cy="4" r="2" /></>,
    ticket: <><path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 0 0-4V4H3v4Z" /><path d="M12 4v12" /></>,
    camera: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="m8 6 2-3h4l2 3" /><circle cx="12" cy="13" r="4" /></>,
    party: <><path d="m4 20 5-16 11 11-16 5Z" /><path d="m8 7 9 9M14 4l1-2m4 6 3-1m-3-3 2-2" /></>,
    pill: <><path d="M7 18a4 4 0 0 1 0-6l6-6a4 4 0 0 1 6 6l-6 6a4 4 0 0 1-6 0Z" /><path d="m9 10 5 5" /></>,
    doctor: <><circle cx="12" cy="7" r="4" /><path d="M5 21a7 7 0 0 1 14 0M17 16v4m-2-2h4" /></>,
    tooth: <path d="M7 4c2-2 4 0 5 0s3-2 5 0c4 4 0 16-3 16-2 0-1-6-2-6s0 6-2 6C7 20 3 8 7 4Z" />,
    glasses: <><circle cx="7" cy="14" r="4" /><circle cx="17" cy="14" r="4" /><path d="M11 14h2M3 13l2-6m16 6-2-6" /></>,
    spa: <><path d="M12 21c-5-3-7-7-6-12 4 1 6 3 6 7 0-6 3-9 7-10 1 7-1 12-7 15Z" /><path d="M4 21h16" /></>,
    baby: <><circle cx="12" cy="13" r="8" /><path d="M12 5c-2-3 1-4 3-2M9 12h.01M15 12h.01M9 16c2 2 4 2 6 0" /></>,
    accessibility: <><circle cx="12" cy="4" r="2" /><path d="M5 8h14m-7 0v5m0 0-5 8m5-8 5 8" /></>,
    bone: <path d="M7 9a3 3 0 1 1-3-5 3 3 0 0 1 5 3l6 6a3 3 0 1 1 3 5 3 3 0 0 1-5-3L7 9Z" />,
    bird: <><path d="M4 15c5 1 8-2 9-7 3 4 5 5 8 5-4 7-12 8-17 2Z" /><path d="m13 8 2-4 2 4" /></>,
    fish: <><path d="M4 12c4-5 10-5 14 0-4 5-10 5-14 0Zm14 0 3-4v8l-3-4Z" /><circle cx="9" cy="11" r=".5" /></>,
    flower: <><circle cx="12" cy="12" r="2" /><path d="M12 10c-4-6-8-1-3 2-5 1-2 7 2 3 0 6 7 4 4-1 5 2 7-5 1-4 4-3 1-9-3-1Z" /></>,
    tree: <><path d="M12 3 5 13h4l-3 5h12l-3-5h4L12 3Z" /><path d="M12 18v3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19" /></>,
    moon: <path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z" />,
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {p[key] ?? p.star}
    </svg>
  );
}
function CategoryAppearancePicker({
  icon,
  color,
  onIconChange,
  onColorChange,
}: {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}) {
  return (
    <div className="category-appearance-picker">
      <span className="category-editor-label">Elige un icono</span>
      <div className="appearance-groups icon-groups">
        {categoryIconGroups.map((group) => (
          <section className="appearance-group" key={group.name}>
            <h3>{group.name}</h3>
            <div className="symbol-picker">
              {group.icons.map((symbol) => (
                <button
                  type="button"
                  key={symbol}
                  className={icon === symbol ? "symbol-choice selected" : "symbol-choice"}
                  onClick={() => onIconChange(symbol)}
                  aria-label={`Elegir icono de ${symbolLabels[symbol]}`}
                  title={symbolLabels[symbol]}
                  style={{ color, background: `${color}18` }}
                >
                  <CategoryIcon name={symbol} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <span className="category-editor-label">Elige un color</span>
      <div className="appearance-groups color-groups">
        {categoryColorGroups.map((group) => (
          <section className="appearance-group" key={group.name}>
            <h3>{group.name}</h3>
            <div className="color-picker">
              {group.colors.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={color === option ? "color-choice selected" : "color-choice"}
                  style={{ background: option }}
                  onClick={() => onColorChange(option)}
                  aria-label={`Elegir ${group.name.toLocaleLowerCase("es")} ${option}`}
                  title={option}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
function calculateAmount(expression: string) {
  const clean = expression
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace(/−/g, "-");
  if (!/^\d*\.?\d+%?(?:[+-]\d*\.?\d+%?)*$/.test(clean)) return 0;
  const parts = clean.match(/[+-]?\d*\.?\d+%?/g) ?? [];
  let total = 0;
  parts.forEach((part, index) => {
    const percent = part.endsWith("%");
    const sign = part.startsWith("-") ? -1 : 1;
    const numeric = Number(part.replace(/^[+-]/, "").replace("%", ""));
    const value = percent && index > 0 ? total * numeric / 100 : percent ? numeric / 100 : numeric;
    total += sign * value;
  });
  return Math.max(0, Math.round(total * 100) / 100);
}
function AmountCalculator({ defaultValue }: { defaultValue?: number }) {
  const [value, setValue] = useState(
    defaultValue != null ? String(defaultValue).replace(".", ",") : "",
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const result = calculateAmount(value);
  const finish = () => {
    setValue(String(result).replace(".", ","));
    setOpen(false);
  };
  const add = (token: string) =>
    setValue((current) =>
      token === "C"
        ? ""
        : token === "⌫"
          ? current.slice(0, -1)
          : current + token,
    );
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
        finish();
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open, result]);
  return (
    <div className="amount-calculator" ref={rootRef}>
      <input type="hidden" name="amount" value={result} />
      <input
        className="amount-expression"
        inputMode="decimal"
        value={value}
        onChange={(e) =>
          setValue(e.target.value.replace(/[^0-9,%+\-−.\s]/g, ""))
        }
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish();
          }
        }}
        placeholder="0,00 €"
        aria-label="Importe"
        required
      />
      <button
        type="button"
        className="calculator-toggle"
        aria-label={open ? "Cerrar calculadora" : "Abrir calculadora"}
        aria-expanded={open}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => open ? finish() : setOpen(true)}
      ><Icon name="calculator" size={18} /></button>
      {open && (
        <div className="calculator-panel">
          <div className="calculator-result">
            <span>Resultado</span>
            <strong>{money(result)}</strong>
          </div>
          <div className="calculator-keys">
            {[
              "7",
              "8",
              "9",
              "+",
              "4",
              "5",
              "6",
              "−",
              "1",
              "2",
              "3",
              ",",
              "%",
              "C",
              "0",
              "⌫",
            ].map((key) => (
              <button
                type="button"
                key={key}
                className={key === "+" || key === "−" || key === "%" ? "operator" : ""}
                onClick={() => add(key)}
              >
                {key}
              </button>
            ))}
            <button type="button" className="equals" onClick={finish}>
              =
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function nextOccurrence(p: Program) {
  const start = new Date(`${p.start}T12:00:00`);
  const threshold = new Date(`${todayISO}T00:00:00`);
  const d = new Date(start);
  let guard = 0;
  while (d < threshold && guard++ < 1200) {
    const interval = Math.max(1, p.interval ?? 1);
    if (p.frequency === "Semanal") d.setDate(d.getDate() + 7 * interval);
    else
      d.setMonth(
        d.getMonth() +
          (p.frequency === "Anual"
            ? 12
            : p.frequency === "Semestral"
              ? 6
              : p.frequency === "Trimestral"
                ? 3
                : 1) * interval,
      );
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextUnskippedOccurrence(p: Program, skipped: string[] = []) {
  let date = nextOccurrence(p);
  let guard = 0;
  while (skipped.includes(`${p.id}:${date}`) && guard++ < 120) {
    const d = new Date(`${date}T12:00:00`);
    const interval = Math.max(1, p.interval ?? 1);
    if (p.frequency === "Semanal") d.setDate(d.getDate() + 7 * interval);
    else
      d.setMonth(
        d.getMonth() +
          (p.frequency === "Anual"
            ? 12
            : p.frequency === "Semestral"
              ? 6
              : p.frequency === "Trimestral"
                ? 3
                : 1) * interval,
      );
    date = isoDate(d);
  }
  return date;
}
function repairDebtAmortization(
  debts: DebtProfile[],
  movements: Movement[],
  accounts: Account[],
) {
  let repairedMovements = [...movements];
  const repairedDebts = debts.map((debt) => {
    const indexes = repairedMovements
      .map((movement, index) => ({ movement, index }))
      .filter(
        ({ movement }) =>
          movement.kind === "deuda" && movement.target === debt.accountId,
      )
      .sort((a, b) => a.movement.date.localeCompare(b.movement.date));
    const initialPrincipal =
      debt.initialPrincipal ??
      Math.round(
        (debt.principal +
          indexes.reduce(
            (total, { movement }) =>
              total + (movement.principal ?? movement.amount),
            0,
          )) *
          100,
      ) / 100;
    let remaining = initialPrincipal;
    for (const [paymentIndex, { movement, index }] of indexes.entries()) {
      let principal = Math.min(
        remaining,
        movement.principal ?? movement.amount,
      );
      let interest = Math.max(0, movement.amount - principal);
      if (debt.type === "loan" && movement.id.startsWith("scheduled:")) {
        const scheduleRow =
          debt.schedule?.find((row) => row.date === movement.date) ??
          debt.schedule?.[paymentIndex];
        interest =
          scheduleRow?.interest ??
          Math.round(((remaining * debt.tin) / 100 / 12) * 100) / 100;
        principal = Math.min(
          remaining,
          scheduleRow?.principal ??
            Math.max(0, Math.round((movement.amount - interest) * 100) / 100),
        );
        repairedMovements[index] = { ...movement, principal, interest };
      }
      remaining = Math.max(0, Math.round((remaining - principal) * 100) / 100);
    }
    return { ...debt, initialPrincipal, principal: remaining };
  });
  const byAccount = Object.fromEntries(
    repairedDebts.map((debt) => [debt.accountId, debt.principal]),
  );
  return {
    debts: repairedDebts,
    movements: repairedMovements,
    accounts: accounts.map((account) =>
      byAccount[account.id] === undefined
        ? account
        : { ...account, balance: byAccount[account.id] },
    ),
  };
}

type BetaStats = {
  registered: number;
  started: number;
  active7: number;
  active30: number;
  adClicks: number;
  affiliateClicks: number;
  subscribers: number;
  capacity: {
    profileCount: number; stateBytes: number; storageLimitBytes: number; storagePercent: number;
    averageProfileBytes: number; largestProfileBytes: number; profileLimitBytes: number; largestProfilePercent: number;
    nextUserReview: number;
    alerts: Array<{ level: "good" | "info" | "warning" | "critical"; title: string; message: string }>;
  };
  feedback: Array<{ id: number; type: string; message: string; context: string; email: string; createdAt: number }>;
};
const formatStorage = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`
  : `${Math.max(0, bytes / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} KB`;

export default function Finance({
  email,
  displayName,
  isBetaAdmin = false,
  betaStats,
  plan,
  vipActive,
  vipRemaining,
  onRefreshAccount,
  onSignOut,
  spaces,
  activeSpaceId,
  onSwitchSpace,
  savedAccounts,
  currentUserId,
  onSwitchAccount,
  onAddAccount,
  onForgetAccount,
}: {
  email: string;
  displayName: string;
  isBetaAdmin?: boolean;
  betaStats?: BetaStats;
  plan: "free" | "vip";
  vipActive: boolean;
  vipRemaining: number;
  onRefreshAccount: () => Promise<unknown>;
  onSignOut: () => Promise<void>;
  spaces: FinanceSpace[];
  activeSpaceId: string;
  onSwitchSpace: (spaceId: string) => void;
  savedAccounts: Array<{ userId: string; email: string }>;
  currentUserId: string;
  onSwitchAccount: (userId: string) => Promise<void>;
  onAddAccount: () => void;
  onForgetAccount: (userId: string) => void;
}) {
  const [refundSource, setRefundSource] = useState<Movement | null>(null);
  const [pendingAccountDelete, setPendingAccountDelete] =
    useState<Account | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [accountKind, setAccountKind] = useState<AccountKind>("corriente");
  const [accountIcon, setAccountIcon] = useState("bank");
  const [accountColor, setAccountColor] = useState(categoryColors[0]);
  const [collapsedAccountGroups, setCollapsedAccountGroups] = useState<
    AccountKind[]
  >([]);
  const [hiddenAccountGroups, setHiddenAccountGroups] = useState<AccountKind[]>(
    [],
  );
  const [debtAmountsHidden, setDebtAmountsHidden] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<string[]>([]);
  const [debtCreateRequest, setDebtCreateRequest] = useState(0);
  const [data, setData] = useState<Data>(createEmptyData);
  const [tab, setTab] = useState<Tab>("cuentas");
  const [movementSection, setMovementSection] = useState<
    "movimientos" | "recurrentes"
  >("movimientos");
  const [modal, setModal] = useState<"movement" | "account" | "program" | null>(
    null,
  );
  const [edit, setEdit] = useState<Movement | null>(null);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [editProgram, setEditProgram] = useState<Program | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicatingMovement, setDuplicatingMovement] = useState(false);
  const [upOpen, setUpOpen] = useState(true);
  const [period, setPeriod] = useState("mes");
  const [filter, setFilter] = useState("todos");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementCategoryFilter, setMovementCategoryFilter] = useState("todas");
  const [movementAccountFilter, setMovementAccountFilter] = useState("todas");
  const [movementSubcategoryFilter, setMovementSubcategoryFilter] = useState("todas");
  const [movementMinAmount, setMovementMinAmount] = useState("");
  const [movementMaxAmount, setMovementMaxAmount] = useState("");
  const [categoryView, setCategoryView] = useState<
    "patrimonio" | "gastos" | "distribucion" | "mis-categorias"
  >("patrimonio");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [spaceForm, setSpaceForm] = useState<"create" | "edit" | "invite" | "delete" | null>(null);
  const [spaceActionId, setSpaceActionId] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState("");
  const [spaceKind, setSpaceKind] = useState<"personal" | "demo" | "shared">("personal");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [spaceBusy, setSpaceBusy] = useState(false);
  const [spaceMessage, setSpaceMessage] = useState("");
  const [deleteSpaceText, setDeleteSpaceText] = useState("");
  const [settingsSection, setSettingsSection] = useState<"general" | "cuenta" | "periodos" | "categorias" | "datos" | "informes" | "plan" | "ayuda" | "acerca" | "beta" | null>(null);
  const [openBalancePanels, setOpenBalancePanels] = useState<string[]>(["liquid", "investments", "non-current"]);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorialStartedRef = useRef(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [confirmRestoreCategories, setConfirmRestoreCategories] = useState(false);
  const [confirmDeleteData, setConfirmDeleteData] = useState(false);
  const [vipCheckoutBusy, setVipCheckoutBusy] = useState(false);
  const [vipCheckoutMessage, setVipCheckoutMessage] = useState("");
  const [vipTermsAccepted, setVipTermsAccepted] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? spaces[0];
  const managedSpace = spaces.find((space) => space.id === spaceActionId) ?? activeSpace;
  const isSpaceReadOnly = activeSpace?.role === "viewer";
  const deviceAccounts = savedAccounts.some((account) => account.userId === currentUserId)
    ? savedAccounts
    : [{ userId: currentUserId, email }, ...savedAccounts];

  useEffect(() => {
    const timers = new WeakMap<HTMLDetailsElement, number>();
    const closeTips = (except?: HTMLDetailsElement) => {
      document.querySelectorAll<HTMLDetailsElement>("details.info-tip[open]").forEach((tip) => {
        if (tip !== except) tip.removeAttribute("open");
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest("details.info-tip")) closeTips();
    };
    const onToggle = (event: Event) => {
      const tip = event.target as HTMLDetailsElement;
      if (!tip.matches?.("details.info-tip") || !tip.open) return;
      closeTips(tip);
      const previous = timers.get(tip);
      if (previous) window.clearTimeout(previous);
      timers.set(tip, window.setTimeout(() => tip.removeAttribute("open"), 7000));
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);

  const spaceHeaders = { "x-mizufi-space-id": activeSpaceId };

  const createSpace = async () => {
    if (!spaceName.trim()) { setSpaceMessage("Escribe un nombre para el espacio."); return; }
    setSpaceBusy(true); setSpaceMessage("");
    try {
      const response = await authenticatedFetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: spaceName, kind: spaceKind }),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "No se ha podido crear el espacio");
      await onRefreshAccount();
      onSwitchSpace(result.id);
      setSpaceForm(null); setSpaceMenuOpen(false); setSpaceName("");
    } catch (error) {
      setSpaceMessage(error instanceof Error ? error.message : "No se ha podido crear el espacio.");
    } finally { setSpaceBusy(false); }
  };

  const inviteMember = async () => {
    if (!activeSpace || (activeSpace.kind !== "shared" && activeSpace.kind !== "demo")) return;
    setSpaceBusy(true); setSpaceMessage("");
    try {
      const response = await authenticatedFetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", spaceId: activeSpace.id, email: inviteEmail, role: inviteRole }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se ha podido enviar la invitación");
      await onRefreshAccount();
      setInviteEmail(""); setSpaceForm(null);
      setSpaceMessage("Invitación preparada. El espacio aparecerá al iniciar sesión con ese correo.");
    } catch (error) {
      setSpaceMessage(error instanceof Error ? error.message : "No se ha podido enviar la invitación.");
    } finally { setSpaceBusy(false); }
  };

  const updateSpace = async () => {
    if (!managedSpace) return;
    setSpaceBusy(true); setSpaceMessage("");
    try {
      const response = await authenticatedFetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", spaceId: managedSpace.id, name: spaceName, kind: spaceKind }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se ha podido actualizar el espacio");
      await onRefreshAccount();
      setSpaceForm(null); setSpaceActionId(null); setSpaceMessage("Espacio actualizado.");
    } catch (error) {
      setSpaceMessage(error instanceof Error ? error.message : "No se ha podido actualizar el espacio.");
    } finally { setSpaceBusy(false); }
  };

  const deleteOrLeaveSpace = async () => {
    if (!managedSpace) return;
    const isOwner = managedSpace.role === "owner";
    if (isOwner && deleteSpaceText.trim().toUpperCase() !== "ELIMINAR") {
      setSpaceMessage("Escribe ELIMINAR para confirmar.");
      return;
    }
    setSpaceBusy(true); setSpaceMessage("");
    try {
      const response = await authenticatedFetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", spaceId: managedSpace.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se ha podido eliminar el espacio");
      const nextAccount = await onRefreshAccount() as { spaces?: FinanceSpace[] };
      const nextSpace = nextAccount.spaces?.find((space) => space.id !== managedSpace.id) ?? nextAccount.spaces?.[0];
      if (managedSpace.id === activeSpaceId && nextSpace) onSwitchSpace(nextSpace.id);
      setSpaceForm(null); setSpaceActionId(null); setSpaceMenuOpen(false); setDeleteSpaceText("");
    } catch (error) {
      setSpaceMessage(error instanceof Error ? error.message : "No se ha podido eliminar el espacio.");
    } finally { setSpaceBusy(false); }
  };

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("vip");
    if (status === "cancelled") {
      setVipCheckoutMessage("Pago cancelado. No se ha realizado ningún cargo.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (status !== "success") return;
    setSettingsOpen(true);
    setSettingsSection("plan");
    setVipCheckoutMessage("Pago recibido. Estamos activando tu acceso VIP…");
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      const next = await onRefreshAccount() as { vipActive?: boolean };
      if (next.vipActive) {
        setVipCheckoutMessage("¡Ya eres VIP! Tu acceso sin publicidad es para siempre.");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (attempts < 5) {
        window.setTimeout(check, 1200);
      } else {
        setVipCheckoutMessage("El pago está confirmado. La activación puede tardar unos segundos; vuelve a abrir Mi plan.");
      }
    };
    void check();
  }, [onRefreshAccount]);

  const startVipCheckout = async () => {
    if (!vipTermsAccepted) {
      setVipCheckoutMessage("Lee y acepta las condiciones de compra para continuar.");
      return;
    }
    setVipCheckoutBusy(true);
    setVipCheckoutMessage("");
    try {
      const response = await authenticatedFetch("/api/vip/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedTerms: true }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "El pago todavía no está disponible");
      window.location.assign(result.url);
    } catch (error) {
      setVipCheckoutMessage(error instanceof Error ? error.message : "No se ha podido abrir el pago");
      setVipCheckoutBusy(false);
    }
  };
  const [assetDraft, setAssetDraft] = useState({ name: "", kind: "Vivienda", value: "" });
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [editingValuation, setEditingValuation] = useState<{ assetId: string; index: number; value: string } | null>(null);
  const [assetFormOpen, setAssetFormOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("Deporte");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [kind, setKind] = useState<MovementKind>("gasto");
  const [cat, setCat] = useState("Alimentación");
  const [subcat, setSubcat] = useState("");
  const [quickSubcategoryOpen, setQuickSubcategoryOpen] = useState(false);
  const [quickSubcategoryName, setQuickSubcategoryName] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState<string | null>(null);
  const [draggingAccount, setDraggingAccount] = useState<string | null>(null);
  const draggingAccountRef = useRef<Account | null>(null);
  const [programMenu, setProgramMenu] = useState<string | null>(null);
  const [programSearch, setProgramSearch] = useState("");
  const [programCategoryFilter, setProgramCategoryFilter] = useState("todas");
  const [showArchived, setShowArchived] = useState(false);
  const [showArchivedPrograms, setShowArchivedPrograms] = useState(false);
  const [categoryEditor, setCategoryEditor] =
    useState<CategoryDefinition | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("⭐");
  const [categoryColor, setCategoryColor] = useState(categoryColors[0]);
  const [categoryBucket, setCategoryBucket] = useState<"needs" | "wants" | "savings">("wants");
  const [subcategoryEditor, setSubcategoryEditor] = useState<{
    categoryId: string;
    original?: string;
  } | null>(null);
  const [subcategoryName, setSubcategoryName] = useState("");
  const [pendingCategoryRemoval, setPendingCategoryRemoval] = useState<{
    categoryId: string;
    subcategory?: string;
  } | null>(null);
  const [expandedManagedCategory, setExpandedManagedCategory] = useState<
    string | null
  >(null);
  const [managedSubcategoryMenu, setManagedSubcategoryMenu] = useState<
    string | null
  >(null);
  useEffect(() => {
    authenticatedFetch("/api/finance", { headers: spaceHeaders })
      .then((r) => (r.ok ? r.json() : null))
      .then((saved) => {
        if (!saved || !Array.isArray(saved.accounts)) throw new Error("finance-load");
        if (saved && Array.isArray(saved.accounts)) {
          const debtProfiles: DebtProfile[] =
            saved.debts ??
            saved.accounts
              .filter(
                (account: Account) =>
                  account.kind === "deuda" && !account.archived,
              )
              .map((account: Account) => {
                const program = (saved.programs ?? []).find(
                  (item: Program) =>
                    item.target === account.id && item.kind === "deuda",
                );
                return {
                  id: `migrated-${account.id}`,
                  accountId: account.id,
                  type: "loan",
                  name: account.name,
                  principal: account.balance,
                  tin: 0,
                  monthlyPayment: program?.amount ?? 0,
                  remainingTerms: undefined,
                  nextPaymentDate: program ? nextOccurrence(program) : todayISO,
                  paymentAccount:
                    program?.account ??
                    saved.accounts.find(
                      (item: Account) => item.kind === "corriente",
                    )?.id ??
                    "",
                  maturityDate: program?.end,
                };
              });
          const repaired = repairDebtAmortization(
            debtProfiles,
            saved.movements ?? [],
            saved.accounts,
          );
          const restored = {
            ...saved,
            ...repaired,
            trash: (saved.trash ?? []).filter(
              (item: TrashItem) => new Date(item.expiresAt).getTime() > Date.now(),
            ),
            accounts: repaired.accounts.map((account: Account) => ({
              ...account,
              icon: categoryIconChoices.includes(
                legacySymbols[account.icon] ?? account.icon,
              )
                ? (legacySymbols[account.icon] ?? account.icon)
                : defaultAccountIcons[account.kind],
            })),
            programs:
              saved.programs?.map((program: Program) => ({
                ...program,
                active: true,
                end: normalizedProgramEnd(program.start, program.end),
              })) ?? [],
            categories: saved.categories?.map(
              (category: CategoryDefinition) => ({
                ...category,
                archived: false,
                subcategories: category.subcategories.map((subcategory) => ({
                  ...subcategory,
                  archived: false,
                })),
              }),
            ),
          };
          setData(restored);
          const openingPeriod = saved.preferences?.rememberLastPeriod === false
            ? (saved.preferences?.defaultPeriod ?? "mes")
            : (saved.preferences?.period ?? saved.preferences?.defaultPeriod ?? "mes");
          setPeriod(openingPeriod);
          const savedTab = saved.preferences?.lastTab as Tab | undefined;
          if (["cuentas", "movimientos", "deudas", "presupuestos", "categorias"].includes(savedTab ?? "")) setTab(savedTab!);
          if (["movimientos", "recurrentes"].includes(saved.preferences?.lastMovementSection ?? "")) setMovementSection(saved.preferences.lastMovementSection);
          setUpOpen(saved.preferences?.upcomingOpen ?? true);
          setCollapsedAccountGroups(saved.preferences?.collapsedAccountGroups ?? []);
          setCollapsedDays(saved.preferences?.collapsedMovementDays ?? []);
          setShowArchived(saved.preferences?.showArchivedAccounts ?? false);
          setShowArchivedPrograms(saved.preferences?.showArchivedPrograms ?? false);
          setOpenBalancePanels(saved.preferences?.openBalancePanels ?? ["liquid", "investments", "non-current"]);
          setExpandedManagedCategory(saved.preferences?.expandedManagedCategory ?? null);
          setTutorialStep(saved.preferences?.onboardingStep ?? 0);
          if (saved.preferences?.hideAmountsOnOpen) {
            setHiddenAccountGroups(["corriente", "ahorro", "hucha", "inversion"]);
          }
          setDebtAmountsHidden(
            saved.preferences?.hideAmountsOnOpen
              ? true
              : (saved.preferences?.debtAmountsHidden ?? false),
          );
        }
        setLastSavedAt(new Date());
        setReady(true);
      })
      .catch(() => { setLoadError(true); setReady(true); });
  }, []);
  useEffect(() => {
    if (!ready || isSpaceReadOnly) return;
    setSaveState("saving");
    const t = setTimeout(() => {
      authenticatedFetch("/api/finance", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...spaceHeaders },
        body: JSON.stringify(data),
      })
        .then((response) => {
          setSaveState(response.ok ? "saved" : "error");
          if (response.ok) setLastSavedAt(new Date());
        })
        .catch(() => setSaveState("error"));
    }, 450);
    return () => clearTimeout(t);
  }, [data, ready, isSpaceReadOnly]);
  useEffect(() => {
    if (!ready || tutorialStartedRef.current) return;
    tutorialStartedRef.current = true;
    if (data.preferences?.onboardingCompleted !== true) {
      setTutorialStep(Math.min(data.preferences?.onboardingStep ?? 0, tutorialSteps.length - 1));
      setTutorialOpen(true);
    }
  }, [ready, data.preferences?.onboardingCompleted, data.preferences?.onboardingStep]);
  useEffect(() => {
    if (!ready) return;
    setData((old) => {
      const movedPrograms = old.programs.filter(
        (program) =>
          !program.archived &&
          program.active !== false &&
          program.start > todayISO &&
          old.movements.some((movement) => movement.id === `scheduled:${program.id}:${todayISO}`),
      );
      if (!movedPrograms.length) return old;
      const orphanIds = new Set(movedPrograms.map((program) => `scheduled:${program.id}:${todayISO}`));
      const orphaned = old.movements.filter((movement) => orphanIds.has(movement.id));
      let accounts = old.accounts;
      let debts = old.debts;
      for (const movement of orphaned) {
        const sourceDelta = movementAccountDelta(movement, movement.account, debts);
        const targetDelta = movement.kind === "deuda" ? -(movement.principal ?? movement.amount) : movement.amount;
        debts = changeDebtCapital(debts, movement.account, -sourceDelta);
        if (movement.target) debts = changeDebtCapital(debts, movement.target, -targetDelta);
        accounts = accounts.map((account) => {
          let balance = account.balance;
          if (account.id === movement.account) balance -= sourceDelta;
          if (account.id === movement.target) balance -= targetDelta;
          return balance === account.balance ? account : { ...account, balance };
        });
      }
      return { ...old, accounts, debts, movements: old.movements.filter((movement) => !orphanIds.has(movement.id)) };
    });
  }, [ready, data.programs]);
  useEffect(() => {
    document.querySelectorAll(".tour-highlight").forEach((element) => element.classList.remove("tour-highlight"));
    if (!tutorialOpen) return;
    const step = tutorialSteps[tutorialStep];
    if (step.tab) setTab(step.tab);
    if (step.movementSection) setMovementSection(step.movementSection);
    const timer = window.setTimeout(() => {
      if (!step.target) return;
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      target?.classList.add("tour-highlight");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => {
      window.clearTimeout(timer);
      document.querySelectorAll(".tour-highlight").forEach((element) => element.classList.remove("tour-highlight"));
    };
  }, [tutorialOpen, tutorialStep]);
  useEffect(() => {
    if (!ready) return;
    setData((old) => {
      const recentStart = new Date(`${todayISO}T12:00:00`);
      recentStart.setDate(recentStart.getDate() - 31);
      const due = old.programs
        .filter(
          (program) =>
            program.kind === "deuda" &&
            !program.archived &&
            program.active !== false &&
            program.start <= todayISO,
        )
        .flatMap((program) =>
          programOccurrences(
            program,
            recentStart,
            new Date(`${todayISO}T12:00:00`),
          ).map((date) => ({ program, date })),
        )
        .filter(
          ({ program, date }) =>
            !old.skippedOccurrences?.includes(`${program.id}:${date}`) &&
            !old.movements.some(
              (movement) =>
                movement.id === `scheduled:${program.id}:${date}`,
            ),
        );
      if (!due.length) return old;
      let accounts = old.accounts;
      let debts = old.debts ?? [];
      const movements = [...old.movements];
      for (const { program, date } of due) {
        const debt = debts.find((item) => item.id === program.debtId);
        const scheduleRow = debt?.schedule?.find(
          (row) => row.date === date,
        );
        const interest =
          scheduleRow?.interest ??
          (debt?.type === "loan"
            ? Math.round(((debt.principal * debt.tin) / 100 / 12) * 100) / 100
            : Math.max(0, program.interest ?? 0));
        const principal = Math.min(
          debt?.principal ?? program.amount,
          scheduleRow?.principal ??
            Math.max(0, Math.round((program.amount - interest) * 100) / 100),
        );
        movements.push({
          id: `scheduled:${program.id}:${date}`,
          date,
          name: [program.category, program.subcategory]
            .filter(Boolean)
            .join(" · "),
          amount: program.amount,
          kind: "deuda",
          account: program.account,
          target: program.target,
          category: program.category,
          subcategory: program.subcategory,
          notes: program.notes,
          principal,
          interest,
          scheduled: true,
        });
        accounts = accounts.map((account) =>
          account.id === program.account
            ? { ...account, balance: account.balance - program.amount }
            : account.id === program.target
              ? {
                  ...account,
                  balance: Math.max(0, account.balance - principal),
                }
              : account,
        );
        if (program.debtId)
          debts = debts.map((item) =>
            item.id === program.debtId
              ? {
                  ...item,
                  principal: Math.max(
                    0,
                    Math.round((item.principal - principal) * 100) / 100,
                  ),
                }
              : item,
          );
      }
      return { ...old, accounts, debts, movements };
    });
  }, [ready, data.programs]);
  useEffect(() => {
    if (!ready) return;
    setData((old) => {
      const legacyFuture = old.movements.filter(
        (movement) =>
          movement.date > todayISO &&
          !movement.scheduled &&
          !movement.planned,
      );
      const due = old.movements.filter(
        (movement) => movement.planned && movement.date <= todayISO,
      );
      if (!legacyFuture.length && !due.length) return old;

      let accounts = old.accounts;
      let debts = old.debts;
      for (const movement of legacyFuture) {
        const sourceDelta = movementAccountDelta(
          movement,
          movement.account,
          debts,
        );
        const targetDelta =
          movement.kind === "deuda"
            ? -(movement.principal ?? movement.amount)
            : movement.amount;
        debts = changeDebtCapital(debts, movement.account, -sourceDelta);
        if (movement.target)
          debts = changeDebtCapital(debts, movement.target, -targetDelta);
        accounts = accounts.map((account) => {
          let balance = account.balance;
          if (account.id === movement.account) balance -= sourceDelta;
          if (account.id === movement.target) balance -= targetDelta;
          return balance === account.balance ? account : { ...account, balance };
        });
      }
      for (const movement of due) {
        const sourceDelta = movementAccountDelta(
          movement,
          movement.account,
          debts,
        );
        const targetDelta =
          movement.kind === "deuda"
            ? -(movement.principal ?? movement.amount)
            : movement.amount;
        debts = changeDebtCapital(debts, movement.account, sourceDelta);
        if (movement.target)
          debts = changeDebtCapital(debts, movement.target, targetDelta);
        accounts = accounts.map((account) => {
          let balance = account.balance;
          if (account.id === movement.account) balance += sourceDelta;
          if (account.id === movement.target) balance += targetDelta;
          return balance === account.balance ? account : { ...account, balance };
        });
      }
      return {
        ...old,
        accounts,
        debts,
        movements: old.movements.map((movement) =>
          legacyFuture.some((item) => item.id === movement.id)
            ? { ...movement, planned: true }
            : due.some((item) => item.id === movement.id)
              ? { ...movement, planned: undefined }
              : movement,
        ),
      };
    });
  }, [ready, data.movements]);
  useEffect(() => {
    if (!ready) return;
    const recentStart = new Date(`${todayISO}T12:00:00`);
    recentStart.setDate(recentStart.getDate() - 31);
    setData((old) => {
      const occurrences = old.programs
        .filter(
          (program) =>
            program.kind !== "deuda" &&
            !program.archived &&
            program.active !== false &&
            program.start <= todayISO,
        )
        .flatMap((program) =>
          programOccurrences(
            program,
            recentStart,
            new Date(`${todayISO}T12:00:00`),
          ).map((date) => ({ program, date })),
        )
        .filter(
          ({ program, date }) =>
            !old.skippedOccurrences?.includes(`${program.id}:${date}`) &&
            !old.movements.some(
              (movement) =>
                movement.id === `scheduled:${program.id}:${date}`,
            ),
        );
      if (!occurrences.length) return old;
      let accounts = old.accounts;
      const movements = [...old.movements];
      for (const { program, date } of occurrences) {
        const movement: Movement = {
          id: `scheduled:${program.id}:${date}`,
          date,
          name: program.name,
          amount: program.amount,
          kind: program.kind,
          account: program.account,
          target: program.target,
          category: program.category,
          subcategory: program.subcategory,
          notes: program.notes,
          scheduled: true,
        };
        const sourceDelta = movementAccountDelta(
          movement,
          movement.account,
          old.debts,
        );
        accounts = accounts.map((account) =>
          account.id === movement.account
            ? { ...account, balance: account.balance + sourceDelta }
            : account.id === movement.target
              ? { ...account, balance: account.balance + movement.amount }
              : account,
        );
        movements.push(movement);
      }
      return { ...old, accounts, movements };
    });
  }, [ready, data.programs]);
  useEffect(() => {
    if (modal !== "program") return;
    const frame = requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        '.modal input[name="name"]',
      );
      if (input) {
        input.required = false;
        input.closest("label")?.classList.add("legacy-concept-field");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [modal, editProgram, duplicating]);
  useEffect(() => {
    if (modal === "account") {
      const nextKind = editAccount?.kind ?? "corriente";
      setAccountKind(nextKind);
      setAccountIcon(
        editAccount &&
          categoryIconChoices.includes(
            legacySymbols[editAccount.icon] ?? editAccount.icon,
          )
          ? (legacySymbols[editAccount.icon] ?? editAccount.icon)
          : defaultAccountIcons[nextKind],
      );
      setAccountColor(editAccount?.color ?? categoryColors[0]);
    }
  }, [modal, editAccount]);
  const categoryDefinitions =
    data.categories?.length ? data.categories : defaultCategoryDefinitions;
  const catalogCategoryDefinitions = useMemo(
    () => currentCategoryCatalog(categoryDefinitions),
    [categoryDefinitions],
  );
  const categories = useMemo(
    () =>
      Object.fromEntries(
        catalogCategoryDefinitions.map((category) => [
          category.name,
          category.subcategories.map((subcategory) => subcategory.name),
        ]),
      ),
    [catalogCategoryDefinitions],
  );
  const categoryDefinition = (name: string) => {
    const key = categoryCatalogKey(name);
    return catalogCategoryDefinitions.find(
      (category) => categoryCatalogKey(category.name) === key,
    );
  };
  const activeCategoryDefinitions = catalogCategoryDefinitions.filter(
    (category) => category.name !== "Traspasos",
  );
  const selectableCategoryDefinitions = catalogCategoryDefinitions.filter(
    (category) => category.name !== "Traspasos",
  );
  useEffect(() => {
    if (!modal || modal === "account") return;
    const initialSubcategory =
      editProgram?.subcategory ??
      edit?.subcategory ??
      refundSource?.subcategory ??
      "";
    setSubcat(
      (categories[cat] ?? []).includes(initialSubcategory)
        ? initialSubcategory
        : "",
    );
  }, [modal, editProgram, edit, refundSource, cat]);

  function createQuickSubcategory() {
    const name = quickSubcategoryName.trim();
    if (!name) return;
    const category = categoryDefinitions.find((item) => item.name === cat);
    if (!category) return;
    const existing = category.subcategories.find(
      (item) => item.name.localeCompare(name, "es", { sensitivity: "base" }) === 0,
    );
    const selectedName = existing?.name ?? name;
    if (!existing) {
      setData((old) => ({
        ...old,
        categories: (old.categories?.length ? old.categories : defaultCategoryDefinitions).map(
          (item) => item.id === category.id
            ? { ...item, subcategories: [...item.subcategories, { name, archived: false }] }
            : item,
        ),
      }));
      toast(`Subcategoría «${name}» creada en ${cat}`);
    }
    setSubcat(selectedName);
    setQuickSubcategoryName("");
    setQuickSubcategoryOpen(false);
  }
  useEffect(() => {
    if (modal && modal !== "account" && kind === "ingreso" && cat !== "Ingresos") {
      setCat("Ingresos");
      setCategoryPickerOpen(false);
    }
  }, [modal, kind, cat]);
  const byId = useMemo(
    () => Object.fromEntries(data.accounts.map((a) => [a.id, a])),
    [data.accounts],
  );
  const programTitle = (p: Program) =>
    p.kind === "traspaso"
      ? `Traspaso a ${byId[p.target ?? ""]?.name ?? "otra cuenta"}`
      : [p.category, p.subcategory].filter(Boolean).join(" · ");
  const activeAccounts = data.accounts.filter((a) => !a.archived);
  const archivedAccounts = data.accounts.filter((a) => a.archived);
  const currentPrograms = data.programs
    .filter((p) => !p.archived && (!p.occurrences || programOccurrences(p, new Date(`${p.start}T12:00:00`), new Date("2200-12-31T12:00:00")).at(-1)! >= todayISO))
    .map((p) => ({ ...p, name: programTitle(p) }));
  const visiblePrograms = currentPrograms.filter((program) => {
    const query = programSearch.trim().toLocaleLowerCase("es");
    const matchesSearch = !query || [program.name, program.category, program.subcategory, byId[program.account]?.name]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("es").includes(query));
    const matchesCategory = programCategoryFilter === "todas" || program.category === programCategoryFilter;
    return matchesSearch && matchesCategory;
  });
  const archivedPrograms = data.programs
    .filter((p) => p.archived)
    .map((p) => ({ ...p, name: programTitle(p) }));
  const included = activeAccounts.filter(
    (a) => a.included && a.kind !== "deuda",
  );
  const current = included.reduce((n, a) => n + a.balance, 0);
  const cycleStartDay = data.preferences?.cycleStartDay ?? 28;
  const firstDayOfWeek = data.preferences?.firstDayOfWeek ?? 1;
  const selectedPeriod = periodBounds(period, cycleStartDay, periodOffset, firstDayOfWeek);
  const changePeriod = (next: string) => {
    setPeriod(next);
    setPeriodOffset(0);
    setData((old) => ({
      ...old,
      preferences: {
        ...old.preferences,
        period: next,
        cycleStartDay: old.preferences?.cycleStartDay ?? 28,
      },
    }));
  };
  const changeCycleStartDay = (day: number) => {
    setPeriodOffset(0);
    setData((old) => ({
      ...old,
      preferences: {
        ...old.preferences,
        period: "personalizado",
        cycleStartDay: day,
      },
    }));
  };
  const matchesPeriod = (date: string) => {
    const d = new Date(`${date}T12:00:00`);
    return d >= selectedPeriod.start && d <= selectedPeriod.end;
  };
  const impact = (m: {
    kind: MovementKind;
    amount: number;
    account: string;
    target?: string;
  }) =>
    m.kind === "ingreso" || m.kind === "devolucion"
      ? m.amount
      : m.kind === "traspaso" &&
          !byId[m.account]?.included &&
          byId[m.target ?? ""]?.included
        ? m.amount
        : -m.amount;
  const worth = activeAccounts.reduce(
    (n, a) => n + (a.kind === "deuda" ? -a.balance : a.balance),
    0,
  );
  const periodMovements = data.movements.filter(
    (m) => matchesPeriod(m.date) && m.date <= todayISO && !m.planned,
  );
  const isIncomeAccount = (accountId: string) => {
    const account = byId[accountId];
    return !!account && !account.archived && account.kind !== "deuda";
  };
  const incomeMovements = periodMovements.filter(
    (movement) => movement.kind === "ingreso" && isIncomeAccount(movement.account),
  );
  const income = incomeMovements.reduce((total, movement) => total + movement.amount, 0);
  const expenses = periodMovements
    .filter(
      (m) =>
        ["gasto", "deuda", "devolucion"].includes(m.kind) &&
        m.category !== "Ingresos" &&
        m.category !== "Traspasos",
    )
    .map((m) => ({
      ...m,
      amount: m.kind === "devolucion" ? -m.amount : m.amount,
    }));
  const totalExpenses = Math.max(
    0,
    expenses.reduce((total, m) => total + m.amount, 0),
  );
  const transferContributions = periodMovements
    .filter(
      (m) =>
        m.kind === "traspaso" &&
        byId[m.account]?.kind === "corriente" &&
        ["ahorro", "hucha", "inversion"].includes(byId[m.target ?? ""]?.kind),
    )
    .map((m) => ({
      category:
        byId[m.target ?? ""]?.kind === "inversion"
          ? "Inversión"
          : byId[m.target ?? ""]?.kind === "hucha"
            ? "Huchas"
            : "Ahorro",
      name: byId[m.target ?? ""]?.name ?? "Destino",
      amount: m.amount,
    }));
  const directIncomeContributions = incomeMovements
    .filter((movement) => ["ahorro", "hucha", "inversion"].includes(byId[movement.account]?.kind))
    .map((movement) => ({
      category:
        byId[movement.account]?.kind === "inversion"
          ? "Inversión"
          : byId[movement.account]?.kind === "hucha"
            ? "Huchas"
            : "Ahorro",
      name: byId[movement.account]?.name ?? "Cuenta",
      amount: movement.amount,
    }));
  const contributions = [...transferContributions, ...directIncomeContributions];
  const allocatedTotal =
    totalExpenses + contributions.reduce((total, m) => total + m.amount, 0);
  const categoryRows = Object.entries(
    expenses.reduce<
      Record<string, { total: number; subs: Record<string, number> }>
    >((all, m) => {
      all[m.category] ??= { total: 0, subs: {} };
      all[m.category].total += m.amount;
      all[m.category].subs[m.subcategory] =
        (all[m.category].subs[m.subcategory] ?? 0) + m.amount;
      return all;
    }, {}),
  )
    .filter(([, value]) => value.total > 0)
    .sort((a, b) => b[1].total - a[1].total);
  const distributionRows = [
    { name: "Gastos", total: totalExpenses, color: "#bd8b70" },
    ...[
      { name: "Huchas", color: "#a38ba3" },
      { name: "Ahorro", color: "#68877b" },
      { name: "Inversión", color: "#778ba3" },
    ].map((item) => ({
      ...item,
      total: contributions
        .filter((m) => m.category === item.name)
        .reduce((total, m) => total + m.amount, 0),
    })),
  ].filter((item) => item.total > 0);
  const liquidAssets = activeAccounts
    .filter((account) => ["corriente", "ahorro", "hucha"].includes(account.kind))
    .reduce((total, account) => total + account.balance, 0);
  const investmentAssets = activeAccounts
    .filter((account) => account.kind === "inversion")
    .reduce((total, account) => {
      const history = data.investmentValuations?.[account.id] ?? [];
      return total + (history.at(-1)?.value ?? account.balance);
    }, 0);
  const nonLiquidAssets = (data.manualAssets ?? []).reduce(
    (total, asset) => total + asset.value,
    0,
  );
  const debtTotal = (data.debts ?? []).reduce(
    (total, debt) => total + Math.max(0, debt.principal),
    0,
  );
  const netWorth = liquidAssets + investmentAssets + nonLiquidAssets - debtTotal;
  const necessaryNames = new Set(["Alimentación", "Vivienda", "Transporte", "Salud", "Deudas"]);
  const ruleBucketForMovement = (movement: { category: string }) =>
    categoryDefinition(movement.category)?.bucket ??
    (necessaryNames.has(movement.category) ? "needs" : "wants");
  const allocationBucketForMovement = (movement: {
    kind: MovementKind;
    account: string;
    target?: string;
  }): "needs" | "wants" | "savings" | null => {
    if (movement.kind === "ingreso") {
      const account = byId[movement.account];
      if (account?.kind === "ahorro" || account?.kind === "inversion") return "savings";
      if (account?.kind === "hucha") return account.bucket ?? null;
      return null;
    }
    if (movement.kind !== "traspaso" || byId[movement.account]?.kind !== "corriente") return null;
    const target = byId[movement.target ?? ""];
    if (target?.kind === "ahorro" || target?.kind === "inversion")
      return "savings";
    if (target?.kind === "hucha") return target.bucket ?? null;
    return null;
  };
  const ruleExpenses = expenses.filter(
    (movement) => byId[movement.account]?.kind !== "hucha",
  );
  const currentAllocationTotal = (
    bucket: "needs" | "wants" | "savings",
  ) =>
    periodMovements
      .filter((movement) => allocationBucketForMovement(movement) === bucket)
      .reduce((total, movement) => total + movement.amount, 0);
  const needsSpent = ruleExpenses
    .filter((movement) => {
      const definition = categoryDefinition(movement.category);
      return definition?.bucket === "needs" || (!definition?.bucket && necessaryNames.has(movement.category));
    })
    .reduce((total, movement) => total + movement.amount, 0) +
    currentAllocationTotal("needs");
  const savingsCategorySpent = ruleExpenses
    .filter((movement) => categoryDefinition(movement.category)?.bucket === "savings")
    .reduce((total, movement) => total + movement.amount, 0);
  const wantsSpent = ruleExpenses
    .filter((movement) => {
      const definition = categoryDefinition(movement.category);
      return definition?.bucket === "wants" || (!definition?.bucket && !necessaryNames.has(movement.category));
    })
    .reduce((total, movement) => total + movement.amount, 0) +
    currentAllocationTotal("wants");
  const savingsInvested = savingsCategorySpent + currentAllocationTotal("savings");
  const targetNeeds = data.preferences?.needsTarget ?? 50;
  const targetWants = data.preferences?.wantsTarget ?? 30;
  const targetSavings = data.preferences?.savingsTarget ?? 20;
  const updateTargets = (key: "needsTarget" | "wantsTarget" | "savingsTarget", value: number) =>
    setData((old) => ({
      ...old,
      preferences: { ...old.preferences, [key]: Math.max(0, Math.min(100, value)) },
    }));
  const updatePreferences = (next: Partial<NonNullable<Data["preferences"]>>) =>
    setData((old) => ({
      ...old,
      preferences: { ...old.preferences, ...next },
    }));
  const updateProfilePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Selecciona una imagen válida");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast("No se ha podido leer la imagen");
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => toast("No se ha podido preparar la imagen");
      image.onload = () => {
        const size = 192;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return;
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - sourceSize) / 2;
        const sourceY = (image.naturalHeight - sourceSize) / 2;
        context.fillStyle = "#dff3ef";
        context.fillRect(0, 0, size, size);
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        updatePreferences({ profilePhoto: canvas.toDataURL("image/jpeg", 0.82) });
        toast("Foto de perfil actualizada");
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const startTutorial = () => {
    setSettingsOpen(false);
    setTutorialStep(0);
    setTutorialOpen(true);
    updatePreferences({ onboardingCompleted: false, onboardingStep: 0 });
  };
  const closeTutorial = (completed: boolean) => {
    setTutorialOpen(false);
    updatePreferences({ onboardingCompleted: true, onboardingStep: completed ? tutorialSteps.length - 1 : tutorialStep });
    document.querySelectorAll(".tour-highlight").forEach((element) => element.classList.remove("tour-highlight"));
  };
  const changeTutorialStep = (step: number) => {
    const safeStep = Math.max(0, Math.min(tutorialSteps.length - 1, step));
    setTutorialStep(safeStep);
    updatePreferences({ onboardingStep: safeStep });
  };
  const rememberUpcomingOpen = (open: boolean) => {
    setUpOpen(open);
    updatePreferences({ upcomingOpen: open });
  };
  const rememberTab = (nextTab: Tab) => {
    setTab(nextTab);
    updatePreferences({ lastTab: nextTab });
  };
  const rememberMovementSection = (section: "movimientos" | "recurrentes") => {
    setMovementSection(section);
    updatePreferences({ lastMovementSection: section, lastTab: "movimientos" });
  };
  const rememberCollapsedAccountGroups = (groups: AccountKind[]) => {
    setCollapsedAccountGroups(groups);
    updatePreferences({ collapsedAccountGroups: groups });
  };
  const rememberCollapsedDays = (days: string[]) => {
    setCollapsedDays(days);
    updatePreferences({ collapsedMovementDays: days });
  };
  const rememberBalancePanels = (panels: string[]) => {
    setOpenBalancePanels(panels);
    updatePreferences({ openBalancePanels: panels });
  };
  const rememberExpandedCategory = (categoryId: string | null) => {
    setExpandedManagedCategory(categoryId);
    updatePreferences({ expandedManagedCategory: categoryId });
  };
  const restoreDefaultCategories = () => {
    setData((old) => ({
      ...old,
      categories: defaultCategoryDefinitions.map((category) => ({
        ...category,
        subcategories: category.subcategories.map((subcategory) => ({ ...subcategory })),
      })),
    }));
    setConfirmRestoreCategories(false);
    setExpandedManagedCategory(null);
    toast("Categorías predeterminadas restauradas");
  };
  const deleteAllFinanceData = async () => {
    const response = await authenticatedFetch("/api/finance?scope=data", { method: "DELETE", headers: spaceHeaders });
    if (!response.ok) {
      toast("No se han podido eliminar los datos");
      return;
    }
    setData((old) => ({
      accounts: [],
      movements: [],
      programs: [],
      budgets: [],
      debts: [],
      categories: defaultCategoryDefinitions.map((category) => ({
        ...category,
        subcategories: category.subcategories.map((subcategory) => ({ ...subcategory })),
      })),
      preferences: old.preferences,
      manualAssets: [],
      investmentValuations: {},
      overrides: {},
      skippedOccurrences: [],
    }));
    setConfirmDeleteData(false);
    toast("Tus datos financieros se han eliminado");
  };
  const deleteUserAccount = async () => {
    if (deleteAccountText !== "ELIMINAR" || deletingAccount) return;
    setDeletingAccount(true);
    try {
      const response = await authenticatedFetch("/api/finance?scope=account", { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        toast(payload?.error || "No se ha podido eliminar la cuenta");
        return;
      }
      await onSignOut();
    } finally {
      setDeletingAccount(false);
    }
  };
  const downloadBackup = () => {
    const backup = JSON.stringify(
      { format: "mizufi-backup", version: 1, exportedAt: new Date().toISOString(), data },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `mizufi-copia-${todayISO}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Copia de seguridad descargada");
  };
  const restoreBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const restored = parsed?.format === "mizufi-backup" ? parsed.data : parsed;
      if (!Array.isArray(restored?.accounts) || !Array.isArray(restored?.movements) || !Array.isArray(restored?.programs))
        throw new Error("invalid");
      if (!window.confirm("¿Restaurar esta copia? Sustituirá los datos actuales de Mizufi.")) return;
      setData({
        ...restored,
        trash: (restored.trash ?? []).filter(
          (item: TrashItem) => new Date(item.expiresAt).getTime() > Date.now(),
        ),
      });
      toast("Copia de seguridad restaurada");
    } catch {
      toast("El archivo no es una copia válida de Mizufi");
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  };
  const restoreTrashItem = (item: TrashItem) => {
    setData((old) => {
      const merge = <T extends { id: string }>(current: T[], restored: T[] = []) => [
        ...current.filter((entry) => !restored.some((candidate) => candidate.id === entry.id)),
        ...restored,
      ];
      let next: Data = { ...old, trash: (old.trash ?? []).filter((entry) => entry.id !== item.id) };
      if (item.kind === "movement" && item.payload.movements?.[0]) {
        const movement = item.payload.movements[0];
        if (!old.movements.some((entry) => entry.id === movement.id)) {
          if (item.payload.debts?.length || item.payload.programs?.length) {
            next = {
              ...next,
              accounts: merge(old.accounts, item.payload.accounts),
              debts: merge(old.debts ?? [], item.payload.debts),
              programs: merge(old.programs, item.payload.programs),
              movements: [...old.movements, movement],
            };
          } else if (movement.planned || movement.date > todayISO) {
            next.movements = [...old.movements, movement];
          } else {
            const sourceDelta = movementAccountDelta(movement, movement.account, old.debts);
            const targetDelta = movement.kind === "deuda" ? -(movement.principal ?? movement.amount) : movement.amount;
            let debts = changeDebtCapital(old.debts, movement.account, sourceDelta);
            if (movement.target) debts = changeDebtCapital(debts, movement.target, targetDelta);
            next = {
              ...next,
              debts,
              movements: [...old.movements, movement],
              accounts: old.accounts.map((account) => account.id === movement.account
                ? { ...account, balance: account.balance + sourceDelta }
                : account.id === movement.target
                  ? { ...account, balance: account.balance + targetDelta }
                  : account),
            };
          }
        }
      } else {
        if (item.payload.accounts) next.accounts = merge(old.accounts, item.payload.accounts);
        if (item.payload.movements) next.movements = merge(old.movements, item.payload.movements);
        if (item.payload.programs) next.programs = merge(old.programs, item.payload.programs);
        if (item.payload.debts) next.debts = merge(old.debts ?? [], item.payload.debts);
        if (item.payload.budgets) next.budgets = merge(old.budgets ?? [], item.payload.budgets);
        if (item.payload.categories) next.categories = merge(old.categories ?? [], item.payload.categories);
        if (item.payload.manualAssets) next.manualAssets = merge(old.manualAssets ?? [], item.payload.manualAssets);
        if (item.payload.overrides) next.overrides = { ...old.overrides, ...item.payload.overrides };
        if (item.payload.skippedOccurrences) next.skippedOccurrences = [...new Set([...(old.skippedOccurrences ?? []), ...item.payload.skippedOccurrences])];
      }
      return next;
    });
    toast(`${item.label} restaurado`);
  };
  const permanentlyDeleteTrashItem = (item: TrashItem) => {
    if (!window.confirm(`¿Eliminar definitivamente «${item.label}»?`)) return;
    setData((old) => ({ ...old, trash: (old.trash ?? []).filter((entry) => entry.id !== item.id) }));
    toast("Elemento eliminado definitivamente");
  };
  const saveManualAsset = () => {
    const value = Number(assetDraft.value.replace(",", "."));
    if (!assetDraft.name.trim() || !Number.isFinite(value) || value < 0) {
      toast("Escribe un nombre y un valor válido");
      return;
    }
    setData((old) => {
      const assets = old.manualAssets ?? [];
      if (editingAsset) {
        return {
          ...old,
          manualAssets: assets.map((asset) =>
            asset.id === editingAsset
              ? {
                  ...asset,
                  name: assetDraft.name.trim(),
                  kind: assetDraft.kind,
                  value,
                  valuations: [...asset.valuations, { date: todayISO, value }],
                }
              : asset,
          ),
        };
      }
      const asset: ManualAsset = {
        id: crypto.randomUUID(),
        name: assetDraft.name.trim(),
        kind: assetDraft.kind,
        value,
        valuations: [{ date: todayISO, value }],
      };
      return { ...old, manualAssets: [...assets, asset] };
    });
    setAssetDraft({ name: "", kind: "Vivienda", value: "" });
    setEditingAsset(null);
    setAssetFormOpen(false);
    toast(editingAsset ? "Valor actualizado y guardado en el historial" : "Activo añadido");
  };
  const updateInvestmentValue = (account: Account, value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    setData((old) => ({
      ...old,
      investmentValuations: {
        ...old.investmentValuations,
        [account.id]: [
          ...(old.investmentValuations?.[account.id] ?? []),
          { date: todayISO, value },
        ],
      },
    }));
    toast("Valor de inversión actualizado");
  };
  const saveAssetValuation = () => {
    if (!editingValuation) return;
    const value = Number(editingValuation.value.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast("Introduce un valor válido");
      return;
    }
    setData((old) => ({
      ...old,
      manualAssets: (old.manualAssets ?? []).map((asset) => {
        if (asset.id !== editingValuation.assetId) return asset;
        const valuations = asset.valuations.map((valuation, index) =>
          index === editingValuation.index ? { ...valuation, value } : valuation,
        );
        return { ...asset, valuations, value: valuations.at(-1)?.value ?? 0 };
      }),
    }));
    setEditingValuation(null);
    toast("Valor del historial modificado");
  };
  const deleteAssetValuation = (assetId: string, index: number) => {
    if (!window.confirm("¿Eliminar este valor del historial?")) return;
    setData((old) => {
      const original = (old.manualAssets ?? []).find((asset) => asset.id === assetId);
      const next = {
      ...old,
      manualAssets: (old.manualAssets ?? []).map((asset) => {
        if (asset.id !== assetId) return asset;
        const valuations = asset.valuations.filter((_, valuationIndex) => valuationIndex !== index);
        return { ...asset, valuations, value: valuations.at(-1)?.value ?? 0 };
      }),
      };
      return original
        ? addTrashItem(next, "asset", `Valor de ${original.name}`, { manualAssets: [original] })
        : next;
    });
    setEditingValuation(null);
    toast("Valor enviado a la papelera durante 30 días");
  };
  const programmedUpcoming = data.programs
    .filter(
      (p) =>
        !p.archived &&
        p.active !== false &&
        !byId[p.account]?.archived &&
        (!p.target || !byId[p.target]?.archived),
    )
    .flatMap((p) => {
      const dates = programOccurrences(
        p,
        selectedPeriod.start,
        selectedPeriod.end,
      );
      const periodStart = isoDate(selectedPeriod.start);
      const periodEnd = isoDate(selectedPeriod.end);
      if (
        p.start >= periodStart &&
        p.start <= periodEnd &&
        !dates.includes(p.start)
      ) {
        dates.unshift(p.start);
      }
      return dates.map((date) => ({
          ...p,
          programId: p.id,
          id: `${p.id}:${date}`,
          date,
          scheduled: true,
        }));
    })
    .filter(
      (p) =>
        p.date > todayISO &&
        !data.skippedOccurrences?.includes(`${p.programId}:${p.date}`),
    );
  const manualUpcoming = data.movements
    .filter(
      (movement) =>
        movement.date > todayISO &&
        !movement.scheduled &&
        matchesPeriod(movement.date),
    )
    .map((movement) => ({ ...movement, planned: true }));
  const periodUpcoming = [...programmedUpcoming, ...manualUpcoming]
    .sort((a, b) => a.date.localeCompare(b.date));
  const availablePeriodMovements = periodUpcoming.filter((movement) =>
    movement.kind === "traspaso"
      ? !!byId[movement.account]?.included !==
        !!byId[movement.target ?? ""]?.included
      : !!byId[movement.account]?.included,
  );
  const plannedIncome = availablePeriodMovements
    .filter((movement) => impact(movement) > 0)
    .reduce((total, movement) => total + impact(movement), 0);
  const plannedPayments = Math.abs(
    availablePeriodMovements
      .filter((movement) => impact(movement) < 0)
      .reduce((total, movement) => total + impact(movement), 0),
  );
  const available = current - plannedPayments + plannedIncome;
  const nextIncomeSearchStart = new Date(`${todayISO}T12:00:00`);
  nextIncomeSearchStart.setDate(nextIncomeSearchStart.getDate() + 1);
  const nextIncomeSearchEnd = new Date(nextIncomeSearchStart);
  nextIncomeSearchEnd.setFullYear(nextIncomeSearchEnd.getFullYear() + 5);
  const futureProgramTimeline = data.programs
    .filter(
      (program) =>
        !program.archived &&
        program.active !== false &&
        !byId[program.account]?.archived &&
        (!program.target || !byId[program.target]?.archived),
    )
    .flatMap((program) =>
      programOccurrences(program, nextIncomeSearchStart, nextIncomeSearchEnd)
        .filter(
          (date) =>
            !data.skippedOccurrences?.includes(`${program.id}:${date}`),
        )
        .map((date) => ({
          ...program,
          programId: program.id,
          id: `${program.id}:${date}`,
          date,
          scheduled: true,
        })),
    );
  const futureManualTimeline = data.movements
    .filter(
      (movement) =>
        movement.date > todayISO &&
        !movement.scheduled,
    )
    .map((movement) => ({ ...movement, planned: true }));
  const futureTimeline = [...futureProgramTimeline, ...futureManualTimeline]
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextIncome = futureTimeline.find(
    (movement) =>
      movement.kind === "ingreso" &&
      !!byId[movement.account]?.included,
  );
  // El disponible debe ser conservador: descuenta todos los pagos del
  // periodo seleccionado y no depende de que un ingreso futuro llegue.
  const availableUntilNextIncome = current - plannedPayments;
  const nextIncomeName = nextIncome
    ? nextIncome.name ||
      [nextIncome.category, nextIncome.subcategory].filter(Boolean).join(" · ") ||
      "Ingreso previsto"
    : null;
  const futureIncomeMovements = periodUpcoming
    .filter((movement) => movement.kind === "ingreso" && isIncomeAccount(movement.account));
  const futurePeriodIncome = futureIncomeMovements
    .reduce((total, movement) => total + movement.amount, 0);
  const futurePeriodExpenses = periodUpcoming
    .filter((movement) => ["gasto", "deuda", "devolucion"].includes(movement.kind))
    .reduce((total, movement) => total + (movement.kind === "devolucion" ? -movement.amount : movement.amount), 0);
  const futureBucketTotal = (bucket: "needs" | "wants" | "savings") => periodUpcoming
    .filter((movement) => ["gasto", "deuda", "devolucion"].includes(movement.kind))
    .filter((movement) => byId[movement.account]?.kind !== "hucha")
    .filter((movement) => {
      const assigned = categoryDefinition(movement.category)?.bucket ?? (necessaryNames.has(movement.category) ? "needs" : "wants");
      return assigned === bucket;
    })
    .reduce((total, movement) => total + (movement.kind === "devolucion" ? -movement.amount : movement.amount), 0);
  const futureAllocationTotal = (
    bucket: "needs" | "wants" | "savings",
  ) =>
    periodUpcoming
      .filter((movement) => allocationBucketForMovement(movement) === bucket)
      .reduce((total, movement) => total + movement.amount, 0);
  const projectedIncome = income + futurePeriodIncome;
  const projectedTotalExpenses = Math.max(0, totalExpenses + futurePeriodExpenses);
  const futureExpenses = periodUpcoming
    .filter((movement) => ["gasto", "deuda", "devolucion"].includes(movement.kind))
    .map((movement) => ({
      ...movement,
      amount: movement.kind === "devolucion" ? -movement.amount : movement.amount,
    }));
  const projectedExpenseMovements = [...expenses, ...futureExpenses];
  const projectedCategoryRows = Object.entries(
    projectedExpenseMovements.reduce<
      Record<string, { total: number; subs: Record<string, number> }>
    >((all, movement) => {
      all[movement.category] ??= { total: 0, subs: {} };
      all[movement.category].total += movement.amount;
      all[movement.category].subs[movement.subcategory] =
        (all[movement.category].subs[movement.subcategory] ?? 0) + movement.amount;
      return all;
    }, {}),
  )
    .filter(([, value]) => value.total > 0)
    .sort((a, b) => b[1].total - a[1].total);
  const futureTransferContributions = periodUpcoming
    .filter(
      (movement) =>
        movement.kind === "traspaso" &&
        byId[movement.account]?.kind === "corriente" &&
        ["ahorro", "hucha", "inversion"].includes(
          byId[movement.target ?? ""]?.kind,
        ),
    )
    .map((movement) => ({
      category:
        byId[movement.target ?? ""]?.kind === "inversion"
          ? "Inversión"
          : byId[movement.target ?? ""]?.kind === "hucha"
            ? "Huchas"
            : "Ahorro",
      name: byId[movement.target ?? ""]?.name ?? "Destino",
      amount: movement.amount,
    }));
  const futureDirectIncomeContributions = futureIncomeMovements
    .filter((movement) => ["ahorro", "hucha", "inversion"].includes(byId[movement.account]?.kind))
    .map((movement) => ({
      category:
        byId[movement.account]?.kind === "inversion"
          ? "Inversión"
          : byId[movement.account]?.kind === "hucha"
            ? "Huchas"
            : "Ahorro",
      name: byId[movement.account]?.name ?? "Cuenta",
      amount: movement.amount,
    }));
  const futureContributions = [...futureTransferContributions, ...futureDirectIncomeContributions];
  const projectedContributions = [...contributions, ...futureContributions];
  const projectedAllocatedTotal =
    projectedTotalExpenses +
    projectedContributions.reduce((total, movement) => total + movement.amount, 0);
  const projectedDistributionRows = [
    { name: "Gastos", total: projectedTotalExpenses, color: "#bd8b70" },
    ...[
      { name: "Huchas", color: "#a38ba3" },
      { name: "Ahorro", color: "#68877b" },
      { name: "Inversión", color: "#778ba3" },
    ].map((item) => ({
      ...item,
      total: projectedContributions
        .filter((movement) => movement.category === item.name)
        .reduce((total, movement) => total + movement.amount, 0),
    })),
  ].filter((item) => item.total > 0);
  const groupDistributionItems = (
    items: { name: string; amount: number }[],
  ) =>
    Object.values(
      items.reduce<Record<string, { name: string; total: number }>>(
        (groups, item) => {
          groups[item.name] ??= { name: item.name, total: 0 };
          groups[item.name].total += item.amount;
          return groups;
        },
        {},
      ),
    ).sort((a, b) => b.total - a.total);
  const distributionBreakdowns = {
    Gastos: categoryRows.map(([name, value]) => ({
      name,
      total: value.total,
    })),
    Huchas: groupDistributionItems(
      contributions
        .filter((item) => item.category === "Huchas")
        .map((item) => ({ ...item, name: huchaLabel(item.name) })),
    ),
    Ahorro: groupDistributionItems(
      contributions.filter((item) => item.category === "Ahorro"),
    ),
    Inversión: groupDistributionItems(
      contributions.filter((item) => item.category === "Inversión"),
    ),
  };
  const projectedDistributionBreakdowns = {
    Gastos: projectedCategoryRows.map(([name, value]) => ({
      name,
      total: value.total,
    })),
    Huchas: groupDistributionItems(
      projectedContributions
        .filter((item) => item.category === "Huchas")
        .map((item) => ({ ...item, name: huchaLabel(item.name) })),
    ),
    Ahorro: groupDistributionItems(
      projectedContributions.filter((item) => item.category === "Ahorro"),
    ),
    Inversión: groupDistributionItems(
      projectedContributions.filter((item) => item.category === "Inversión"),
    ),
  };
  const projectedNeedsSpent =
    needsSpent + futureBucketTotal("needs") + futureAllocationTotal("needs");
  const projectedWantsSpent =
    wantsSpent + futureBucketTotal("wants") + futureAllocationTotal("wants");
  const projectedSavingsInvested =
    savingsInvested +
    futureBucketTotal("savings") +
    futureAllocationTotal("savings");
  const ruleDetail = (
    movement: Movement | (Program & { date: string; id: string }),
    amount = movement.amount,
  ): RuleDetail => ({
    id: movement.id,
    date: movement.date,
    name:
      movement.kind === "traspaso"
        ? `${byId[movement.account]?.name ?? "Cuenta"} → ${byId[movement.target ?? ""]?.name ?? "Destino"}`
        : movement.name ||
          [movement.category, movement.subcategory].filter(Boolean).join(" · "),
    context:
      movement.kind === "traspaso"
        ? "Aportación nueva"
        : [movement.category, movement.subcategory].filter(Boolean).join(" · "),
    category:
      movement.kind === "traspaso"
        ? byId[movement.target ?? ""]?.kind === "hucha"
          ? huchaLabel(byId[movement.target ?? ""]?.name ?? "Sin nombre")
          : byId[movement.target ?? ""]?.kind === "inversion"
            ? "Inversión"
            : "Ahorro"
        : movement.kind === "ingreso" && byId[movement.account]?.kind === "hucha"
          ? huchaLabel(byId[movement.account]?.name ?? "Sin nombre")
        : movement.category || "Sin categoría",
    amount,
  });
  const currentRuleDetails = {
    needs: ruleExpenses
      .filter((movement) => ruleBucketForMovement(movement) === "needs")
      .map((movement) => ruleDetail(movement, movement.amount))
      .concat(
        periodMovements
          .filter(
            (movement) => allocationBucketForMovement(movement) === "needs",
          )
          .map((movement) => ruleDetail(movement)),
      ),
    wants: ruleExpenses
      .filter((movement) => ruleBucketForMovement(movement) === "wants")
      .map((movement) => ruleDetail(movement, movement.amount))
      .concat(
        periodMovements
          .filter(
            (movement) => allocationBucketForMovement(movement) === "wants",
          )
          .map((movement) => ruleDetail(movement)),
      ),
    savings: [
      ...ruleExpenses
        .filter((movement) => ruleBucketForMovement(movement) === "savings")
        .map((movement) => ruleDetail(movement, movement.amount)),
      ...periodMovements
        .filter(
          (movement) => allocationBucketForMovement(movement) === "savings",
        )
        .map((movement) => ruleDetail(movement)),
    ],
  };
  const futureRuleExpenses = periodUpcoming
    .filter((movement) =>
      ["gasto", "deuda", "devolucion"].includes(movement.kind),
    )
    .filter((movement) => byId[movement.account]?.kind !== "hucha")
    .map((movement) => ({
      movement,
      amount:
        movement.kind === "devolucion" ? -movement.amount : movement.amount,
    }));
  const projectedRuleDetails = {
    needs: [
      ...currentRuleDetails.needs,
      ...futureRuleExpenses
        .filter(({ movement }) => ruleBucketForMovement(movement) === "needs")
        .map(({ movement, amount }) => ruleDetail(movement, amount)),
      ...periodUpcoming
        .filter(
          (movement) => allocationBucketForMovement(movement) === "needs",
        )
        .map((movement) => ruleDetail(movement)),
    ],
    wants: [
      ...currentRuleDetails.wants,
      ...futureRuleExpenses
        .filter(({ movement }) => ruleBucketForMovement(movement) === "wants")
        .map(({ movement, amount }) => ruleDetail(movement, amount)),
      ...periodUpcoming
        .filter(
          (movement) => allocationBucketForMovement(movement) === "wants",
        )
        .map((movement) => ruleDetail(movement)),
    ],
    savings: [
      ...currentRuleDetails.savings,
      ...futureRuleExpenses
        .filter(({ movement }) => ruleBucketForMovement(movement) === "savings")
        .map(({ movement, amount }) => ruleDetail(movement, amount)),
      ...periodUpcoming
        .filter(
          (movement) => allocationBucketForMovement(movement) === "savings",
        )
        .map((movement) => ruleDetail(movement)),
    ],
  };
  const toast = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 2800);
  };
  function movementAccountDelta(
    movement: Movement,
    accountId: string,
    debts: DebtProfile[] = [],
  ) {
    const card = debts.find(
      (debt) => debt.type === "card" && debt.accountId === accountId,
    );
    if (card && movement.kind === "gasto") return movement.amount;
    if (card && movement.kind === "devolucion") return -movement.amount;
    return accountDelta(movement);
  }
  function changeDebtCapital(
    debts: DebtProfile[] | undefined,
    accountId: string | undefined,
    delta: number,
  ) {
    if (!accountId || !delta) return debts ?? [];
    return (debts ?? []).map((debt) =>
      debt.accountId === accountId
        ? {
            ...debt,
            principal: Math.max(
              0,
              Math.round((debt.principal + delta) * 100) / 100,
            ),
          }
        : debt,
    );
  }
  function openCategoryEditor(category?: CategoryDefinition) {
    setCategoryEditor(category ?? null);
    setCreatingCategory(!category);
    setCategoryName(category?.name ?? "");
    setCategoryIcon(
      category ? (legacySymbols[category.icon] ?? category.icon) : "star",
    );
    setCategoryColor(
      category?.color ??
        categoryColors[categoryDefinitions.length % categoryColors.length],
    );
    setCategoryBucket(category?.bucket ?? (category && necessaryNames.has(category.name) ? "needs" : "wants"));
  }
  function startCategoryCreation() {
    openCategoryEditor();
    setSettingsSection("categorias");
    setSettingsOpen(true);
  }
  function closeCategoryEditor() {
    setCategoryEditor(null);
    setCreatingCategory(false);
    setCategoryName("");
  }
  function saveCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    if (
      categoryDefinitions.some(
        (category) =>
          category.name.toLocaleLowerCase("es") ===
            name.toLocaleLowerCase("es") && category.id !== categoryEditor?.id,
      )
    ) {
      toast("Ya existe una categoría con ese nombre");
      return;
    }
    if (categoryEditor) {
      setData((old) => {
        const existing = old.categories?.length
          ? old.categories
          : defaultCategoryDefinitions;
        const renamed = categoryEditor.name !== name;
        return {
          ...old,
          categories: existing.map((category) =>
            category.id === categoryEditor.id
              ? { ...category, name, icon: categoryIcon, color: categoryColor, bucket: categoryBucket }
              : category,
          ),
          movements: renamed
            ? old.movements.map((movement) =>
                movement.category === categoryEditor.name
                  ? {
                      ...movement,
                      category: name,
                      name:
                        movement.kind === "traspaso"
                          ? movement.name
                          : [name, movement.subcategory]
                              .filter(Boolean)
                              .join(" · "),
                    }
                  : movement,
              )
            : old.movements,
          programs: renamed
            ? old.programs.map((program) =>
                program.category === categoryEditor.name
                  ? {
                      ...program,
                      category: name,
                      name:
                        program.kind === "traspaso"
                          ? program.name
                          : [name, program.subcategory]
                              .filter(Boolean)
                              .join(" · "),
                    }
                  : program,
              )
            : old.programs,
        };
      });
      if (cat === categoryEditor.name) setCat(name);
      toast("Categoría actualizada y movimientos conservados");
    } else {
      const category: CategoryDefinition = {
        id: uid(),
        name,
        icon: categoryIcon,
        color: categoryColor,
        bucket: categoryBucket,
        subcategories: [],
      };
      setData((old) => ({
        ...old,
        categories: [
          ...(old.categories?.length
            ? old.categories
            : defaultCategoryDefinitions
          ).filter(
            (existing) =>
              categoryCatalogKey(existing.name) !== categoryCatalogKey(name),
          ),
          category,
        ],
      }));
      setCat(name);
      setSubcat("");
      setCategoryPickerOpen(false);
      toast("Categoría creada correctamente");
    }
    closeCategoryEditor();
  }
  function categoryUsage(category: CategoryDefinition, subcategory?: string) {
    return (
      data.movements.filter(
        (movement) =>
          movement.category === category.name &&
          (!subcategory || movement.subcategory === subcategory),
      ).length +
      data.programs.filter(
        (program) =>
          program.category === category.name &&
          (!subcategory || program.subcategory === subcategory),
      ).length
    );
  }
  function requestCategoryRemoval(
    category: CategoryDefinition,
    subcategory?: SubcategoryDefinition,
  ) {
    if (!subcategory && ["Ingresos", "Deudas"].includes(category.name)) {
      toast("Esta categoría es necesaria para registrar ingresos o deudas");
      return;
    }
    setPendingCategoryRemoval({
      categoryId: category.id,
      subcategory: subcategory?.name,
    });
  }
  function confirmCategoryRemoval(
    category: CategoryDefinition,
    subcategory?: SubcategoryDefinition,
  ) {
    if (subcategory) {
      setData((old) => addTrashItem({
        ...old,
        categories: (old.categories?.length
          ? old.categories
          : defaultCategoryDefinitions
        ).map(
          (item) =>
            item.id === category.id
              ? {
                  ...item,
                  subcategories: item.subcategories.filter(
                    (sub) => sub.name !== subcategory.name,
                  ),
                }
              : item,
        ),
      }, "subcategory", `${category.name} · ${subcategory.name}`, { categories: [category] }));
      toast("Subcategoría enviada a la papelera durante 30 días.");
    } else {
      setData((old) => addTrashItem({
        ...old,
        categories: (old.categories?.length
          ? old.categories
          : defaultCategoryDefinitions
        ).filter(
          (item) => item.id !== category.id,
        ),
      }, "category", category.name, { categories: [category] }));
      if (cat === category.name) setCat("Alimentación");
      toast("Categoría enviada a la papelera durante 30 días.");
    }
    setPendingCategoryRemoval(null);
    setManagedSubcategoryMenu(null);
  }
  function addSubcategory(category: CategoryDefinition) {
    setSubcategoryEditor({ categoryId: category.id });
    setSubcategoryName("");
    setPendingCategoryRemoval(null);
  }
  function editSubcategory(
    category: CategoryDefinition,
    subcategory: SubcategoryDefinition,
  ) {
    setSubcategoryEditor({
      categoryId: category.id,
      original: subcategory.name,
    });
    setSubcategoryName(subcategory.name);
    setPendingCategoryRemoval(null);
  }
  function saveSubcategory(
    e: React.FormEvent<HTMLFormElement>,
    category: CategoryDefinition,
  ) {
    e.preventDefault();
    const name = subcategoryName.trim();
    if (!name) return;
    const original = subcategoryEditor?.original;
    if (
      category.subcategories.some(
        (item) =>
          item.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es") &&
          item.name !== original,
      )
    ) {
      toast("Esa subcategoría ya existe");
      return;
    }
    setData((old) => ({
      ...old,
      categories: (old.categories?.length
        ? old.categories
        : defaultCategoryDefinitions
      ).map((item) =>
        item.id === category.id
          ? {
              ...item,
              subcategories: original
                ? item.subcategories.map((sub) =>
                    sub.name === original ? { ...sub, name } : sub,
                  )
                : [...item.subcategories, { name }],
            }
          : item,
      ),
      movements: original
        ? old.movements.map((movement) =>
            movement.category === category.name &&
            movement.subcategory === original
              ? {
                  ...movement,
                  subcategory: name,
                  name: [category.name, name].join(" · "),
                }
              : movement,
          )
        : old.movements,
      programs: original
        ? old.programs.map((program) =>
            program.category === category.name &&
            program.subcategory === original
              ? {
                  ...program,
                  subcategory: name,
                  name: [category.name, name].join(" · "),
                }
              : program,
          )
        : old.programs,
    }));
    setSubcategoryEditor(null);
    setSubcategoryName("");
    toast(original ? "Subcategoría actualizada" : "Subcategoría añadida");
  }
  function archiveAccount(account: Account) {
    if (
      account.balance !== 0 &&
      !window.confirm(
        `${account.name} todavía tiene un saldo de ${money(account.balance)}. Al archivarla dejará de incluirse en tus totales. ¿Quieres archivarla igualmente?`,
      )
    )
      return;
    setData((old) => ({
      ...old,
      accounts: old.accounts.map((a) =>
        a.id === account.id ? { ...a, archived: true, included: false } : a,
      ),
      programs: old.programs.map((p) =>
        p.account === account.id || p.target === account.id
          ? { ...p, active: false }
          : p,
      ),
    }));
    setAccountMenu(null);
    toast(`${account.name} archivada. Su historial se conserva.`);
  }
  function restoreAccount(account: Account) {
    setData((old) => ({
      ...old,
      accounts: old.accounts.map((a) =>
        a.id === account.id ? { ...a, archived: false, included: false } : a,
      ),
    }));
    toast(`${account.name} vuelve a estar disponible`);
  }
  function deleteAccount(account: Account) {
    setAccountMenu(null);
    setPendingAccountDelete(account);
  }
  function moveAccountTo(account: Account, targetId: string) {
    if (account.id === targetId) return;
    setData((old) => {
      const group = old.accounts.filter((item) => !item.archived && item.kind === account.kind);
      const from = group.findIndex((item) => item.id === account.id);
      const to = group.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return old;
      const reordered = [...group];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      let position = 0;
      return {
        ...old,
        accounts: old.accounts.map((item) =>
          !item.archived && item.kind === account.kind
            ? reordered[position++]
            : item,
        ),
      };
    });
  }
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const account = draggingAccountRef.current;
      if (!account) return;
      event.preventDefault();
      if (event.clientY < 90) window.scrollBy(0, -10);
      if (event.clientY > window.innerHeight - 110) window.scrollBy(0, 10);
      const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-account-kind="${account.kind}"]`))
        .filter((row) => row.dataset.accountId);
      const currentIndex = rows.findIndex((row) => row.dataset.accountId === account.id);
      if (currentIndex < 0) return;
      const currentBounds = rows[currentIndex].getBoundingClientRect();
      const currentCenter = currentBounds.top + currentBounds.height / 2;
      let target: HTMLElement | null = null;
      if (event.clientY > currentCenter) {
        target = rows.slice(currentIndex + 1).filter((row) => {
          const bounds = row.getBoundingClientRect();
          return bounds.top + bounds.height / 2 <= event.clientY;
        }).at(-1) ?? null;
      } else if (event.clientY < currentCenter) {
        target = rows.slice(0, currentIndex).find((row) => {
          const bounds = row.getBoundingClientRect();
          return bounds.top + bounds.height / 2 >= event.clientY;
        }) ?? null;
      }
      if (target?.dataset.accountId) moveAccountTo(account, target.dataset.accountId);
    };
    const finish = () => {
      if (!draggingAccountRef.current) return;
      draggingAccountRef.current = null;
      setDraggingAccount(null);
      toast("Orden de cuentas actualizado");
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, []);
  function confirmDeleteAccount() {
    if (!pendingAccountDelete) return;
    const account = pendingAccountDelete;
    setData((old) => {
      const relatedMovements = old.movements.filter((m) => m.account === account.id || m.target === account.id);
      const relatedPrograms = old.programs.filter((p) => p.account === account.id || p.target === account.id);
      const relatedDebts = (old.debts ?? []).filter((debt) => debt.accountId === account.id || debt.paymentAccount === account.id);
      return addTrashItem({
      ...old,
      accounts: old.accounts.filter((a) => a.id !== account.id),
      movements: old.movements.filter(
        (m) => m.account !== account.id && m.target !== account.id,
      ),
      programs: old.programs.filter(
        (p) => p.account !== account.id && p.target !== account.id,
      ),
      debts: (old.debts ?? []).filter((debt) => debt.accountId !== account.id && debt.paymentAccount !== account.id),
    }, "account", account.name, { accounts: [account], movements: relatedMovements, programs: relatedPrograms, debts: relatedDebts });
    });
    setPendingAccountDelete(null);
    toast(`${account.name} enviada a la papelera durante 30 días`);
  }
  function archiveProgram(program: Program) {
    setData((old) => ({
      ...old,
      programs: old.programs.map((p) =>
        p.id === program.id ? { ...p, archived: true, active: false } : p,
      ),
    }));
    setProgramMenu(null);
    toast(
      `${program.name} archivado. Los movimientos anteriores se conservan.`,
    );
  }
  function restoreProgram(program: Program) {
    setData((old) => ({
      ...old,
      programs: old.programs.map((p) =>
        p.id === program.id ? { ...p, archived: false, active: true } : p,
      ),
    }));
    toast(`${program.name} desarchivado y programado de nuevo.`);
  }
  function deleteProgram(program: Program) {
    if (
      !window.confirm(
        `¿Enviar ${program.name} a la papelera?\n\nDejará de generar movimientos futuros y podrás recuperarlo durante 30 días.`,
      )
    )
      return;
    setData((old) => {
      const overrides = { ...old.overrides };
      delete overrides[program.id];
      const next = {
        ...old,
        programs: old.programs.filter((p) => p.id !== program.id),
        overrides,
        skippedOccurrences: (old.skippedOccurrences ?? []).filter(
          (key) => !key.startsWith(`${program.id}:`),
        ),
      };
      const skipped = (old.skippedOccurrences ?? []).filter((key) => key.startsWith(`${program.id}:`));
      return addTrashItem(next, "program", program.name, { programs: [program], overrides: old.overrides?.[program.id] ? { [program.id]: old.overrides[program.id] } : {}, skippedOccurrences: skipped });
    });
    setProgramMenu(null);
    toast(`${program.name} enviado a la papelera durante 30 días.`);
  }
  function skipOccurrence(programId: string, date: string, name: string) {
    if (
      !window.confirm(
        `¿Saltar ${name} del ${friendly(date)}?\n\nSolo se omitirá esta vez. El resto de fechas seguirán programadas.`,
      )
    )
      return;
    const key = `${programId}:${date}`;
    setData((old) => ({
      ...old,
      skippedOccurrences: [
        ...new Set([...(old.skippedOccurrences ?? []), key]),
      ],
    }));
    toast(`${name} se ha saltado solo esta vez.`);
  }
  const accountDelta = (movement: { kind: MovementKind; amount: number }) =>
    movement.kind === "ingreso" || movement.kind === "devolucion"
      ? movement.amount
      : -movement.amount;
  function startRefund(movement: Movement) {
    setRefundSource(movement);
    setEdit(null);
    setDuplicatingMovement(false);
    setKind("devolucion");
    setCat(movement.category);
    setModal("movement");
  }
  function rebuildLoanFromCurrent(debt: DebtProfile, principal: number) {
    if (debt.type !== "loan") return { ...debt, principal };
    const past = (debt.schedule ?? []).filter(
      (row) => row.date < debt.nextPaymentDate,
    );
    const rate = debt.tin / 100 / 12;
    let remaining = principal;
    const future = [];
    let guard = 0;
    while (remaining > 0.005 && guard++ < 600) {
      const interest = remaining * rate;
      const payment = Math.min(debt.monthlyPayment, remaining + interest);
      const capital = Math.max(0, payment - interest);
      remaining = Math.max(0, remaining - capital);
      const date = new Date(`${debt.nextPaymentDate}T12:00:00`);
      date.setMonth(date.getMonth() + future.length);
      future.push({
        number: past.length + future.length + 1,
        date: isoDate(date),
        payment: Math.round(payment * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        principal: Math.round(capital * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
      });
      if (capital <= 0) break;
    }
    return {
      ...debt,
      principal,
      remainingTerms: future.length,
      maturityDate: future.at(-1)?.date,
      schedule: [...past, ...future],
    };
  }
  function deleteMovement(movement: Movement) {
    const isPlanned = !!movement.planned || movement.date > todayISO;
    if (
      !window.confirm(
        isPlanned
          ? `¿Eliminar este movimiento previsto de ${money(movement.amount)}?\n\nTodavía no ha afectado al saldo de ninguna cuenta.`
          : `¿Enviar este movimiento de ${money(movement.amount)} a la papelera?\n\nLos saldos se actualizarán y podrás recuperarlo durante 30 días.`,
      )
    )
      return;
    setData((old) => {
      if (isPlanned) {
        return addTrashItem({
          ...old,
          movements: old.movements.filter((item) => item.id !== movement.id),
        }, "movement", movement.name, { movements: [movement] });
      }
      const isAdjustment =
        movement.kind === "deuda" &&
        (movement.debtAdjustment ||
          movement.name.startsWith("Amortización extraordinaria") ||
          movement.name.startsWith("Cancelación de préstamo"));
      if (isAdjustment && movement.target) {
        const current = (old.debts ?? []).find(
          (debt) => debt.accountId === movement.target,
        );
        const snapshot = movement.debtAdjustment?.previousDebt;
        const restored =
          snapshot ??
          (current
            ? rebuildLoanFromCurrent(
                current,
                Math.round(
                  (current.principal +
                    (movement.principal ?? movement.amount)) *
                    100,
                ) / 100,
              )
            : undefined);
        let debts = old.debts ?? [];
        if (restored)
          debts = debts.map((debt) =>
            debt.accountId === movement.target ? restored : debt,
          );
        let programs = old.programs;
        if (restored) {
          const nextRow = restored.schedule?.find(
            (row) => row.date >= restored.nextPaymentDate,
          );
          const existing = programs.find(
            (program) => program.debtId === restored.id,
          );
          const restoredProgram: Program = {
            id: existing?.id ?? uid(),
            debtId: restored.id,
            name: restored.name,
            amount: restored.monthlyPayment,
            kind: "deuda",
            account: restored.paymentAccount,
            target: restored.accountId,
            category: "Deudas",
            subcategory: restored.name,
            frequency: "Mensual",
            start: restored.nextPaymentDate,
            end: restored.maturityDate,
            day: new Date(`${restored.nextPaymentDate}T12:00:00`).getDate(),
            active: true,
            principal: nextRow?.principal,
            interest: nextRow?.interest,
          };
          programs = existing
            ? programs.map((program) =>
                program.id === existing.id ? restoredProgram : program,
              )
            : [...programs, restoredProgram];
        }
        return addTrashItem({
          ...old,
          debts,
          programs,
          movements: old.movements.filter((item) => item.id !== movement.id),
          accounts: old.accounts.map((account) =>
            account.id === movement.account
              ? {
                  ...account,
                  balance:
                    Math.round((account.balance + movement.amount) * 100) / 100,
                }
              : account.id === movement.target && restored
                ? { ...account, balance: restored.principal }
                : account,
          ),
        }, "movement", movement.name, {
          movements: [movement],
          accounts: old.accounts.filter((account) => account.id === movement.account || account.id === movement.target),
          debts: (old.debts ?? []).filter((debt) => debt.accountId === movement.target),
          programs: old.programs.filter((program) => program.debtId && (old.debts ?? []).some((debt) => debt.id === program.debtId && debt.accountId === movement.target)),
        });
      }
      const sourceDelta = movementAccountDelta(
        movement,
        movement.account,
        old.debts,
      );
      const targetDelta =
        movement.kind === "deuda"
          ? -(movement.principal ?? movement.amount)
          : movement.amount;
      let debts = changeDebtCapital(old.debts, movement.account, -sourceDelta);
      if (movement.target)
        debts = changeDebtCapital(debts, movement.target, -targetDelta);
      return addTrashItem({
        ...old,
        debts,
        movements: old.movements.filter((m) => m.id !== movement.id),
        accounts: old.accounts.map((account) => {
          let balance = account.balance;
          if (account.id === movement.account) balance -= sourceDelta;
          if (account.id === movement.target) balance -= targetDelta;
          return balance === account.balance
            ? account
            : { ...account, balance };
        }),
      }, "movement", movement.name, { movements: [movement] });
    });
    setModal(null);
    setEdit(null);
    setRefundSource(null);
    toast(
      isPlanned
        ? "Movimiento previsto enviado a la papelera"
        : "Movimiento enviado a la papelera y saldos actualizados",
    );
  }
  function submitMovement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const k = v.get("kind") as MovementKind;
    const amount = Number(v.get("amount"));
    if (!amount || amount <= 0) {
      toast("Introduce un importe válido");
      return;
    }
    const account = String(v.get("account"));
    const target = String(v.get("target") ?? "");
    const principal = Number(v.get("principal") ?? amount);
    const notes = String(v.get("notes") ?? "").trim();
    const category = String(
      v.get("category") ?? (k === "traspaso" ? "Traspasos" : "Ingresos"),
    );
    const subcategory = String(v.get("subcategory") ?? "");
    const name = edit?.id.startsWith("future:")
      ? edit.name
      : k === "traspaso"
        ? `Traspaso a ${byId[target]?.name ?? "otra cuenta"}`
        : k === "devolucion"
          ? `Devolución · ${[category, subcategory].filter(Boolean).join(" · ")}`
          : [category, subcategory].filter(Boolean).join(" · ");
    const m: Movement = {
      id: duplicatingMovement ? uid() : (edit?.id ?? uid()),
      date: String(v.get("date")),
      name,
      amount,
      kind: k,
      account,
      target: target || undefined,
      category,
      subcategory,
      notes: notes || undefined,
      principal,
      interest: k === "deuda" ? Math.max(0, amount - principal) : 0,
      refundOf: edit?.refundOf ?? refundSource?.id,
      planned: String(v.get("date")) > todayISO ? true : undefined,
    };
    const insertMovement = (old: Data) => {
      if (m.planned) {
        return { ...old, movements: [...old.movements, m] };
      }
      const sourceDelta = movementAccountDelta(m, account, old.debts);
      const targetDelta = k === "deuda" ? -principal : amount;
      let debts = changeDebtCapital(old.debts, account, sourceDelta);
      if (target) debts = changeDebtCapital(debts, target, targetDelta);
      return {
        ...old,
        debts,
        movements: [...old.movements, m],
        accounts: old.accounts.map((a) =>
          a.id === account
            ? { ...a, balance: a.balance + sourceDelta }
            : a.id === target
              ? { ...a, balance: a.balance + targetDelta }
              : a,
        ),
      };
    };
    if (duplicatingMovement) {
      setData(insertMovement);
      toast(
        m.planned
          ? "Movimiento duplicado y guardado en previstos"
          : "Movimiento duplicado y saldos actualizados",
      );
    } else if (edit?.id.startsWith("future:")) {
      const programId = edit.id.slice(7);
      setData((old) => ({
        ...old,
        overrides: {
          ...old.overrides,
          [programId]: {
            date: m.date,
            amount: m.amount,
            account: m.account,
            name: m.name,
            target: m.target,
            category: m.category,
            subcategory: m.subcategory,
            notes: m.notes,
            principal: m.principal,
            interest: m.interest,
          },
        },
      }));
      toast("Próximo movimiento modificado sin cambiar la programación");
    } else if (edit) {
      setData((old) => {
        const oldApplied = !edit.planned && edit.date <= todayISO;
        const newApplied = !m.planned;
        const oldSource = movementAccountDelta(edit, edit.account, old.debts);
        const newSource = movementAccountDelta(m, m.account, old.debts);
        const oldTarget =
          edit.kind === "deuda"
            ? -(edit.principal ?? edit.amount)
            : edit.amount;
        const newTarget =
          m.kind === "deuda" ? -(m.principal ?? m.amount) : m.amount;
        let debts = old.debts;
        if (oldApplied)
          debts = changeDebtCapital(debts, edit.account, -oldSource);
        if (oldApplied && edit.target)
          debts = changeDebtCapital(debts, edit.target, -oldTarget);
        if (newApplied)
          debts = changeDebtCapital(debts, m.account, newSource);
        if (newApplied && m.target)
          debts = changeDebtCapital(debts, m.target, newTarget);
        return {
          ...old,
          debts,
          movements: old.movements.map((x) => (x.id === m.id ? m : x)),
          accounts: old.accounts.map((a) => {
            let balance = a.balance;
            if (oldApplied && a.id === edit.account) balance -= oldSource;
            if (oldApplied && a.id === edit.target) balance -= oldTarget;
            if (newApplied && a.id === m.account) balance += newSource;
            if (newApplied && a.id === m.target) balance += newTarget;
            return balance === a.balance ? a : { ...a, balance };
          }),
        };
      });
      toast(
        m.planned
          ? "Movimiento actualizado y mantenido como previsto"
          : "Movimiento actualizado y saldos recalculados",
      );
    } else {
      setData(insertMovement);
      toast(
        m.planned
          ? "Movimiento guardado en previstos"
          : k === "devolucion"
          ? "Devolución registrada y saldo actualizado"
          : "Movimiento guardado y saldos actualizados",
      );
    }
    setModal(null);
    setEdit(null);
    setDuplicatingMovement(false);
    setRefundSource(null);
  }
  function submitAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const k = v.get("accountKind") as AccountKind;
    const name = String(v.get("name"));
    const icon = accountIcon;
    const color = accountColor;
    const huchaBucket = String(v.get("bucket")) as
      | "needs"
      | "wants"
      | "savings";
    const huchaBucketLabel =
      huchaBucket === "needs"
        ? "Sobrevivir"
        : huchaBucket === "wants"
          ? "Disfrutar"
          : "Ahorro e inversión";
    if (editAccount) {
      setData((old) => ({
        ...old,
        accounts: old.accounts.map((a) =>
          a.id === editAccount.id
            ? {
                ...a,
                name,
                kind: k,
                balance: Number(v.get("balance")),
                icon,
                color,
                included: k === "deuda" ? false : a.included,
                goal:
                  k === "hucha"
                    ? Number(v.get("goal")) || undefined
                    : undefined,
                bucket:
                  k === "hucha"
                    ? huchaBucket
                    : undefined,
                detail:
                  k === "hucha"
                    ? Number(v.get("goal"))
                      ? `Objetivo: ${money(Number(v.get("goal")))} · ${huchaBucketLabel}`
                      : `Dinero reservado · ${huchaBucketLabel}`
                    : a.kind !== k
                      ? undefined
                      : a.detail,
              }
            : a,
        ),
      }));
      toast("Cuenta actualizada y totales recalculados");
    } else {
      const a: Account = {
        id: uid(),
        name,
        kind: k,
        balance: Number(v.get("balance")),
        included: k === "corriente",
        icon,
        color,
        detail:
          k === "hucha"
            ? `Dinero reservado · ${huchaBucketLabel}`
            : undefined,
        goal: k === "hucha" ? Number(v.get("goal")) || undefined : undefined,
        bucket:
          k === "hucha" ? huchaBucket : undefined,
      };
      setData((old) => ({ ...old, accounts: [...old.accounts, a] }));
      toast("Cuenta añadida correctamente");
    }
    setModal(null);
    setEditAccount(null);
  }
  function submitProgram(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const start = String(v.get("start"));
    const k = v.get("kind") as MovementKind;
    const amount = Number(v.get("amount"));
    const principal =
      k === "deuda" ? Number(v.get("principal") ?? amount) : undefined;
    const notes = String(v.get("notes") ?? "").trim();
    const target = String(v.get("target") ?? "") || undefined;
    const category = String(
      v.get("category") ?? (k === "traspaso" ? "Traspasos" : "Ingresos"),
    );
    const subcategory = String(v.get("subcategory") ?? "");
    const name =
      k === "traspaso"
        ? `Traspaso a ${byId[target ?? ""]?.name ?? "otra cuenta"}`
        : [category, subcategory].filter(Boolean).join(" · ");
    const p: Program = {
      id: editProgram && !duplicating ? editProgram.id : uid(),
      name,
      amount,
      kind: k,
      account: String(v.get("account")),
      target,
      category,
      subcategory,
      notes: notes || undefined,
      frequency: String(v.get("frequency")),
      occurrences: Math.max(1, Number(v.get("occurrences") ?? editProgram?.occurrences ?? 1)),
      start,
      end: normalizedProgramEnd(
        start,
        String(v.get("end") ?? "") || undefined,
      ),
      day: new Date(`${start}T12:00:00`).getDate(),
      active: duplicating ? true : (editProgram?.active ?? true),
      archived: duplicating ? false : (editProgram?.archived ?? false),
      principal,
      interest:
        k === "deuda" ? Math.max(0, amount - (principal ?? amount)) : undefined,
    };
    if (editProgram && !duplicating) {
      setData((old) => {
        const todayOccurrenceId = `scheduled:${p.id}:${todayISO}`;
        const existingToday = old.movements.find((movement) => movement.id === todayOccurrenceId);
        const remainsDueToday = programOccurrences(p, new Date(`${todayISO}T12:00:00`), new Date(`${todayISO}T12:00:00`)).includes(todayISO);
        if (!existingToday || remainsDueToday)
          return { ...old, programs: old.programs.map((x) => (x.id === p.id ? p : x)) };
        const sourceDelta = movementAccountDelta(existingToday, existingToday.account, old.debts);
        const targetDelta = existingToday.kind === "deuda" ? -(existingToday.principal ?? existingToday.amount) : existingToday.amount;
        let debts = changeDebtCapital(old.debts, existingToday.account, -sourceDelta);
        if (existingToday.target) debts = changeDebtCapital(debts, existingToday.target, -targetDelta);
        const accounts = old.accounts.map((account) => {
          let balance = account.balance;
          if (account.id === existingToday.account) balance -= sourceDelta;
          if (account.id === existingToday.target) balance -= targetDelta;
          return balance === account.balance ? account : { ...account, balance };
        });
        return { ...old, accounts, debts, movements: old.movements.filter((movement) => movement.id !== todayOccurrenceId), programs: old.programs.map((x) => (x.id === p.id ? p : x)) };
      });
      toast("Programado actualizado para los próximos movimientos");
    } else {
      setData((old) => {
        const retroactiveDates = programOccurrences(
          p,
          new Date(`${p.start}T12:00:00`),
          new Date(`${todayISO}T12:00:00`),
        ).filter(
          (date) =>
            !old.skippedOccurrences?.includes(`${p.id}:${date}`) &&
            !old.movements.some(
              (movement) => movement.id === `scheduled:${p.id}:${date}`,
            ),
        );
        let accounts = old.accounts;
        let debts = old.debts;
        const movements = [...old.movements];
        for (const date of retroactiveDates) {
          const movement: Movement = {
            id: `scheduled:${p.id}:${date}`,
            date,
            name: p.name,
            amount: p.amount,
            kind: p.kind,
            account: p.account,
            target: p.target,
            category: p.category,
            subcategory: p.subcategory,
            notes: p.notes,
            scheduled: true,
            principal: p.principal,
            interest: p.interest,
          };
          const sourceDelta = movementAccountDelta(
            movement,
            movement.account,
            debts,
          );
          const targetDelta =
            movement.kind === "deuda"
              ? -(movement.principal ?? movement.amount)
              : movement.amount;
          debts = changeDebtCapital(
            debts,
            movement.account,
            sourceDelta,
          );
          if (movement.target)
            debts = changeDebtCapital(
              debts,
              movement.target,
              targetDelta,
            );
          accounts = accounts.map((account) =>
            account.id === movement.account
              ? { ...account, balance: account.balance + sourceDelta }
              : account.id === movement.target
                ? { ...account, balance: account.balance + targetDelta }
                : account,
          );
          movements.push(movement);
        }
        return {
          ...old,
          accounts,
          debts,
          movements,
          programs: [...old.programs, p],
        };
      });
      toast(
        duplicating
          ? "Programado duplicado correctamente"
          : start <= todayISO
            ? "Programado creado y movimientos vencidos registrados"
            : "Movimiento periódico programado",
      );
    }
    setModal(null);
    setEditProgram(null);
    setDuplicating(false);
  }
  function registerExtraDebtPayment(
    original: DebtProfile,
    updated: DebtProfile,
    payment: ExtraDebtPayment,
    replacingId?: string,
  ) {
    setData((old) => {
      const replacedMovement = replacingId ? old.movements.find((movement) => movement.id === replacingId) : undefined;
      const total = Math.round((payment.amount + payment.fee) * 100) / 100;
      const movement: Movement = {
        id: replacingId ?? uid(),
        date: payment.date,
        name: `${payment.mode === "cancel" ? "Cancelación de préstamo" : "Amortización extraordinaria"} · ${original.name}`,
        amount: total,
        kind: "deuda",
        account: payment.account,
        target: original.accountId,
        category: "Deudas",
        subcategory: original.name,
        principal: payment.amount,
        interest: 0,
        notes:
          payment.fee > 0
            ? `Capital: ${money(payment.amount)} · Comisión: ${(payment.feePercent ?? 0).toFixed(2).replace(".", ",")}% (${money(payment.fee)})`
            : payment.mode === "term"
              ? "Reduce plazo"
              : payment.mode === "payment"
                ? "Reduce cuota"
                : "Cancelación total",
        debtAdjustment: {
          mode: payment.mode,
          fee: payment.fee,
          feePercent: payment.feePercent,
          previousDebt: original,
        },
      };
      const debts = (old.debts ?? []).map((debt) =>
        debt.id === updated.id ? updated : debt,
      );
      let accounts = old.accounts.map((account) => {
        const refunded = replacedMovement && account.id === replacedMovement.account ? replacedMovement.amount : 0;
        const charged = account.id === payment.account ? total : 0;
        return account.id === payment.account || refunded
          ? { ...account, balance: Math.round((account.balance + refunded - charged) * 100) / 100 }
          : account.id === updated.accountId
            ? { ...account, balance: updated.principal }
            : account;
      });
      let programs = old.programs;
      if (payment.mode === "cancel") {
        programs = programs.filter((program) => program.debtId !== updated.id);
      } else {
        const nextRow = updated.schedule?.find(
          (row) => row.date >= updated.nextPaymentDate,
        );
        programs = programs.map((program) =>
          program.debtId === updated.id
            ? {
                ...program,
                amount: updated.monthlyPayment,
                start: updated.nextPaymentDate,
                end: updated.maturityDate,
                day: new Date(`${updated.nextPaymentDate}T12:00:00`).getDate(),
                principal: nextRow?.principal,
                interest: nextRow?.interest,
              }
            : program,
        );
      }
      return {
        ...old,
        debts,
        accounts,
        programs,
        movements: replacingId ? old.movements.map((item) => item.id === replacingId ? movement : item) : [...old.movements, movement],
      };
    });
    toast(
      payment.mode === "cancel"
        ? "Préstamo cancelado y movimiento registrado"
        : replacingId ? "Amortización actualizada y cuadro recalculado" : "Amortización registrada y cuadro actualizado",
    );
  }

  function syncDebts(nextDebts: DebtProfile[]) {
    setData((old) => {
      const removedDebt = (old.debts ?? []).find(
        (debt) => !nextDebts.some((candidate) => candidate.id === debt.id),
      );
      const repaired = repairDebtAmortization(
        nextDebts,
        old.movements,
        old.accounts,
      );
      const debts = repaired.debts;
      const ids = new Set(debts.map((debt) => debt.id));
      let accounts = repaired.accounts.filter(
        (account) =>
          account.kind !== "deuda" ||
          debts.some((debt) => debt.accountId === account.id),
      );
      let programs = old.programs.filter(
        (program) => !program.debtId || ids.has(program.debtId),
      );
      for (const debt of debts) {
        const account: Account = {
          id: debt.accountId,
          name: debt.name,
          kind: "deuda",
          balance: debt.principal,
          included: false,
          icon: "card",
          color: debt.type === "card" ? "#8b6f91" : "#ad7067",
          detail:
            debt.type === "card"
              ? "Tarjeta de crédito"
              : "Préstamo o financiación",
        };
        accounts = accounts.some((item) => item.id === debt.accountId)
          ? accounts.map((item) =>
              item.id === debt.accountId ? { ...item, ...account } : item,
            )
          : [...accounts, account];
        const estimated =
          debt.type === "card"
            ? debt.paymentMethod === "full"
              ? debt.principal
              : debt.paymentMethod === "percentage"
                ? Math.max(
                    debt.monthlyPayment,
                    (debt.principal * (debt.paymentPercent ?? 5)) / 100,
                  )
                : debt.monthlyPayment
            : debt.monthlyPayment;
        const scheduleRow = debt.schedule?.find(
          (row) => row.date === debt.nextPaymentDate,
        );
        const interest =
          scheduleRow?.interest ?? (debt.principal * debt.tin) / 100 / 12;
        const principal =
          scheduleRow?.principal ?? Math.max(0, estimated - interest);
        const program: Program = {
          id: programs.find((item) => item.debtId === debt.id)?.id ?? uid(),
          debtId: debt.id,
          name: debt.name,
          amount: Math.round(estimated * 100) / 100,
          kind: "deuda",
          account: debt.paymentAccount,
          target: debt.accountId,
          category: "Deudas",
          subcategory: debt.type === "card" ? "Tarjeta de crédito" : debt.name,
          frequency: "Mensual",
          start: debt.nextPaymentDate,
          end: debt.type === "loan" ? debt.maturityDate : undefined,
          day: new Date(`${debt.nextPaymentDate}T12:00:00`).getDate(),
          active: true,
          principal: Math.round(principal * 100) / 100,
          interest: Math.round(interest * 100) / 100,
        };
        programs = programs.some((item) => item.debtId === debt.id)
          ? programs.map((item) => (item.debtId === debt.id ? program : item))
          : [...programs, program];
      }
      const next = {
        ...old,
        debts,
        accounts,
        programs,
        movements: repaired.movements,
      };
      if (!removedDebt) return next;
      return addTrashItem(next, "debt", removedDebt.name, {
        debts: [removedDebt],
        accounts: old.accounts.filter((account) => account.id === removedDebt.accountId),
        programs: old.programs.filter((program) => program.debtId === removedDebt.id),
      });
    });
    toast("Deudas y pagos programados actualizados");
  }
  function syncBudgets(nextBudgets: BudgetItem[]) {
    setData((old) => {
      const removed = (old.budgets ?? []).filter(
        (item) => !nextBudgets.some((candidate) => candidate.id === item.id),
      );
      let next: Data = { ...old, budgets: nextBudgets };
      for (const item of removed) {
        next = addTrashItem(next, "budget", item.label, { budgets: [item] });
      }
      return next;
    });
  }
  function syncAnnualExpenses(annualExpenses: AnnualExpense[]) {
    setData((old) => ({ ...old, annualExpenses }));
  }
  function createAnnualExpenseHucha(name: string, goal: number) {
    const id = uid();
    setData((old) => ({
      ...old,
      accounts: [...old.accounts, {
        id,
        name,
        kind: "hucha",
        balance: 0,
        included: false,
        icon: "wallet",
        color: "#a18194",
        detail: "Hucha para un gasto del año",
        goal,
        bucket: "savings",
      }],
    }));
    return id;
  }
  function createAnnualExpenseProgram(input: { name: string; amount: number; date: string; frequency: AnnualExpense["frequency"]; interval?: number; accountId: string; category: string; subcategory: string }) {
    const id = uid();
    const program: Program = {
      id,
      name: input.name,
      amount: input.amount,
      kind: "gasto",
      account: input.accountId,
      category: input.category,
      subcategory: input.subcategory,
      notes: "Creado desde Gastos del año",
      frequency: input.frequency === "Una vez" ? "Anual" : input.frequency,
      interval: Math.max(1, input.interval ?? 1),
      start: input.date,
      end: input.frequency === "Una vez" ? input.date : undefined,
      day: new Date(`${input.date}T12:00:00`).getDate(),
      active: true,
    };
    setData((old) => ({ ...old, programs: [...old.programs, program] }));
    return id;
  }
  function registerAnnualPayment(expense: AnnualExpense, payment: AnnualPayment, accountId: string) {
    setData((old) => {
      const occurrenceId = expense.programId ? `scheduled:${expense.programId}:${payment.date}` : "";
      if (occurrenceId && old.movements.some((movement) => movement.id === occurrenceId)) return old;
      const movement: Movement = {
        id: `annual:${expense.id}:${payment.id}`,
        date: todayISO,
        name: expense.name,
        amount: payment.amount,
        kind: "gasto",
        account: accountId,
        category: expense.category,
        subcategory: expense.subcategory ?? "",
        notes: "Registrado desde Gastos del año",
        scheduled: !!expense.programId,
      };
      return {
        ...old,
        accounts: old.accounts.map((account) => account.id === accountId ? { ...account, balance: account.balance - payment.amount } : account),
        movements: [...old.movements, movement],
        skippedOccurrences: expense.programId ? [...new Set([...(old.skippedOccurrences ?? []), `${expense.programId}:${payment.date}`])] : old.skippedOccurrences,
      };
    });
    toast("Pago registrado en Movimientos");
  }
  const visible = [...periodMovements]
    .reverse()
    .filter(
      (m) =>
        filter === "todos" ||
        (filter === "gasto"
          ? m.kind === "gasto" || m.kind === "devolucion"
          : m.kind === filter),
    )
    .filter((movement) => {
      const query = movementSearch.trim().toLocaleLowerCase("es");
      const matchesSearch = !query || [movement.name, movement.category, movement.subcategory, movement.notes, byId[movement.account]?.name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("es").includes(query));
      const matchesCategory = movementCategoryFilter === "todas" || movement.category === movementCategoryFilter;
      const matchesAccount = movementAccountFilter === "todas" || movement.account === movementAccountFilter || movement.target === movementAccountFilter;
      const matchesSubcategory = movementSubcategoryFilter === "todas" || movement.subcategory === movementSubcategoryFilter;
      const matchesMin = !movementMinAmount || movement.amount >= Number(movementMinAmount.replace(",", "."));
      const matchesMax = !movementMaxAmount || movement.amount <= Number(movementMaxAmount.replace(",", "."));
      return matchesSearch && matchesCategory && matchesAccount && matchesSubcategory && matchesMin && matchesMax;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const visibleNetTotal = visible.reduce((total, movement) => {
    if (movement.kind === "ingreso" || movement.kind === "devolucion") return total + movement.amount;
    if (movement.kind === "traspaso") return total;
    return total - movement.amount;
  }, 0);
  const importMovements = (rows: Array<Omit<ToolMovement, "id">>) => {
    setData((old) => ({
      ...old,
      movements: [
        ...old.movements,
        ...rows.map((row) => ({
          ...row,
          id: uid(),
          kind: (["gasto", "ingreso", "traspaso", "deuda", "devolucion"].includes(row.kind) ? row.kind : "gasto") as MovementKind,
          subcategory: row.subcategory ?? "",
        })),
      ],
    }));
  };
  const days = Object.entries(
    visible.reduce<Record<string, Movement[]>>((all, m) => {
      (all[m.date] ??= []).push(m);
      return all;
    }, {}),
  );
  const titles: Record<Tab, string> = {
    cuentas: "Cuentas",
    programados: "Programados",
    movimientos: "Movimientos",
    deudas: "Deudas",
    presupuestos: "Presupuestos",
    categorias: "Balance",
  };
  const privateMoney = (value: number, group: AccountKind) =>
    hiddenAccountGroups.includes(group) ? "**** €" : money(value);
  const privateAccountDetail = (
    value: string | undefined,
    group: AccountKind,
  ) =>
    hiddenAccountGroups.includes(group)
      ? value?.replace(/\d[\d.,]*\s*€/g, "**** €")
      : value;
  const tabs: Tab[] = [
    "cuentas",
    "movimientos",
    "deudas",
    "presupuestos",
    "categorias",
  ];
  const projectedRows = periodUpcoming.map((m) => {
    const definition = categoryDefinition(m.category);
    const color =
      definition?.color ?? (m.kind === "traspaso" ? "#70899b" : "#2d8f88");
    const programId = "programId" in m ? m.programId : undefined;
    const sourceProgram = data.programs.find(
      (program) => program.id === programId,
    );
    const occurrencePosition = sourceProgram ? programOccurrencePosition(sourceProgram, m.date) : null;
    return (
      <div key={m.id} className="future-row">
        <span className="future-date">{friendly(m.date)}</span>
        <span
          className="movement-category-icon"
          style={{ background: `${color}18`, color }}
        >
          {m.kind === "traspaso" ? (
            "⇄"
          ) : (
            <CategoryIcon name={definition?.icon ?? "star"} size={19} />
          )}
        </span>
        <div className="future-copy">
          <strong>
            {m.kind === "traspaso"
              ? m.name
              : [m.category, m.subcategory].filter(Boolean).join(" · ")}
          </strong>
          <small>
            {m.category}
            {m.subcategory ? ` › ${m.subcategory}` : ""} ·{" "}
            {byId[m.account]?.name}
            {occurrencePosition ? ` · Plazo ${occurrencePosition}` : ""}
          </small>
          {m.notes && <small className="movement-notes">{m.notes}</small>}
          <div className="future-actions">
            {sourceProgram ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const movement = {
                      ...m,
                      id: `future:${sourceProgram.id}`,
                    } as Movement;
                    setEdit(movement);
                    setDuplicatingMovement(true);
                    setKind(movement.kind);
                    setCat(movement.category);
                    setModal("movement");
                  }}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => skipOccurrence(sourceProgram.id, m.date, m.name)}
                >
                  Saltar esta vez
                </button>
                <button
                  type="button"
                  className="future-delete"
                  onClick={() => deleteProgram(sourceProgram)}
                >
                  Eliminar programado
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const movement = m as Movement;
                    setEdit(movement);
                    setDuplicatingMovement(true);
                    setKind(movement.kind);
                    setCat(movement.category);
                    setModal("movement");
                  }}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const movement = m as Movement;
                    setEdit(movement);
                    setDuplicatingMovement(false);
                    setKind(movement.kind);
                    setCat(movement.category);
                    setModal("movement");
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="future-delete"
                  onClick={() => deleteMovement(m as Movement)}
                >
                  Eliminar
                </button>
              </>
            )}
          </div>
        </div>
        <div className="future-amount">
          <strong className={impact(m) > 0 ? "positive" : ""}>
            {impact(m) > 0 ? "+" : "−"}
            {money(m.amount)}
          </strong>
          <small>Previsto</small>
        </div>
      </div>
    );
  });
  const expenseChart = (
    title: string,
    subtitle: string,
    rows: [string, { total: number; subs: Record<string, number> }][],
    total: number,
  ) => {
    let position = 0;
    const slices = rows.map(([name, value], index) => {
      const from = position;
      position += total ? (value.total / total) * 100 : 0;
      return `${categoryDefinition(name)?.color ?? categoryColors[index % categoryColors.length]} ${from}% ${position}%`;
    });
    return (
      <article className="balance-comparison-card">
        <div className="balance-comparison-heading">
          <div><span>{subtitle}</span><h2>{title}</h2></div>
          <strong>{money(total)}</strong>
        </div>
        {rows.length ? (
          <div className="category-chart-content">
            <div className="category-donut" style={{ background: `conic-gradient(${slices.join(", ")})` }}>
              <div className="category-donut-center"><strong>100 %</strong><span>de tus gastos</span></div>
            </div>
            <div className="category-chart-legend">
              {rows.map(([name, value], index) => {
                const definition = categoryDefinition(name);
                const color = definition?.color ?? categoryColors[index % categoryColors.length];
                const subcategories = Object.entries(value.subs)
                  .map(([subcategory, amount]) => ({
                    name: subcategory || "Sin subcategoría",
                    total: amount,
                  }))
                  .sort((a, b) => b.total - a.total);
                return (
                  <details className="income-breakdown" key={name}>
                    <summary className="category-legend-row">
                      <span className="category-legend-name">
                        <i style={{ background: color }} />
                        <span className="legend-line-icon" style={{ color }}>
                          <CategoryIcon name={definition?.icon ?? "star"} size={15} />
                        </span>
                        {name}
                      </span>
                      <strong>{total ? ((value.total / total) * 100).toFixed(1).replace(".", ",") : "0"} %</strong>
                    </summary>
                    <div className="income-breakdown-list">
                      {subcategories.map((subcategory) => (
                        <div key={subcategory.name}>
                          <span>{subcategory.name}</span>
                          <strong>{money(subcategory.total)}</strong>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        ) : <p className="empty-comparison">No hay gastos en este periodo.</p>}
      </article>
    );
  };
  const incomeChart = (
    title: string,
    subtitle: string,
    rows: { name: string; total: number; color: string }[],
    totalIncome: number,
    totalAllocated: number,
    breakdowns: Record<string, { name: string; total: number }[]>,
  ) => {
    const chartBase = Math.max(totalIncome, totalAllocated, 1);
    let position = 0;
    const slices = rows.map((item) => {
      const from = position;
      position += (item.total / chartBase) * 100;
      return `${item.color} ${from}% ${position}%`;
    });
    if (position < 100) slices.push(`#edf0ed ${position}% 100%`);
    return (
      <article className="balance-comparison-card">
        <div className="balance-comparison-heading"><div><span>{subtitle}</span><h2>{title}</h2></div><strong>{money(totalIncome)}</strong></div>
        {totalIncome > 0 || rows.length ? <div className="category-chart-content">
          <div className="category-donut" style={{ background: `conic-gradient(${slices.join(", ")})` }}><div className="category-donut-center"><strong>{totalIncome ? Math.round((totalAllocated / totalIncome) * 100) : 0} %</strong><span>destinado</span></div></div>
          <div className="category-chart-legend income-chart-legend">
            {rows.map((item) => (
              <details className="income-breakdown" key={item.name}>
                <summary className="category-legend-row">
                  <span className="category-legend-name"><i style={{ background: item.color }} />{item.name}</span>
                  <strong>{totalIncome ? ((item.total / totalIncome) * 100).toFixed(1).replace(".", ",") : "0"} %</strong>
                </summary>
                <div className="income-breakdown-list">
                  {(breakdowns[item.name] ?? []).map((row) => (
                    <div key={row.name}><span>{row.name}</span><strong>{money(row.total)}</strong></div>
                  ))}
                </div>
              </details>
            ))}
            {totalIncome > totalAllocated && <div className="category-legend-row"><span className="category-legend-name"><i style={{ background: "#edf0ed" }} />Disponible</span><strong>{(((totalIncome - totalAllocated) / totalIncome) * 100).toFixed(1).replace(".", ",")} %</strong></div>}
          </div>
        </div> : <p className="empty-comparison">No hay ingresos en este periodo.</p>}
        {totalIncome > 0 && totalAllocated > totalIncome && <p className="category-chart-alert">Has destinado más dinero del que has ingresado en este período.</p>}
      </article>
    );
  };
  const distributionRule = (
    title: string,
    totalIncome: number,
    amounts: { needs: number; wants: number; savings: number },
    details: {
      needs: RuleDetail[];
      wants: RuleDetail[];
      savings: RuleDetail[];
    },
  ) => (
    <article className="rule-comparison rule-comparison-panel">
      <div className="rule-panel-heading">
        <span>{title}</span>
        <strong>{money(totalIncome)} de ingresos</strong>
      </div>
      {[
        ["Sobrevivir", "needs", targetNeeds, amounts.needs, "#44ad91"],
        ["Disfrutar", "wants", targetWants, amounts.wants, "#f0b92e"],
        ["Ahorro e inversión", "savings", targetSavings, amounts.savings, "#7d58b3"],
      ].map(([label, bucket, target, amount, color]) => {
        const percentage = totalIncome
          ? (Number(amount) / totalIncome) * 100
          : 0;
        const rows = details[bucket as "needs" | "wants" | "savings"];
        const groupedRows = Object.values(
          rows.reduce<Record<string, { category: string; amount: number }>>(
            (groups, row) => {
              groups[row.category] ??= {
                category: row.category,
                amount: 0,
              };
              groups[row.category].amount += row.amount;
              return groups;
            },
            {},
          ),
        ).sort((a, b) => b.amount - a.amount);
        return (
          <details className="rule-row-details" key={String(label)}>
            <summary className="rule-row">
              <div>
                <strong>{label}</strong>
                <span>
                  Objetivo {target}% · Resultado{" "}
                  {percentage.toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <div className="rule-track">
                <i
                  style={{
                    width: `${Math.min(100, percentage)}%`,
                    background: String(color),
                  }}
                />
                <b style={{ left: `${Math.min(100, Number(target))}%` }} />
              </div>
            </summary>
            <div className="rule-detail-list">
              {groupedRows.length ? groupedRows.map((row) => (
                <div className="rule-detail-item" key={row.category}>
                  <strong>{row.category}</strong>
                  <strong>{money(row.amount)}</strong>
                </div>
              )) : <p>No hay movimientos incluidos.</p>}
            </div>
          </details>
        );
      })}
    </article>
  );
  const preferredDisplayName = data.preferences?.displayName?.trim() || displayName;
  const selectedTheme = data.preferences?.theme === "dark" ? "dark" : "light";
  const topbarDate = data.preferences?.dateFormat === "yyyy-mm-dd"
    ? todayISO
    : data.preferences?.dateFormat === "dd/mm/yyyy"
      ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(today)
      : new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(today);
  if (!ready) {
    return <main className="auth-page"><div className="auth-loading" role="status"><img src="/mizufi-logo-ola-mar.png" alt="" /><span>Cargando MiZUFi…</span></div></main>;
  }
  if (loadError) {
    return <main className="auth-page"><div className="auth-loading finance-load-error" role="alert"><img src="/mizufi-logo-ola-mar.png" alt="" /><strong>No hemos podido cargar tus datos</strong><span>Comprueba tu conexión y vuelve a intentarlo.</span><button type="button" className="auth-primary" onClick={() => window.location.reload()}>Volver a intentar</button></div></main>;
  }
  return (
    <div className={`app-shell tab-${tab} theme-${selectedTheme}`}>
      <aside className="sidebar">
        <div className="brand brand-logo">
          <img src="/mizufi-logo-ola-mar.png" alt="Mizufi" />
          <span>Controla la marea de tus finanzas</span>
        </div>
        <nav className="side-nav">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "nav-item active" : "nav-item"}
              onClick={() => rememberTab(t)}
            >
              <Icon name={t} />
              {titles[t]}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <p>
            Tu dinero, a tu ritmo.
            <br />
            Cada euro tiene su lugar.
          </p>
        </div>
      </aside>
      <main
        className="main-content"
        onTouchStart={(event) => {
          if (settingsOpen || modal || (event.target as HTMLElement).closest("input, select, textarea, button, a, [role='dialog'], [data-no-swipe]")) return;
          const touch = event.touches[0];
          swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = swipeStartRef.current;
          swipeStartRef.current = null;
          if (!start || settingsOpen || modal) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 75 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
          const index = tabs.indexOf(tab);
          const nextIndex = dx < 0 ? index + 1 : index - 1;
          if (nextIndex >= 0 && nextIndex < tabs.length) {
            rememberTab(tabs[nextIndex]);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
      >
        <header className="topbar">
          <div className="mobile-brand">
            <span className="mobile-brand-mark">
              <Icon name="wave" size={21} />
            </span>{" "}
            Mizufi
          </div>
          <span className="topbar-date">
            {topbarDate}
          </span>
          <span className={`save-status ${saveState}`} aria-live="polite">
            {saveState === "saving" ? "Guardando…" : saveState === "error" ? "No se pudo guardar" : "Datos guardados"}
          </span>
          <div className="topbar-actions">
            <div className="profile-space-stack">
            <div className="avatar-stack">
              <button
                type="button"
                className="avatar"
                title={`${preferredDisplayName} · ${activeSpace?.name ?? "Mis finanzas"}`}
                aria-label="Abrir perfil y espacios"
                aria-expanded={spaceMenuOpen}
                onClick={() => { setSpaceMenuOpen((open) => !open); setSpaceMessage(""); setSpaceForm(null); setSpaceActionId(null); }}
              >
                {data.preferences?.profilePhoto ? <img src={data.preferences.profilePhoto} alt="" /> : preferredDisplayName.slice(0, 1).toUpperCase()}
              </button>
              {spaceMenuOpen && <>
                <button type="button" className="space-menu-scrim" aria-label="Cerrar selector" onClick={() => setSpaceMenuOpen(false)} />
                <section className="space-switcher" aria-label="Perfil y espacios financieros">
                  <header>
                    <span className="space-switcher-avatar">{data.preferences?.profilePhoto ? <img src={data.preferences.profilePhoto} alt="" /> : preferredDisplayName.slice(0, 1).toUpperCase()}</span>
                    <div><strong>{preferredDisplayName}</strong><small>{email}</small><div className="space-profile-photo-actions"><label>{data.preferences?.profilePhoto ? "Cambiar foto" : "Añadir foto"}<input type="file" accept="image/*" onChange={(event) => { updateProfilePhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{data.preferences?.profilePhoto && <button type="button" onClick={() => updatePreferences({ profilePhoto: undefined })}>Quitar foto</button>}</div></div>
                  </header>
                  <p className="space-switcher-label">USUARIOS EN ESTE DISPOSITIVO</p>
                  <div className="device-account-list">
                    {deviceAccounts.map((accountItem) => <div className="device-account-row" key={accountItem.userId}><button type="button" className={accountItem.userId === currentUserId ? "active" : ""} onClick={() => { if (accountItem.userId !== currentUserId) { setSpaceMenuOpen(false); void onSwitchAccount(accountItem.userId); } }}>
                      <span>{accountItem.email.slice(0, 1).toUpperCase()}</span><span>{accountItem.email}</span>{accountItem.userId === currentUserId && <b>✓</b>}
                    </button>{accountItem.userId !== currentUserId && <button type="button" className="device-account-remove" aria-label={`Quitar ${accountItem.email} de este dispositivo`} title="Quitar usuario de este dispositivo" onClick={() => { if (window.confirm(`¿Seguro que quieres quitar ${accountItem.email} de este dispositivo? La cuenta y sus datos no se borrarán.`)) onForgetAccount(accountItem.userId); }}>×</button>}</div>)}
                    <button type="button" className="device-account-add" onClick={() => { setSpaceMenuOpen(false); onAddAccount(); }}>＋ Añadir otro usuario</button>
                  </div>
                  <p className="space-switcher-label">ESPACIOS FINANCIEROS</p>
                  <div className="space-switcher-list">
                    {spaces.map((space) => <div key={space.id} className={`space-switcher-row ${space.id === activeSpaceId ? "active" : ""}`}>
                      <button type="button" className="space-switcher-main" onClick={() => { onSwitchSpace(space.id); setSpaceMenuOpen(false); }}>
                        <span className={`space-kind-icon ${space.kind}`}>{space.kind === "demo" ? "D" : space.kind === "shared" ? "2" : preferredDisplayName.slice(0, 1).toUpperCase()}</span>
                        <span><strong>{space.name}</strong><small>{space.kind === "demo" ? "Demostración" : space.kind === "shared" ? `${space.memberCount} ${space.memberCount === 1 ? "persona" : "personas"}` : "Personal"}</small></span>
                        {space.id === activeSpaceId && <b aria-label="Espacio activo">✓</b>}
                      </button>
                      <div className="space-switcher-row-actions">
                        {space.role === "owner" && <button type="button" aria-label={`Editar ${space.name}`} title="Editar espacio" onClick={() => { setSpaceActionId(space.id); setSpaceForm("edit"); setSpaceName(space.name); setSpaceKind(space.kind); setSpaceMessage(""); }}>✎</button>}
                        <button type="button" className="remove" aria-label={space.role === "owner" ? `Eliminar ${space.name}` : `Salir de ${space.name}`} title={space.role === "owner" ? "Eliminar espacio" : "Salir del espacio"} onClick={() => { setSpaceActionId(space.id); setSpaceForm("delete"); setDeleteSpaceText(""); setSpaceMessage(""); }}>×</button>
                      </div>
                    </div>)}
                  </div>
                  {spaceForm === "edit" && <div className="space-inline-form">
                    <label>Nombre<input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} maxLength={50} /></label>
                    <label>Tipo<select value={spaceKind} onChange={(event) => setSpaceKind(event.target.value as typeof spaceKind)}><option value="personal">Personal</option><option value="demo">Demostración</option><option value="shared">Compartido</option></select></label>
                    <div><button type="button" onClick={() => { setSpaceForm(null); setSpaceActionId(null); }}>Cancelar</button><button type="button" className="primary" disabled={spaceBusy} onClick={updateSpace}>{spaceBusy ? "Guardando…" : "Guardar"}</button></div>
                  </div>}
                  {spaceForm === "create" ? <div className="space-inline-form">
                    <label>Nombre<input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} placeholder="Por ejemplo, MiZUFi Demo" maxLength={50} /></label>
                    <label>Tipo<select value={spaceKind} onChange={(event) => setSpaceKind(event.target.value as typeof spaceKind)}><option value="personal">Personal</option><option value="demo">Demostración</option><option value="shared">Compartido</option></select></label>
                    <div><button type="button" onClick={() => setSpaceForm(null)}>Cancelar</button><button type="button" className="primary" disabled={spaceBusy} onClick={createSpace}>{spaceBusy ? "Creando…" : "Crear espacio"}</button></div>
                  </div> : spaceForm === null && <button type="button" className="space-switcher-add" onClick={() => { setSpaceForm("create"); setSpaceName(""); setSpaceKind("personal"); setSpaceMessage(""); }}>＋ Crear otro espacio</button>}
                  {(activeSpace?.kind === "shared" || activeSpace?.kind === "demo") && activeSpace.role === "owner" && (spaceForm === "invite" ? <div className="space-inline-form">
                    <label>Correo de la otra persona<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="correo@ejemplo.com" /></label>
                    <label>Permiso<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)}><option value="editor">Puede editar</option><option value="viewer">Solo lectura</option></select></label>
                    <div><button type="button" onClick={() => setSpaceForm(null)}>Cancelar</button><button type="button" className="primary" disabled={spaceBusy} onClick={inviteMember}>{spaceBusy ? "Guardando…" : "Invitar"}</button></div>
                  </div> : spaceForm === null && <button type="button" className="space-switcher-add" onClick={() => { setSpaceForm("invite"); setSpaceMessage(""); }}>＋ Invitar a este espacio</button>)}
                  {spaceForm === "delete" && <div className="space-delete-form">
                    <strong>{managedSpace?.role === "owner" ? `Eliminar «${managedSpace.name}»` : `Salir de «${managedSpace?.name}»`}</strong>
                    <p>{managedSpace?.role === "owner" ? managedSpace.kind === "shared" ? "Se borrarán todos sus datos y desaparecerá para todas las personas invitadas." : "Se borrarán definitivamente todos los datos guardados en este espacio." : "Dejarás de verlo, pero sus datos seguirán disponibles para las demás personas."}</p>
                    {managedSpace?.role === "owner" && <label>Escribe <b>ELIMINAR</b><input value={deleteSpaceText} onChange={(event) => setDeleteSpaceText(event.target.value)} /></label>}
                    <div><button type="button" onClick={() => { setSpaceForm(null); setSpaceActionId(null); setDeleteSpaceText(""); }}>Cancelar</button><button type="button" className="danger" disabled={spaceBusy} onClick={deleteOrLeaveSpace}>{spaceBusy ? "Un momento…" : managedSpace?.role === "owner" ? "Eliminar espacio" : "Salir del espacio"}</button></div>
                  </div>}
                  {spaceMessage && <p className="space-switcher-message" role="status">{spaceMessage}</p>}
                  <div className="space-switcher-actions">
                    <button type="button" onClick={onSignOut}><span>↪</span> Cerrar sesión</button>
                  </div>
                </section>
              </>}
            </div>
              <span className="active-space-name" title={activeSpace?.name}>{activeSpace?.name ?? "Mis finanzas"}</span>
              <small>BETA</small>
            </div>
            <button type="button" className="topbar-settings-button" aria-label="Abrir ajustes" title="Ajustes" onClick={() => { setSpaceMenuOpen(false); setSettingsSection(null); setSettingsOpen(true); }}>⚙</button>
            <NotificationCenter movements={data.movements} accounts={data.accounts} readScope={`${currentUserId}:${activeSpaceId}`} onOpenLatestReport={() => { setSettingsOpen(true); setSettingsSection("informes"); setPeriod("mes"); setPeriodOffset(-1); setTimeout(() => document.querySelector(".data-tools")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100); }} />
          </div>
        </header>
        {isSpaceReadOnly && <div className="space-readonly-note">Estás viendo «{activeSpace?.name}» en modo de solo lectura.</div>}
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {tab === "cuentas"
                ? "TU VISIÓN GENERAL"
                : tab === "movimientos"
                    ? "DÍA A DÍA"
                    : tab === "deudas"
                      ? "RECUPERA EL RUMBO"
                      : tab === "presupuestos"
                        ? "TRAZA TU RUMBO"
                        : "ENTIENDE TU DINERO"}
            </p>
            <div className="page-title-line">
              <h1>{titles[tab]}</h1>
            </div>
          </div>
          {tab !== "presupuestos" && tab !== "categorias" && (
            <button
              className="button-primary"
              aria-label={tab === "deudas" ? "Añadir deuda" : undefined}
              onClick={() => {
                if (tab === "deudas") {
                  setDebtCreateRequest((value) => value + 1);
                  return;
                }
                setKind("gasto");
                setCat(
                  activeCategoryDefinitions.find(
                    (category) =>
                      category.name !== "Ingresos" &&
                      category.name !== "Deudas",
                  )?.name ?? "Alimentación",
                );
                setSubcat("");
                setEditAccount(null);
                setEditProgram(null);
                setDuplicating(false);
                setEdit(null);
                setDuplicatingMovement(false);
                setModal(
                  tab === "cuentas"
                    ? "account"
                    : tab === "movimientos" && movementSection === "recurrentes"
                      ? "program"
                      : "movement",
                );
              }}
            >
              <Icon name="plus" size={18} />
              <span>
                {tab === "cuentas"
                  ? "Añadir cuenta"
                  : tab === "movimientos" && movementSection === "recurrentes"
                    ? "Añadir recurrente"
                    : tab === "deudas"
                      ? "Añadir deuda"
                      : "Añadir movimiento"}
              </span>
            </button>
          )}
        </div>
        {tab === "cuentas" && (
          <section>
            <div className="summary-row">
              <article className="summary-card available-card">
                <span>Disponible para gastar</span>
                <strong>{money(available)}</strong>
                <small>Saldo actual − pagos previstos + ingresos previstos del periodo</small>
              </article>
              <article className="summary-card">
                <span>Saldo en cuentas activas</span>
                <strong>{money(current)}</strong>
                <small>{included.length} cuentas incluidas</small>
              </article>
              <article className="summary-card">
                <span>Patrimonio total</span>
                <strong>{money(worth)}</strong>
                <small>Todo lo que tienes, menos tus deudas</small>
              </article>
            </div>
            {activeAccounts.length === 0 && <div className="empty-onboarding"><h2>Empieza por tu primera cuenta</h2><p>Añade la cuenta que utilizas en el día a día. Después podrás registrar movimientos y MiZUFi calculará cuánto tienes realmente disponible.</p><button type="button" className="button-primary" onClick={() => { setEditAccount(null); setModal("account"); }}>Añadir mi primera cuenta</button></div>}
            <div className="account-groups" data-tour="accounts">
              {groups.map((g) => {
                const items = activeAccounts.filter((a) => a.kind === g.id);
                const collapsed = collapsedAccountGroups.includes(g.id);
                return (
                  <section
                    className={`account-group${collapsed ? " account-group-collapsed" : ""}`}
                    key={g.id}
                  >
                    <div className="group-heading">
                      <button
                        type="button"
                        className="group-heading-button group-heading-content"
                        aria-expanded={!collapsed}
                        onClick={() => {
                          rememberCollapsedAccountGroups(
                            collapsed
                              ? collapsedAccountGroups.filter((id) => id !== g.id)
                              : [...collapsedAccountGroups, g.id],
                          );
                          setAccountMenu(null);
                        }}
                      >
                        <div>
                          <h2>{g.title}</h2>
                          <span>{g.subtitle}</span>
                        </div>
                        <span className="group-heading-total">
                          <strong>
                            {privateMoney(
                              items.reduce((n, a) => n + a.balance, 0),
                              g.id,
                            )}
                          </strong>
                          <i className={collapsed ? "" : "rotated"}>
                            <Icon name="down" size={17} />
                          </i>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="privacy-toggle group-privacy-toggle"
                        onClick={() =>
                          setHiddenAccountGroups((current) =>
                            current.includes(g.id)
                              ? current.filter((id) => id !== g.id)
                              : [...current, g.id],
                          )
                        }
                        aria-label={
                          hiddenAccountGroups.includes(g.id)
                            ? `Mostrar importes de ${g.title}`
                            : `Ocultar importes de ${g.title}`
                        }
                        title={
                          hiddenAccountGroups.includes(g.id)
                            ? "Mostrar importes"
                            : "Ocultar importes"
                        }
                      >
                        <Icon
                          name={
                            hiddenAccountGroups.includes(g.id)
                              ? "eyeOff"
                              : "eye"
                          }
                          size={18}
                        />
                      </button>
                    </div>
                    {!collapsed && (
                      <div>
                        {items.length === 0 && (
                          <p className="empty-group">
                            No hay cuentas activas en este apartado.
                          </p>
                        )}
                        {items.map((a) => (
                          <article
                            key={a.id}
                            className={`account-row${draggingAccount === a.id ? " account-row-dragging" : ""}`}
                            data-account-id={a.id}
                            data-account-kind={a.kind}
                          >
                            {items.length > 1 && (
                              <button
                                type="button"
                                className="account-drag-handle"
                                aria-label={`Arrastrar ${a.name} para cambiar su posición`}
                                title="Mantén pulsado y arrastra"
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  setAccountMenu(null);
                                  draggingAccountRef.current = a;
                                  setDraggingAccount(a.id);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                                  event.preventDefault();
                                  const index = items.findIndex((item) => item.id === a.id);
                                  const target = items[index + (event.key === "ArrowUp" ? -1 : 1)];
                                  if (target) {
                                    moveAccountTo(a, target.id);
                                    toast("Orden de cuentas actualizado");
                                  }
                                }}
                              >
                                <span /><span /><span />
                              </button>
                            )}
                            <div
                              className="account-icon"
                              style={{
                                background: `${a.color}18`,
                                color: a.color,
                              }}
                            >
                              <CategoryIcon name={a.icon} size={20} />
                            </div>
                            <div className="account-copy">
                              <strong>{a.name}</strong>
                              <span>
                                {privateAccountDetail(a.detail, a.kind)}
                              </span>
                              {a.goal && (
                                <div className="goal-track">
                                  <i
                                    style={{
                                      width: `${Math.min(100, (a.balance / a.goal) * 100)}%`,
                                      background: a.color,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="account-right">
                              <strong>{privateMoney(a.balance, a.kind)}</strong>
                              <button
                                className={
                                  a.included
                                    ? "include-toggle on"
                                    : "include-toggle"
                                }
                                aria-label={`${a.included ? "Excluir" : "Incluir"} ${a.name} del saldo disponible`}
                                onClick={() =>
                                  setData((old) => ({
                                    ...old,
                                    accounts: old.accounts.map((x) =>
                                      x.id === a.id
                                        ? { ...x, included: !x.included }
                                        : x,
                                    ),
                                  }))
                                }
                              >
                                <i />
                              </button>
                            </div>
                            <div className="account-actions">
                              <button
                                className="account-menu-button"
                                aria-label={`Opciones de ${a.name}`}
                                onClick={() =>
                                  setAccountMenu(
                                    accountMenu === a.id ? null : a.id,
                                  )
                                }
                              >
                                ⋯
                              </button>
                              {accountMenu === a.id && (
                                <div className="account-menu">
                                  <button
                                    onClick={() => {
                                      setEditAccount(a);
                                      setAccountMenu(null);
                                      setModal("account");
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button onClick={() => archiveAccount(a)}>
                                    Archivar
                                  </button>
                                  <button
                                    className="delete-action"
                                    onClick={() => deleteAccount(a)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
              {archivedAccounts.length > 0 && (
                <section className="account-group archived-section">
                  <button
                    className="archived-heading"
                    onClick={() => { const open = !showArchived; setShowArchived(open); updatePreferences({ showArchivedAccounts: open }); }}
                  >
                    <span>
                      Cuentas archivadas <em>{archivedAccounts.length}</em>
                    </span>
                    <i className={showArchived ? "rotated" : ""}>
                      <Icon name="down" size={17} />
                    </i>
                  </button>
                  {showArchived && (
                    <div>
                      {archivedAccounts.map((a) => (
                        <article
                          key={a.id}
                          className="account-row archived-row"
                        >
                          <div
                            className="account-icon"
                            style={{
                              background: `${a.color}18`,
                              color: a.color,
                            }}
                          >
                            <CategoryIcon name={a.icon} size={20} />
                          </div>
                          <div className="account-copy">
                            <strong>{a.name}</strong>
                            <span>
                              {groups.find((g) => g.id === a.kind)?.title} ·{" "}
                              {privateMoney(a.balance, a.kind)}
                            </span>
                          </div>
                          <button
                            className="restore-button"
                            onClick={() => restoreAccount(a)}
                          >
                            Desarchivar
                          </button>
                          <button
                            className="archived-delete"
                            aria-label={`Eliminar ${a.name}`}
                            onClick={() => deleteAccount(a)}
                          >
                            Eliminar
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>
        )}
        {tab === "movimientos" && (
          <div className="movement-section-tabs" role="tablist" aria-label="Secciones de movimientos" data-tour="recurrentes">
            <button
              type="button"
              role="tab"
              aria-selected={movementSection === "movimientos"}
              className={movementSection === "movimientos" ? "selected" : ""}
              onClick={() => rememberMovementSection("movimientos")}
            >
              Movimientos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={movementSection === "recurrentes"}
              className={movementSection === "recurrentes" ? "selected" : ""}
              onClick={() => rememberMovementSection("recurrentes")}
            >
              Recurrentes
            </button>
          </div>
        )}
        {tab === "movimientos" && movementSection === "recurrentes" && (
          <section>
            <div className="intro-strip">
              <span>Organiza ingresos, gastos y traspasos que se repiten.</span>
              <strong>
                {currentPrograms.filter((p) => p.active).length} activos
              </strong>
            </div>
            <div className="list-filters">
              <label className="search-field"><span className="sr-only">Buscar programados</span><Icon name="search" size={17} /><input type="search" value={programSearch} onChange={(event) => setProgramSearch(event.target.value)} placeholder="Buscar programados" /></label>
              <select value={programCategoryFilter} onChange={(event) => { if (event.target.value === "__create__") startCategoryCreation(); else setProgramCategoryFilter(event.target.value); }} aria-label="Filtrar recurrentes por categoría"><option value="todas">Todas las categorías</option>{[...selectableCategoryDefinitions].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })).map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}<option value="__create__">+ Crear categoría</option></select>
            </div>
            <div className="program-list">
              {visiblePrograms.map((p) => (
                <article
                  key={p.id}
                  className={`program-card${p.active ? "" : " program-paused"}`}
                >
                  <div className={`movement-symbol ${p.kind}`}>
                    {p.kind === "ingreso"
                      ? "↗"
                      : p.kind === "traspaso"
                        ? "⇄"
                        : "↘"}
                  </div>
                  <div className="program-info">
                    <strong>
                      {p.name}
                      {!p.active && (
                        <span className="paused-label"> · desactivado</span>
                      )}
                    </strong>
                    <span>
                      {p.frequency} · Día {p.day} · {byId[p.account]?.name}
                      {p.target ? ` → ${byId[p.target]?.name}` : ""}
                    </span>
                    <small>
                      Desde {friendly(p.start)}
                      {p.occurrences ? ` · ${p.occurrences} ${p.occurrences === 1 ? "vez" : "veces"}` : p.end ? ` hasta ${friendly(p.end)}` : " · Indefinido"}
                    </small>
                  </div>
                  <div className="program-right">
                    <strong className={p.kind === "ingreso" ? "positive" : ""}>
                      {p.kind === "ingreso" ? "+" : ""}
                      {money(p.amount)}
                    </strong>
                    <button
                      className={
                        p.active ? "include-toggle on" : "include-toggle"
                      }
                      aria-label={`${p.active ? "Desactivar" : "Activar"} ${p.name}`}
                      onClick={() => {
                        setData((old) => ({
                          ...old,
                          programs: old.programs.map((x) =>
                            x.id === p.id ? { ...x, active: !x.active } : x,
                          ),
                        }));
                        toast(
                          p.active
                            ? `${p.name} desactivado`
                            : `${p.name} activado`,
                        );
                      }}
                    >
                      <i />
                    </button>
                  </div>
                  <div className="account-actions program-actions">
                    <button
                      className="account-menu-button"
                      aria-label={`Opciones de ${p.name}`}
                      onClick={() =>
                        setProgramMenu(programMenu === p.id ? null : p.id)
                      }
                    >
                      ⋯
                    </button>
                    {programMenu === p.id && (
                      <div className="account-menu">
                        <button
                          onClick={() => {
                            setEditProgram(p);
                            setDuplicating(false);
                            setKind(p.kind);
                            setCat(p.category);
                            setProgramMenu(null);
                            setModal("program");
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setEditProgram(p);
                            setDuplicating(true);
                            setKind(p.kind);
                            setCat(p.category);
                            setProgramMenu(null);
                            setModal("program");
                          }}
                        >
                          Duplicar
                        </button>
                        <button onClick={() => archiveProgram(p)}>
                          Archivar
                        </button>
                        <button
                          className="delete-action"
                          onClick={() => deleteProgram(p)}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {visiblePrograms.length === 0 && (currentPrograms.length === 0
                ? <div className="empty-onboarding"><h2>Aquí aparecerá lo que se repite</h2><p>Crea un ingreso o pago recurrente y MiZUFi preparará automáticamente los próximos movimientos.</p><button type="button" className="button-primary" onClick={() => { setEditProgram(null); setDuplicating(false); setModal("program"); }}>Crear mi primer recurrente</button></div>
                : <p className="empty-group">No hay programados que coincidan con la búsqueda.</p>)}
            </div>
            {archivedPrograms.length > 0 && (
              <section className="account-group archived-section archived-programs">
                <button
                  className="archived-heading"
                  onClick={() => { const open = !showArchivedPrograms; setShowArchivedPrograms(open); updatePreferences({ showArchivedPrograms: open }); }}
                >
                  <span>
                    Recurrentes archivados <em>{archivedPrograms.length}</em>
                  </span>
                  <i className={showArchivedPrograms ? "rotated" : ""}>
                    <Icon name="down" size={17} />
                  </i>
                </button>
                {showArchivedPrograms && (
                  <div>
                    {archivedPrograms.map((p) => (
                      <article key={p.id} className="account-row archived-row">
                        <div className={`movement-symbol ${p.kind}`}>
                          {p.kind === "ingreso"
                            ? "↗"
                            : p.kind === "traspaso"
                              ? "⇄"
                              : "↘"}
                        </div>
                        <div className="account-copy">
                          <strong>{p.name}</strong>
                          <span>
                            {p.frequency} · {money(p.amount)}
                          </span>
                        </div>
                        <button
                          className="restore-button"
                          onClick={() => restoreProgram(p)}
                        >
                          Desarchivar
                        </button>
                        <button
                          className="archived-delete"
                          aria-label={`Eliminar ${p.name}`}
                          onClick={() => deleteProgram(p)}
                        >
                          Eliminar
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
            <p className="helper-note">
              Los cambios aquí afectan a los próximos movimientos. Para
              modificar solo una fecha o importe puntual, ve a Movimientos.
            </p>
          </section>
        )}
        {tab === "movimientos" && movementSection === "movimientos" && (
          <section>
            <div className="balance-banner" data-tour="available">
              <div className="available-until-income">
                <span>Dinero disponible este periodo</span>
                <strong>{money(availableUntilNextIncome)}</strong>
                <small>
                  {money(current)} en cuentas activadas − {money(plannedPayments)} en pagos previstos este periodo
                </small>
              </div>
              <div className="next-income-summary">
                <span>Próximo ingreso</span>
                {nextIncome ? (
                  <>
                    <strong>+{money(nextIncome.amount)}</strong>
                    <small>{nextIncomeName} · {friendly(nextIncome.date)}</small>
                  </>
                ) : (
                  <>
                    <strong>Sin programar</strong>
                    <small>Se descuentan los pagos previstos del periodo actual.</small>
                  </>
                )}
              </div>
            </div>
            <div className="toolbar">
              <div className="period-toolbar-main">
                <div className="period-tabs">
                  {[
                    ["semana", "Semana"],
                    ["mes", "Mes"],
                    ["año", "Año"],
                    ["personalizado", "Personalizado"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      className={period === k ? "selected" : ""}
                      onClick={() => changePeriod(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div
                  className="period-inline-navigation"
                  aria-label="Navegar entre periodos"
                >
                  <button
                    type="button"
                    onClick={() => setPeriodOffset((value) => value - 1)}
                    aria-label="Ver periodo anterior"
                  >
                    <span className="period-arrow previous">
                      <Icon name="chevron" size={16} />
                    </span>
                  </button>
                  <strong>
                    {periodRange(period, cycleStartDay, periodOffset, firstDayOfWeek)}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setPeriodOffset((value) => value + 1)}
                    aria-label="Ver periodo siguiente"
                  >
                    <span className="period-arrow">
                      <Icon name="chevron" size={16} />
                    </span>
                  </button>
                  {periodOffset !== 0 && (
                    <button
                      type="button"
                      className="period-today-button"
                      onClick={() => setPeriodOffset(0)}
                    >
                      Actual
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="list-filters">
              <label className="search-field"><span className="sr-only">Buscar movimientos</span><Icon name="search" size={17} /><input type="search" value={movementSearch} onChange={(event) => setMovementSearch(event.target.value)} placeholder="Buscar movimientos" /></label>
            </div>
            <details className="movement-filter-details">
              <summary>Filtros <span>{[filter !== "todos", movementCategoryFilter !== "todas", movementAccountFilter !== "todas", movementSubcategoryFilter !== "todas", !!movementMinAmount, !!movementMaxAmount].filter(Boolean).length || ""}</span></summary>
            <div className="advanced-filters">
              <label>Tipo<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="todos">Todos</option><option value="gasto">Gastos y devoluciones</option><option value="devolucion">Solo devoluciones</option><option value="ingreso">Ingresos</option><option value="traspaso">Traspasos</option><option value="deuda">Deudas</option></select></label>
              <label>Categoría<select value={movementCategoryFilter} onChange={(event) => { if (event.target.value === "__create__") startCategoryCreation(); else setMovementCategoryFilter(event.target.value); }}><option value="todas">Todas las categorías</option>{[...selectableCategoryDefinitions].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })).map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}<option value="__create__">+ Crear categoría</option></select></label>
              <label>Cuenta<select value={movementAccountFilter} onChange={(event) => setMovementAccountFilter(event.target.value)}><option value="todas">Todas</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label>Subcategoría<select value={movementSubcategoryFilter} onChange={(event) => setMovementSubcategoryFilter(event.target.value)}><option value="todas">Todas</option>{[...new Set(selectableCategoryDefinitions.flatMap((category) => category.subcategories.map((subcategory) => subcategory.name)))].sort((a, b) => a.localeCompare(b, "es")).map((subcategory) => <option key={subcategory}>{subcategory}</option>)}</select></label>
              <label>Importe mínimo<input inputMode="decimal" value={movementMinAmount} onChange={(event) => setMovementMinAmount(event.target.value)} placeholder="0,00 €" /></label>
              <label>Importe máximo<input inputMode="decimal" value={movementMaxAmount} onChange={(event) => setMovementMaxAmount(event.target.value)} placeholder="Sin límite" /></label>
            </div></details>
            <section className="upcoming-panel" data-tour="upcoming">
              <button
                className="upcoming-toggle"
                onClick={() => rememberUpcomingOpen(!upOpen)}
              >
                <span>
                  <Icon name="programados" size={18} /> Movimientos previstos{" "}
                  <em>{periodUpcoming.length}</em>
                </span>
                <i className={upOpen ? "rotated" : ""}>
                  <Icon name="down" size={18} />
                </i>
              </button>
              {upOpen && (
                <div className="future-list">
                  {periodUpcoming.length === 0 ? (
                    <p className="empty-period">
                      No hay movimientos previstos en este periodo.
                    </p>
                  ) : (
                    projectedRows
                  )}
                </div>
              )}
            </section>
            <div className="history-heading">
              <h2>Movimientos realizados</h2>
              <div className="filter-summary" aria-live="polite">
                <span><strong>{visible.length}</strong> {visible.length === 1 ? "transacción" : "transacciones"}</span>
                <span>Total neto <strong className={visibleNetTotal < 0 ? "negative" : "positive"}>{visibleNetTotal > 0 ? "+" : ""}{money(visibleNetTotal)}</strong></span>
              </div>
            </div>
            {!visible.length && !periodUpcoming.length && <div className="empty-onboarding"><h2>Aquí aparecerá tu día a día</h2><p>Registra un ingreso, un gasto o un traspaso. Si se repite cada mes, créalo como recurrente y MiZUFi hará el resto.</p><button type="button" className="button-primary" onClick={() => { setEdit(null); setKind("gasto"); setModal("movement"); }}>Registrar mi primer movimiento</button></div>}
            {days.map(([date, items]) => {
              const dayCollapsed = collapsedDays.includes(date);
              const dayIncome = items
                .filter((m) => m.kind === "ingreso")
                .reduce((total, m) => total + m.amount, 0);
              const dayRefunds = items
                .filter((m) => m.kind === "devolucion")
                .reduce((total, m) => total + m.amount, 0);
              const dayExpenses =
                items
                  .filter((m) => m.kind === "gasto" || m.kind === "deuda")
                  .reduce((total, m) => total + m.amount, 0) - dayRefunds;
              const dayTotal = dayIncome - dayExpenses;
              return (
                <section className="day-group" key={date}>
                  <button
                    type="button"
                    className="day-heading day-heading-toggle"
                    aria-expanded={!dayCollapsed}
                    onClick={() => rememberCollapsedDays(
                      dayCollapsed
                        ? collapsedDays.filter((day) => day !== date)
                        : [...collapsedDays, date],
                    )}
                  >
                    <h3>{date === todayISO ? "Hoy" : friendly(date, true)}</h3>
                    <div className="day-totals">
                      <span className="day-income">
                        Ingresos <strong>+{money(dayIncome)}</strong>
                      </span>
                      <span className="day-expenses">
                        Gastos netos{" "}
                        <strong>
                          {dayExpenses >= 0 ? "−" : "+"}
                          {money(Math.abs(dayExpenses))}
                        </strong>
                      </span>
                      <span
                        className={`day-balance${dayTotal < 0 ? " negative" : " positive"}`}
                      >
                        Total{" "}
                        <strong>
                          {dayTotal > 0 ? "+" : ""}
                          {money(dayTotal)}
                        </strong>
                      </span>
                    </div>
                    <i className={dayCollapsed ? "" : "rotated"}>
                      <Icon name="down" size={17} />
                    </i>
                  </button>
                  {!dayCollapsed &&
                    items.map((m) => {
                      const definition = categoryDefinition(m.category);
                      const sourceProgram = m.scheduled ? data.programs.find((program) => m.id.startsWith(`scheduled:${program.id}:`)) : undefined;
                      const occurrencePosition = sourceProgram ? programOccurrencePosition(sourceProgram, m.date) : null;
                      const color =
                        definition?.color ??
                        (m.kind === "traspaso" ? "#70899b" : "#2d8f88");
                      return (
                        <article
                          className={`movement-row${m.kind === "devolucion" ? " refund-row" : ""}`}
                          key={m.id}
                          onClick={() => {
                            setRefundSource(null);
                            setEdit(m);
                            setDuplicatingMovement(false);
                            setKind(m.kind);
                            setCat(m.category);
                            setModal("movement");
                          }}
                        >
                          <span
                            className="movement-category-icon"
                            style={{ background: `${color}18`, color }}
                          >
                            {m.kind === "traspaso" ? (
                              "⇄"
                            ) : (
                              <CategoryIcon
                                name={definition?.icon ?? "star"}
                                size={20}
                              />
                            )}
                          </span>
                          <div className="movement-copy">
                            <strong>
                              {m.name}
                              {m.scheduled && (
                                <span className="scheduled-dot">
                                  {` · Recurrente${occurrencePosition ? ` · ${occurrencePosition}` : ""}`}
                                </span>
                              )}
                            </strong>
                            <span>
                              {m.category}
                              {m.subcategory
                                ? ` › ${m.subcategory}`
                                : ""} · {byId[m.account]?.name}
                            </span>
                            {m.notes && (
                              <small className="movement-notes">
                                {m.notes}
                              </small>
                            )}
                          </div>
                          <strong
                            className={
                              m.kind === "ingreso" || m.kind === "devolucion"
                                ? "positive amount"
                                : "amount"
                            }
                          >
                            {m.kind === "ingreso" || m.kind === "devolucion"
                              ? "+"
                              : m.kind === "traspaso"
                                ? ""
                                : "−"}
                            {money(m.amount)}
                          </strong>
                        </article>
                      );
                    })}
                </section>
              );
            })}
          </section>
        )}
        {tab === "deudas" && (
          <section data-tour="debts">
          <DebtPlanner
            debts={data.debts ?? []}
            paymentAccounts={data.accounts
              .filter(
                (account) => !account.archived && account.kind === "corriente",
              )
              .map((account) => ({ id: account.id, name: account.name }))}
            adjustments={data.movements
              .filter(
                (movement) =>
                  movement.kind === "deuda" &&
                  movement.target &&
                  (movement.debtAdjustment ||
                    movement.name.startsWith("Amortización extraordinaria") ||
                    movement.name.startsWith("Cancelación de préstamo")),
              )
              .map(
                (movement) =>
                  ({
                    id: movement.id,
                    debtAccountId: movement.target!,
                    date: movement.date,
                    principal: movement.principal ?? movement.amount,
                    fee:
                      movement.debtAdjustment?.fee ??
                      Math.max(
                        0,
                        movement.amount -
                          (movement.principal ?? movement.amount),
                      ),
                    feePercent:
                      movement.debtAdjustment?.feePercent ??
                      ((movement.debtAdjustment?.fee ?? Math.max(0, movement.amount - (movement.principal ?? movement.amount))) /
                        Math.max(movement.principal ?? movement.amount, 0.01)) * 100,
                    mode: movement.debtAdjustment?.mode,
                    account: movement.account,
                    previousDebt: movement.debtAdjustment?.previousDebt,
                    cancelled: movement.name.startsWith(
                      "Cancelación de préstamo",
                    ),
                  }) satisfies DebtAdjustment,
              )}
            onChange={syncDebts}
            onExtraPayment={registerExtraDebtPayment}
            onDeleteAdjustment={(id) => {
              const movement = data.movements.find((item) => item.id === id);
              if (movement) deleteMovement(movement);
            }}
            createRequest={debtCreateRequest}
            initialOpenId={data.preferences?.openDebtId}
            onOpenChange={(openDebtId) => updatePreferences({ openDebtId })}
            amountsHidden={debtAmountsHidden}
            onAmountsHiddenChange={(hidden) => {
              setDebtAmountsHidden(hidden);
              updatePreferences({ debtAmountsHidden: hidden });
            }}
          />
          </section>
        )}
        {tab === "presupuestos" && (
          <section data-tour="budgets">
          <BudgetPlanner
            items={data.budgets ?? []}
            movements={data.movements}
            categories={catalogCategoryDefinitions.filter((category) => !category.archived).map((category) => ({ ...category, subcategories: category.subcategories.filter((subcategory) => !subcategory.archived) }))}
            accounts={data.accounts.filter((account) => !account.archived)}
            initialYear={data.preferences?.budgetYear}
            initialMonth={data.preferences?.budgetMonth}
            onViewChange={(budgetYear, budgetMonth) =>
              setData((old) => ({
                ...old,
                preferences: { ...old.preferences, budgetYear, budgetMonth },
              }))
            }
            onChange={syncBudgets}
            onCreateCategory={startCategoryCreation}
            annualExpenses={data.annualExpenses ?? []}
            programs={data.programs.filter((program) => !program.archived)}
            onAnnualChange={syncAnnualExpenses}
            onCreateHucha={createAnnualExpenseHucha}
            onCreateProgram={createAnnualExpenseProgram}
            onRegisterAnnualPayment={registerAnnualPayment}
            ruleTargets={{ needs: targetNeeds, wants: targetWants, savings: targetSavings }}
          />
          </section>
        )}
        {tab === "categorias" && (
          <section data-tour="balance">
            <div className="toolbar category-toolbar">
              <div className="period-toolbar-main">
                <div className="period-tabs">
                  {[
                    ["semana", "Semana"],
                    ["mes", "Mes"],
                    ["año", "Año"],
                    ["personalizado", "Personalizado"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      className={period === k ? "selected" : ""}
                      onClick={() => changePeriod(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div
                  className="period-inline-navigation"
                  aria-label="Navegar entre periodos"
                >
                  <button
                    type="button"
                    onClick={() => setPeriodOffset((value) => value - 1)}
                    aria-label="Ver periodo anterior"
                  >
                    <span className="period-arrow previous">
                      <Icon name="chevron" size={16} />
                    </span>
                  </button>
                  <strong>
                    {periodRange(period, cycleStartDay, periodOffset, firstDayOfWeek)}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setPeriodOffset((value) => value + 1)}
                    aria-label="Ver periodo siguiente"
                  >
                    <span className="period-arrow">
                      <Icon name="chevron" size={16} />
                    </span>
                  </button>
                  {periodOffset !== 0 && (
                    <button
                      type="button"
                      className="period-today-button"
                      onClick={() => setPeriodOffset(0)}
                    >
                      Actual
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div
              className="period-tabs category-view-tabs"
              role="tablist"
              aria-label="Vista de categorías"
            >
              <button
                role="tab"
                aria-selected={categoryView === "patrimonio"}
                className={categoryView === "patrimonio" ? "selected" : ""}
                onClick={() => setCategoryView("patrimonio")}
              >
                Patrimonio
              </button>
              <button
                role="tab"
                aria-selected={categoryView === "gastos"}
                className={categoryView === "gastos" ? "selected" : ""}
                onClick={() => setCategoryView("gastos")}
              >
                Gastos
              </button>
              <button
                role="tab"
                aria-selected={categoryView === "distribucion"}
                className={categoryView === "distribucion" ? "selected" : ""}
                onClick={() => setCategoryView("distribucion")}
              >
                Ingresos
              </button>
            </div>
            {categoryView === "patrimonio" && (
              <div className="balance-dashboard">
                <section className="net-worth-hero">
                  <div><span>Patrimonio neto <details className="info-tip"><summary aria-label="Información sobre el patrimonio neto">i</summary><p>Suma tus activos y resta el capital pendiente de tus deudas.</p></details></span><strong>{money(netWorth)}</strong></div>
                  <small>Activos {money(liquidAssets + investmentAssets + nonLiquidAssets)} · Deudas −{money(debtTotal)}</small>
                </section>
                <div className="balance-grid">
                  <details className="balance-panel collapsible-balance-panel" open={openBalancePanels.includes("liquid")} onToggle={(event) => { const open = event.currentTarget.open; const next = open ? [...new Set([...openBalancePanels, "liquid"])] : openBalancePanels.filter((item) => item !== "liquid"); if (next.length !== openBalancePanels.length) rememberBalancePanels(next); }}>
                    <summary><div><h2>Activos líquidos <details className="info-tip"><summary aria-label="Información sobre los activos líquidos">i</summary><p>Es el dinero que tienes disponible o que puedes convertir rápidamente en dinero, como el saldo de tus cuentas, ahorros y huchas.</p></details></h2><p>Se actualizan automáticamente desde Cuentas.</p></div><span className="balance-summary-total"><strong>{money(liquidAssets)}</strong><Icon name="down" size={17} /></span></summary>
                    <div className="balance-panel-content">
                    {activeAccounts.filter((account) => ["corriente", "ahorro", "hucha"].includes(account.kind)).map((account) => (
                      <div className="balance-line" key={account.id}><span>{account.name}</span><strong>{money(account.balance)}</strong></div>
                    ))}
                    </div>
                  </details>
                  <details className="balance-panel collapsible-balance-panel" open={openBalancePanels.includes("investments")} onToggle={(event) => { const open = event.currentTarget.open; const next = open ? [...new Set([...openBalancePanels, "investments"])] : openBalancePanels.filter((item) => item !== "investments"); if (next.length !== openBalancePanels.length) rememberBalancePanels(next); }}>
                    <summary><div><h2>Inversiones <details className="info-tip"><summary aria-label="Información sobre la valoración de inversiones">i</summary><p>Si no actualizas la valoración, Mizufi muestra el capital aportado, no su valor de mercado.</p></details></h2><p>Capital aportado o valoración que indiques.</p></div><span className="balance-summary-total"><strong>{money(investmentAssets)}</strong><Icon name="down" size={17} /></span></summary>
                    <div className="balance-panel-content">
                    {activeAccounts.filter((account) => account.kind === "inversion").map((account) => {
                      const history = data.investmentValuations?.[account.id] ?? [];
                      const shown = history.at(-1)?.value ?? account.balance;
                      return <div className="investment-line" key={account.id}><div><strong>{account.name}</strong><small>{history.length ? `Actualizado ${history.at(-1)?.date}` : "Capital aportado"}</small></div><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateInvestmentValue(account, Number(String(form.get("value")).replace(",", "."))); }}><input name="value" inputMode="decimal" defaultValue={shown} aria-label={`Valor actual de ${account.name}`} /><button>Actualizar</button></form></div>;
                    })}
                    {!activeAccounts.some((account) => account.kind === "inversion") && <p className="empty-hint">No hay inversiones registradas.</p>}
                    </div>
                  </details>
                </div>
                <details className="balance-panel manual-assets-panel collapsible-balance-panel" open={openBalancePanels.includes("non-current")} onToggle={(event) => { const open = event.currentTarget.open; const next = open ? [...new Set([...openBalancePanels, "non-current"])] : openBalancePanels.filter((item) => item !== "non-current"); if (next.length !== openBalancePanels.length) rememberBalancePanels(next); }}>
                  <summary><div><h2>Activos no corrientes <details className="info-tip"><summary aria-label="Información sobre los activos no corrientes">i</summary><p>Son bienes que conservas a largo plazo y que no suelen convertirse rápidamente en dinero, como una vivienda, un vehículo u otras propiedades.</p></details></h2><p>Vivienda, vehículo u otros bienes con historial de valor.</p></div><div className="manual-assets-heading-actions"><strong>{money(nonLiquidAssets)}</strong>{openBalancePanels.includes("non-current") && <button type="button" className="asset-add-button" aria-label="Añadir activo no corriente" onClick={(event) => { event.preventDefault(); setEditingAsset(null); setAssetDraft({ name: "", kind: "Vivienda", value: "" }); setAssetFormOpen((open) => !open); }}><Icon name="plus" size={16} /></button>}<Icon className="balance-summary-chevron" name="down" size={17} /></div></summary>
                  <div className="balance-panel-content">
                  {assetFormOpen && <form className="asset-form" onSubmit={(event) => { event.preventDefault(); saveManualAsset(); }}>
                    <input placeholder="Nombre del activo" value={assetDraft.name} onChange={(event) => setAssetDraft((old) => ({ ...old, name: event.target.value }))} />
                    <select value={assetDraft.kind} onChange={(event) => setAssetDraft((old) => ({ ...old, kind: event.target.value }))}><option>Vivienda</option><option>Vehículo</option><option>Otro</option></select>
                    <input placeholder="Valor actual" inputMode="decimal" value={assetDraft.value} onChange={(event) => setAssetDraft((old) => ({ ...old, value: event.target.value }))} />
                    <div className="asset-form-actions"><button type="button" className="text-button" onClick={() => { setAssetFormOpen(false); setEditingAsset(null); }}>Cancelar</button><button className="button-primary">{editingAsset ? "Guardar valor" : "Añadir activo"}</button></div>
                  </form>}
                  {(data.manualAssets ?? []).map((asset) => <details className="asset-row" key={asset.id}><summary><span><strong>{asset.name}</strong><small>{asset.kind}</small></span><span><strong>{money(asset.value)}</strong><button type="button" onClick={(event) => { event.preventDefault(); setEditingAsset(asset.id); setAssetDraft({ name: asset.name, kind: asset.kind, value: String(asset.value).replace(".", ",") }); setAssetFormOpen(true); }}>Actualizar</button></span></summary><div className="valuation-history"><strong>Historial de valores</strong>{asset.valuations.map((valuation, index) => ({ valuation, index })).reverse().map(({ valuation, index }) => <div className="valuation-history-row" key={`${valuation.date}-${index}`}><span>{valuation.date}</span>{editingValuation?.assetId === asset.id && editingValuation.index === index ? <span className="valuation-edit"><input aria-label={`Modificar valor de ${asset.name}`} inputMode="decimal" value={editingValuation.value} onChange={(event) => setEditingValuation({ ...editingValuation, value: event.target.value })} /><button type="button" onClick={saveAssetValuation}>Guardar</button><button type="button" onClick={() => setEditingValuation(null)}>Cancelar</button></span> : <span className="valuation-value"><strong>{money(valuation.value)}</strong><button type="button" onClick={() => setEditingValuation({ assetId: asset.id, index, value: String(valuation.value).replace(".", ",") })}>Editar</button><button type="button" className="delete-action" onClick={() => deleteAssetValuation(asset.id, index)}>Eliminar</button></span>}</div>)}</div></details>)}
                  </div>
                </details>
              </div>
            )}
            {categoryView === "gastos" && (
              <section className="balance-chart-comparison" aria-label="Gastos actuales y previstos">
                <div className="comparison-chart-today">
                  {expenseChart("Gastos", "Hasta hoy", categoryRows, totalExpenses)}
                </div>
                <div className="comparison-chart-projected">
                  {expenseChart("Gastos", "Previsión al final del periodo", projectedCategoryRows, projectedTotalExpenses)}
                </div>
              </section>
            )}
            {categoryView === "distribucion" && (
              <section className="balance-chart-comparison" aria-label="Distribución de ingresos actual y prevista">
                {incomeChart("Distribución de ingresos", "Hasta hoy", distributionRows, income, allocatedTotal, distributionBreakdowns)}
                {incomeChart("Distribución de ingresos", "Previsión al final del periodo", projectedDistributionRows, projectedIncome, projectedAllocatedTotal, projectedDistributionBreakdowns)}
              </section>
            )}
            {categoryView === "distribucion" &&
              (income > 0 || distributionRows.length > 0 || projectedIncome > 0) && (
                  <section className="rule-comparison-section" aria-label="Comparación con tu regla objetivo">
                    <div className="category-chart-heading"><h2>Tu regla de distribución <details className="info-tip"><summary aria-label="Información sobre tu regla de distribución">i</summary><p>Compara lo que estás haciendo con los porcentajes que has elegido en Ajustes.</p></details></h2><span>Objetivo frente a distribución real del periodo</span></div>
                    <div className="rule-comparison-grid">
                      {distributionRule("Hasta hoy", income, {
                        needs: needsSpent,
                        wants: wantsSpent,
                        savings: savingsInvested,
                      }, currentRuleDetails)}
                      {distributionRule("Previsión al final del periodo", projectedIncome, {
                        needs: projectedNeedsSpent,
                        wants: projectedWantsSpent,
                        savings: projectedSavingsInvested,
                      }, projectedRuleDetails)}
                    </div>
                    <button className="text-button" type="button" onClick={() => { setSettingsSection("general"); setSettingsOpen(true); }}>Modificar mi regla</button>
                  </section>
              )}
            {categoryView === "mis-categorias" && (
              <section className="category-manager">
                <div className="category-manager-heading">
                  <div>
                    <h2>Mis categorías</h2>
                    <p>Estas opciones ahora forman parte de Ajustes.</p>
                  </div>
                  <div className="category-manager-actions"><button type="button" className="text-button" onClick={() => setCategoryView("patrimonio")}>Volver a Balance</button><button
                    type="button"
                    className="button-primary category-add-button"
                    onClick={() => openCategoryEditor()}
                  >
                    <Icon name="plus" size={15} /> Nueva categoría
                  </button></div>
                </div>
                {(creatingCategory || categoryEditor) && (
                  <form className="category-editor" onSubmit={saveCategory}>
                    <label>
                      Nombre de la categoría
                      <input
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        placeholder="Por ejemplo, Mascotas"
                        disabled={
                          !!categoryEditor &&
                          ["Ingresos", "Deudas"].includes(categoryEditor.name)
                        }
                        required
                      />
                    </label>
                    {(!categoryEditor || categoryEditor.name !== "Ingresos") && (
                      <label className="category-create-bucket">
                        En la regla de distribución cuenta como
                        <select value={categoryBucket} onChange={(event) => setCategoryBucket(event.target.value as "needs" | "wants" | "savings")}>
                          <option value="needs">Supervivencia</option>
                          <option value="wants">Disfrutar</option>
                          <option value="savings">Ahorro e inversión</option>
                        </select>
                      </label>
                    )}
                    <CategoryAppearancePicker
                      icon={categoryIcon}
                      color={categoryColor}
                      onIconChange={setCategoryIcon}
                      onColorChange={setCategoryColor}
                    />
                    <div className="category-editor-actions">
                      <button
                        type="button"
                        className="category-secondary-button"
                        onClick={closeCategoryEditor}
                      >
                        Cancelar
                      </button>
                      <button className="button-primary">
                        {categoryEditor ? "Guardar cambios" : "Crear categoría"}
                      </button>
                    </div>
                  </form>
                )}
                <div className="managed-category-list">
                  {activeCategoryDefinitions.map((category) => {
                    const isOpen = expandedManagedCategory === category.id;
                    const removal =
                      pendingCategoryRemoval?.categoryId === category.id
                        ? pendingCategoryRemoval
                        : null;
                    const removingSubcategory = removal?.subcategory
                      ? category.subcategories.find(
                          (item) => item.name === removal.subcategory,
                        )
                      : undefined;
                    const usage = removal
                      ? categoryUsage(category, removal.subcategory)
                      : 0;
                    return (
                      <article
                        className={`managed-category${isOpen ? " managed-category-open" : ""}`}
                        key={category.id}
                      >
                        <div className="managed-category-heading">
                          <button
                            type="button"
                            className="managed-category-toggle"
                            onClick={() => {
                              rememberExpandedCategory(
                                isOpen ? null : category.id,
                              );
                              setManagedSubcategoryMenu(null);
                            }}
                          >
                            <span
                              className="category-symbol-badge"
                              style={{
                                background: `${category.color}18`,
                                color: category.color,
                              }}
                            >
                              <CategoryIcon name={category.icon} size={21} />
                            </span>
                            <div className="managed-category-title">
                              <strong>{category.name}</strong>
                              <span>
                                {category.subcategories.length} subcategorías
                              </span>
                            </div>
                            <i className={isOpen ? "rotated" : ""}>
                              <Icon name="down" size={17} />
                            </i>
                          </button>
                        </div>
                        {isOpen && (
                          <div className="managed-category-details">
                            {!['Ingresos', 'Deudas'].includes(category.name) && (
                              <label className="category-bucket-field">
                                En la regla de distribución cuenta como
                                <select
                                  value={category.bucket ?? (necessaryNames.has(category.name) ? "needs" : "wants")}
                                  onChange={(event) => setData((old) => ({
                                    ...old,
                                    categories: (old.categories?.length ? old.categories : defaultCategoryDefinitions).map((item) => item.id === category.id ? { ...item, bucket: event.target.value as "needs" | "wants" | "savings" } : item),
                                  }))}
                                >
                                  <option value="needs">Supervivencia</option>
                                  <option value="wants">Disfrutar</option>
                                  <option value="savings">Ahorro e inversión</option>
                                </select>
                              </label>
                            )}
                            <div className="category-inline-actions">
                              <button
                                type="button"
                                className="edit-category-inline"
                                onClick={() => openCategoryEditor(category)}
                              >
                                <Icon name="categorias" size={15} /> Editar
                                categoría
                              </button>
                              {!["Ingresos", "Deudas"].includes(
                                category.name,
                              ) && (
                                <button
                                  type="button"
                                  className="delete-category-inline"
                                  onClick={() =>
                                    requestCategoryRemoval(category)
                                  }
                                >
                                  <Icon name="trash" size={15} /> Eliminar
                                </button>
                              )}
                            </div>
                            <div className="managed-subcategories">
                              {category.subcategories.length === 0 && (
                                <p className="empty-subcategories">
                                  Aún no hay subcategorías.
                                </p>
                              )}
                              {category.subcategories.map((subcategory) => {
                                const menuId = `${category.id}:${subcategory.name}`;
                                return (
                                  <div
                                    className="managed-subcategory"
                                    key={subcategory.name}
                                  >
                                    <span>{subcategory.name}</span>
                                    <div className="managed-menu-wrap">
                                      <button
                                        type="button"
                                        className="managed-menu-button"
                                        aria-label={`Opciones de ${subcategory.name}`}
                                        onClick={() =>
                                          setManagedSubcategoryMenu(
                                            managedSubcategoryMenu === menuId
                                              ? null
                                              : menuId,
                                          )
                                        }
                                      >
                                        ⋯
                                      </button>
                                      {managedSubcategoryMenu === menuId && (
                                        <div className="managed-menu subcategory-menu">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              editSubcategory(
                                                category,
                                                subcategory,
                                              );
                                              setManagedSubcategoryMenu(null);
                                            }}
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            className="managed-delete"
                                            onClick={() => {
                                              requestCategoryRemoval(
                                                category,
                                                subcategory,
                                              );
                                              setManagedSubcategoryMenu(null);
                                            }}
                                          >
                                            Eliminar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {subcategoryEditor?.categoryId === category.id && (
                              <form
                                className="subcategory-editor"
                                onSubmit={(e) => saveSubcategory(e, category)}
                              >
                                <label>
                                  {subcategoryEditor.original
                                    ? "Editar subcategoría"
                                    : "Nueva subcategoría"}
                                  <input
                                    autoFocus
                                    value={subcategoryName}
                                    onChange={(e) =>
                                      setSubcategoryName(e.target.value)
                                    }
                                    placeholder="Por ejemplo, Veterinario"
                                    required
                                  />
                                </label>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubcategoryEditor(null);
                                      setSubcategoryName("");
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                  <button className="button-primary">
                                    Guardar
                                  </button>
                                </div>
                              </form>
                            )}
                            {removal && (
                              <div className="removal-confirmation">
                                <p>
                                  {usage > 0
                                    ? `Se eliminará de tus opciones futuras. Sus ${usage} movimientos o programados conservarán el nombre «${removal.subcategory ?? category.name}» en el historial.`
                                    : `¿Enviar ${removal.subcategory ?? category.name} a la papelera durante 30 días?`}
                                </p>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingCategoryRemoval(null)
                                    }
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    className="confirm-delete-button"
                                    onClick={() =>
                                      confirmCategoryRemoval(
                                        category,
                                        removingSubcategory,
                                      )
                                    }
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              className="add-subcategory-button"
                              onClick={() => addSubcategory(category)}
                            >
                              + Añadir subcategoría
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {categoryView !== "mis-categorias" && (
              <p className="helper-note">
                {categoryView === "gastos"
                  ? "Los porcentajes de cada categoría se calculan sobre el total de gastos del período seleccionado."
                  : "Los porcentajes se calculan sobre los ingresos en cuentas corrientes del período seleccionado."}
              </p>
            )}
          </section>
        )}
      </main>
      <nav className="mobile-nav">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => rememberTab(t)}
          >
            <Icon name={t} size={19} />
            <span>{titles[t].replace("Tus ", "")}</span>
          </button>
        ))}
      </nav>
      {pendingAccountDelete && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget)
              setPendingAccountDelete(null);
          }}
        >
          <section
            className="modal account-delete-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">ELIMINAR CUENTA</p>
                <h2 id="delete-account-title">{pendingAccountDelete.name}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setPendingAccountDelete(null)}
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>
            {(() => {
              const movements = data.movements.filter(
                (m) =>
                  m.account === pendingAccountDelete.id ||
                  m.target === pendingAccountDelete.id,
              ).length;
              const programs = data.programs.filter(
                (p) =>
                  p.account === pendingAccountDelete.id ||
                  p.target === pendingAccountDelete.id,
              ).length;
              return (
                <p>
                  {movements || programs
                    ? `También se eliminarán ${movements} movimientos y ${programs} programados relacionados.`
                    : "Esta cuenta no tiene movimientos ni programados asociados."}{" "}
                  Podrás recuperarla desde la papelera durante 30 días.
                </p>
              );
            })()}
            <div className="account-delete-actions">
              <button
                type="button"
                onClick={() => setPendingAccountDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="confirm-delete-button"
                onClick={confirmDeleteAccount}
              >
                Enviar a la papelera
              </button>
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModal(null);
              setEdit(null);
              setEditAccount(null);
              setEditProgram(null);
              setDuplicating(false);
              setDuplicatingMovement(false);
              setRefundSource(null);
            }
          }}
        >
          <section className="modal">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">
                  {modal === "account"
                    ? "ORGANIZA TU DINERO"
                    : modal === "program"
                      ? "PLANIFICA CON CALMA"
                      : kind === "devolucion"
                        ? "RECUPERA UN GASTO"
                        : "REGISTRA TU DÍA"}
                </p>
                <h2>
                  {modal === "account"
                    ? editAccount
                      ? "Editar cuenta"
                      : "Nueva cuenta"
                    : modal === "program"
                      ? duplicating
                        ? "Duplicar programado"
                        : editProgram
                          ? "Editar programado"
                          : "Nuevo programado"
                      : duplicatingMovement
                        ? "Duplicar movimiento"
                      : kind === "devolucion"
                        ? edit
                          ? "Editar devolución"
                          : "Nueva devolución"
                        : edit
                          ? "Editar movimiento"
                          : "Nuevo movimiento"}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  setModal(null);
                  setEdit(null);
                  setEditAccount(null);
                  setEditProgram(null);
                  setDuplicating(false);
                  setDuplicatingMovement(false);
                  setRefundSource(null);
                }}
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>
            {modal === "movement" &&
              edit &&
              (edit.debtAdjustment ||
                edit.name.startsWith("Amortización extraordinaria") ||
                edit.name.startsWith("Cancelación de préstamo")) && (
                <button
                  type="button"
                  className="delete-movement-button debt-adjustment-delete"
                  onClick={() => deleteMovement(edit)}
                >
                  <Icon name="trash" size={16} /> Eliminar esta amortización y
                  deshacer sus cambios
                </button>
              )}
            {modal === "account" ? (
              <form onSubmit={submitAccount}>
                <label>
                  Tipo de cuenta
                  <select
                    name="accountKind"
                    value={accountKind}
                    onChange={(event) =>
                      setAccountKind(event.target.value as AccountKind)
                    }
                  >
                    <option value="corriente">Cuenta corriente</option>
                    <option value="ahorro">Ahorro</option>
                    <option value="hucha">Hucha</option>
                    <option value="inversion">Inversión</option>
                  </select>
                </label>
                <label>
                  Nombre
                  <input
                    name="name"
                    defaultValue={editAccount?.name}
                    placeholder="Por ejemplo, vacaciones"
                    required
                  />
                </label>
                <div className="account-icon-editor">
                  <span className="category-editor-label">Elige un icono</span>
                  <div className="symbol-picker">
                    {categoryIconChoices.map((symbol) => (
                      <button
                        type="button"
                        key={symbol}
                        className={
                          accountIcon === symbol
                            ? "symbol-choice selected"
                            : "symbol-choice"
                        }
                        onClick={() => setAccountIcon(symbol)}
                        aria-label={`Elegir icono de ${symbolLabels[symbol]}`}
                        title={symbolLabels[symbol]}
                        style={{
                          color: accountColor,
                          background: `${accountColor}18`,
                        }}
                      >
                        <CategoryIcon name={symbol} />
                      </button>
                    ))}
                  </div>
                  <span className="category-editor-label">Elige un color</span>
                  <div className="color-picker">
                    {categoryColors.map((color) => (
                      <button
                        type="button"
                        key={color}
                        className={
                          accountColor === color
                            ? "color-choice selected"
                            : "color-choice"
                        }
                        style={{ background: color }}
                        onClick={() => setAccountColor(color)}
                        aria-label={`Elegir color ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <label>
                  {editAccount ? "Saldo actual" : "Saldo inicial"}
                  <input
                    name="balance"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editAccount?.balance}
                    placeholder="0,00 €"
                    required
                  />
                </label>
                {accountKind === "hucha" && (
                  <>
                    <label>
                      ¿Cómo se distribuye esta hucha?
                      <select
                        name="bucket"
                        defaultValue={editAccount?.bucket ?? ""}
                        required
                      >
                        <option value="" disabled>
                          Elige una opción
                        </option>
                        <option value="needs">Sobrevivir</option>
                        <option value="wants">Disfrutar</option>
                        <option value="savings">Ahorro e inversión</option>
                      </select>
                      <span className="optional">
                        Las aportaciones a esta hucha contarán aquí dentro de tu
                        regla.
                      </span>
                    </label>
                    <label>
                      Objetivo de la hucha{" "}
                      <span className="optional">opcional</span>
                      <input
                        name="goal"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={editAccount?.goal}
                        placeholder="0,00 €"
                      />
                    </label>
                  </>
                )}
                <button className="button-primary submit-button">
                  {editAccount ? "Guardar cambios" : "Crear cuenta"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={modal === "program" ? submitProgram : submitMovement}
              >
                {kind === "devolucion" ? (
                  <div className="refund-form-banner">
                    <span>↩</span>
                    <div>
                      <strong>Devolución de gasto</strong>
                      <small>
                        Puedes cambiar el importe si la devolución es parcial.
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="kind-selector">
                    {[
                      ["gasto", "Gasto"],
                      ["ingreso", "Ingreso"],
                      ["traspaso", "Traspaso"],
                      ...(modal === "program" || edit?.kind === "deuda"
                        ? [["deuda", "Deuda"]]
                        : []),
                    ].map(([k, label]) => (
                      <button
                        type="button"
                        key={k}
                        className={kind === k ? "selected" : ""}
                        onClick={() => {
                          setKind(k as MovementKind);
                          setCat(
                            k === "ingreso"
                              ? "Ingresos"
                              : k === "traspaso"
                                ? "Traspasos"
                                : k === "deuda"
                                  ? "Deudas"
                                  : (activeCategoryDefinitions.find(
                                      (category) =>
                                        category.name !== "Ingresos" &&
                                        category.name !== "Deudas",
                                    )?.name ?? "Alimentación"),
                          );
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <input type="hidden" name="kind" value={kind} />
                {modal === "program" && (
                  <label>
                    Concepto
                    <input
                      name="name"
                      defaultValue={editProgram?.name}
                      placeholder={
                        kind === "traspaso"
                          ? "Por ejemplo, hucha vacaciones"
                          : "Por ejemplo, Netflix"
                      }
                      required
                    />
                  </label>
                )}
                <div className="form-grid">
                  <label>
                    Importe
                    <AmountCalculator
                      key={`${modal}:${editProgram?.id ?? edit?.id ?? refundSource?.id ?? "new"}`}
                      defaultValue={
                        editProgram?.amount ??
                        edit?.amount ??
                        refundSource?.amount
                      }
                    />
                  </label>
                  <label>
                    {modal === "program" ? "Fecha de inicio" : "Fecha"}
                    <input
                      name={modal === "program" ? "start" : "date"}
                      type="date"
                      defaultValue={
                        editProgram?.start ?? edit?.date ?? todayISO
                      }
                      required
                    />
                  </label>
                </div>
                <label>
                  {kind === "gasto"
                    ? "Cuenta o tarjeta de pago"
                    : kind === "ingreso" || kind === "devolucion"
                      ? "Cuenta o tarjeta de destino"
                      : "Cuenta de origen"}
                  <select
                    name="account"
                    defaultValue={
                      editProgram?.account ??
                      edit?.account ??
                      refundSource?.account
                    }
                  >
                    {data.accounts
                      .filter((a) => {
                        const available =
                          !a.archived ||
                          a.id === edit?.account ||
                          a.id === editProgram?.account ||
                          a.id === refundSource?.account;
                        const isCard = (data.debts ?? []).some(
                          (debt) =>
                            debt.type === "card" && debt.accountId === a.id,
                        );
                        return (
                          available &&
                          a.kind !== "inversion" &&
                          (a.kind !== "deuda" ||
                            (isCard &&
                              (kind === "gasto" || kind === "devolucion")))
                        );
                      })
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {(data.debts ?? []).some(
                            (debt) =>
                              debt.type === "card" && debt.accountId === a.id,
                          )
                            ? " · crédito"
                            : ""}
                          {a.archived ? " · archivada" : ""}
                        </option>
                      ))}
                  </select>
                </label>
                {(kind === "traspaso" || kind === "deuda") && (
                  <label>
                    {kind === "deuda" ? "Deuda asociada" : "Cuenta de destino"}
                    <select
                      name="target"
                      defaultValue={editProgram?.target ?? edit?.target}
                    >
                      {data.accounts
                        .filter(
                          (a) =>
                            (!a.archived ||
                              a.id === edit?.target ||
                              a.id === editProgram?.target) &&
                            (kind === "deuda"
                              ? a.kind === "deuda"
                              : [
                                  "corriente",
                                  "ahorro",
                                  "hucha",
                                  "inversion",
                                ].includes(a.kind)),
                        )
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                            {kind === "traspaso" && a.kind === "hucha"
                              ? " · Hucha"
                              : ""}
                            {a.archived ? " · archivada" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {kind === "deuda" && (
                  <label>
                    Capital amortizado{" "}
                    <span className="optional">
                      el resto se registra como intereses
                    </span>
                    <input
                      name="principal"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={editProgram?.principal ?? edit?.principal}
                      placeholder="Por ejemplo, 215 €"
                      required
                    />
                  </label>
                )}
                {kind !== "traspaso" && (
                  <div className="form-grid category-fields-grid">
                    <label>
                      Categoría
                      <input type="hidden" name="category" value={kind === "ingreso" ? "Ingresos" : cat} />
                      {kind === "ingreso" ? (
                        <div className="category-picker-trigger category-picker-fixed">
                          <span>Ingresos</span>
                        </div>
                      ) : (
                        <div className="category-picker">
                          <button
                            type="button"
                            className="category-picker-trigger"
                            aria-expanded={categoryPickerOpen}
                            onClick={() => setCategoryPickerOpen((open) => !open)}
                          >
                            <span>{cat}</span>
                            <span aria-hidden="true">⌄</span>
                          </button>
                          {categoryPickerOpen && (
                            <div className="category-picker-menu">
                              {[...selectableCategoryDefinitions]
                                .sort((a, b) =>
                                  a.name.localeCompare(b.name, "es", {
                                    sensitivity: "base",
                                  }),
                                )
                                .map((category) => (
                                <button
                                  type="button"
                                  key={category.id}
                                  className={category.name === cat ? "selected" : ""}
                                  onClick={() => {
                                    setCat(category.name);
                                    setSubcat("");
                                    setCategoryPickerOpen(false);
                                  }}
                                >
                                  <Icon
                                    name={legacySymbols[category.icon] ?? category.icon}
                                    size={17}
                                  />
                                  <span>{category.name}</span>
                                </button>
                              ))}
                              <button
                                type="button"
                                className="category-picker-create"
                                onClick={() => { setCategoryPickerOpen(false); startCategoryCreation(); }}
                              >
                                <span aria-hidden="true">＋</span>
                                <span>Crear categoría</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </label>
                    <label>
                      Subcategoría
                      <select
                        name="subcategory"
                        value={subcat}
                        onChange={(event) => {
                          if (event.target.value === "__create__") {
                            setQuickSubcategoryOpen(true);
                            setQuickSubcategoryName("");
                            return;
                          }
                          setSubcat(event.target.value);
                          setQuickSubcategoryOpen(false);
                        }}
                      >
                        <option value="">Sin subcategoría</option>
                        {(categories[cat] ?? []).map((subcategory) => (
                          <option key={subcategory}>{subcategory}</option>
                        ))}
                        <option value="__create__">+ Crear subcategoría</option>
                      </select>
                      {quickSubcategoryOpen && (
                        <span className="quick-subcategory-creator">
                          <input value={quickSubcategoryName} onChange={(event) => setQuickSubcategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createQuickSubcategory(); } }} placeholder={`Nueva subcategoría de ${cat}`} aria-label={`Nueva subcategoría de ${cat}`} autoFocus />
                          <button type="button" onClick={createQuickSubcategory}>Crear</button>
                        </span>
                      )}
                    </label>
                  </div>
                )}
                <label>
                  Notas <span className="optional">opcional</span>
                  <textarea
                    name="notes"
                    defaultValue={
                      editProgram?.notes ??
                      edit?.notes ??
                      (refundSource ? "Devolución" : undefined)
                    }
                    placeholder="Por ejemplo, sombra de ojos"
                    rows={3}
                  />
                </label>
                {modal === "program" && (
                  <div className="form-grid">
                    <label>
                      Periodicidad
                      <select
                        name="frequency"
                        defaultValue={editProgram?.frequency}
                      >
                        <option>Mensual</option>
                        <option>Semanal</option>
                        <option>Trimestral</option>
                        <option>Semestral</option>
                        <option>Anual</option>
                      </select>
                    </label>
                    <label>
                      Plazos
                      <input
                        name="occurrences"
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        defaultValue={editProgram?.occurrences ?? 1}
                        required
                      />
                    </label>
                  </div>
                )}
                <button className="button-primary submit-button">
                  {modal === "program"
                    ? duplicating
                      ? "Crear copia"
                      : editProgram
                        ? "Guardar cambios"
                        : "Guardar programado"
                    : duplicatingMovement
                      ? "Crear copia"
                    : kind === "devolucion"
                      ? edit
                        ? "Guardar devolución"
                        : "Registrar devolución"
                      : edit
                        ? "Guardar cambio puntual"
                        : "Guardar movimiento"}
                </button>
                {modal === "movement" &&
                  edit &&
                  !duplicatingMovement && (
                    <div className="movement-form-actions">
                      {!edit.id.startsWith("future:") && edit.kind === "gasto" && (
                        <button
                          type="button"
                          className="refund-movement-button"
                          onClick={() => startRefund(edit)}
                        >
                          ↩ Registrar devolución
                        </button>
                      )}
                      <button
                        type="button"
                        className="duplicate-movement-button"
                        onClick={() => setDuplicatingMovement(true)}
                      >
                        Duplicar movimiento
                      </button>
                      {!edit.id.startsWith("future:") && (
                      <button
                        type="button"
                        className="delete-movement-button"
                        onClick={() => deleteMovement(edit)}
                      >
                        Eliminar movimiento
                      </button>
                      )}
                    </div>
                  )}
              </form>
            )}
          </section>
        </div>
      )}
      {settingsOpen && (
        <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="settings-sheet" role="dialog" aria-modal="true" aria-label="Ajustes de Mizufi">
            <header><div>{settingsSection ? <button type="button" className="settings-back-button" onClick={() => setSettingsSection(null)}><Icon name="chevron" size={16} /> Ajustes</button> : <p className="eyebrow">HAZLO TUYO</p>}<h1>{settingsSection === "general" ? "Preferencias" : settingsSection === "cuenta" ? "Cuenta y acceso" : settingsSection === "periodos" ? "Periodos" : settingsSection === "categorias" ? "Categorías" : settingsSection === "datos" ? "Privacidad y datos" : settingsSection === "informes" ? "Mis informes" : settingsSection === "plan" ? "Mi plan" : settingsSection === "ayuda" ? "Ayuda" : settingsSection === "acerca" ? "Sobre Mizufi" : settingsSection === "beta" ? "Panel beta" : "Ajustes"}</h1></div><button className="settings-close" onClick={() => setSettingsOpen(false)} aria-label="Cerrar ajustes">×</button></header>
            <div className="settings-content">
              {settingsSection === "ayuda" && <div className="setting-card help-tour-launcher"><div><h2>Recorrido por Mizufi</h2><p>Repite el tutorial inicial para repasar Cuentas, Movimientos, Recurrentes, Deudas, Presupuestos y Balance.</p></div><button type="button" className="settings-outline-button" onClick={startTutorial}>Ver tutorial</button></div>}
              {settingsSection === null && <><div className="settings-menu-list">{[
                ["general", "Preferencias", "Nombre, apariencia y regla de distribución"],
                ["cuenta", "Cuenta y acceso", "Correo, contraseña y verificación"],
                ["periodos", "Periodos", "Semana, periodo inicial y fechas"],
                ["categorias", "Categorías", "Categorías y subcategorías"],
                ["informes", "Mis informes", "Excel, PDF y exportación de movimientos"],
                ["datos", "Privacidad y datos", "Papelera, copias y seguridad"],
                ["plan", "Mi plan", "Estado de tu plan de Mizufi"],
                ["ayuda", "Ayuda", "Cómo funcionan los cálculos"],
                ["acerca", "Sobre Mizufi", "Versión, privacidad y condiciones"],
                ...(isBetaAdmin ? [["beta", "Panel beta", "Seguimiento general de las pruebas"]] : []),
              ].map(([key, label, description]) => <button type="button" key={key} onClick={() => setSettingsSection(key as Exclude<typeof settingsSection, null>)}><span><strong>{label}</strong><small>{description}</small></span><Icon name="chevron" size={17} /></button>)}</div><button type="button" className="settings-sign-out" onClick={onSignOut}>Cerrar sesión</button></>}
              {settingsSection === "general" && <>
                <div className="setting-card"><h2>Tu perfil</h2><p>Personaliza el nombre y la imagen que aparecen en MiZUFi.</p><div className="profile-photo-row"><span className="profile-photo-preview">{data.preferences?.profilePhoto ? <img src={data.preferences.profilePhoto} alt="Tu foto de perfil" /> : preferredDisplayName.slice(0, 1).toUpperCase()}</span><div><strong>Foto de perfil</strong><small>Se recortará automáticamente en formato cuadrado.</small><div className="profile-photo-actions"><label className="settings-outline-button">{data.preferences?.profilePhoto ? "Cambiar foto" : "Añadir foto"}<input type="file" accept="image/*" onChange={(event) => { updateProfilePhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{data.preferences?.profilePhoto && <button type="button" className="profile-photo-remove" onClick={() => updatePreferences({ profilePhoto: undefined })}>Quitar foto</button>}</div></div></div><label className="settings-field">Nombre mostrado<input value={data.preferences?.displayName ?? displayName} onChange={(event) => updatePreferences({ displayName: event.target.value })} /></label></div>
                <div className="setting-card"><h2>Visualización</h2><div className="settings-choice-grid"><label>Moneda<select value={data.preferences?.currency ?? "EUR"} onChange={() => updatePreferences({ currency: "EUR" })}><option value="EUR">Euro (€)</option></select></label><label>Formato de fecha<select value={data.preferences?.dateFormat ?? "long"} onChange={(event) => updatePreferences({ dateFormat: event.target.value === "yyyy-mm-dd" ? "yyyy-mm-dd" : event.target.value === "dd/mm/yyyy" ? "dd/mm/yyyy" : undefined })}><option value="long">Fecha escrita</option><option value="dd/mm/yyyy">DD/MM/AAAA</option><option value="yyyy-mm-dd">AAAA-MM-DD</option></select></label><label>Tema<select value={data.preferences?.theme === "dark" ? "dark" : "light"} onChange={(event) => updatePreferences({ theme: event.target.value as "light" | "dark" })}><option value="light">Claro (predeterminado)</option><option value="dark">Oscuro</option></select></label></div><label className="settings-switch-row"><span><strong>Ocultar importes al abrir</strong><small>Las cifras de Cuentas y Deudas aparecerán protegidas hasta que pulses el ojo.</small></span><input type="checkbox" checked={!!data.preferences?.hideAmountsOnOpen} onChange={(event) => { const checked = event.target.checked; updatePreferences({ hideAmountsOnOpen: checked, debtAmountsHidden: checked }); setHiddenAccountGroups(checked ? ["corriente", "ahorro", "hucha", "inversion"] : []); setDebtAmountsHidden(checked); }} /></label></div>
                <div className="setting-card"><h2>Tu regla de distribución</h2><p>Adapta la referencia 50/30/20 a tu vida. Los tres porcentajes deben sumar 100.</p><div className="target-inputs"><label>Sobrevivir<input type="number" min="0" max="100" value={targetNeeds} onChange={(event) => updateTargets("needsTarget", Number(event.target.value))} /><span>%</span></label><label>Disfrutar<input type="number" min="0" max="100" value={targetWants} onChange={(event) => updateTargets("wantsTarget", Number(event.target.value))} /><span>%</span></label><label>Ahorro e inversión<input type="number" min="0" max="100" value={targetSavings} onChange={(event) => updateTargets("savingsTarget", Number(event.target.value))} /><span>%</span></label></div><div className={`target-total ${targetNeeds + targetWants + targetSavings === 100 ? "valid" : "invalid"}`}>Total: {targetNeeds + targetWants + targetSavings}% {targetNeeds + targetWants + targetSavings === 100 ? "✓" : "· Ajusta hasta 100%"}</div></div>
              </>}
              {settingsSection === "cuenta" && <div className="setting-card"><h2>Tu acceso a MiZUFi</h2><p>Gestiona el correo y la contraseña asociados a tu cuenta.</p><AccountSecurity email={email} onMessage={toast} /></div>}
              {settingsSection === "periodos" && <><div className="setting-card"><h2>Cómo se organizan tus periodos</h2><p>Estas preferencias se aplican en Movimientos y Balance.</p><div className="settings-choice-grid"><label>Primer día de la semana<select value={firstDayOfWeek} onChange={(event) => updatePreferences({ firstDayOfWeek: Number(event.target.value) as 0 | 1 })}><option value={1}>Lunes</option><option value={0}>Domingo</option></select></label><label>Periodo predeterminado<select value={data.preferences?.defaultPeriod ?? "mes"} onChange={(event) => updatePreferences({ defaultPeriod: event.target.value })}><option value="semana">Semana</option><option value="mes">Mes</option><option value="año">Año</option><option value="personalizado">Personalizado</option></select></label><label>El periodo personalizado empieza el día<select value={cycleStartDay} onChange={(event) => changeCycleStartDay(Number(event.target.value))}>{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label></div><label className="settings-switch-row"><span><strong>Recordar el último periodo consultado</strong><small>Si lo desactivas, Mizufi abrirá siempre el periodo predeterminado.</small></span><input type="checkbox" checked={data.preferences?.rememberLastPeriod !== false} onChange={(event) => updatePreferences({ rememberLastPeriod: event.target.checked })} /></label></div></>}
              {settingsSection === "categorias" && (
                <div className="settings-category-manager">
                  <div className="category-manager-heading">
                    <div>
                      <h2>Categorías y subcategorías</h2>
                      <p>Este es el catálogo que utilizan Movimientos y Programados.</p>
                    </div>
                    <button
                      type="button"
                      className="button-primary category-add-button"
                      onClick={() => openCategoryEditor()}
                    >
                      <Icon name="plus" size={15} /> Nueva categoría
                    </button>
                  </div>
                  {(creatingCategory || categoryEditor) && (
                    <form className="category-editor" onSubmit={saveCategory}>
                      <label>
                        Nombre de la categoría
                        <input
                          autoFocus
                          value={categoryName}
                          onChange={(event) => setCategoryName(event.target.value)}
                          placeholder="Por ejemplo, Mascotas"
                          disabled={
                            !!categoryEditor &&
                            ["Ingresos", "Deudas"].includes(categoryEditor.name)
                          }
                          required
                        />
                      </label>
                      {(!categoryEditor || categoryEditor.name !== "Ingresos") && (
                        <label className="category-create-bucket">
                          En la regla de distribución cuenta como
                          <select value={categoryBucket} onChange={(event) => setCategoryBucket(event.target.value as "needs" | "wants" | "savings")}>
                            <option value="needs">Supervivencia</option>
                            <option value="wants">Disfrutar</option>
                            <option value="savings">Ahorro e inversión</option>
                          </select>
                        </label>
                      )}
                      <CategoryAppearancePicker
                        icon={categoryIcon}
                        color={categoryColor}
                        onIconChange={setCategoryIcon}
                        onColorChange={setCategoryColor}
                      />
                      <div className="category-editor-actions">
                        <button
                          type="button"
                          className="category-secondary-button"
                          onClick={closeCategoryEditor}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="button-primary">
                          {categoryEditor ? "Guardar cambios" : "Crear categoría"}
                        </button>
                      </div>
                    </form>
                  )}
                  <div className="managed-category-list">
                    {activeCategoryDefinitions.map((category) => {
                      const isOpen = expandedManagedCategory === category.id;
                      const removal =
                        pendingCategoryRemoval?.categoryId === category.id
                          ? pendingCategoryRemoval
                          : null;
                      const removingSubcategory = removal?.subcategory
                        ? category.subcategories.find(
                            (item) => item.name === removal.subcategory,
                          )
                        : undefined;
                      const usage = removal
                        ? categoryUsage(category, removal.subcategory)
                        : 0;
                      return (
                        <article
                          className={`managed-category${isOpen ? " managed-category-open" : ""}`}
                          key={category.id}
                        >
                          <button
                            type="button"
                            className="managed-category-toggle"
                            onClick={() => {
                              rememberExpandedCategory(isOpen ? null : category.id);
                              setManagedSubcategoryMenu(null);
                            }}
                          >
                            <span
                              className="category-symbol-badge"
                              style={{
                                background: `${category.color}18`,
                                color: category.color,
                              }}
                            >
                              <CategoryIcon name={category.icon} size={21} />
                            </span>
                            <div className="managed-category-title">
                              <strong>{category.name}</strong>
                              <span>{category.subcategories.length} subcategorías</span>
                              {category.name !== 'Ingresos' && (
                                <small className={`bucket-badge bucket-${category.bucket ?? (necessaryNames.has(category.name) ? "needs" : "wants")}`}>
                                  {category.bucket === "savings" ? "Ahorro e inversión" : category.bucket === "needs" || (!category.bucket && necessaryNames.has(category.name)) ? "Supervivencia" : "Disfrutar"}
                                </small>
                              )}
                            </div>
                            <i className={isOpen ? "rotated" : ""}>
                              <Icon name="down" size={17} />
                            </i>
                          </button>
                          {isOpen && (
                            <div className="managed-category-details">
                              {category.name !== 'Ingresos' && (
                                <label className="category-bucket-field">
                                  En la regla cuenta como
                                  <select
                                    value={category.bucket ?? (necessaryNames.has(category.name) ? "needs" : "wants")}
                                    onChange={(event) => setData((old) => ({
                                      ...old,
                                      categories: (old.categories?.length ? old.categories : defaultCategoryDefinitions).map((item) => item.id === category.id ? { ...item, bucket: event.target.value as "needs" | "wants" | "savings" } : item),
                                    }))}
                                  >
                                    <option value="needs">Supervivencia</option>
                                    <option value="wants">Disfrutar</option>
                                    <option value="savings">Ahorro e inversión</option>
                                  </select>
                                </label>
                              )}
                              <div className="category-inline-actions">
                                <button
                                  type="button"
                                  className="edit-category-inline"
                                  onClick={() => openCategoryEditor(category)}
                                >
                                  <Icon name="categorias" size={15} /> Editar categoría
                                </button>
                                {!["Ingresos", "Deudas"].includes(category.name) && (
                                  <button
                                    type="button"
                                    className="delete-category-inline"
                                    onClick={() => requestCategoryRemoval(category)}
                                  >
                                    <Icon name="trash" size={15} /> Eliminar
                                  </button>
                                )}
                              </div>
                              <div className="managed-subcategories">
                                {category.subcategories.length === 0 && (
                                  <p className="empty-subcategories">
                                    Aún no hay subcategorías.
                                  </p>
                                )}
                                {category.subcategories.map((subcategory) => (
                                  <div
                                    className="managed-subcategory"
                                    key={subcategory.name}
                                  >
                                    <span>{subcategory.name}</span>
                                    <div className="settings-subcategory-actions">
                                      <button
                                        type="button"
                                        onClick={() => editSubcategory(category, subcategory)}
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        className="managed-delete"
                                        onClick={() =>
                                          requestCategoryRemoval(category, subcategory)
                                        }
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {subcategoryEditor?.categoryId === category.id && (
                                <form
                                  className="subcategory-editor"
                                  onSubmit={(event) => saveSubcategory(event, category)}
                                >
                                  <label>
                                    {subcategoryEditor.original
                                      ? "Editar subcategoría"
                                      : "Nueva subcategoría"}
                                    <input
                                      autoFocus
                                      value={subcategoryName}
                                      onChange={(event) =>
                                        setSubcategoryName(event.target.value)
                                      }
                                      placeholder="Por ejemplo, Veterinario"
                                      required
                                    />
                                  </label>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSubcategoryEditor(null);
                                        setSubcategoryName("");
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                    <button className="button-primary">Guardar</button>
                                  </div>
                                </form>
                              )}
                              {removal && (
                                <div className="removal-confirmation">
                                  <p>
                                    {usage > 0
                                      ? `Se eliminará de tus opciones futuras. Sus ${usage} movimientos o programados conservarán el nombre «${removal.subcategory ?? category.name}» en el historial.`
                                      : `¿Enviar ${removal.subcategory ?? category.name} a la papelera durante 30 días?`}
                                  </p>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => setPendingCategoryRemoval(null)}
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      className="confirm-delete-button"
                                      onClick={() =>
                                        confirmCategoryRemoval(
                                          category,
                                          removingSubcategory,
                                        )
                                      }
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              )}
                              <button
                                type="button"
                                className="add-subcategory-button"
                                onClick={() => addSubcategory(category)}
                              >
                                + Añadir subcategoría
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  <div className="restore-categories-panel">
                    <div><strong>Restaurar categorías predeterminadas</strong><p>Recupera el catálogo inicial de Mizufi. Los movimientos antiguos conservarán sus nombres.</p></div>
                    {!confirmRestoreCategories ? <button type="button" className="settings-outline-button" onClick={() => setConfirmRestoreCategories(true)}>Restaurar</button> : <div className="settings-confirm-actions"><button type="button" onClick={() => setConfirmRestoreCategories(false)}>Cancelar</button><button type="button" className="danger-button" onClick={restoreDefaultCategories}>Sí, restaurar</button></div>}
                  </div>
                </div>
              )}
              {settingsSection === "datos" && <>
                <div className="setting-card"><h2>Privacidad</h2><p>Cada perfil está asociado al usuario autenticado. Los demás probadores no pueden consultar tus cuentas, movimientos, deudas ni importes.</p><p>En Cuentas puedes ocultar por separado cada grupo y en Deudas puedes proteger todos los importes con un solo ojo.</p></div>
                <div className="setting-card"><h2>Importar movimientos</h2><p>Añade movimientos desde un archivo del banco o utiliza la plantilla de MiZUFi.</p><DataTools mode="import" movements={periodMovements} accounts={data.accounts} budgets={data.budgets ?? []} periodLabel={periodRange(period, cycleStartDay, periodOffset, firstDayOfWeek)} periodStart={isoDate(selectedPeriod.start)} periodEnd={isoDate(selectedPeriod.end)} onImport={importMovements} onMessage={toast} /></div>
                <div className="setting-card"><h2>Sincronización y copia de seguridad</h2><p className={`data-security ${saveState}`}>{saveState === "saved" ? "✓ Datos guardados" : saveState === "saving" ? "Guardando cambios…" : "No se han podido guardar los últimos cambios"}</p><p>{lastSavedAt ? `Última actualización: ${lastSavedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "Todavía no se ha completado la primera sincronización."}</p><p>Descarga una copia privada de todos tus datos o restaura una copia anterior.</p><div className="backup-actions"><button type="button" className="settings-outline-button" onClick={downloadBackup}>Descargar copia</button><button type="button" className="settings-outline-button" onClick={() => backupInputRef.current?.click()}>Restaurar copia</button><input ref={backupInputRef} className="backup-file-input" type="file" accept="application/json,.json" onChange={(event) => restoreBackup(event.target.files?.[0])} /></div></div>
                <div className="setting-card trash-card"><div className="trash-heading"><div><h2>Papelera</h2><p>Los elementos eliminados se conservan durante 30 días.</p></div><span>{(data.trash ?? []).length}</span></div>{(data.trash ?? []).length ? <div className="trash-list">{[...(data.trash ?? [])].reverse().map((item) => { const days = Math.max(1, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / 86400000)); return <article key={item.id}><div><strong>{item.label}</strong><small>{item.kind === "account" ? "Cuenta" : item.kind === "movement" ? "Movimiento" : item.kind === "program" ? "Programado" : item.kind === "debt" ? "Deuda" : item.kind === "budget" ? "Presupuesto" : item.kind === "category" ? "Categoría" : item.kind === "subcategory" ? "Subcategoría" : "Activo"} · {days} {days === 1 ? "día restante" : "días restantes"}</small></div><div><button type="button" onClick={() => restoreTrashItem(item)}>Restaurar</button><button type="button" className="trash-delete" onClick={() => permanentlyDeleteTrashItem(item)} aria-label={`Eliminar definitivamente ${item.label}`}><Icon name="trash" size={15} /></button></div></article>; })}</div> : <p className="trash-empty">No hay elementos eliminados.</p>}</div>
                <div className="setting-card settings-session-card"><h2>Sesión</h2><p>Si compartes el dispositivo, cierra la sesión cuando termines.</p><button type="button" className="settings-outline-button" onClick={onSignOut}>Cerrar sesión</button></div>
                <div className="setting-card danger-zone"><h2>Zona de seguridad</h2><div className="danger-action"><div><strong>Eliminar mis datos financieros</strong><p>Vacía cuentas, movimientos, programados, deudas, presupuestos y activos. Mantiene tu acceso a Mizufi.</p></div>{!confirmDeleteData ? <button type="button" className="danger-button" onClick={() => setConfirmDeleteData(true)}>Eliminar datos</button> : <div className="settings-confirm-actions"><button type="button" onClick={() => setConfirmDeleteData(false)}>Cancelar</button><button type="button" className="danger-button" onClick={deleteAllFinanceData}>Confirmar borrado</button></div>}</div><div className="danger-action delete-account-action"><div><strong>Eliminar mi cuenta de Mizufi</strong><p>Borra tu acceso, tus datos financieros, el registro de usuario, la actividad de la beta y el acceso VIP. Si vuelves en el futuro, tendrás que registrarte y comprar VIP de nuevo. Esta acción no se puede deshacer.</p></div><label>Escribe <b>ELIMINAR</b> para confirmar<input value={deleteAccountText} disabled={deletingAccount} onChange={(event) => setDeleteAccountText(event.target.value)} /></label><button type="button" className="danger-button" disabled={deleteAccountText !== "ELIMINAR" || deletingAccount} onClick={deleteUserAccount}>{deletingAccount ? "Eliminando…" : "Eliminar cuenta"}</button></div></div>
              </>}
              {settingsSection === "informes" && <div className="setting-card"><h2>Mis informes</h2><p>Elige un día, un mes, un año o cualquier intervalo y crea un informe completo.</p><DataTools mode="reports" movements={data.movements} accounts={data.accounts} budgets={data.budgets ?? []} categories={catalogCategoryDefinitions} ruleTargets={{ needs: targetNeeds, wants: targetWants, savings: targetSavings }} periodLabel={periodRange(period, cycleStartDay, periodOffset, firstDayOfWeek)} periodStart={isoDate(selectedPeriod.start)} periodEnd={isoDate(selectedPeriod.end)} onImport={importMovements} onMessage={toast} /></div>}
              {settingsSection === "plan" && <div className={`setting-card plan-card ${vipActive ? "plan-card-vip" : ""}`}><div className="plan-card-heading"><div><span>Tu plan actual</span><h2>{vipActive ? "MiZUFi VIP" : "MiZUFi Beta"}</h2></div><b>{vipActive ? "VIP" : "BETA"}</b></div>{vipActive ? <><p>Tu acceso VIP está activo para siempre.</p><ul><li>Todas las funciones de MiZUFi.</li><li>Sin publicidad.</li><li>Sin cuotas ni renovaciones.</li></ul><p className="setting-note">Gracias por apoyar el crecimiento de MiZUFi 🌊</p></> : <div className="beta-access-note"><strong>Estás disfrutando de la versión beta de MiZUFi.</strong><p>Más adelante MiZUFi será de pago, pero esta cuenta mantendrá el acceso gratuito para siempre mientras no la elimines.</p><small>Si eliminas la cuenta y vuelves a registrarte, este acceso gratuito permanente se perderá.</small></div>}{vipCheckoutMessage && <p className="vip-checkout-message" role="status">{vipCheckoutMessage}</p>}</div>}
              {settingsSection === "ayuda" && <><div className="setting-card help-card"><h2>Cómo funciona Mizufi</h2><p>Respuestas breves sobre los cálculos principales.</p><details><summary>¿Cómo se calcula el dinero disponible?</summary><p>Saldo de las cuentas activadas menos todos los pagos previstos del periodo. Los ingresos futuros no se suman hasta que llegan.</p></details><details><summary>¿Qué diferencia hay entre realizado y previsto?</summary><p>Un movimiento realizado ya afecta al saldo. Un movimiento previsto pertenece al futuro y sirve para anticiparte, pero todavía no modifica la cuenta.</p></details><details><summary>¿Cómo funcionan las huchas?</summary><p>Una aportación a una hucha es un traspaso, no un gasto. El gasto se registra cuando utilizas ese dinero para pagar.</p></details><details><summary>¿Cómo funcionan las devoluciones?</summary><p>Una devolución devuelve dinero a la cuenta y reduce el gasto neto de su categoría. No se considera un ingreso nuevo.</p></details><details><summary>¿Cómo interpreta Mizufi las deudas?</summary><p>La cuota completa sale de la cuenta, pero el capital pendiente solo disminuye por la parte amortizada. Los intereses no reducen la deuda.</p></details><details><summary>¿Qué es la regla de distribución?</summary><p>Compara los ingresos del periodo con lo destinado a Sobrevivir, Disfrutar y Ahorro e inversión según los porcentajes que hayas elegido.</p></details></div><div className="setting-card"><h2>Ayúdanos a mejorar la beta</h2><p>Cuéntanos si algo no funciona o si echas de menos alguna cosa.</p><FeedbackForm currentArea={`${tab}/${movementSection}`} onSent={toast} /></div></>}
              {settingsSection === "acerca" && <><div className="setting-card about-card"><span className="beta-label">BETA · VERSIÓN 0.1</span><h2>Sobre Mizufi</h2><p>Mizufi te ayuda a saber dónde va tu dinero, anticiparte a lo que viene y tomar decisiones con más calma.</p><p><strong>Finanzas sin rollos, para tu vida real.</strong></p></div><div className="setting-card"><h2>Información legal</h2><p>Consulta el aviso legal, la privacidad, las cookies y las condiciones de compra en un único lugar.</p><a className="settings-outline-link" href="/legal" target="_blank" rel="noreferrer">Abrir centro legal</a></div><div className="setting-card"><h2>Contacto</h2><p>Para consultas sobre MiZUFi, privacidad o compras, escribe a <a href="mailto:hola@somosmizufi.com">hola@somosmizufi.com</a>.</p></div></>}
              {isBetaAdmin && settingsSection === "beta" && (
                <div className="setting-card beta-panel">
                  <div className="beta-panel-heading"><div><h2>Seguimiento de la beta</h2><p>Datos de uso generales. Tus propios accesos no se incluyen.</p></div><span>Solo visible para ti</span></div>
                  <div className="beta-stat-grid">
                    <article><span>Usuarios registrados</span><strong>{betaStats?.registered ?? 0}</strong><small>Han accedido al menos una vez</small></article>
                    <article><span>Han empezado</span><strong>{betaStats?.started ?? 0}</strong><small>Ya han guardado datos en Mizufi</small></article>
                    <article><span>Activos últimos 7 días</span><strong>{betaStats?.active7 ?? 0}</strong><small>Han vuelto durante esta semana</small></article>
                    <article><span>Activos últimos 30 días</span><strong>{betaStats?.active30 ?? 0}</strong><small>Actividad reciente de la beta</small></article>
                    <article><span>Clics en anuncios</span><strong>{betaStats?.adClicks ?? 0}</strong><small>Interacciones registradas con publicidad</small></article>
                    <article><span>Clics en afiliaciones</span><strong>{betaStats?.affiliateClicks ?? 0}</strong><small>Visitas enviadas a colaboradores</small></article>
                    <article><span>Usuarios VIP</span><strong>{betaStats?.subscribers ?? 0}</strong><small>Pagos únicos con acceso sin publicidad</small></article>
                  </div>
                  <section className="beta-capacity-panel">
                    <div className="beta-capacity-heading"><div><h3>Capacidad y salud del sistema</h3><p>Solo muestra cantidades y tamaños generales, nunca datos financieros.</p></div><span className={`beta-health-badge ${(betaStats?.capacity?.alerts ?? []).some((alert) => alert.level === "critical") ? "critical" : (betaStats?.capacity?.alerts ?? []).some((alert) => alert.level === "warning") ? "warning" : "good"}`}>{(betaStats?.capacity?.alerts ?? []).some((alert) => alert.level === "critical") ? "Requiere atención" : (betaStats?.capacity?.alerts ?? []).some((alert) => alert.level === "warning") ? "Revisar" : "Todo correcto"}</span></div>
                    <div className="beta-capacity-grid">
                      <article><span>Datos financieros guardados</span><strong>{formatStorage(betaStats?.capacity?.stateBytes ?? 0)}</strong><small>Referencia conservadora: {formatStorage(betaStats?.capacity?.storageLimitBytes ?? 500 * 1024 * 1024)}</small><div className="beta-capacity-bar"><i style={{ width: `${Math.max(1, betaStats?.capacity?.storagePercent ?? 0)}%` }} /></div><b>{(betaStats?.capacity?.storagePercent ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })} % utilizado</b></article>
                      <article><span>Cuenta con más datos</span><strong>{formatStorage(betaStats?.capacity?.largestProfileBytes ?? 0)}</strong><small>Media por usuario: {formatStorage(betaStats?.capacity?.averageProfileBytes ?? 0)}</small><div className="beta-capacity-bar profile"><i style={{ width: `${Math.max(1, betaStats?.capacity?.largestProfilePercent ?? 0)}%` }} /></div><b>{(betaStats?.capacity?.largestProfilePercent ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })} % del límite individual</b></article>
                      <article><span>Perfiles con datos</span><strong>{betaStats?.capacity?.profileCount ?? 0}</strong><small>Usuarios que ya han guardado información en MiZUFi</small></article>
                      <article><span>Próxima revisión</span><strong>{betaStats?.capacity?.nextUserReview ?? 100} usuarios</strong><small>Revisiones previstas a los 100, 250, 400 y 1.000 usuarios</small></article>
                    </div>
                    <div className="beta-capacity-alerts">
                      {(betaStats?.capacity?.alerts ?? [{ level: "info" as const, title: "Calculando capacidad", message: "Los datos de capacidad aparecerán al volver a abrir el panel." }]).map((alert, index) => <article className={alert.level} key={`${alert.title}-${index}`}><span aria-hidden="true">{alert.level === "critical" ? "!" : alert.level === "warning" ? "!" : alert.level === "good" ? "✓" : "i"}</span><div><strong>{alert.title}</strong><p>{alert.message}</p></div></article>)}
                    </div>
                  </section>
                  <div className="beta-feedback-list">
                    <h3>Avisos y sugerencias recientes</h3>
                    {betaStats?.feedback?.length ? betaStats.feedback.map((item) => <article key={item.id}><header><strong>{item.type === "error" ? "Error" : "Sugerencia"}</strong><small>{new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</small></header><small>{item.email}</small><p>{item.message}</p></article>) : <p>No hay mensajes pendientes de la beta.</p>}
                  </div>
                  <p className="beta-privacy-note">Este panel no permite consultar cuentas, movimientos, deudas ni importes de los probadores.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {tutorialOpen && (
        <div className="tutorial-layer" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
          <div className="tutorial-shade" />
          <section className={`tutorial-card tutorial-step-${tutorialStep}`}>
            <header>
              <img src="/mizufi-logo-ola-mar.png" alt="Mizufi" />
              <button type="button" onClick={() => closeTutorial(false)} aria-label="Saltar tutorial">×</button>
            </header>
            <div className="tutorial-progress" aria-label={`Paso ${tutorialStep + 1} de ${tutorialSteps.length}`}>
              {tutorialSteps.map((_, index) => <i key={index} className={index <= tutorialStep ? "active" : ""} />)}
            </div>
            <p className="tutorial-count">{tutorialStep + 1} de {tutorialSteps.length}</p>
            <h2 id="tutorial-title">{tutorialSteps[tutorialStep].title}</h2>
            <p>{tutorialSteps[tutorialStep].text}</p>
            <footer>
              <button type="button" className="tutorial-skip" onClick={() => closeTutorial(false)}>{tutorialStep === 0 ? "Ahora no" : "Saltar"}</button>
              <div>
                {tutorialStep > 0 && <button type="button" className="tutorial-previous" onClick={() => changeTutorialStep(tutorialStep - 1)}>Atrás</button>}
                {tutorialStep < tutorialSteps.length - 1 ? <button type="button" className="tutorial-next" onClick={() => changeTutorialStep(tutorialStep + 1)}>{tutorialStep === 0 ? "Empezar recorrido" : "Siguiente"}</button> : <button type="button" className="tutorial-next" onClick={() => { closeTutorial(true); setTab("cuentas"); }}>Ir a Cuentas</button>}
              </div>
            </footer>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast">
          <Icon name="check" size={17} />
          {notice}
        </div>
      )}
    </div>
  );
}
