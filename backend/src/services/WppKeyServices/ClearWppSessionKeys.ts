import WppKey from "../../models/WppKey";
import { getRedisClient } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

const ClearWppSessionKeys = async (connectionId: number): Promise<void> => {
  const redis = getRedisClient();
  if (redis) {
    try {
      const match = `wpp:${connectionId}:*`;

      const scanAndDelete = async (cursor: string): Promise<void> => {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          match,
          "COUNT",
          100
        );

        if (keys.length > 0) {
          await redis.del(keys);
        }

        if (nextCursor !== "0") {
          await scanAndDelete(nextCursor);
        }
      };

      await scanAndDelete("0");
      logger.info({ info: "Cleared Redis session keys", connectionId });
    } catch (err) {
      logger.error({ info: "Error clearing Redis keys", connectionId, err });
    }
  }

  try {
    const deletedCount = await WppKey.destroy({
      where: { connectionId }
    });
    logger.info({
      info: "Cleared database session keys (WppKey)",
      connectionId,
      deletedCount
    });
  } catch (err) {
    logger.error({
      info: "Error deleting session keys from database",
      connectionId,
      err
    });
  }
};

export default ClearWppSessionKeys;
