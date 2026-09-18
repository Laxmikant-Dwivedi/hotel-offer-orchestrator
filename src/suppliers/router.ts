import { Router } from "express";
import { getSupplierAHotels, getSupplierBHotels } from "./data";
import { logger } from "../logger";

export const suppliersRouter = Router();

/**
 * `down=true` lets Postman/tests simulate a supplier outage without
 * touching any code (e.g. GET /supplierA/hotels?city=delhi&down=true).
 */
suppliersRouter.get("/supplierA/hotels", (req, res) => {
  const { city, down } = req.query;

  if (down === "true") {
    logger.warn("Supplier A simulated outage", { city });
    res.status(503).json({ error: "Supplier A is temporarily unavailable" });
    return;
  }

  const hotels = getSupplierAHotels(typeof city === "string" ? city : undefined);
  logger.info("Supplier A responded", { city, count: hotels.length });
  res.json(hotels);
});

suppliersRouter.get("/supplierB/hotels", (req, res) => {
  const { city, down } = req.query;

  if (down === "true") {
    logger.warn("Supplier B simulated outage", { city });
    res.status(503).json({ error: "Supplier B is temporarily unavailable" });
    return;
  }

  const hotels = getSupplierBHotels(typeof city === "string" ? city : undefined);
  logger.info("Supplier B responded", { city, count: hotels.length });
  res.json(hotels);
});
