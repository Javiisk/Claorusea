// src/commands/Roblox/welcome.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { getRobloxGroupRank, getRobloxUserByDiscord } from '../../utils/bloxlink.js';

const TARGET_CHANNEL_ID = '1546995398907002982';
const RANK_NAME = 'Devoted';
const RANKS_CHANNEL_URL = 'https://discord.com/channels/1546983561306050580/1546995558957457408';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Send a welcome embed to a newly ranked user')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to welcome')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user');

    // Nickname del ejecutor en este servidor
    const executorMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const executorName = executorMember?.displayName || interaction.user.username;

    // Rango del ejecutor en el grupo de Roblox
    let executorRank = 'Staff';
    try {
      const bloxlinkData = await getRobloxUserByDiscord(interaction.user.id);
      if (bloxlinkData?.robloxID) {
        const groupRank = await getRobloxGroupRank(bloxlinkData.robloxID);
        if (groupRank && groupRank !== 'Error fetching rank' && groupRank !== 'Not in the group') {
          executorRank = groupRank;
        }
      }
    } catch {
      // keep default
    }

    const description =
      `<@${target.id}>,\n\n` +
      `If you received this message, it's because you've been ranked to **${RANK_NAME}** on **Adoresa!** ` +
      `Welcome to your new role, so feel free to update your **ranks** on ${RANKS_CHANNEL_URL}.\n\n` +
      `**Remember to follow the rules and enjoy your new lamp and in-game advantages.**\n\n` +
      `-# Signed by, ${executorName}! ${executorRank}`;

    const embed = new EmbedBuilder()
      .setColor(0x808080) // gris
      .setDescription(description);

    // Enviar al canal específico
    const channel = await interaction.client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
    if (!channel) {
      return interaction.editReply({
        content: `❌ No pude encontrar el canal <#${TARGET_CHANNEL_ID}>.`,
      });
    }

    await channel.send({
      embeds: [embed],
      allowedMentions: { users: [target.id] },
    });

    await interaction.editReply({
      content: `✅ Welcome embed enviado para <@${target.id}>.`,
    });
  },
};