/**
 * Extrai o número autenticado de uma sessão WhatsApp, quando disponível.
 * As versões/provedores usados pelo sistema armazenam o JID em estruturas
 * ligeiramente diferentes, por isso mantemos a leitura tolerante aqui.
 */
export const extractWhatsappNumber = (session: unknown): string => {
  if (!session) return "";

  let value: any = session;
  if (typeof session === "string") {
    try {
      value = JSON.parse(session);
    } catch {
      return "";
    }
  }

  const candidates = [
    value?.me?.id,
    value?.creds?.me?.id,
    value?.user?.id,
    value?.account?.id,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const number = String(candidate)
      .split("@")[0]
      .split(":")[0]
      .replace(/\D/g, "");
    if (number) return number;
  }

  return "";
};

export default extractWhatsappNumber;
