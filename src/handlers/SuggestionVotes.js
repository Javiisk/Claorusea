import { EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOTES_PATH = join(__dirname, '../../suggestion-votes.json');

function loadVotes() {
  if (!existsSync(VOTES_PATH)) {
    writeFileSync(VOTES_PATH, JSON.stringify({}));
  }
  return JSON.parse(readFileSync(VOTES_PATH, 'utf8'));
}

function saveVotes(data) {
  writeFileSync(VOTES_PATH, JSON.stringify(data, null, 2));
}

export default async function handleSuggestionVotes(interaction) {
  const [action, suggestionId] = interaction.customId.split(':');

  if (!['suggestion_upvote', 'suggestion_downvote'].includes(action)) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const votes = loadVotes();
    const userId = interaction.user.id;

    if (!votes[suggestionId]) {
      votes[suggestionId] = { upvotes: [], downvotes: [] };
    }

    const suggestion = votes[suggestionId];

    // Si ya votó, remover su voto anterior
    if (suggestion.upvotes.includes(userId)) {
      suggestion.upvotes = suggestion.upvotes.filter(id => id !== userId);
    }
    if (suggestion.downvotes.includes(userId)) {
      suggestion.downvotes = suggestion.downvotes.filter(id => id !== userId);
    }

    // Agregar nuevo voto
    if (action === 'suggestion_upvote') {
      suggestion.upvotes.push(userId);
    } else {
      suggestion.downvotes.push(userId);
    }

    saveVotes(votes);

    const upvotes = suggestion.upvotes.length;
    const downvotes = suggestion.downvotes.length;

    // Actualizar botones
    const message = interaction.message;
    const row = message.components[0];

    // Crear nuevos botones con los contadores actualizados
    const newRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`suggestion_upvote:${suggestionId}`)
        .setLabel(`👍 ${upvotes}`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('👍'),
      new ButtonBuilder()
        .setCustomId(`suggestion_downvote:${suggestionId}`)
        .setLabel(`👎 ${downvotes}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji('👎'),
      new ButtonBuilder()
        .setCustomId(`suggestion_comment:${suggestionId}`)
        .setLabel('💬 Comment')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬'),
      new ButtonBuilder()
        .setCustomId(`suggestion_status:${suggestionId}`)
        .setLabel('📊 Status')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊')
    );

    await message.edit({ components: [newRow] });

    await interaction.editReply({
      content: `✅ Your vote has been recorded! 👍 ${upvotes} | 👎 ${downvotes}`,
    });

  } catch (error) {
    logger.error('Suggestion vote error:', error);
    await interaction.editReply({
      content: '❌ An error occurred.',
    });
  }
}
