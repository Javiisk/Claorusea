// src/commands/Roblox/makec.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

const COLOR_MAP = {
  none: null,
  red: 0xED4245,
  green: 0x57F287,
  blue: 0x5865F2,
  yellow: 0xFEE75C,
  purple: 0x9B59B6,
  black: 0x000000,
  white: 0xFFFFFF,
};

export default {
  data: new SlashCommandBuilder()
    .setName('makec')
    .setDescription('Build a Components V2 container with simple options')
    .setDMPermission(false)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send the container to')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('Accent color of the container')
        .setRequired(true)
        .addChoices(
          { name: '🚫 None (invisible)', value: 'none' },
          { name: '🔴 Red', value: 'red' },
          { name: '🟢 Green', value: 'green' },
          { name: '🔵 Blue', value: 'blue' },
          { name: '🟡 Yellow', value: 'yellow' },
          { name: '🟣 Purple', value: 'purple' },
          { name: '⚫ Black', value: 'black' },
          { name: '⚪ White', value: 'white' },
        ))
    .addStringOption(opt =>
      opt.setName('title')
        .setDescription('Optional title (## header)')
        .setRequired(false)
        .setMaxLength(100))
    .addStringOption(opt =>
      opt.setName('text1')
        .setDescription('First text block (main content)')
        .setRequired(true)
        .setMaxLength(2000))
    .addStringOption(opt =>
      opt.setName('text2')
        .setDescription('Optional second text block')
        .setRequired(false)
        .setMaxLength(2000))
    .addStringOption(opt =>
      opt.setName('text3')
        .setDescription('Optional third text block')
        .setRequired(false)
        .setMaxLength(2000))
    .addBooleanOption(opt =>
      opt.setName('dividers')
        .setDescription('Add dividers between text blocks (default: true)')
        .setRequired(false))
    .addAttachmentOption(opt =>
      opt.setName('image')
        .setDescription('Optional image at the top')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('button_label')
        .setDescription('Optional button label')
        .setRequired(false)
        .setMaxLength(80))
    .addStringOption(opt =>
      opt.setName('button_url')
        .setDescription('Optional button URL (required if button_label is set)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel');
    const colorKey = interaction.options.getString('color');
    const title = interaction.options.getString('title');
    const text1 = interaction.options.getString('text1');
    const text2 = interaction.options.getString('text2');
    const text3 = interaction.options.getString('text3');
    const dividers = interaction.options.getBoolean('dividers') ?? true;
    const image = interaction.options.getAttachment('image');
    const buttonLabel = interaction.options.getString('button_label');
    const buttonUrl = interaction.options.getString('button_url');

    // ─── Validate button ───────────────────────────────────────────────
    if (buttonLabel && !buttonUrl) {
      return interaction.editReply({
        content: '❌ You provided a button label but no URL. Both are required.',
      });
    }
    if (buttonUrl && !buttonLabel) {
      return interaction.editReply({
        content: '❌ You provided a button URL but no label. Both are required.',
      });
    }

    // ─── Permissions check ─────────────────────────────────────────────
    const me = interaction.guild.members.me;
    if (!channel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
      return interaction.editReply({
        content: `❌ I don't have permission to send messages in <#${channel.id}>.`,
      });
    }

    try {
      const container = new ContainerBuilder()
        .setAccentColor(COLOR_MAP[colorKey]);

      // ─── Title (optional) ─────────────────────────────────────────────
      if (title) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${title}`)
        );
        if (dividers) {
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
        }
      }

      // ─── Image (optional) ─────────────────────────────────────────────
      const files = [];
      if (image) {
        files.push({ attachment: image.url, name: image.name });
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(`attachment://${image.name}`)
          )
        );
        if (dividers) {
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
        }
      }

      // ─── Text blocks ──────────────────────────────────────────────────
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(text1)
      );

      if (text2) {
        if (dividers) {
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
        }
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(text2)
        );
      }

      if (text3) {
        if (dividers) {
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
        }
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(text3)
        );
      }

      // ─── Button (optional) ────────────────────────────────────────────
      if (buttonLabel && buttonUrl) {
        if (dividers) {
          container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
          );
        }
        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel(buttonLabel)
              .setStyle(ButtonStyle.Link)
              .setURL(buttonUrl)
          )
        );
      }

      // ─── Send ─────────────────────────────────────────────────────────
      const sent = await channel.send({
        components: [container],
        files,
        flags: MessageFlags.IsComponentsV2,
      });

      await interaction.editReply({
        content: `✅ Container sent to <#${channel.id}>! ([jump](${sent.url}))`,
      });
    } catch (err) {
      console.error('[MakeC] Error:', err);
      await interaction.editReply({
        content: `❌ Failed: \`${err.message}\``,
      });
    }
  },
};