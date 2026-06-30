import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const GAMEPASS_ID = '1889164521';

const ALLOWED_ROLES = [
  '1505671292873867544',
  '1505671296883757158',
  '1505671309915328713',
  '1505673808097574912',
  '1505673879069393024',
];

async function checkGamepass(userId) {
  try {
    const res = await fetch(`https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${GAMEPASS_ID}`);
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const item = data.data[0];
      return {
        owned: true,
        purchaseDate: item.created ? new Date(item.created).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        }) : 'Unknown',
      };
    }
    return { owned: false, purchaseDate: null };
  } catch {
    return { owned: false, purchaseDate: null };
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('checkpurchase')
    .setDescription('Check if a user owns the gamepass')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Discord user to check')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('CheckPurchase interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'checkpurchase' });
      return;
    }

    try {
      const targetUser = interaction.options.getUser('user');

      // ✅ Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      const { owned, purchaseDate } = await checkGamepass(robloxId);

      if (owned) {
        const embed = createEmbed({ title: '💰 Gamepass Check', description: null })
          .setDescription(`✅ **${robloxUsername}** owns this gamepass!`)
          .addFields(
            { name: 'Roblox ID', value: String(robloxId), inline: true },
            { name: 'Purchase Date', value: purchaseDate, inline: true }
          )
          .setColor(0x57F287)
          .setTimestamp();
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const embed = createEmbed({ title: '💰 Gamepass Check', description: null })
        .setDescription(`❌ **${robloxUsername}** does not own this gamepass.`)
        .addFields(
          { name: 'Roblox ID', value: String(robloxId), inline: true }
        )
        .setColor(0xED4245)
        .setTimestamp();
      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('CheckPurchase command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed to send error reply:', e); }
    }
  },
};
