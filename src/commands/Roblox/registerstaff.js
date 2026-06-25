import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAFF_PATH = join(__dirname, '../../../../staff-data.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

function loadStaff() {
  if (!existsSync(STAFF_PATH)) writeFileSync(STAFF_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(STAFF_PATH, 'utf8'));
}

function saveStaff(data) {
  writeFileSync(STAFF_PATH, JSON.stringify(data, null, 2));
}

async function getRobloxUser(username) {
  const res = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });
  const data = await res.json();
  return data.data?.[0] ?? null;
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
        .addStringOption(opt =>
          opt.setName('user').setDescription('Roblox username').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Unregister a staff member.')
        .addStringOption(opt =>
          opt.setName('user').setDescription('Roblox username').setRequired(true)
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
    const username = interaction.options.getString('user');

    try {
      const roblox = await getRobloxUser(username);
      if (!roblox) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Roblox user not found.',
        });
      }

      const staff = loadStaff();
      const key = roblox.name.toLowerCase();

      if (subcommand === 'add') {
        const { rank, role } = await getRobloxRank(roblox.id);

        staff[key] = {
          username: roblox.name,
          robloxId: roblox.id,
          rank,
          role,
          registeredBy: interaction.user.id,
          registeredAt: new Date().toISOString(),
        };
        saveStaff(staff);

        const embed = createEmbed({ title: '✅ Staff Registered', description: null })
          .setDescription(`**${roblox.name}** has been registered as staff.`)
          .setColor(0x57f287)
          .addFields(
            { name: '👤 Username', value: roblox.name, inline: true },
            { name: '🎖️ Rank', value: `${role} (${rank})`, inline: true },
            { name: '📋 Registered by', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setTimestamp();

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      if (subcommand === 'remove') {
        if (!staff[key]) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `❌ **${roblox.name}** is not registered as staff.`,
          });
        }

        delete staff[key];
        saveStaff(staff);

        const embed = createEmbed({ title: '🗑️ Staff Unregistered', description: null })
          .setDescription(`**${roblox.name}** has been removed from the staff list.`)
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
