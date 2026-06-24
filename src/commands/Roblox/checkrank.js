import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const GROUP_ID = process.env.ROBLOX_GROUP_ID;

async function getRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data?.[0] || null;
}

async function getCurrentRank(userId) {
  try {
    const res = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    const data = await res.json();
    const group = data.data?.find(g => String(g.group.id) === String(GROUP_ID));
    return group ? group.role : null;
  } catch {
    return null;
  }
}

async function getRobloxAvatar(userId) {
  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    const data = await res.json();
    return data.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('checkrank')
    .setDescription('Check a user\'s current rank in the group 🏅')
    .addStringOption(opt =>
      opt.setName('robloxuser').setDescription('Roblox username').setRequired(true)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('CheckRank defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const username = interaction.options.getString('robloxuser');
      const roblox = await getRobloxUser(username);
      if (!roblox) return await InteractionHelper.safeEditReply(interaction, { content: '❌ Roblox user not found.' });

      const [currentRole, avatar] = await Promise.all([
        getCurrentRank(roblox.id),
        getRobloxAvatar(roblox.id),
      ]);

      const embed = new EmbedBuilder()
        .setTitle('🏅 Rank Check')
        .setColor(0x5865F2)
        .setThumbnail(avatar)
        .addFields(
          { name: 'Username', value: roblox.name, inline: false },
          { name: 'Roblox ID', value: String(roblox.id), inline: false },
          { name: 'Current Rank', value: currentRole ? currentRole.name : 'Not in the group', inline: false },
        )
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    } catch (error) {
      logger.error('CheckRank error:', error);
      try { await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed:', e); }
    }
  },
};
