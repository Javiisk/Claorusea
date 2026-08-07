import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPARTMENTS_PATH = join(__dirname, '../../../departments.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

const LOG_CHANNEL_ID = '1535401497360343130';
const OUTREACH_ROLE_ID = '1531770096777691256';
const STAFFING_ROLE_ID = '1531769734322852011';

function loadDepartments() {
  if (!existsSync(DEPARTMENTS_PATH)) {
    writeFileSync(DEPARTMENTS_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(DEPARTMENTS_PATH, 'utf8'));
}

function saveDepartments(data) {
  writeFileSync(DEPARTMENTS_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('department')
    .setDescription('📋 Choose or view your department')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('choose')
        .setDescription('Choose your department (Staffing or Outreach)')
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View your current department')
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all members by department (Staff only)')
    )
    .addSubcommand(sub =>
      sub
        .setName('reset')
        .setDescription('Reset your department choice (Staff only)')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to reset')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'choose') {
      await handleChoose(interaction);
    } else if (subcommand === 'view') {
      await handleView(interaction);
    } else if (subcommand === 'list') {
      await handleList(interaction);
    } else if (subcommand === 'reset') {
      await handleReset(interaction);
    }
  },
};

// ─── CHOOSE ────────────────────────────────────────────────────────────────

async function handleChoose(interaction) {
  const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
  if (!hasRole) {
    return await interaction.reply({
      content: '❌ You don\'t have permission to choose a department.',
      ephemeral: true,
    });
  }

  await InteractionHelper.safeDefer(interaction, { ephemeral: true });

  try {
    const departments = loadDepartments();
    const userId = interaction.user.id;

    if (departments[userId]) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: `⚠️ You are already in the **${departments[userId]}** department. Use \`/department reset\` to change.`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3F3F3F)
      .setTitle('📋 Department Choice')
      .setDescription(
        'Greetings! Before your official HR journey begins, you are required to select a department.\n\n' +
        'Each department handles different materials. However, in case assistance is required in the other department, ' +
        'another department member may assist even if it is outside of their department.'
      )
      .addFields(
        {
          name: '👥 Staffing',
          value:
            'The Staffing department handles anything related to **staffing**. ' +
            'Their role is to handle the weekly **staff reforms**, including promotions, demotions and staff of the week. ' +
            'This department also handles **tickets of any kind and server/in-game moderation**. ' +
            'This department also handles selecting new members for the MR and HR team. ' +
            'This department is the primal training hoster department, however a staffing department member may host one if no Supervision department member is available.',
          inline: false,
        },
        {
          name: '🎪 Outreach',
          value:
            'The Outreach department main role is to handle staff and non-staff events, to ensure the community is alive. ' +
            'They are responsible for **handling events, daily activities, and chat revives**. ' +
            'This department has the final say over **Discord moderation**, as they do not handle reforms, you will handle **in-game promotions and supervision**. ' +
            'This department handles welcoming new members, wherever that would be LR, MR or HR to ensure everyone feels welcomed.',
          inline: false,
        }
      )
      .setFooter({ text: 'Choose your department wisely. You can only change with staff approval.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`department_select:${userId}`)
        .setPlaceholder('Select your department...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('👥 Staffing')
            .setDescription('Staff reforms, tickets, moderation')
            .setValue('Staffing')
            .setEmoji('👥'),
          new StringSelectMenuOptionBuilder()
            .setLabel('🎪 Outreach')
            .setDescription('Events, activities, community engagement')
            .setValue('Outreach')
            .setEmoji('🎪')
        )
    );

    await InteractionHelper.safeEditReply(interaction, {
      embeds: [embed],
      components: [row],
    });

    const filter = (i) => i.customId === `department_select:${userId}` && i.user.id === userId;
    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 60000,
      max: 1,
    });

    collector.on('collect', async (selectInteraction) => {
      const selected = selectInteraction.values[0];

      departments[userId] = selected;
      saveDepartments(departments);

      const roleId = selected === 'Staffing' ? STAFFING_ROLE_ID : OUTREACH_ROLE_ID;
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        await interaction.member.roles.add(role);
      }

      const confirmEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Department Selected')
        .setDescription(`You have been assigned to the **${selected}** department!`)
        .setTimestamp();

      await selectInteraction.update({
        embeds: [confirmEmbed],
        components: [],
      });

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send({
          content: `📋 **${interaction.user.tag}** has joined the **${selected}** department.`,
        });
      }

      logger.info(`[Department] ${interaction.user.tag} joined ${selected}`);
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({
          content: '⏳ Selection timed out. Please try again.',
          components: [],
        });
      }
    });

  } catch (error) {
    logger.error('Department choose error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: `❌ An error occurred: ${error.message}`,
    });
  }
}

// ─── VIEW ──────────────────────────────────────────────────────────────────

async function handleView(interaction) {
  await InteractionHelper.safeDefer(interaction, { ephemeral: true });

  try {
    const departments = loadDepartments();
    const userId = interaction.user.id;
    const department = departments[userId];

    if (!department) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: '❌ You have not selected a department yet. Use `/department choose` to select one.',
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3F3F3F)
      .setTitle('📋 Your Department')
      .setDescription(`You are currently in the **${department}** department.`)
      .setTimestamp();

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

  } catch (error) {
    logger.error('Department view error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: `❌ An error occurred: ${error.message}`,
    });
  }
}

// ─── LIST ──────────────────────────────────────────────────────────────────

async function handleList(interaction) {
  const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
  if (!hasRole) {
    return await interaction.reply({
      content: '❌ You don\'t have permission to view the department list.',
      ephemeral: true,
    });
  }

  await InteractionHelper.safeDefer(interaction, { ephemeral: true });

  try {
    const departments = loadDepartments();
    const staffing = [];
    const outreach = [];

    for (const [userId, dept] of Object.entries(departments)) {
      try {
        const user = await interaction.client.users.fetch(userId);
        if (dept === 'Staffing') {
          staffing.push(user.tag);
        } else {
          outreach.push(user.tag);
        }
      } catch {
        // Usuario no encontrado
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x3F3F3F)
      .setTitle('📋 Department Members')
      .addFields(
        {
          name: `👥 Staffing (${staffing.length})`,
          value: staffing.length > 0 ? staffing.join('\n') : 'No members',
          inline: true,
        },
        {
          name: `🎪 Outreach (${outreach.length})`,
          value: outreach.length > 0 ? outreach.join('\n') : 'No members',
          inline: true,
        }
      )
      .setTimestamp();

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

  } catch (error) {
    logger.error('Department list error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: `❌ An error occurred: ${error.message}`,
    });
  }
}

// ─── RESET ─────────────────────────────────────────────────────────────────

async function handleReset(interaction) {
  const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
  if (!hasRole) {
    return await interaction.reply({
      content: '❌ You don\'t have permission to reset departments.',
      ephemeral: true,
    });
  }

  await InteractionHelper.safeDefer(interaction, { ephemeral: true });

  try {
    const targetUser = interaction.options.getUser('user');
    const departments = loadDepartments();
    const userId = targetUser.id;

    if (!departments[userId]) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: `❌ **${targetUser.tag}** does not have a department selected.`,
      });
    }

    const oldDept = departments[userId];
    delete departments[userId];
    saveDepartments(departments);

    const roleId = oldDept === 'Staffing' ? STAFFING_ROLE_ID : OUTREACH_ROLE_ID;
    const role = interaction.guild.roles.cache.get(roleId);
    if (role) {
      const member = await interaction.guild.members.fetch(userId);
      if (member) {
        await member.roles.remove(role);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔄 Department Reset')
      .setDescription(`**${targetUser.tag}** has been removed from the **${oldDept}** department.`)
      .setTimestamp();

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    logger.info(`[Department] ${interaction.user.tag} reset ${targetUser.tag} from ${oldDept}`);

  } catch (error) {
    logger.error('Department reset error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: `❌ An error occurred: ${error.message}`,
    });
  }
}