import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROUPS_PATH = join(__dirname, '../../../blacklisted-groups.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

const DEFAULT_GROUPS = [
  { id: '9221386', name: 'Unholy sacred sisters' },
  { id: '1097260506', name: 'Démoria' },
  { id: '35008390', name: 'la vélvoria' },
];

function loadGroups() {
  if (!existsSync(GROUPS_PATH)) {
    writeFileSync(GROUPS_PATH, JSON.stringify(DEFAULT_GROUPS, null, 2));
    return DEFAULT_GROUPS;
  }
  return JSON.parse(readFileSync(GROUPS_PATH, 'utf8'));
}

function saveGroups(data) {
  writeFileSync(GROUPS_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('blacklistgroup')
    .setDescription('🚫 Add or remove groups from the blacklist')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a group to the blacklist')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Group ID')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Group name')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a group from the blacklist')
        .addStringOption(opt =>
          opt.setName('id')
            .setDescription('Group ID')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all blacklisted groups')
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
      const subcommand = interaction.options.getSubcommand();
      const groups = loadGroups();

      // ─── ADD ──────────────────────────────────────────────────────────────

      if (subcommand === 'add') {
        const id = interaction.options.getString('id');
        const name = interaction.options.getString('name');

        if (groups.find(g => g.id === id)) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `⚠️ Group **${name}** (${id}) is already blacklisted.`,
          });
        }

        groups.push({ id, name });
        saveGroups(groups);

        const embed = new EmbedBuilder()
          .setColor(0x3F3F3F)
          .setTitle('🚫 Group Blacklisted')
          .setDescription(`**${name}** (ID: \`${id}\`) has been added to the blacklist.`)
          .addFields(
            { name: '📊 Total Groups', value: `\`${groups.length}\``, inline: true }
          )
          .setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        logger.info(`[BlacklistGroup] ${interaction.user.tag} added ${name} (${id})`);
      }

      // ─── REMOVE ───────────────────────────────────────────────────────────

      if (subcommand === 'remove') {
        const id = interaction.options.getString('id');
        const group = groups.find(g => g.id === id);

        if (!group) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `❌ Group with ID \`${id}\` not found in the blacklist.`,
          });
        }

        const updatedGroups = groups.filter(g => g.id !== id);
        saveGroups(updatedGroups);

        const embed = new EmbedBuilder()
          .setColor(0x3F3F3F)
          .setTitle('✅ Group Removed')
          .setDescription(`**${group.name}** (ID: \`${id}\`) has been removed from the blacklist.`)
          .addFields(
            { name: '📊 Total Groups', value: `\`${updatedGroups.length}\``, inline: true }
          )
          .setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        logger.info(`[BlacklistGroup] ${interaction.user.tag} removed ${group.name} (${id})`);
      }

      // ─── LIST ─────────────────────────────────────────────────────────────

      if (subcommand === 'list') {
        if (groups.length === 0) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: '📭 No groups are currently blacklisted.',
          });
        }

        const groupList = groups.map((g, i) =>
          `${i + 1}. **${g.name}** (ID: \`${g.id}\`)`
        ).join('\n');

        const embed = new EmbedBuilder()
          .setColor(0x3F3F3F)
          .setTitle('🚫 Blacklisted Groups')
          .setDescription(`**${groups.length}** groups are currently blacklisted.`)
          .addFields(
            { name: '📋 Groups', value: groupList, inline: false }
          )
          .setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

    } catch (error) {
      logger.error('BlacklistGroup error:', error);
      await InteractionHelper.safeEditReply(interaction, {
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },
};