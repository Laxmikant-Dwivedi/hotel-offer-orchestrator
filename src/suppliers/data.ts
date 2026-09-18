import { SupplierHotel } from "../types";

/**
 * Static mock catalogs. Names intentionally overlap between suppliers
 * (per city) so the aggregation workflow has real deduping/price-compare
 * work to do, plus some supplier-exclusive hotels to exercise the
 * "only one supplier returned it" path.
 */
const supplierACatalog: Record<string, SupplierHotel[]> = {
  delhi: [
    { hotelId: "a1", name: "Holtin", price: 6000, city: "delhi", commissionPct: 10 },
    { hotelId: "a2", name: "Radison", price: 5900, city: "delhi", commissionPct: 13 },
    { hotelId: "a3", name: "Taj Palace", price: 12500, city: "delhi", commissionPct: 8 },
    { hotelId: "a4", name: "ITC Maurya", price: 15800, city: "delhi", commissionPct: 9 },
    { hotelId: "a5", name: "The Lalit", price: 8700, city: "delhi", commissionPct: 12 },
  ],
  mumbai: [
    { hotelId: "a10", name: "Taj Mahal Palace", price: 21000, city: "mumbai", commissionPct: 7 },
    { hotelId: "a11", name: "Trident Nariman Point", price: 13500, city: "mumbai", commissionPct: 11 },
    { hotelId: "a12", name: "Holtin", price: 9800, city: "mumbai", commissionPct: 10 },
  ],
  bangalore: [
    { hotelId: "a20", name: "The Oberoi", price: 11200, city: "bangalore", commissionPct: 9 },
  ],
};

const supplierBCatalog: Record<string, SupplierHotel[]> = {
  delhi: [
    { hotelId: "b1", name: "Holtin", price: 5340, city: "delhi", commissionPct: 20 },
    { hotelId: "b2", name: "Radison", price: 6100, city: "delhi", commissionPct: 15 },
    { hotelId: "b3", name: "Leela Palace", price: 17200, city: "delhi", commissionPct: 10 },
    { hotelId: "b4", name: "The Lalit", price: 8450, city: "delhi", commissionPct: 14 },
    { hotelId: "b5", name: "Shangri-La Eros", price: 13900, city: "delhi", commissionPct: 11 },
  ],
  mumbai: [
    { hotelId: "b10", name: "Taj Mahal Palace", price: 20500, city: "mumbai", commissionPct: 8 },
    { hotelId: "b11", name: "Holtin", price: 9600, city: "mumbai", commissionPct: 16 },
    { hotelId: "b12", name: "ITC Grand Central", price: 12800, city: "mumbai", commissionPct: 9 },
  ],
  bangalore: [],
};

export function getSupplierAHotels(city?: string): SupplierHotel[] {
  if (!city) return Object.values(supplierACatalog).flat();
  return supplierACatalog[city.toLowerCase()] ?? [];
}

export function getSupplierBHotels(city?: string): SupplierHotel[] {
  if (!city) return Object.values(supplierBCatalog).flat();
  return supplierBCatalog[city.toLowerCase()] ?? [];
}
