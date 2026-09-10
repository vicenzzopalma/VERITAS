import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { getRedisClient, getFromRedis } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

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
  const missingIds: string[] = [];

  const redis = getRedisClient();
  if (redis) {
    await Promise.all(
      ids.map(async id => {
        const key = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
        const stored = await getFromRedis(key);

        if (stored) {
          try {
            data[id] = JSON.parse(stored, BufferJSON.reviver);
          } catch {
            missingIds.push(id);
          }
        } else {
          missingIds.push(id);
        }
      })
    );
  } else {
    missingIds.push(...ids);
  }

  if (missingIds.length > 0) {
    try {
      const records = await WppKey.findAll({
        where: {
          connectionId,
          type,
          keyId: missingIds
        }
      });

      for (const record of records) {
        try {
          data[record.keyId] = JSON.parse(record.value, BufferJSON.reviver);
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
