import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROUPS_PATH = join(__dirname, '../../../../blacklisted-groups.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

function loadGroups() {
  if (!existsSync(GROUPS_PATH)) writeFileSync(GROUPS_PATH, JSON.stringify([]));
  return JSON.parse(readFileSync(GROUPS_PATH, 'utf8'));
}

function saveGroups(groups) {
  writeFileSync(GROUPS_PATH, JSON.stringify(groups, null, 2));
}

async function getRobloxGroupInfo(groupId) {
  try {
    const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);
    const data = await res.json();
    return data?.name ? data : null;
  } catch { return null; }
}

export default {
  data: new SlashCommandBuilder()
    .setName('blacklistgroup')
    .setDescription('Add or remove a Roblox group from the blacklist 🚫')
    .addStringOption(opt =>
      opt.setName('groupid').setDescription('Roblox group ID').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('action').setDescription('Add or remove').setRequired(true)
        .addChoices(
          { name: '🚫 Blacklist', value: 'add' },
          { name: '✅ Remove', value: 'remove' },
        )
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('BlacklistGroup interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'blacklistgroup' });
      return;
    }

    try {
      const groupId = interaction.options.getString('groupid');
      const action = interaction.options.getString('action');
      const groupInfo = await getRobloxGroupInfo(groupId);
      if (!groupInfo) return await InteractionHelper.safeEditReply(interaction, { content: '❌ Group not found on Roblox.' });

      const groups = loadGroups();
      const exists = groups.find(g => g.id === groupId);

      if (action === 'add') {
        if (exists) return await InteractionHelper.safeEditReply(interaction, { content: `⚠️ **${groupInfo.name}** is already blacklisted.` });
        groups.push({ id: groupId, name: groupInfo.name });
        saveGroups(groups);
        const embed = createEmbed({ title: '🚫 Group Blacklisted', description: null })
          .setDescription(`**${groupInfo.name}** (\`${groupId}\`) has been added to the blacklist.`)
          .setColor(0xED4245).setTimestamp();
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      if (action === 'remove') {
        if (!exists) return await InteractionHelper.safeEditReply(interaction, { content: `⚠️ **${groupInfo.name}** is not blacklisted.` });
        saveGroups(groups.filter(g => g.id !== groupId));
        const embed = createEmbed({ title: '✅ Group Removed', description: null })
          .setDescription(`**${groupInfo.name}** (\`${groupId}\`) has been removed from the blacklist.`)
          .setColor(0x57F287).setTimestamp();
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }
    } catch (error) {
      logger.error('BlacklistGroup command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed to send error reply:', e); }
    }
  },
};
