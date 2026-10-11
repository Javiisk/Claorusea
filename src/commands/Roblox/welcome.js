// src/commands/Roblox/welcome.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { getRobloxGroupRank, getRobloxUsernameByDiscord } from '../../utils/bloxlink.js';

const PING_ROLE_ID = '1546995398907002982';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Send a welcome message to a newly ranked user')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to welcome')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('rank')
        .setDescription('The rank they received (e.g. Devoted)')
        .setRequired(true)
        .setMaxLength(50))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('user');
    const rank = interaction.options.getString('rank');

    // Obtener nickname del ejecutor en este servidor
    const executorMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const executorName = executorMember?.displayName || interaction.user.username;

    // Obtener el rango del ejecutor en el grupo de Roblox
    let executorRank = 'Staff';
    try {
      const robloxData = await getRobloxUsernameByDiscord(interaction.user.id);
      if (robloxData) {
        // Obtener el robloxID del ejecutor
        const { getRobloxUserByDiscord } = await import('../../utils/bloxlink.js');
        const bloxlinkData = await getRobloxUserByDiscord(interaction.user.id);
        if (bloxlinkData?.robloxID) {
          const groupRank = await getRobloxGroupRank(bloxlinkData.robloxID);
          if (groupRank && groupRank !== 'Error fetching rank' && groupRank !== 'Not in the group') {
            executorRank = groupRank;
          }
        }
      }
    } catch (err) {
      // keep default
    }

    const message =
      `<@${target.id}>,\n\n` +
      `If you received this message, it's because you've been ranked to **${rank}** on **Adoresa!** ` +
      `Welcome to your new role, so feel free to update your **ranks** on ` +
      `https://discord.com/channels/1546983561306050580/1546995558957457408.\n\n` +
      `**Remember to follow the rules and enjoy your new lamp and in-game advantages.**\n\n` +
      `-# Signed by, ${executorName}! ${executorRank}`;

    // Publicar el mensaje con ping al rol en el canal
    await interaction.channel.send({
      content: message,
      allowedMentions: {
        users: [target.id],
        roles: [PING_ROLE_ID],
      },
    });

    await interaction.editReply({
      content: `✅ Welcome message sent for <@${target.id}> (${rank}).`,
    });
  },
};