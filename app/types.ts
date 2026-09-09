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
};

export type PickCategory = {
  id: string;
  label: string;
  count: number;
  items: PickItem[];
};

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
};
