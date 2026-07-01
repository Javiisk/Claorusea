import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHIFT_PATH = join(__dirname, '../../../../shift-data.json');

const SHIFT_CHANNEL_ID = '1507135602326372423';
const SHIFT_PING_ROLE = '1513330672754884751';
const GAME_LINK = 'https://www.roblox.com/games/90664126150507/Whispering-Pines-Summer-Camp';

const ALLOWED_ROLES = [
  '1505671309915328713',
  '1505673808097574912',
  '1505673879069393024',
  '1507261877431042159',
  '1505671318262255616',
  '1505671338508161094',
];

function loadShift() {
  if (!existsSync(SHIFT_PATH)) return null;
  const data = JSON.parse(readFileSync(SHIFT_PATH, 'utf8'));
  return data || null;
}

function saveShift(data) {
  writeFileSync(SHIFT_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('startshift')
    .setDescription('Start a shift 🔑'),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

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

      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setDescription(
          `The sun rises, the moon sets, and our lovely <@${interaction.user.id}> open our camp gates for all of you including newcomers! So what are you waiting for! Join us and visit our islands and camp, explore and investigate! Everyone is welcome to this great shift, We're waiting for you... or even explore the secrets of our beloved islands, Join us before it's too late and the camp gates close again! We'll be waiting.\n\n` +
          `🔑 — Everyone is welcome, if no one joins within 10 minutes the shift will be cancelled and the camp will close its doors again and the moon will set again.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Now then... what are you waiting for? Don't be late before the camp gates get closed, and our camp staff leave! we invite you:\n\n` +
          `[Whispering Pines Summer Camp](${GAME_LINK})\n\n` +
          `shift status: 🟢`
        )
        .setTimestamp();

      const channel = await interaction.client.channels.fetch(SHIFT_CHANNEL_ID);
      const msg = await channel.send({
        content: `<@&${SHIFT_PING_ROLE}>`,
        embeds: [embed],
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
