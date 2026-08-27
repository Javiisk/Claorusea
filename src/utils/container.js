// src/utils/container.js

import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } from 'discord.js';

/**
 * Crear un container (embed moderno V2) con formato Markdown
 */
export function createContainer({
  title = '',
  description = '',
  color = 0x36393F,
  fields = [],
  footer = null,
  timestamp = true,
  thumbnail = null,
} = {}) {
  // Construir el contenido con Markdown
  let content = '';

  // Título (con emoji si se proporciona)
  if (title) {
    content += `# ${title}\n\n`;
  }

  // Descripción / cuerpo principal
  if (description) {
    content += `${description}\n\n`;
  }

  // Campos (como viñetas o listas)
  if (fields && fields.length > 0) {
    fields.forEach(field => {
      if (field.name && field.value) {
        content += `**${field.name}**\n> ${field.value}\n\n`;
      }
    });
  }

  // Separador
  content += `---\n`;

  // Footer
  if (footer) {
    content += `*${footer}*\n`;
  }

  // Timestamp
  if (timestamp) {
    const ts = Math.floor(Date.now() / 1000);
    content += `<t:${ts}:F>`;
  }

  // Crear el container con los componentes
  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addComponents(
      new TextDisplayBuilder()
        .setContent(content.trim())
    );

  return container;
}

/**
 * Enviar un container como respuesta
 */
export async function replyContainer(interaction, container, ephemeral = false) {
  const flags = ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2;
  
  // Si ya está deferida
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

/**
 * Crear container de error
 */
export function errorContainer(message) {
  return createContainer({
    title: '❌ Error',
    description: message,
    color: 0xED4245,
  });
}

/**
 * Crear container de éxito
 */
export function successContainer(message) {
  return createContainer({
    title: '✅ Success',
    description: message,
    color: 0x57F287,
  });
}

/**
 * Crear container de información
 */
export function infoContainer(message) {
  return createContainer({
    title: 'ℹ️ Information',
    description: message,
    color: 0x5865F2,
  });
}