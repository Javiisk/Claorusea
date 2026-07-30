import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OFFERS_PATH = join(__dirname, '../../../offers.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

function loadOffers() {
  if (!existsSync(OFFERS_PATH)) {
    writeFileSync(OFFERS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(OFFERS_PATH, 'utf8'));
}

function saveOffers(offers) {
  writeFileSync(OFFERS_PATH, JSON.stringify(offers, null, 2));
}

function generateOfferId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export default {
  data: new SlashCommandBuilder()
    .setName('offer')
    .setDescription('🎯 Offer a rank to a user (24h expiry)')
    .addUserOption(option =>
      option.setName('discorduser')
        .setDescription('Discord user to offer the rank to')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('rank_name')
        .setDescription('Rank name to offer')
        .setRequired(true)
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission.',
        ephemeral: true,
      });
    }

    await InteractionHelper.safeDefer(interaction, { ephemeral: true });

    try {
      const discordUser = interaction.options.getUser('discorduser');
      const rankName = interaction.options.getString('rank_name');

      const userInfo = await getRobloxUserInfoByDiscord(discordUser.id);
      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${discordUser.tag}** does not have a Roblox account linked.`,
        });
      }

      const offerId = generateOfferId();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      const offers = loadOffers();
      offers[offerId] = {
        robloxId: userInfo.id,
        robloxUsername: userInfo.username,
        discordId: discordUser.id,
        discordTag: discordUser.tag,
        rankName: rankName,
        offeredBy: interaction.user.id,
        offeredByTag: interaction.user.tag,
        expiresAt: expiresAt,
        status: 'pending',
        createdAt: Date.now(),
      };
      saveOffers(offers);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🎯 Rank Offer Created')
        .setDescription(`A rank offer has been created for **${userInfo.username}**!`)
        .addFields(
          { name: '👤 User', value: userInfo.username, inline: true },
          { name: '📊 Rank', value: rankName, inline: true },
          { name: '📋 Offer ID', value: `\`${offerId}\``, inline: true },
          { name: '⏳ Expires', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true },
          { name: '\u200B', value: `**To accept:** \`/accept ${offerId}\`\n**To reject:** \`/reject ${offerId}\``, inline: false }
        )
        .setTimestamp();

      const logChannel = await interaction.client.channels.fetch('1504301603262566440');
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

      await InteractionHelper.safeEditReply(interaction, {
        content: `✅ Offer created!\n📋 ID: \`${offerId}\`\n👤 User: ${userInfo.username}\n📊 Rank: ${rankName}\n⏳ Expires in 24 hours.`,
      });

    } catch (error) {
      logger.error('Offer error:', error);
      await InteractionHelper.safeReply(interaction, {
        content: '❌ An error occurred.',
        ephemeral: true,
      });
    }
  },
};
