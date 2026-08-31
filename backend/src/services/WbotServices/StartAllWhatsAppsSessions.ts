import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";

export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  const whatsapps = await ListWhatsAppsService();
  if (whatsapps.length > 0) {
    for (const whatsapp of whatsapps) {
      StartWhatsAppSession(whatsapp);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
};
