import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { getRedisClient, setInRedis } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

interface StoreKeyRequest {
  connectionId: number;
  deviceId: number;
  type: string;
  id: string;
  value: any;
}

const StoreWppSessionKeys = async ({
  connectionId,
  deviceId,
  type,
  id,
  value
}: StoreKeyRequest): Promise<void> => {
  const valueJson = JSON.stringify(value, BufferJSON.replacer);

  const redis = getRedisClient();
  if (redis) {
    const redisKey = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
    await setInRedis(redisKey, valueJson).catch(() => {});
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

export default StoreWppSessionKeys;
