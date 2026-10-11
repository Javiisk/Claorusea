import {
  SlashCommandBuilder,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';

const LOG_CHANNEL_ID = '1547414356210225203';

// ─── PARSERS ────────────────────────────────────────────────────────────

function parseDate(dateStr) {
  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseTime(timeStr) {
  const match = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// Returns the offset from UTC in minutes (e.g. "UTC-6" -> -360), or null if invalid.
function parseTimezoneOffset(tzStr) {
  const cleaned = tzStr.trim().toUpperCase();

  if (cleaned === 'UTC' || cleaned === 'GMT') return 0;

  const match = cleaned.match(/^(?:UTC|GMT)\s*([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;

  return sign * (hours * 60 + minutes);
}

export default {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Creates a Discord scheduled event')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('title')
        .setDescription('Event title')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('description')
        .setDescription('Event description')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Event date (MM/DD/YYYY)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('time')
        .setDescription('Event start time, e.g. "6:00 PM" or "18:00"')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('timezone')
        .setDescription('Your timezone, e.g. "UTC-6", "GMT+2", "UTC"')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('location')
        .setDescription('Where the event takes place')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('duration_hours')
        .setDescription('How many hours the event lasts (default: 2)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(24)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const dateInput = interaction.options.getString('date');
    const timeInput = interaction.options.getString('time');
    const tzInput = interaction.options.getString('timezone');
    const location = interaction.options.getString('location');
    const durationHours = interaction.options.getInteger('duration_hours') ?? 2;

    const date = parseDate(dateInput);
    const time = parseTime(timeInput);
    const offsetMinutes = parseTimezoneOffset(tzInput);

    if (!date) {
      return interaction.editReply({ content: '❌ Invalid date. Please use MM/DD/YYYY (e.g. 09/05/2026).' });
    }
    if (!time) {
      return interaction.editReply({ content: '❌ Invalid time. Try something like "6:00 PM" or "18:00".' });
    }
    if (offsetMinutes === null) {
      return interaction.editReply({ content: '❌ Invalid timezone. Try something like "UTC-6", "GMT+2", or "UTC".' });
    }

    // Treat the given local date/time as if it were UTC, then subtract the
    // offset to get the real UTC instant. (local UTC-6 -> actual UTC = local + 6h)
    const localAsUtcMs = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
    const scheduledStartTime = new Date(localAsUtcMs - offsetMinutes * 60000);
    const scheduledEndTime = new Date(scheduledStartTime.getTime() + durationHours * 3600000);

    if (scheduledStartTime.getTime() < Date.now()) {
      return interaction.editReply({ content: '❌ That date/time is in the past.' });
    }

    try {
      const event = await interaction.guild.scheduledEvents.create({
        name: title,
        description,
        scheduledStartTime,
        scheduledEndTime,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        entityMetadata: { location },
      });

      await interaction.editReply({ content: '✔️ Event has been created, feel free to check out.' });

      // ─── LOG (Components V2) ───────────────────────────────────────────
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const startUnix = Math.floor(scheduledStartTime.getTime() / 1000);
        const endUnix = Math.floor(scheduledEndTime.getTime() / 1000);

        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### 📅 Event Created'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `**Title**\n${title}`,
                '',
                `**Description**\n${description}`,
                '',
                `**Location**\n${location}`,
                '',
                `**Starts**\n<t:${startUnix}:F>`,
                '',
                `**Ends**\n<t:${endUnix}:F>`,
                '',
                `**Created by**\n<@${interaction.user.id}>`,
                '',
                `**Link**\nhttps://discord.com/events/${interaction.guild.id}/${event.id}`,
              ].join('\n'),
            ),
          );

        await logChannel.send({ components: [logContainer], flags: MessageFlags.IsComponentsV2 });
      }

    } catch (error) {
      console.error('❌ /event error:', error);
      await interaction.editReply({ content: `❌ Failed to create the event: ${error.message}` });
    }
  },
};
