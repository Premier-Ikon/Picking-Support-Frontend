export type PickItem = {
  id: string;
  name: string;
  title: string;
  productType: string | null;
  size: string | null;
  sizeShort?: string | null;
  quantity: number;
  imageUrl: string | null;
  sku: string | null;
  category: string;
  orders?: { orderNumber: string; shipmentId: string; quantity: number }[];
};

export type MissingItem = {
  id: string;
  batchNumber: string;
  itemId: string;
  name: string;
  title: string;
  size: string | null;
  sizeShort?: string | null;
  sku: string | null;
  imageUrl: string | null;
  category: string;
  quantityMissing: number;
  orders: { orderNumber: string; shipmentId: string; quantity: number }[];
};

export type FillingHoldItem = {
  itemId?: string;
  name?: string;
  title: string;
  size: string | null;
  sizeShort?: string | null;
  imageUrl?: string | null;
  quantity: number;
  category?: string;
};

export type FillingHoldOrder = {
  orderNumber: string;
  shipmentId: string;
  missingItems: FillingHoldItem[];
  bagItems: FillingHoldItem[];
};

export type InventoryLocationStock = {
  name: string;
  available: number;
  onHand: number;
  backstock: boolean;
};

export type InventoryCheck = {
  configured: boolean;
  sku?: string | null;
  locations: InventoryLocationStock[];
  backstock: InventoryLocationStock[];
  message?: string;
};

export type FillingPlan = {
  holdOrders: FillingHoldOrder[];
  missingCount: number;
};

export type PickCategory = {
  id: string;
  label: string;
  count: number;
  items: PickItem[];
};

export type BagSize = "large" | "ml" | "medium" | "small";

export type BagItem = {
  title: string;
  size: string | null;
  sizeShort?: string | null;
  category: string;
  quantity: number;
};

export type PlannedBag = {
  size: BagSize;
  reason: string;
  items: BagItem[];
};

export type BaggingShipment = {
  shipmentId: string;
  orderNumber: string;
  shipmentNumber: string;
  bagCount: number;
  boxCount: number;
  bags: PlannedBag[];
  boxItems: BagItem[];
};

export type BaggingPlan = {
  totals: {
    large: number;
    ml: number;
    medium: number;
    small: number;
    boxes: number;
    totalBags: number;
    shipmentCount: number;
  };
  rules: string[];
  shipments: BaggingShipment[];
};

export type AppTab = "picking" | "bagging" | "filling";

export type PickListResponse = {
  success: boolean;
  error?: string;
  batch: {
    batchNumber: string;
    batchId: string;
    status: string | null;
    shipmentCount: number;
    createdAt: string | null;
  };
  summary: {
    totalItems: number;
    uniqueItems: number;
    shipmentCount: number;
  };
  categories: PickCategory[];
  bagging?: BaggingPlan;
  missing?: MissingItem[];
  filling?: FillingPlan;
};
