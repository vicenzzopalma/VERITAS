import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { getRedisClient, getFromRedis } from "../../libs/redisStore";
import { logger } from "../../utils/logger";
import { getWppKeyFromCache, setWppKeyInCache } from "./wppKeyCache";

interface GetKeysRequest {
  connectionId: number;
  deviceId: number;
  type: string;
  ids: string[];
}

const GetWppSessionKeys = async ({
  connectionId,
  deviceId,
  type,
  ids
}: GetKeysRequest): Promise<any> => {
  const data: any = {};
  const missingFromMemory: string[] = [];

  // 1. Verifica cache em memória ultra rápido
  for (const id of ids) {
    const cached = getWppKeyFromCache(connectionId, deviceId, type, id);
    if (cached !== undefined) {
      data[id] = cached;
    } else {
      missingFromMemory.push(id);
    }
  }

  // Se tudo estava no cache de memória, retorna instantaneamente (0ms de I/O)
  if (missingFromMemory.length === 0) {
    return data;
  }

  const missingFromRedis: string[] = [];
  const redis = getRedisClient();

  if (redis) {
    await Promise.all(
      missingFromMemory.map(async id => {
        const key = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
        const stored = await getFromRedis(key);

        if (stored) {
          try {
            const parsed = JSON.parse(stored, BufferJSON.reviver);
            data[id] = parsed;
            setWppKeyInCache(connectionId, deviceId, type, id, parsed);
          } catch {
            missingFromRedis.push(id);
          }
        } else {
          missingFromRedis.push(id);
        }
      })
    );
  } else {
    missingFromRedis.push(...missingFromMemory);
  }

  if (missingFromRedis.length > 0) {
    try {
      const records = await WppKey.findAll({
        where: {
          connectionId,
          type,
          keyId: missingFromRedis
        }
      });

      for (const record of records) {
        try {
          const parsed = JSON.parse(record.value, BufferJSON.reviver);
          data[record.keyId] = parsed;
          setWppKeyInCache(connectionId, deviceId, type, record.keyId, parsed);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      logger.error({
        info: "Error getting keys from database",
        connectionId,
        type,
        err
      });
    }
  }

  return data;
};

export default GetWppSessionKeys;
