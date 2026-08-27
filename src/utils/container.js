// src/utils/container.js

import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';

/**
 * Crear un container (embed moderno V2) con formato Markdown
 */
export function createContainer({
  title = '',
  description = '',
  color = 0x36393F,
  footer = null,
  timestamp = true,
} = {}) {
  let content = '';

  if (title) {
    content += `# ${title}\n\n`;
  }

  if (description) {
    content += `${description}\n\n`;
  }

  if (footer) {
    content += `---\n\n*${footer}*\n`;
  }

  if (timestamp) {
    const ts = Math.floor(Date.now() / 1000);
    content += `<t:${ts}:F>`;
  }

  return new ContainerBuilder()
    .setAccentColor(color)
    .addComponents(
      new TextDisplayBuilder()
        .setContent(content.trim())
    );
}

/**
 * Enviar un container como respuesta
 */
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

export function errorContainer(message) {
  return createContainer({
    title: '❌ Error',
    description: message,
    color: 0xED4245,
  });
}

export function successContainer(message) {
  return createContainer({
    title: '✅ Success',
    description: message,
    color: 0x57F287,
  });
}

export function infoContainer(message) {
  return createContainer({
    title: 'ℹ️ Information',
    description: message,
    color: 0x5865F2,
  });
}