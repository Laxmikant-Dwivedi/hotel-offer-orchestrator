import axios from "axios";
import { config } from "../config";
import { logger } from "../logger";
import { SupplierHotel, SupplierHealth, SupplierName } from "../types";

const httpClient = axios.create({ timeout: config.supplierTimeoutMs });

async function fetchFromSupplier(
  path: string,
  supplier: SupplierName,
  city: string,
  simulateDown?: boolean
): Promise<SupplierHotel[]> {
  const url = `${config.selfBaseUrl}${path}`;
  try {
    const response = await httpClient.get<SupplierHotel[]>(url, {
      params: { city, ...(simulateDown ? { down: "true" } : {}) },
    });
    logger.info("Activity fetched supplier hotels", {
      supplier,
      city,
      count: response.data.length,
    });
    return response.data;
  } catch (error) {
    const message = axios.isAxiosError(error) ? error.message : String(error);
    logger.error("Activity failed to fetch supplier hotels", { supplier, city, error: message });
    // Rethrow so Temporal's retry policy (configured on the workflow side) can retry the call.
    throw new Error(`${supplier} request failed: ${message}`);
  }
}

export async function fetchSupplierAHotels(city: string, simulateDown?: boolean): Promise<SupplierHotel[]> {
  return fetchFromSupplier("/supplierA/hotels", "Supplier A", city, simulateDown);
}

export async function fetchSupplierBHotels(city: string, simulateDown?: boolean): Promise<SupplierHotel[]> {
  return fetchFromSupplier("/supplierB/hotels", "Supplier B", city, simulateDown);
}

async function checkSupplierHealth(path: string, supplier: SupplierName): Promise<SupplierHealth> {
  const start = Date.now();
  try {
    await httpClient.get(`${config.selfBaseUrl}${path}`, { params: { city: "delhi" } });
    return { name: supplier, healthy: true, latencyMs: Date.now() - start };
  } catch (error) {
    const message = axios.isAxiosError(error) ? error.message : String(error);
    return { name: supplier, healthy: false, latencyMs: Date.now() - start, error: message };
  }
}

export async function checkSupplierAHealth(): Promise<SupplierHealth> {
  return checkSupplierHealth("/supplierA/hotels", "Supplier A");
}

export async function checkSupplierBHealth(): Promise<SupplierHealth> {
  return checkSupplierHealth("/supplierB/hotels", "Supplier B");
}
