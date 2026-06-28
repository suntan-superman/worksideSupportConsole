import { apiRequest } from "@/services/apiClient";

type AnyRecord = Record<string, any>;

export type SupportProduct = {
  id: string;
  label: string;
};

function collectionFromPayload(payload: AnyRecord) {
  const value = payload.items || payload.products || payload.data?.items || payload.data?.products || payload.data || payload;
  return Array.isArray(value) ? value : [];
}

export async function getSupportProducts() {
  const payload = await apiRequest<AnyRecord>("/support/products");
  const products = collectionFromPayload(payload)
    .map((item) => {
      const id = String(item.id || item.product || item.productKey || item.key || "").trim();
      if (!id) return null;
      return {
        id,
        label: String(item.label || item.name || id).trim()
      };
    })
    .filter(Boolean) as SupportProduct[];

  return {
    products
  };
}
