import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHIFT_PATH = join(__dirname, '../../../../shift-data.json');

const GAME_LINK = 'https://www.roblox.com/games/90664126150507/Whispering-Pines-Summer-Camp';

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671338508161094',
];

function loadShift() {
  if (!existsSync(SHIFT_PATH)) return null;
  return JSON.parse(readFileSync(SHIFT_PATH, 'utf8'));
}

function clearShift() {
  if (existsSync(SHIFT_PATH)) unlinkSync(SHIFT_PATH);
}

export default {
  data: new SlashCommandBuilder()
    .setName('endshift')
    .setDescription('End the current shift 🔴'),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

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

      // Editar el embed original
      const channel = await interaction.client.channels.fetch(shift.channelId);
      const msg = await channel.messages.fetch(shift.messageId);

      const endedEmbed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setDescription(
          `The sun rises, the moon sets, and our lovely <@${shift.hostId}> open our camp gates for all of you including newcomers! So what are you waiting for! Join us and visit our islands and camp, explore and investigate! Everyone is welcome to this great shift, We're waiting for you... or even explore the secrets of our beloved islands, Join us before it's too late and the camp gates close again! We'll be waiting.\n\n` +
          `🔑 — Everyone is welcome, if no one joins within 10 minutes the shift will be cancelled and the camp will close its doors again and the moon will set again.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Looks like you're late, the camp has closed, the lights have gone out, the moon has set again, and our amazing staff has left.\n\n` +
          `Loading link... E-E-ERROR Error code: ???\n\n` +
          `shift status: 🔴`
        )
        .setTimestamp();

      await msg.edit({ embeds: [endedEmbed] });

      // DM al host
      try {
        const host = await interaction.client.users.fetch(shift.hostId);
        const dmEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(
            `Greetings! **You Adoresa shift its already concluded**, hope you haved a wonderful shift! Remember to do your shift log.`
          )
          .setTimestamp();
        await host.send({ embeds: [dmEmbed] });
      } catch { /* DMs disabled */ }

      clearShift();

      await InteractionHelper.safeEditReply(interaction, { content: '✅ Shift ended successfully!' });

    } catch (error) {
      logger.error('EndShift error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
