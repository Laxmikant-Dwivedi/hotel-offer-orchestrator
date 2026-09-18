import { Router } from "express";
import { runHotelAggregationWorkflow } from "../temporal/client";
import { saveHotelsForCity, getHotelsForCityInPriceRange } from "../services/redisHotelStore";
import { logger } from "../logger";

export const hotelsRouter = Router();

function parsePrice(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

hotelsRouter.get("/api/hotels", async (req, res) => {
  const { city, minPrice, maxPrice, simulateDown } = req.query;

  if (typeof city !== "string" || city.trim() === "") {
    res.status(400).json({ error: "Query parameter 'city' is required" });
    return;
  }

  const min = parsePrice(minPrice);
  const max = parsePrice(maxPrice);

  if (minPrice !== undefined && min === undefined) {
    res.status(400).json({ error: "'minPrice' must be a number" });
    return;
  }
  if (maxPrice !== undefined && max === undefined) {
    res.status(400).json({ error: "'maxPrice' must be a number" });
    return;
  }

  const simulateDownValue = typeof simulateDown === "string" ? simulateDown.toLowerCase() : undefined;
  const simulateDownOptions =
    simulateDownValue && ["a", "b", "both"].includes(simulateDownValue)
      ? {
          supplierA: simulateDownValue === "a" || simulateDownValue === "both",
          supplierB: simulateDownValue === "b" || simulateDownValue === "both",
        }
      : undefined;

  try {
    const offers = await runHotelAggregationWorkflow(city, simulateDownOptions);
    await saveHotelsForCity(city, offers);

    if (min !== undefined || max !== undefined) {
      const filtered = await getHotelsForCityInPriceRange(
        city,
        min ?? 0,
        max ?? Number.MAX_SAFE_INTEGER
      );
      logger.info("Returned price-filtered hotels", { city, min, max, count: filtered.length });
      res.json(filtered);
      return;
    }

    res.json(offers);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to aggregate hotels", { city, error: message });
    res.status(502).json({ error: "Failed to fetch hotel offers", details: message });
  }
});
