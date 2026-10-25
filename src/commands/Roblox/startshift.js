// src/commands/Roblox/startshift.js
import { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../../../data');
const SHIFT_PATH = join(DATA_DIR, 'shift-data.json');

// ✅ Canal actualizado
const SHIFT_CHANNEL_ID = '1546992061847310346'; 
const SHIFT_PING_ROLE = '1513330672754884751';
const GAME_LINK = 'https://www.roblox.com/games/90664126150507/Whispering-Pines-Summer-Camp';

// Aseguramos que la carpeta data exista
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadShift() {
  if (!existsSync(SHIFT_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(SHIFT_PATH, 'utf8'));
    return data || null;
  } catch {
    return null;
  }
}

function saveShift(data) {
  writeFileSync(SHIFT_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('startshift')
    .setDescription('Start a shift 🔑'),

  async execute(interaction) {
    // ✅ Ya no hay validación de ALLOWED_ROLES, cualquiera puede usarlo
    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('StartShift defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const existing = loadShift();
      if (existing?.active) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '⚠️ There is already an active shift!',
        });
      }

      // Construimos el Container V2
      const container = new ContainerBuilder()
        .setAccentColor(0x2B2D31)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `The sun rises, the moon sets, and our lovely <@${interaction.user.id}> open our camp gates for all of you including newcomers! So what are you waiting for! Join us and visit our islands and camp, explore and investigate! Everyone is welcome to this great shift, We're waiting for you... or even explore the secrets of our beloved islands, Join us before it's too late and the camp gates close again! We'll be waiting.\n\n` +
            `🔑 — Everyone is welcome, if no one joins within 10 minutes the shift will be cancelled and the camp will close its doors again and the moon will set again.`
          )
        )
        .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `Now then... what are you waiting for? Don't be late before the camp gates get closed, and our camp staff leave! we invite you:`
          )
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Whispering Pines Summer Camp')
              .setStyle(ButtonStyle.Link)
              .setURL(GAME_LINK)
          )
        )
        .addSeparatorComponents((sep) => sep.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`shift status: 🟢`)
        );

      const channel = await interaction.client.channels.fetch(SHIFT_CHANNEL_ID);
      
      const msg = await channel.send({
        content: `<@&${SHIFT_PING_ROLE}>`,
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });

      saveShift({
        active: true,
        messageId: msg.id,
        channelId: SHIFT_CHANNEL_ID,
        hostId: interaction.user.id,
        startedAt: new Date().toISOString(),
      });

      await InteractionHelper.safeEditReply(interaction, { content: '✅ Shift started successfully!' });

    } catch (error) {
      logger.error('StartShift error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};