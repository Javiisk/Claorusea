import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRobloxUserInfoByDiscord } from './bloxlink.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAFF_PATH = join(__dirname, '../../../../staff-data.json');

const ALLOWED_ROLES = [
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671296883757158',
  '1505671292873867544',
];

function loadStaff() {
  if (!existsSync(STAFF_PATH)) writeFileSync(STAFF_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(STAFF_PATH, 'utf8'));
}

function saveStaff(data) {
  writeFileSync(STAFF_PATH, JSON.stringify(data, null, 2));
}

async function getRobloxRank(userId) {
  const res = await fetch(
    `https://groups.roblox.com/v1/users/${userId}/groups/roles`
  );
  if (!res.ok) return { rank: 0, role: 'Unknown' };
  const data = await res.json();
  const group = data.data?.find(g => g.group.id === 376034335);
  if (!group) return { rank: 0, role: 'Guest' };
  return { rank: group.role.rank, role: group.role.name };
}

export default {
  data: new SlashCommandBuilder()
    .setName('registerstaff')
    .setDescription('Register or unregister a staff member. (Staff only)')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Register a staff member.')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Discord user to register as staff')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Unregister a staff member.')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Discord user to unregister')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Registerstaff interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'registerstaff',
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');

    try {
      // ✅ Obtener Roblox info desde Bloxlink
      const userInfo = await getRobloxUserInfoByDiscord(targetUser.id);

      if (!userInfo) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ **${targetUser.tag}** does not have a Roblox account linked in this server.`,
        });
      }

      const robloxId = userInfo.id;
      const robloxUsername = userInfo.username;

      const staff = loadStaff();
      const key = robloxUsername.toLowerCase();

      if (subcommand === 'add') {
        const { rank, role } = await getRobloxRank(robloxId);

        staff[key] = {
          username: robloxUsername,
          robloxId: robloxId,
          discordId: targetUser.id,
          discordTag: targetUser.tag,
          rank,
          role,
          registeredBy: interaction.user.id,
          registeredAt: new Date().toISOString(),
        };
        saveStaff(staff);

        const embed = createEmbed({ title: '✅ Staff Registered', description: null })
          .setDescription(`**${robloxUsername}** has been registered as staff.`)
          .setColor(0x57f287)
          .addFields(
            { name: '👤 Roblox Username', value: robloxUsername, inline: true },
            { name: '🆔 Roblox ID', value: String(robloxId), inline: true },
            { name: '🎖️ Rank', value: `${role} (${rank})`, inline: true },
            { name: '📋 Discord User', value: `${targetUser}`, inline: true },
            { name: '📋 Registered by', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      if (subcommand === 'remove') {
        if (!staff[key]) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `❌ **${robloxUsername}** is not registered as staff.`,
          });
        }

        delete staff[key];
        saveStaff(staff);

        const embed = createEmbed({ title: '🗑️ Staff Unregistered', description: null })
          .setDescription(`**${robloxUsername}** has been removed from the staff list.`)
          .setColor(0xed4245)
          .setTimestamp();

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }
    } catch (error) {
      logger.error('Registerstaff command error:', error.message, error.stack);
      try {
        return await InteractionHelper.safeReply(interaction, {
          content: '❌ An error occurred.',
        });
      } catch (e) {
        logger.error('Failed to send error reply:', e);
      }
    }
  },
};
