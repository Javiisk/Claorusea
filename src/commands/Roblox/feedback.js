import {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { createFeedbackRecord } from '../../utils/feedbackStorage.js';

const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID || '1546998306360660069';

const FEEDBACK_CHOICES = [
  'Amazing answers & Very detailed.',
  'Good answers & Great grammar.',
  'Good answers but grammar mistakes.',
  'Some bad answers and not very detailed.',
  'Other.',
];

export default {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Give feedback on a staff application')
    .setDMPermission(false)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The applicant to give feedback to')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('feedback')
        .setDescription('The feedback category')
        .setRequired(true)
        .addChoices(...FEEDBACK_CHOICES.map(choice => ({ name: choice, value: choice })))
    )
    .addStringOption(opt =>
      opt.setName('other')
        .setDescription('Required if you picked "Other." above')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const feedbackChoice = interaction.options.getString('feedback');
    const otherText = interaction.options.getString('other');

    if (feedbackChoice === 'Other.' && !otherText) {
      return interaction.reply({
        content: '<:UnverifiedIcon:1547447352795594844> You picked "Other." — please also fill in the `other` option with your feedback.',
        ephemeral: true,
      });
    }

    const feedbackText = feedbackChoice === 'Other.' ? otherText : feedbackChoice;

    const feedbackChannel = await interaction.client.channels.fetch(FEEDBACK_CHANNEL_ID).catch(() => null);

    if (!feedbackChannel) {
      return interaction.reply({
        content: '<:UnverifiedIcon:1547447352795594844> Could not find the feedback channel. Contact staff.',
        ephemeral: true,
      });
    }

    const pingContainer = new ContainerBuilder()
      .setAccentColor(null)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `Greetings <@${targetUser.id}>, you have received feedback on your application! Press the button below to view it.`,
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('feedback_view')
            .setLabel('View Feedback')
            .setStyle(ButtonStyle.Secondary),
        ),
      );

    const pingMessage = await feedbackChannel.send({
      components: [pingContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    createFeedbackRecord(pingMessage.id, {
      targetUserId: targetUser.id,
      feedbackText,
      givenBy: interaction.user.id,
    });

    await interaction.reply({
      content: `<:VerifiedIcon:1547447354272260107> Feedback sent to <@${targetUser.id}> in ${feedbackChannel}.`,
      ephemeral: true,
    });
  },
};
