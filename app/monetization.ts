export const monetizationConfig = {
  enabled: true,
  adsEnabled: false,
  affiliatesEnabled: false,
  vipEnabled: true,
  vipPrice: "4,99 €",
  vipFounderLimit: 100,
} as const;

export type MizufiPlan = "free" | "vip";

// Los espacios de monetización no se renderizan mientras enabled sea false.
// Cuando se elijan proveedores, se activarán por ubicación sin modificar los
// flujos sensibles de movimientos, cuentas o deudas.
export const monetizationPlacements = {
  balanceFooter: "balance_footer",
  resources: "resources",
} as const;
