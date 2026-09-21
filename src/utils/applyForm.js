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

// Every question: `key` (used to store the answer), `label` (short, for the
// modal field — Discord caps this at 45 chars), `full` (the complete
// question text shown later in the log), and `style` (Short/Paragraph).
const ALL_QUESTIONS = [
  { key: 'discord_username', label: 'Discord username', full: 'Discord username', style: TextInputStyle.Short },
  { key: 'account_age', label: 'Discord Account age', full: 'Discord Account age', style: TextInputStyle.Short },
  { key: 'timezone', label: 'What is your timezone?', full: 'What is your timezone?', style: TextInputStyle.Short },
  { key: 'activity_scale', label: 'Activity (1-10)', full: 'On a scale of 1 to 10, how active can you be?', style: TextInputStyle.Short },

  { key: 'other_communities', label: 'Worked in other communities?', full: 'You worked in other similar communities? Type N/A if not.', style: TextInputStyle.Short },
  { key: 'why_rank', label: 'Why do you want this rank?', full: 'Why do you want this rank?', style: TextInputStyle.Paragraph },
  { key: 'why_hire', label: 'Why hire you over others?', full: 'Why should we hire you and not the other applicants?', style: TextInputStyle.Paragraph },
  { key: 'staff_abuse', label: 'Staff abusing tools/powers?', full: 'If a staff member is found abusing their tools or powers, what do you think should be done?', style: TextInputStyle.Paragraph },

  { key: 'unpleasant_player', label: 'Unpleasant player - action?', full: 'In the case of an unpleasant player, what should you do?', style: TextInputStyle.Paragraph },
  { key: 'exploiter', label: 'Encounter an exploiter?', full: 'If you encounter an exploiter, how would you handle the situation?', style: TextInputStyle.Paragraph },
  { key: 'disrespect', label: 'Higher staff disrespectful?', full: 'If a higher ranking staff member was disrespectful to you, what should you do?', style: TextInputStyle.Paragraph },
  { key: 'staff_role', label: 'Role of a staff member?', full: 'In your opinion, what is the role of a staff member?', style: TextInputStyle.Paragraph },

  { key: 'lying', label: 'Ok to lie to staff? Explain.', full: 'Is it acceptable to lie to other staff members? If you think so, please explain your reasoning.', style: TextInputStyle.Paragraph },
  { key: 'ready', label: 'Ready for staff duties?', full: 'Do you think you are ready to take on the duties of a staff?', style: TextInputStyle.Short },
  { key: 'uniform', label: 'Follow rules & be in uniform?', full: 'You will follow the rules and be in uniform?', style: TextInputStyle.Short },
  { key: 'additional', label: 'Anything else to add?', full: 'Do you have anything else to add? If no, please type N/A.', style: TextInputStyle.Paragraph },
];

// Split into 4 pages of 4 questions (Discord's modal limit is 5 fields).
export const QUESTION_PAGES = [
  ALL_QUESTIONS.slice(0, 4),
  ALL_QUESTIONS.slice(4, 8),
  ALL_QUESTIONS.slice(8, 12),
  ALL_QUESTIONS.slice(12, 16),
];

export const TOTAL_PAGES = QUESTION_PAGES.length;

export function buildApplicationModal(pageIndex) {
  const questions = QUESTION_PAGES[pageIndex];

  const modal = new ModalBuilder()
    .setCustomId(`apply_modal_${pageIndex}`)
    .setTitle(`Staff Application (${pageIndex + 1}/${TOTAL_PAGES})`);

  questions.forEach((question) => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(question.key)
          .setLabel(question.label.slice(0, 45))
          .setStyle(question.style)
          .setRequired(true),
      ),
    );
  });

  return modal;
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

// Builds the full application container, reflecting current status
// (pending / passed / declined).
export function buildApplicationContainer(record) {
  const { applicantId, answers, status, processedById, reason, createdAt } = record;

  let statusText;
  if (status === 'accepted') {
    statusText = `Passed by <@${processedById}>`;
  } else if (status === 'declined') {
    statusText = `Declined by <@${processedById}>\n**Reason:** ${reason}`;
  } else {
    statusText = 'Pending';
  }

  const basicInfo = [
    `**Discord Username**\n${answers.discord_username}`,
    '',
    `**Discord Account Age**\n${answers.account_age}`,
    '',
    `**Status**\n${statusText}`,
    '',
    `**Date of Application**\n<t:${Math.floor(createdAt / 1000)}:F>`,
  ].join('\n');

  const answerBlock1 = ALL_QUESTIONS.slice(2, 9)
    .map(q => `**${q.full}**\n${answers[q.key]}`)
    .join('\n\n');

  const answerBlock2 = ALL_QUESTIONS.slice(9, 16)
    .map(q => `**${q.full}**\n${answers[q.key]}`)
    .join('\n\n');

  const container = new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 📋 Staff Application'))
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

  return container;
}
