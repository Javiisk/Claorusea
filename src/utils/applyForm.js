// src/utils/applyForm.js
import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';

// Discord username / account age / Roblox username are NOT asked here —
// they're pulled automatically and shown only in the log container.
export const QUESTIONS = [
  { key: 'timezone', full: 'What is your timezone?', style: TextInputStyle.Short },
  { key: 'activity_scale', full: 'On a scale of 1 to 10, how active can you be?', style: TextInputStyle.Short },
  { key: 'other_communities', full: 'You worked in other similar communities? Type N/A if not.', style: TextInputStyle.Short },
  { key: 'why_rank', full: 'Why do you want this rank?', style: TextInputStyle.Paragraph },
  { key: 'why_hire', full: 'Why should we hire you and not the other applicants?', style: TextInputStyle.Paragraph },
  { key: 'staff_abuse', full: 'If a staff member is found abusing their tools or powers, what do you think should be done?', style: TextInputStyle.Paragraph },
  { key: 'unpleasant_player', full: 'In the case of an unpleasant player, what should you do?', style: TextInputStyle.Paragraph },
  { key: 'exploiter', full: 'If you encounter an exploiter, how would you handle the situation?', style: TextInputStyle.Paragraph },
  { key: 'disrespect', full: 'If a higher ranking staff member was disrespectful to you, what should you do?', style: TextInputStyle.Paragraph },
  { key: 'staff_role', full: 'In your opinion, what is the role of a staff member?', style: TextInputStyle.Paragraph },
  { key: 'lying', full: 'Is it acceptable to lie to other staff members? If you think so, please explain your reasoning.', style: TextInputStyle.Paragraph },
  { key: 'ready', full: 'Do you think you are ready to take on the duties of a staff?', style: TextInputStyle.Short },
  { key: 'uniform', full: 'You will follow the rules and be in uniform?', style: TextInputStyle.Short },
  { key: 'additional', full: 'Do you have anything else to add? If no, please type N/A.', style: TextInputStyle.Paragraph },
];

// The DM message shown for a single question, with an "Answer" button
// below it that opens a one-field modal.
export function buildQuestionContainer(index) {
  const question = QUESTIONS[index];

  return new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### <:SurveyIcon:1547068617042952303> Staff Application (${index + 1}/${QUESTIONS.length})`),
    )
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(question.full),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply_answer_${index}`)
          .setLabel('Answer')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}

export function buildQuestionModal(index) {
  const question = QUESTIONS[index];

  return new ModalBuilder()
    .setCustomId(`apply_qmodal_${index}`)
    .setTitle(`Question ${index + 1}/${QUESTIONS.length}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('answer')
          .setLabel(question.full.slice(0, 45))
          .setStyle(question.style)
          .setRequired(true),
      ),
    );
}

// Shown in the user's DM once every question has been answered.
export function buildDoneContainer() {
  return new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('You application has been logged'),
    );
}

export function buildDeclineModal() {
  return new ModalBuilder()
    .setCustomId('apply_decline_modal')
    .setTitle('Decline Application')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('decline_reason')
          .setLabel('Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true),
      ),
    );
}

// Builds the full application container posted to the log channel,
// reflecting current status (pending / accepted / declined).
export function buildApplicationContainer(record) {
  const { answers, status, processedById, reason, createdAt, discordUsername, accountCreatedAt, robloxUsername } = record;

  let statusText;
  if (status === 'accepted') {
    statusText = `Passed by <@${processedById}>`;
  } else if (status === 'declined') {
    statusText = `Declined by <@${processedById}>\n**Reason:** ${reason}`;
  } else {
    statusText = 'Pending';
  }

  const basicInfo = [
    `**Discord Username**\n${discordUsername}`,
    '',
    `**Discord Account Age**\n<t:${Math.floor(accountCreatedAt / 1000)}:R>`,
    '',
    `**Roblox Username**\n${robloxUsername}`,
    '',
    `**Status**\n${statusText}`,
    '',
    `**Date of Application**\n<t:${Math.floor(createdAt / 1000)}:F>`,
  ].join('\n');

  const answerBlock1 = QUESTIONS.slice(0, 7)
    .map(q => `**${q.full}**\n${answers[q.key]}`)
    .join('\n\n');

  const answerBlock2 = QUESTIONS.slice(7, 14)
    .map(q => `**${q.full}**\n${answers[q.key]}`)
    .join('\n\n');

  return new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### <:SurveyIcon:1547068617042952303> Staff Application'))
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(basicInfo))
    .addSeparatorComponents(separator => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(answerBlock1))
    .addSeparatorComponents(separator => separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(answerBlock2))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('apply_accept')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(status !== 'pending'),
        new ButtonBuilder()
          .setCustomId('apply_decline')
          .setLabel('Decline')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(status !== 'pending'),
      ),
    );
}
