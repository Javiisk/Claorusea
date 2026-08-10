
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { checkAIContent } from '../../utils/aiDetector.js';

const ALLOWED_ROLES = [
  '1505671292873867544',
  '1505671296883757158',
  '1505671309915328713',
  '1505673808097574912',
  '1505673879069393024',
];

export default {
  data: new SlashCommandBuilder()
    .setName('aichecker')
    .setDescription('🤖 Check if a text is AI-generated or human-written')
    .addStringOption(opt =>
      opt.setName('text')
        .setDescription('The text to analyze for AI detection')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Optional: User who wrote the text')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      // Check permissions
      const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
      if (!hasRole) {
        return await interaction.reply({
          content: '❌ You don\'t have permission to use this command.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const text = interaction.options.getString('text');
      const targetUser = interaction.options.getUser('user');

      // Check text length
      if (text.length < 20) {
        return await interaction.editReply({
          content: '⚠️ Text is too short. Please provide at least 20 characters for accurate detection.',
        });
      }

      // Run AI detection
      const result = await checkAIContent(text);

      // ─── CREATE RESULT EMBED ──────────────────────────────────────────

      const embed = new EmbedBuilder()
        .setColor(result.isAI ? 0xED4245 : 0x57F287)
        .setTitle('🤖 AI Content Detection')
        .setDescription(
          result.error
            ? `⚠️ **Error:** ${result.error}`
            : result.isAI 
              ? '⚠️ **AI-generated content detected!**' 
              : '✅ **Content appears to be human-written**'
        )
        .setTimestamp();

      // Only add details if no error
      if (!result.error) {
        embed.addFields(
          { name: '📊 AI Score', value: `${Math.round(result.score * 100)}%`, inline: true },
          { name: '📌 Result', value: result.headline || 'Unknown', inline: true },
          { name: '📝 Text Length', value: `${text.length} characters`, inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '📄 Sample Text', value: text.length > 500 ? text.slice(0, 497) + '...' : text, inline: false }
        );

        // Add user info if provided
        if (targetUser) {
          embed.addFields({
            name: '👤 Analyzed User',
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: false,
          });
        }

        // Add detailed breakdown if available
        if (result.details) {
          const details = result.details;
          embed.addFields({
            name: '📊 Breakdown',
            value: [
              `👤 Human: ${Math.round((details.fraction_human || 0) * 100)}%`,
              `🤖 AI: ${Math.round((details.fraction_ai || 0) * 100)}%`,
              `🤝 AI-Assisted: ${Math.round((details.fraction_ai_assisted || 0) * 100)}%`,
            ].join(' • '),
            inline: false,
          });
        }

        // Add warning if AI detected
        if (result.isAI) {
          embed.addFields({
            name: '⚠️ Recommendation',
            value: 'This content appears to be AI-generated. Consider reviewing it carefully before accepting.',
            inline: false,
          });
        }
      }

      embed.setFooter({ 
        text: result.error 
          ? 'Powered by Pangram Labs' 
          : `Analyzed by Pangram Labs • ${new Date().toLocaleString()}` 
      });

      await interaction.editReply({ embeds: [embed] });

      // Log the check
      logger.info(`[AIChecker] ${interaction.user.tag} checked text (${result.isAI ? 'AI Detected' : 'Human'} | Score: ${Math.round(result.score * 100)}%)`);

    } catch (error) {
      logger.error('AIChecker error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while analyzing the text. Please try again.',
      });
    }
  },
};