import { redis } from "../redisClient";
import { config } from "../config";
import { logger } from "../logger";
import { HotelOffer } from "../types";

function hotelsKey(city: string): string {
  return `hotels:${city.toLowerCase()}`;
}

/**
 * Persists the deduped, best-priced offer list for a city as a Redis
 * sorted set, scored by price. Storing price as the score is what lets
 * min/max price filtering happen inside Redis (ZRANGEBYSCORE) instead of
 * in application code.
 */
export async function saveHotelsForCity(city: string, offers: HotelOffer[]): Promise<void> {
  const key = hotelsKey(city);

  const pipeline = redis.pipeline();
  pipeline.del(key);

  if (offers.length > 0) {
    const zaddArgs: (string | number)[] = [];
    for (const offer of offers) {
      zaddArgs.push(offer.price, JSON.stringify(offer));
    }
    pipeline.zadd(key, ...zaddArgs);
    pipeline.expire(key, config.hotelsCacheTtlSeconds);
  }

  await pipeline.exec();
  logger.info("Saved deduped hotels to Redis", { city, count: offers.length, key });
}

export async function cityHasCachedHotels(city: string): Promise<boolean> {
  const exists = await redis.exists(hotelsKey(city));
  return exists === 1;
}

export async function getAllHotelsForCity(city: string): Promise<HotelOffer[]> {
  const raw = await redis.zrange(hotelsKey(city), 0, -1);
  return raw.map((entry) => JSON.parse(entry) as HotelOffer);
}

/**
 * Filters by price range entirely inside Redis via ZRANGEBYSCORE, using
 * the sorted set built in saveHotelsForCity.
 */
export async function getHotelsForCityInPriceRange(
  city: string,
  minPrice: number,
  maxPrice: number
): Promise<HotelOffer[]> {
  const raw = await redis.zrangebyscore(hotelsKey(city), minPrice, maxPrice);
  return raw.map((entry) => JSON.parse(entry) as HotelOffer);
}
