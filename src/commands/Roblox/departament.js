import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPARTMENTS_PATH = join(__dirname, '../../../departments.json');

const LOG_CHANNEL_ID = '1547416959019253882';
const OUTREACH_ROLE_ID = '1547007643640406027';
const STAFFING_ROLE_ID = '1547007539940556880';

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
  await InteractionHelper.safeDefer(interaction, { ephemeral: true });

  try {
    const departments = loadDepartments();
    const userId = interaction.user.id;

    if (departments[userId]) {
      return await InteractionHelper.safeEditReply(interaction, {
        content: `⚠️ You are already in the **${departments[userId]}** department. Use \`/department reset\` to change.`,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`department_select:${userId}`)
        .setPlaceholder('Select your department...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Staffing')
            .setDescription('Staff reforms, tickets, moderation')
            .setValue('Staffing')
            .setEmoji('👥'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Outreach')
            .setDescription('Events, activities, community engagement')
            .setValue('Outreach')
            .setEmoji('🎪')
        )
    );

    await InteractionHelper.safeEditReply(interaction, {
      content: '📋 Select your department:',
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

      await selectInteraction.update({
        content: `✅ You have joined the department of **${selected}** successfully`,
        components: [],
      });

      // ─── LOG CONTAINER (Components V2) ────────────────────────────────

      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### 📋 Department Joined'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `<@${interaction.user.id}> has joined the **${selected}** department.`,
            ),
          );

        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
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

    await InteractionHelper.safeEditReply(interaction, {
      content: `📋 You are currently in the **${department}** department.`,
    });

  } catch (error) {
    logger.error('Department view error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: `❌ An error occurred: ${error.message}`,
    });
  }
}

// ─── LIST ──────────────────────────────────────────────────────────────────

async function handleList(interaction) {
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

    const content = [
      `📋 **Department Members**`,
      '',
      `**Staffing (${staffing.length})**`,
      staffing.length > 0 ? staffing.join('\n') : 'No members',
      '',
      `**Outreach (${outreach.length})**`,
      outreach.length > 0 ? outreach.join('\n') : 'No members',
    ].join('\n');

    await InteractionHelper.safeEditReply(interaction, { content });

  } catch (error) {
    logger.error('Department list error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: `❌ An error occurred: ${error.message}`,
    });
  }
}

// ─── RESET ─────────────────────────────────────────────────────────────────

async function handleReset(interaction) {
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

    await InteractionHelper.safeEditReply(interaction, {
      content: `🔄 **${targetUser.tag}** has been removed from the **${oldDept}** department.`,
    });

    logger.info(`[Department] ${interaction.user.tag} reset ${targetUser.tag} from ${oldDept}`);

  } catch (error) {
    logger.error('Department reset error:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: `❌ An error occurred: ${error.message}`,
    });
  }
}
