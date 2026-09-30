import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
  getGroupRoles,
  findRoleByInput,
  resolveRobloxUsers,
  getCurrentRoleForUser,
  setRank,
  parseUsernameList,
} from '../../utils/robloxRankUtils.js';

const LOG_CHANNEL_ID = '1547417536327454751';

export default {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promotes one or more Roblox users by one rank (or to a specific rank)')
    .addStringOption(opt =>
      opt.setName('users')
        .setDescription('Roblox usernames, separated by commas (max 15)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('rank')
        .setDescription('Optional: promote everyone directly to this rank name/number/ID instead of +1')
        .setRequired(false)
    ),

  async execute(interaction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('Promote interaction defer failed', { userId: interaction.user.id });
      return;
    }

    try {
      const usernames = parseUsernameList(interaction.options.getString('users'));
      const rankInput = interaction.options.getString('rank');

      if (usernames.length === 0) {
        return await InteractionHelper.safeEditReply(interaction, {
          content: '❌ Please provide at least one Roblox username.',
        });
      }

      const roles = await getGroupRoles();
      let fixedTargetRole = null;

      if (rankInput) {
        fixedTargetRole = findRoleByInput(roles, rankInput);
        if (!fixedTargetRole) {
          const roleList = roles.map(r => `\`${r.rank}\` - ${r.name}`).join('\n');
          return await InteractionHelper.safeEditReply(interaction, {
            content: `❌ Rank not found. Available ranks:\n${roleList}`,
          });
        }
      }

      const resolved = await resolveRobloxUsers(usernames);
      const results = [];

      for (const username of usernames) {
        const match = resolved.find(u => u.requestedUsername.toLowerCase() === username.toLowerCase());

        if (!match) {
          results.push(`❌ **${username}**: Roblox user not found.`);
          continue;
        }

        const currentRole = await getCurrentRoleForUser(match.id);
        if (!currentRole) {
          results.push(`❌ **${match.name}**: Not in the group.`);
          continue;
        }

        let targetRole = fixedTargetRole;
        if (!targetRole) {
          const currentIndex = roles.findIndex(r => r.id === currentRole.id);
          targetRole = roles[currentIndex + 1];
          if (!targetRole) {
            results.push(`❌ **${match.name}**: Already at the highest rank.`);
            continue;
          }
        }

        const result = await setRank(match.id, targetRole.id);

        if (result.success) {
          results.push(`✅ **${match.name}**: ${currentRole.name} → ${targetRole.name}`);
        } else {
          results.push(`❌ **${match.name}**: ${result.error}`);
        }
      }

      await InteractionHelper.safeEditReply(interaction, { content: results.join('\n') });

      // ─── LOG (Components V2) ───────────────────────────────────────────
      const logChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        const logContainer = new ContainerBuilder()
          .setAccentColor(null)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('### 📈 Mass Promote'),
          )
          .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `**Moderator**\n<@${interaction.user.id}>`,
                '',
                `**Results**\n${results.join('\n')}`,
              ].join('\n'),
            ),
          );

        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      logger.info(`[Promote] ${interaction.user.tag} promoted: ${usernames.join(', ')}`);

    } catch (error) {
      logger.error('Promote command error:', error);
      await InteractionHelper.safeEditReply(interaction, { content: '❌ An error occurred.' });
    }
  },
};
