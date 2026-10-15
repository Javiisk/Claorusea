// src/commands/Roblox/makecontainer.js
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
  SectionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('makecontainer')
    .setDescription('Send a Components V2 container from a .json file')
    .setDMPermission(false)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send the container to')
        .setRequired(true))
    .addAttachmentOption(opt =>
      opt.setName('json')
        .setDescription('The .json file with the Components V2 payload')
        .setRequired(true))
    .addAttachmentOption(opt =>
      opt.setName('image')
        .setDescription('Optional image to use with attachment:// references')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel');
    const jsonFile = interaction.options.getAttachment('json');
    const image = interaction.options.getAttachment('image');

    // ─── Validate file ─────────────────────────────────────────────────
    if (!jsonFile.name.endsWith('.json')) {
      return interaction.editReply({
        content: '❌ The file must be `.json`.',
      });
    }

    // ─── Download and parse ────────────────────────────────────────────
    let payload;
    try {
      const res = await fetch(jsonFile.url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const text = await res.text();
      payload = JSON.parse(text);
    } catch (err) {
      return interaction.editReply({
        content: `❌ Failed to read JSON: \`${err.message}\``,
      });
    }

    if (!Array.isArray(payload.components)) {
      return interaction.editReply({
        content: '❌ JSON must have a "components" array.',
      });
    }

    // ─── Build & send ──────────────────────────────────────────────────
    try {
      const container = buildContainerFromJson(payload);

      const files = [];
      if (image) {
        files.push({ attachment: image.url, name: image.name });
      }

      const me = interaction.guild.members.me;
      if (!channel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)) {
        return interaction.editReply({
          content: `❌ I don't have permission to send messages in <#${channel.id}>.`,
        });
      }

      const sent = await channel.send({
        components: [container],
        files,
        flags: MessageFlags.IsComponentsV2,
      });

      await interaction.editReply({
        content: `✅ Container sent to <#${channel.id}>! ([jump](${sent.url}))`,
      });
    } catch (err) {
      console.error('[MakeContainer] Error:', err);
      await interaction.editReply({
        content: `❌ Failed to build container: \`${err.message}\``,
      });
    }
  },
};

// ─── JSON → ContainerBuilder ─────────────────────────────────────────────
function buildContainerFromJson(payload) {
  const container = new ContainerBuilder();

  // Optional accent color from JSON (null by default)
  const color = payload.accent_color ?? null;
  container.setAccentColor(color);

  for (const comp of payload.components) {
    if (comp.type === 17) {
      for (const inner of comp.components || []) {
        addComponent(container, inner);
      }
    } else {
      addComponent(container, comp);
    }
  }

  return container;
}

function addComponent(container, comp) {
  switch (comp.type) {
    case 10:
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(comp.content || '')
      );
      break;

    case 14: {
      const spacing = comp.spacing === 2
        ? SeparatorSpacingSize.Large
        : SeparatorSpacingSize.Small;
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(spacing)
      );
      break;
    }

    case 12: {
      const gallery = new MediaGalleryBuilder();
      for (const item of comp.items || []) {
        if (item.media?.url) {
          gallery.addItems(
            new MediaGalleryItemBuilder().setURL(item.media.url)
          );
        }
      }
      container.addMediaGalleryComponents(gallery);
      break;
    }

    case 9: {
      const section = new SectionBuilder();
      for (const inner of comp.components || []) {
        if (inner.type === 10) {
          section.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(inner.content || '')
          );
        }
      }
      if (comp.accessory?.type === 2) {
        section.setButtonAccessory(
          new ButtonBuilder()
            .setLabel(comp.accessory.label || 'Button')
            .setStyle(mapButtonStyle(comp.accessory.style))
            .setURL(comp.accessory.url || 'https://discord.com')
        );
      }
      container.addSectionComponents(section);
      break;
    }

    case 1: {
      const row = new ActionRowBuilder();
      for (const btn of comp.components || []) {
        if (btn.type === 2) {
          const builder = new ButtonBuilder()
            .setLabel(btn.label || 'Button')
            .setStyle(mapButtonStyle(btn.style));
          if (btn.style === 5 && btn.url) builder.setURL(btn.url);
          else if (btn.custom_id) builder.setCustomId(btn.custom_id);
          row.addComponents(builder);
        }
      }
      container.addActionRowComponents(row);
      break;
    }

    default:
      console.warn(`[MakeContainer] Unknown component type: ${comp.type}`);
  }
}

function mapButtonStyle(style) {
  switch (style) {
    case 1: return ButtonStyle.Primary;
    case 2: return ButtonStyle.Secondary;
    case 3: return ButtonStyle.Success;
    case 4: return ButtonStyle.Danger;
    case 5: return ButtonStyle.Link;
    default: return ButtonStyle.Secondary;
  }
}