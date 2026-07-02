import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../../dm-log-config.json');

const ALLOWED_ROLES = [
  '1505671318262255616',
  '1507261877431042159',
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671292873867544',
];

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: false, channelId: null }));
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(data) {
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('dmlog')
    .setDescription('Configure DM logging')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Set the channel for DM logs')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to send DM logs')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable DM logging')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable or disable')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Show current DM logging status')
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();
    const config = loadConfig();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel');
      config.channelId = channel.id;
      saveConfig(config);
      await interaction.reply({
        content: `✅ DM logs will be sent to <#${channel.id}>`,
        ephemeral: true,
      });
    } else if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      config.enabled = enabled;
      saveConfig(config);
      await interaction.reply({
        content: `✅ DM logging ${enabled ? 'enabled' : 'disabled'}.`,
        ephemeral: true,
      });
    } else if (sub === 'status') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 DM Logging Status')
        .addFields(
          { name: 'Status', value: config.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: 'Log Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not set', inline: true }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
