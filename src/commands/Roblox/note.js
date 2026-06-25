import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NOTES_PATH = join(__dirname, '../../../../notes-data.json');

const ALLOWED_ROLES = [
  '1505671307335958728',
  '1505671314210553877',
  '1505671325144973323',
  '1505673879069393024',
  '1505673808097574912',
];

function loadNotes() {
  if (!existsSync(NOTES_PATH)) writeFileSync(NOTES_PATH, JSON.stringify({}));
  return JSON.parse(readFileSync(NOTES_PATH, 'utf8'));
}

function saveNotes(data) {
  writeFileSync(NOTES_PATH, JSON.stringify(data, null, 2));
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

export default {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Manage private staff notes on a user. (Staff only)')
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a note to a user.')
        .addStringOption(opt =>
          opt.setName('user').setDescription('Roblox username').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('note').setDescription('Note content').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View all notes on a user.')
        .addStringOption(opt =>
          opt.setName('user').setDescription('Roblox username').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a note from a user by ID.')
        .addStringOption(opt =>
          opt.setName('user').setDescription('Roblox username').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Note ID to remove').setRequired(true)
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

    const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
    if (!deferSuccess) {
      logger.warn('Note interaction defer failed', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        commandName: 'note',
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

      const notes = loadNotes();
      const key = roblox.name.toLowerCase();
      if (!notes[key]) notes[key] = { username: roblox.name, notes: [] };

      if (subcommand === 'add') {
        const noteText = interaction.options.getString('note');
        const newId = notes[key].notes.length > 0
          ? Math.max(...notes[key].notes.map(n => n.id)) + 1
          : 1;

        notes[key].notes.push({
          id: newId,
          text: noteText,
          addedBy: interaction.user.id,
          addedAt: new Date().toISOString(),
        });

        saveNotes(notes);

        const embed = createEmbed({ title: '📝 Note Added', description: null })
          .setDescription(`Note **#${newId}** added to **${roblox.name}**.`)
          .setColor(0x57f287)
          .addFields({ name: 'Note', value: noteText, inline: false })
          .setTimestamp();

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      if (subcommand === 'view') {
        const userNotes = notes[key]?.notes ?? [];

        if (userNotes.length === 0) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `📭 No notes found for **${roblox.name}**.`,
          });
        }

        const embed = createEmbed({ title: `📋 Notes — ${roblox.name}`, description: null })
          .setColor(0x5865f2)
          .setTimestamp();

        for (const note of userNotes.slice(0, 25)) {
          const ts = Math.floor(new Date(note.addedAt).getTime() / 1000);
          embed.addFields({
            name: `#${note.id} — <t:${ts}:D>`,
            value: `${note.text}\n*Added by <@${note.addedBy}>*`,
            inline: false,
          });
        }

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      if (subcommand === 'remove') {
        const id = interaction.options.getInteger('id');
        const userNotes = notes[key]?.notes ?? [];
        const index = userNotes.findIndex(n => n.id === id);

        if (index === -1) {
          return await InteractionHelper.safeEditReply(interaction, {
            content: `❌ Note **#${id}** not found for **${roblox.name}**.`,
          });
        }

        userNotes.splice(index, 1);
        notes[key].notes = userNotes;
        saveNotes(notes);

        const embed = createEmbed({ title: '🗑️ Note Removed', description: null })
          .setDescription(`Note **#${id}** has been removed from **${roblox.name}**.`)
          .setColor(0xed4245)
          .setTimestamp();

        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }
    } catch (error) {
      logger.error('Note command error:', error.message, error.stack);
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
