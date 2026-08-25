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
  { id: '9221386', name: 'Unholy sacred sisters', appealable: false },
  { id: '1097260506', name: 'Démoria', appealable: false },
  { id: '35008390', name: 'la vélvoria', appealable: false },
];

// ─── GEISHA GROUPS (para el embed) ─────────────────────────────────────────

const GEISHA_GROUPS = [
  'Démoria',
  'Unholy sacred sisters',
  'la vélvoria'
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

// ─── GENERATE BLACKLIST EMBED ─────────────────────────────────────────────

function generateBlacklistEmbed() {
  const groups = loadGroups();
  
  // Separar grupos de Geisha y otros
  const geishaGroups = groups.filter(g => GEISHA_GROUPS.includes(g.name));
  const otherGroups = groups.filter(g => !GEISHA_GROUPS.includes(g.name));

  let description = '> **Before you can play and visit our amazing islands, these groups are blacklisted! If you are one of the owners of this group and your blacklist is appealable, open a ticket.**\n\n';

  // Grupos de Geisha
  if (geishaGroups.length > 0) {
    description += geishaGroups.map(g => {
      const appealText = g.appealable ? 'Appealable' : 'Not appealable';
      return `> *${g.name}* - **${appealText}**`;
    }).join('\n');
    description += '\n\n> **All the blacklisted groups mentioned were created by Geisha except Empyreum, which was gifted to Geisha! If geisha sold you one of these you can appeal! Any other community created by a geisha will automatically be blacklisted.**\n';
    description += '-# Other blacklist not owned by geisha.\n\n';
  }

  // Otros grupos
  if (otherGroups.length > 0) {
    description += otherGroups.map(g => {
      const appealText = g.appealable ? 'Appealable' : 'Not appealable';
      return `> *${g.name}* - **${appealText}**`;
    }).join('\n');
  }

  description += '\n\n> -# Leave this communities to be able to freely play our game and its future games, note that we have a professional moderation system if detects you are evading blacklist or evading ban you will be Immediately perm banned from server, reasons of blacklists on tickets.';

  return new EmbedBuilder()
    .setColor(0x808080)
    .setTitle('Adoresa Blacklisted Groups')
    .setDescription(description)
    .setTimestamp();
}

// ─── COMANDO ────────────────────────────────────────────────────────────────

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
        .addStringOption(opt =>
          opt.setName('appealable')
            .setDescription('Is this group appealable?')
            .setRequired(true)
            .addChoices(
              { name: 'Appealable', value: 'true' },
              { name: 'Not Appealable', value: 'false' }
            )
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
        const appealable = interaction.options.getString('appealable') === 'true';

        if (groups.find(g => g.id === id)) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `⚠️ Group **${name}** (${id}) is already blacklisted.`,
          });
        }

        groups.push({ id, name, appealable });
        saveGroups(groups);

        // ─── ACTUALIZAR EMBED ────────────────────────────────────────────────

        const embed = generateBlacklistEmbed();

        try {
          const channel = await interaction.client.channels.fetch('1502421151123509300');
          if (channel) {
            const messages = await channel.messages.fetch({ limit: 50 });
            const blacklistMessage = messages.find(m => 
              m.author.id === interaction.client.user.id && 
              m.embeds.length > 0 && 
              m.embeds[0].title === 'Adoresa Blacklisted Groups'
            );
            
            if (blacklistMessage) {
              await blacklistMessage.edit({ embeds: [embed] });
            } else {
              await channel.send({ embeds: [embed] });
            }
          }
        } catch (error) {
          logger.warn('[BlacklistGroup] Could not update embed:', error.message);
        }

        const appealText = appealable ? 'Appealable' : 'Not appealable';
        await InteractionHelper.safeEditReply(interaction, {
          content: `✅ **${name}** (ID: \`${id}\`) has been added to the blacklist as **${appealText}**. The embed has been updated.`,
        });
        logger.info(`[BlacklistGroup] ${interaction.user.tag} added ${name} (${id}) - ${appealText}`);
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

        // ─── ACTUALIZAR EMBED ────────────────────────────────────────────────

        const embed = generateBlacklistEmbed();

        try {
          const channel = await interaction.client.channels.fetch('1502421151123509300');
          if (channel) {
            const messages = await channel.messages.fetch({ limit: 50 });
            const blacklistMessage = messages.find(m => 
              m.author.id === interaction.client.user.id && 
              m.embeds.length > 0 && 
              m.embeds[0].title === 'Adoresa Blacklisted Groups'
            );
            
            if (blacklistMessage) {
              await blacklistMessage.edit({ embeds: [embed] });
            } else {
              await channel.send({ embeds: [embed] });
            }
          }
        } catch (error) {
          logger.warn('[BlacklistGroup] Could not update embed:', error.message);
        }

        await InteractionHelper.safeEditReply(interaction, {
          content: `✅ **${group.name}** (ID: \`${id}\`) has been removed from the blacklist. The embed has been updated.`,
        });
        logger.info(`[BlacklistGroup] ${interaction.user.tag} removed ${group.name} (${id})`);
      }

      // ─── LIST ─────────────────────────────────────────────────────────────

      if (subcommand === 'list') {
        const embed = generateBlacklistEmbed();
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