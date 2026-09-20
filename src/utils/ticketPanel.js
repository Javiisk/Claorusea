// src/utils/ticketPanel.js
import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from 'discord.js';

// panelType: 'all' | 'staff' — which /tickets panel this category shows up in.
// pingRoles: which roles to ping when a ticket of this category opens.
//   'normal' = the regular ticket ping role, 'staff1'/'staff2' = the two
//   staff ping roles. Actual IDs are resolved in ticketHandlers.js.
export const TICKET_CATEGORIES = {
  alliance: {
    label: 'Alliance & role',
    panelType: 'all',
    pingRoles: ['normal'],
    questions: [
      { label: 'What you need?', style: TextInputStyle.Paragraph },
      { label: 'Why should we do it?', style: TextInputStyle.Paragraph },
    ],
  },
  support: {
    label: 'Support Ticket',
    panelType: 'all',
    pingRoles: ['normal'],
    questions: [
      { label: 'What do you need?', style: TextInputStyle.Paragraph },
    ],
  },
  report: {
    label: 'Report ticket',
    panelType: 'all',
    pingRoles: ['normal'],
    questions: [
      { label: 'The user you are reporting', style: TextInputStyle.Short },
      { label: 'Reason of report?', style: TextInputStyle.Paragraph },
      { label: 'Notes', style: TextInputStyle.Paragraph },
    ],
  },
  staffsupport: {
    label: 'Staff Support',
    panelType: 'staff',
    pingRoles: ['normal', 'staff1', 'staff2'],
    visibleRoles: ['ticketStaff', 'staff1', 'staff2'],
    questions: [
      { label: 'What you need?', style: TextInputStyle.Paragraph },
    ],
  },
  usernamechange: {
    label: 'Username Change',
    panelType: 'staff',
    pingRoles: ['staff1', 'staff2'],
    visibleRoles: ['staff1', 'staff2'],
    questions: [
      { label: "What's your old username?", style: TextInputStyle.Short },
      { label: "What's your new username?", style: TextInputStyle.Short },
    ],
  },
  evaluation: {
    label: 'Evaluation Ticket',
    panelType: 'staff',
    pingRoles: ['staff1', 'staff2'],
    visibleRoles: ['staff1', 'staff2'],
    questions: [
      { label: 'Your Roblox user?', style: TextInputStyle.Short },
      { label: 'Current rank?', style: TextInputStyle.Short },
      { label: 'How long has it been since you were promoted?', style: TextInputStyle.Short },
    ],
  },
  staffdispute: {
    label: 'Staff Dispute',
    panelType: 'staff',
    pingRoles: ['staff1', 'staff2'],
    visibleRoles: ['staff1', 'staff2'],
    questions: [
      { label: 'User you are reporting?', style: TextInputStyle.Short },
      { label: 'Reason?', style: TextInputStyle.Paragraph },
    ],
  },
};

function categoriesForPanel(panelType) {
  return Object.entries(TICKET_CATEGORIES).filter(([, cat]) => cat.panelType === panelType);
}

// The panel message posted by /tickets — a select menu (dropdown) instead
// of one button per category.
export function buildPanelContainer(panelType) {
  const entries = categoriesForPanel(panelType);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_open_select_${panelType}`)
    .setPlaceholder('Select a category...')
    .addOptions(
      entries.map(([key, category]) => ({
        label: category.label,
        value: key,
      })),
    );

  return new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        panelType === 'staff' ? '### 🎫 Staff Tickets' : '### 🎫 Support Tickets',
      ),
    )
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Select a category below to open a ticket.'),
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));
}

// The modal shown after picking a category from the select menu.
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
// and the Claim/Close buttons (both gray/Secondary, as requested).
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
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(Boolean(claimedById)),
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
}
