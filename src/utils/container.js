// src/utils/container.js

import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

export function createContainer({ description = '', color = 0x2F3136 } = {}) {
  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addComponents(
      new TextDisplayBuilder()
        .setContent(description.trim())
    );

  return container;
}

export async function replyContainer(interaction, container, ephemeral = false) {
  const flags = ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2;

  if (interaction.deferred) {
    await interaction.editReply({
      components: [container],
      flags: flags,
    });
  } else {
    await interaction.reply({
      components: [container],
      flags: flags,
    });
  }
}