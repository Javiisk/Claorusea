import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEDULE_PATH = join(__dirname, '../../../../schedule.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

const EVENT_CHANNEL_ID = '1519523704034431159';

function loadSchedule() {
  if (!existsSync(SCHEDULE_PATH)) writeFileSync(SCHEDULE_PATH, JSON.stringify([]));
  return JSON.parse(readFileSync(SCHEDULE_PATH, 'utf8'));
}

function saveSchedule(data) {
  writeFileSync(SCHEDULE_PATH, JSON.stringify(data, null, 2));
}

export default {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Manage and view upcoming events.')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub.setName('view').setDescription('View all upcoming events.')
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a new event. (Staff only)')
        .addStringOption(opt =>
          opt.setName('title').setDescription('Event title').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('description').setDescription('Event description').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('date').setDescription('Date and time (e.g. June 28 at 3PM EST)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove an event by ID. (Staff only)')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Event ID to remove').setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // View is public
    if (subcommand === 'view') {
      const deferSuccess = await InteractionHelper.safeDefer(interaction);
      if (!deferSuccess) return;

      const events = loadSchedule().filter(e => e.active !== false);

      if (events.length === 0) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '📭 There are no upcoming events scheduled.',
        });
      }

      const embed = createEmbed({ title: '📅 Upcoming Events', description: null })
        .setColor(0x5865f2)
        .setTimestamp();

      for (const event of events.slice(0, 10)) {
        embed.addFields({
          name: `#${event.id} — ${event.title}`,
          value: `📝 ${event.description}\n🕐 **${event.date}**\n👤 Posted by <@${event.createdBy}>`,
          inline: false,
        });
      }

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    // Add and remove require staff role
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({
        content: '❌ You don\'t have permission to use this command.',
        ephemeral: true,
      });
    }

    if (subcommand === 'add') {
      const deferSuccess = await InteractionHelper.safeDefer(interaction);
      if (!deferSuccess) return;

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const date = interaction.options.getString('date');

      const events = loadSchedule();
      const newId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;

      const newEvent = {
        id: newId,
        title,
        description,
        date,
        createdBy: interaction.user.id,
        createdAt: new Date().toISOString(),
        active: true,
      };

      events.push(newEvent);
      saveSchedule(events);

      // Post to event channel
      try {
        const channel = await interaction.client.channels.fetch(EVENT_CHANNEL_ID);
        if (channel) {
          const announceEmbed = createEmbed({ title: '📅 New Event Scheduled!', description: null })
            .setColor(0x57f287)
            .addFields(
              { name: '🎉 Event', value: title, inline: false },
              { name: '📝 Description', value: description, inline: false },
              { name: '🕐 Date & Time', value: date, inline: false },
              { name: '👤 Posted by', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setTimestamp();
          await channel.send({ embeds: [announceEmbed] });
        }
      } catch (e) {
        logger.warn('Could not post to event channel:', e.message);
      }

      const embed = createEmbed({ title: '✅ Event Added', description: null })
        .setDescription(`**${title}** has been added to the schedule (ID: #${newId}) and posted to the events channel.`)
        .setColor(0x57f287)
        .setTimestamp();

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    if (subcommand === 'remove') {
      const deferSuccess = await InteractionHelper.safeDefer(interaction);
      if (!deferSuccess) return;

      const id = interaction.options.getInteger('id');
      const events = loadSchedule();
      const index = events.findIndex(e => e.id === id);

      if (index === -1) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: `❌ No event found with ID #${id}.`,
        });
      }

      const removed = events.splice(index, 1)[0];
      saveSchedule(events);

      const embed = createEmbed({ title: '🗑️ Event Removed', description: null })
        .setDescription(`Event **#${id} — ${removed.title}** has been removed from the schedule.`)
        .setColor(0xed4245)
        .setTimestamp();

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }
  },
};
