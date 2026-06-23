import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const GAMEPASS_ID = '1889164521';

async function getRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data?.[0] || null;
}

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
    .setDescription('Check if a user owns the gamepass 🎮')
    .addStringOption(opt =>
      opt.setName('user').setDescription('Roblox username').setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('CheckPurchase interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'checkpurchase',
      });
      return;
    }

    try {
      const username = interaction.options.getString('user');
      const roblox = await getRobloxUser(username);

      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Roblox user not found.',
        });
      }

      const { owned, purchaseDate } = await checkGamepass(roblox.id);

      if (owned) {
        const embed = createEmbed({ title: '🎮 Gamepass Check', description: null })
          .setDescription(`✅ **${roblox.name}** has this gamepass!`)
          .addFields(
            { name: 'Purchase Date', value: purchaseDate, inline: false },
          )
          .setColor(0x57F287)
          .setTimestamp();

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const embed = createEmbed({ title: '🎮 Gamepass Check', description: null })
        .setDescription(`❌ **${roblox.name}** doesn't have this gamepass.`)
        .setColor(0xED4245)
        .setTimestamp();

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('CheckPurchase command error:', error);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred while checking the gamepass.',
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
