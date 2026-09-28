import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { getRedisClient, setInRedis } from "../../libs/redisStore";
import { logger } from "../../utils/logger";
import { setWppKeyInCache } from "./wppKeyCache";
import sequelize from "../../database";

export interface StoreKeyRequest {
  connectionId: number;
  deviceId: number;
  type: string;
  id: string;
  value: any;
}

export const StoreWppSessionKeys = async ({
  connectionId,
  deviceId,
  type,
  id,
  value
}: StoreKeyRequest): Promise<void> => {
  // 1. Atualiza imediatamente o cache de memória ultra rápido
  setWppKeyInCache(connectionId, deviceId, type, id, value);

  const valueJson = JSON.stringify(value, BufferJSON.replacer);

  const redis = getRedisClient();
  if (redis) {
    const redisKey = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
    setInRedis(redisKey, valueJson).catch(() => {});
  }

  try {
    await WppKey.upsert({
      connectionId,
      type,
      keyId: id,
      value: valueJson
    });
  } catch (err) {
    logger.error({
      info: "Error storing key in database",
      connectionId,
      type,
      keyId: id,
      err
    });
  }
};

export const StoreWppSessionKeysBatch = async (
  items: StoreKeyRequest[]
): Promise<void> => {
  if (!items || items.length === 0) return;

  const redis = getRedisClient();

  const formattedItems: {
    connectionId: number;
    type: string;
    keyId: string;
    value: string;
  }[] = [];

  for (const item of items) {
    setWppKeyInCache(
      item.connectionId,
      item.deviceId,
      item.type,
      item.id,
      item.value
    );

    const valueJson = JSON.stringify(item.value, BufferJSON.replacer);

    if (redis) {
      const redisKey = `wpp:${item.connectionId}:${item.deviceId}:${item.type}:${item.id}`;
      setInRedis(redisKey, valueJson).catch(() => {});
    }

    formattedItems.push({
      connectionId: item.connectionId,
      type: item.type,
      keyId: item.id,
      value: valueJson
    });
  }

  // Gravação em lote dentro de transação com retries automáticos
  const executeBatch = async () => {
    await sequelize.transaction(async t => {
      for (const item of formattedItems) {
        await WppKey.upsert(item, { transaction: t });
      }
    });
  };

  let success = false;
  let lastErr: any;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await executeBatch();
      success = true;
      break;
    } catch (err: any) {
      lastErr = err;
      const isLock =
        err?.message?.includes("SQLITE_BUSY") ||
        err?.code === "SQLITE_BUSY" ||
        err?.name === "SequelizeTimeoutError";

      if (isLock && attempt < 5) {
        await new Promise(res =>
          setTimeout(res, attempt * 120 + Math.floor(Math.random() * 80))
        );
      } else {
        break;
      }
    }
  }

  if (!success) {
    logger.error({
      info: "Error storing batch keys in database after retries",
      count: items.length,
      err: lastErr
    });
  }
};

export default StoreWppSessionKeys;
