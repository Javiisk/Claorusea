import handleDM from '../handlers/dmhandler.js';
import { logger } from '../utils/logger.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    // Ignorar mensajes del bot
    if (message.author.bot) return;

    // ─── DM LOGGING ──────────────────────────────────────────────────────────
    // Si es un mensaje directo (DM) → enviar al canal de logs
    if (message.channel.type === 1) {
      await handleDM(message);
      return;
    }

    // ─── OTROS EVENTOS (opcional) ──────────────────────────────────────────
    // Aquí puedes poner otros manejadores para mensajes en canales
  },
};
