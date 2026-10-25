// src/commands/Roblox/endshift.js
import { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, existsSync, unlinkSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../../../data');
const SHIFT_PATH = join(DATA_DIR, 'shift-data.json');

// Aseguramos que la carpeta data exista
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadShift() {
  if (!existsSync(SHIFT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SHIFT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function clearShift() {
  if (existsSync(SHIFT_PATH)) unlinkSync(SHIFT_PATH);
}

export default {
  data: new SlashCommandBuilder()
    .setName('endshift')
    .setDescription('End the current shift 🔴'),

  async execute(interaction) {
    // ✅ Ya no hay validación de ALLOWED_ROLES, cualquiera puede usarlo
    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('EndShift defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const shift = loadShift();
      if (!shift?.active) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '⚠️ There is no active shift to end.',
        });
      }

      // Buscar el canal y el mensaje original
      const channel = await interaction.client.channels.fetch(shift.channelId);
      const msg = await channel.messages.fetch(shift.messageId);

      // Construimos el Container V2 actualizado para el final del turno
      const endedContainer = new ContainerBuilder()
        .setAccentColor(0x2B2D31)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `The sun rises, the moon sets, and our lovely <@${shift.hostId}> open our camp gates for all of you including newcomers! So what are you waiting for! Join us and visit our islands and camp, explore and investigate! Everyone is welcome to this great shift, We're waiting for you... or even explore the secrets of our beloved islands, Join us before it's too late and the camp gates close again! We'll be waiting.\n\n` +
            `🔑 — Everyone is welcome, if no one joins within 10 minutes the shift will be cancelled and the camp will close its doors again and the moon will set again.`
          )
        )
        .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `Looks like you're late, the camp has closed, the lights have gone out, the moon has set again, and our amazing staff has left.\n\n` +
            `Loading link... E-E-ERROR Error code: ???`
          )
        )
        .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`shift status: 🔴`)
        );

      // Editamos el mensaje original
      await msg.edit({ 
        components: [endedContainer],
        flags: MessageFlags.IsComponentsV2 
      });

      // DM al host
      try {
        const host = await interaction.client.users.fetch(shift.hostId);
        const dmContainer = new ContainerBuilder()
          .setAccentColor(0x5865F2)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `Greetings! **Your Adoresa shift has already concluded**, hope you had a wonderful shift! Remember to do your shift log.`
            )
          );

        await host.send({ 
          components: [dmContainer],
          flags: MessageFlags.IsComponentsV2 
        });
      } catch { /* DMs disabled */ }

      clearShift();

      await InteractionHelper.safeEditReply(interaction, { content: '✅ Shift ended successfully!' });

    } catch (error) {
      logger.error('EndShift error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};