import { proxyActivities, log } from "@temporalio/workflow";
import type * as activities from "./activities";
import { HotelOffer, SupplierHotel, SupplierName } from "../types";

const { fetchSupplierAHotels, fetchSupplierBHotels } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: {
    initialInterval: "1 second",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

function toOffer(hotel: SupplierHotel, supplier: SupplierName): HotelOffer {
  return {
    name: hotel.name,
    price: hotel.price,
    supplier,
    commissionPct: hotel.commissionPct,
  };
}

/**
 * Calls both suppliers in parallel, dedupes hotels by name, and keeps the
 * cheaper offer per hotel. If a supplier call ultimately fails (after
 * Temporal's activity retries are exhausted), the workflow degrades
 * gracefully and proceeds with whatever the other supplier returned,
 * matching the "if only one supplier returns a hotel" requirement.
 */
export interface SimulateDownOptions {
  supplierA?: boolean;
  supplierB?: boolean;
}

export async function hotelAggregationWorkflow(
  city: string,
  simulateDown?: SimulateDownOptions
): Promise<HotelOffer[]> {
  const [supplierAResult, supplierBResult] = await Promise.allSettled([
    fetchSupplierAHotels(city, simulateDown?.supplierA),
    fetchSupplierBHotels(city, simulateDown?.supplierB),
  ]);

  const supplierAHotels: SupplierHotel[] =
    supplierAResult.status === "fulfilled" ? supplierAResult.value : [];
  const supplierBHotels: SupplierHotel[] =
    supplierBResult.status === "fulfilled" ? supplierBResult.value : [];

  if (supplierAResult.status === "rejected") {
    log.warn("Supplier A unavailable after retries, continuing with Supplier B only", {
      city,
      reason: String(supplierAResult.reason),
    });
  }
  if (supplierBResult.status === "rejected") {
    log.warn("Supplier B unavailable after retries, continuing with Supplier A only", {
      city,
      reason: String(supplierBResult.reason),
    });
  }

  const byName = new Map<string, HotelOffer>();

  for (const hotel of supplierAHotels) {
    byName.set(hotel.name, toOffer(hotel, "Supplier A"));
  }

  for (const hotel of supplierBHotels) {
    const existing = byName.get(hotel.name);
    const candidate = toOffer(hotel, "Supplier B");
    if (!existing || candidate.price < existing.price) {
      byName.set(hotel.name, candidate);
    }
  }

  const deduped = Array.from(byName.values()).sort((a, b) => a.price - b.price);

  log.info("Hotel aggregation complete", {
    city,
    supplierACount: supplierAHotels.length,
    supplierBCount: supplierBHotels.length,
    dedupedCount: deduped.length,
  });

  return deduped;
}
