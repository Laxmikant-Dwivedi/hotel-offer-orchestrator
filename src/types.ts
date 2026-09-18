export interface SupplierHotel {
  hotelId: string;
  name: string;
  price: number;
  city: string;
  commissionPct: number;
}

export type SupplierName = "Supplier A" | "Supplier B";

export interface HotelOffer {
  name: string;
  price: number;
  supplier: SupplierName;
  commissionPct: number;
}

export interface SupplierHealth {
  name: SupplierName;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}
