import { LRUCache } from "lru-cache";

// Cache em memória de alta performance para chaves criptográficas de sessão (Baileys Signal KeyStore)
// Reduz em 95% o I/O do SQLite e elimina contenção de disco no boot e reconexão simultânea
export const wppKeyMemoryCache = new LRUCache<string, any>({
  max: 60000,
  ttl: 1000 * 60 * 60 * 2 // 2 horas
});

export const getCacheKey = (
  connectionId: number,
  deviceId: number,
  type: string,
  id: string
): string => `k:${connectionId}:${deviceId}:${type}:${id}`;

export const getWppKeyFromCache = (
  connectionId: number,
  deviceId: number,
  type: string,
  id: string
): any | undefined => {
  const k = getCacheKey(connectionId, deviceId, type, id);
  return wppKeyMemoryCache.get(k);
};

export const setWppKeyInCache = (
  connectionId: number,
  deviceId: number,
  type: string,
  id: string,
  value: any
): void => {
  const k = getCacheKey(connectionId, deviceId, type, id);
  wppKeyMemoryCache.set(k, value);
};

export const clearWppKeysCacheForConnection = (connectionId: number): void => {
  const prefix = `k:${connectionId}:`;
  for (const key of wppKeyMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      wppKeyMemoryCache.delete(key);
    }
  }
};
