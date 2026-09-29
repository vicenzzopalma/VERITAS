import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { getRedisClient, setInRedis } from "../../libs/redisStore";
import { logger } from "../../utils/logger";
import { setWppKeyInCache } from "./wppKeyCache";

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
  setWppKeyInCache(connectionId, deviceId, type, id, value);

  const valueJson = JSON.stringify(value, BufferJSON.replacer);

  const redis = getRedisClient();
  if (redis) {
    const redisKey = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
    setInRedis(redisKey, valueJson).catch(() => {});
  }

  WppKey.upsert({
    connectionId,
    type,
    keyId: id,
    value: valueJson
  }).catch(err => {
    logger.debug({
      info: "Error storing key in database",
      connectionId,
      type,
      keyId: id,
      err
    });
  });
};

export const StoreWppSessionKeysBatch = async (
  items: StoreKeyRequest[]
): Promise<void> => {
  if (!items || items.length === 0) return;

  const redis = getRedisClient();

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

    // Persistência assíncrona não-bloqueante no SQLite (sem travar conexões ou transações)
    WppKey.upsert({
      connectionId: item.connectionId,
      type: item.type,
      keyId: item.id,
      value: valueJson
    }).catch(err => {
      logger.debug({
        info: "Error storing key batch item in database",
        connectionId: item.connectionId,
        type: item.type,
        keyId: item.id,
        err
      });
    });
  }
};

export default StoreWppSessionKeys;
