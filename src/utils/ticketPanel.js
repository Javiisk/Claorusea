// src/utils/ticketPanel.js
import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';

// Each category: its button label/style, and the modal questions it asks.
export const TICKET_CATEGORIES = {
  alliance: {
    label: 'Alliance & role',
    buttonStyle: ButtonStyle.Primary,
    questions: [
      { id: 'need', label: 'What you need?', style: TextInputStyle.Paragraph },
      { id: 'why', label: 'Why should we do it?', style: TextInputStyle.Paragraph },
    ],
  },
  support: {
    label: 'Support Ticket',
    buttonStyle: ButtonStyle.Success,
    questions: [
      { id: 'need', label: 'What do you need?', style: TextInputStyle.Paragraph },
    ],
  },
  report: {
    label: 'Report ticket',
    buttonStyle: ButtonStyle.Danger,
    questions: [
      { id: 'reported_user', label: 'The user you are reporting', style: TextInputStyle.Short },
      { id: 'reason', label: 'Reason of report?', style: TextInputStyle.Paragraph },
      { id: 'notes', label: 'Notes', style: TextInputStyle.Paragraph },
    ],
  },
};

// The panel message posted by /tickets — one button per category.
export function buildPanelContainer() {
  return new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### 🎫 Support Tickets'),
    )
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Select a category below to open a ticket.'),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        ...Object.entries(TICKET_CATEGORIES).map(([key, category]) =>
          new ButtonBuilder()
            .setCustomId(`ticket_open_${key}`)
            .setLabel(category.label)
            .setStyle(category.buttonStyle),
        ),
      ),
    );
}

// The modal shown when someone clicks a category button.
export function buildCategoryModal(categoryKey) {
  const category = TICKET_CATEGORIES[categoryKey];

  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${categoryKey}`)
    .setTitle(category.label.slice(0, 45));

  category.questions.forEach((question, index) => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(`q${index}`)
          .setLabel(question.label.slice(0, 45))
          .setStyle(question.style)
          .setRequired(true),
      ),
    );
  });

  return modal;
}

// The modal shown when staff click "Close" on a ticket.
export function buildCloseModal() {
  return new ModalBuilder()
    .setCustomId('ticket_close_modal')
    .setTitle('Close Ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('close_reason')
          .setLabel('Reason')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true),
      ),
    );
}

// The container posted inside the ticket channel, with the form answers
// and the Claim/Close buttons.
export function buildTicketContainer({ categoryKey, openerId, answers, claimedById }) {
  const category = TICKET_CATEGORIES[categoryKey];

  const qaText = category.questions
    .map((question, index) => `**${question.label}**\n${answers[`q${index}`] || 'N/A'}`)
    .join('\n\n');

  return new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### 🎫 ${category.label}`),
    )
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [`**Opened by**\n<@${openerId}>`, '', qaText].join('\n'),
      ),
    )
    .addSeparatorComponents(separator =>
      separator.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        claimedById ? `**Claimed by**\n<@${claimedById}>` : '**Claimed by**\nNo one yet',
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('Claim')
          .setStyle(ButtonStyle.Success)
          .setDisabled(Boolean(claimedById)),
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger),
      ),
    );
}
