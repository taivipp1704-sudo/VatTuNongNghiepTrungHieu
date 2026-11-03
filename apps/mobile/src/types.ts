export interface SessionUser {
  dataEpoch?: string;
  id: string;
  username: string;
  name: string;
  owner: boolean;
  mustChangePassword: boolean;
  permissions: string[];
  warehouseIds: string[];
  roles: { id: string; name: string }[];
}
export interface Warehouse {
  id: string;
  name: string;
  address: string;
}
export interface Lot {
  isDeficit?: boolean;
  id: string;
  code: string;
  warehouseId: string;
  warehouseName: string;
  location: string;
  expiresOn: string | null;
  quantity: number;
  reserved: number;
  available: number;
  state: string;
  costBase?: number;
}
export interface Product {
  list_total?: number;
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  base_unit: string;
  pack_unit: string;
  pack_factor: number;
  price_base: number;
  price_pack: number;
  cost_base?: number;
  min_stock: number;
  track_lots: boolean;
  technical_info: string;
  loyalty_rate: number;
  image_url?: string;
  lots: Lot[];
  available: number;
  actual: number;
  details?: {
    wholesaleBase?: number | null;
    wholesalePack?: number | null;
    weightGrams?: number;
    dimensions?: string;
    sellable?: boolean;
  };
  max_stock?: number | null;
  storage_location?: string;
}
export interface Partner {
  list_total?: number;
  id: string;
  name: string;
  kind: "CUSTOMER" | "SUPPLIER";
  phone: string;
  address: string;
  tax_code: string;
  credit_limit: number;
  loyalty_balance?: number;
  lifetime_spend?: number;
  lifetime_earned?: number;
  pending_points?: number;
  debt_balance?: number;
  profile?: {
    code?: string;
    email?: string;
    group?: string;
    birthday?: string | null;
    gender?: "MALE" | "FEMALE" | "OTHER";
    discountPercent?: number;
    priceBook?: "RETAIL" | "WHOLESALE";
    assignedStaff?: string;
    active?: boolean;
    addresses?: { label: string; address: string }[];
    contacts?: { name: string; phone: string; email: string }[];
  };
}
export interface CartLine {
  productId: string;
  name: string;
  quantity: number;
  unit: "BASE" | "PACK";
  unitLabel: string;
  unitPrice: number;
}
export interface Bootstrap {
  inventoryPolicy?: { allowNegativeStock: boolean };
  user: SessionUser;
  warehouses: Warehouse[];
  store: { name: string; address: string; phone: string };
  permissions: string[];
  invoiceProvider: string;
}
export type DataRow = Record<string, any>;
export interface LoyaltySettings {
  enabled: boolean;
  pointValue: number;
  earningTiming: "ORDER" | "FULL_PAYMENT" | "PROPORTIONAL";
  earningBase: "AFTER_DISCOUNT" | "BEFORE_DISCOUNT";
  rounding: "FLOOR" | "NEAREST" | "CEIL";
  redeemEnabled: boolean;
  minRedeemPoints: number;
  maxRedeemPercent: number;
  reverseEarnOnReturn: boolean;
  refundSpentOnReturn: boolean;
  tiersEnabled: boolean;
  tiers: { name: string; minimumPoints: number }[];
}
export interface LoyaltyQuote {
  total: number;
  loyaltyDiscount: number;
  redeemPoints: number;
  potentialPoints: number;
  availablePoints: number;
  settings: LoyaltySettings;
}
