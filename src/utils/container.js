// src/utils/container.js

import { EmbedBuilder } from 'discord.js';

/**
 * Crear un embed con estilo moderno usando Markdown en la descripción
 * (Funciona con CUALQUIER versión de discord.js)
 */
export function createContainer({
  title = '',
  description = '',
  color = 0x36393F,
  fields = [],
  footer = null,
  timestamp = true,
  thumbnail = null,
  image = null,
} = {}) {
  // Construir la descripción con Markdown
  let content = '';

  // Título como heading en Markdown
  if (title) {
    content += `# ${title}\n\n`;
  }

  // Descripción / cuerpo principal
  if (description) {
    content += `${description}\n\n`;
  }

  // Campos (como viñetas)
  if (fields && fields.length > 0) {
    fields.forEach(field => {
      if (field.name && field.value) {
        content += `**${field.name}**\n> ${field.value}\n\n`;
      }
    });
  }

  // Separador
  content += `---\n\n`;

  // Footer
  if (footer) {
    content += `*${footer}*\n`;
  }

  // Timestamp
  if (timestamp) {
    const ts = Math.floor(Date.now() / 1000);
    content += `<t:${ts}:F>`;
  }

  // Crear embed tradicional con todo en la descripción
  const embed = new EmbedBuilder()
    .setColor(color)
    .setDescription(content.trim());

  // Thumbnail
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  // Image
  if (image) {
    embed.setImage(image);
  }

  return embed;
}

/**
 * Enviar un container como respuesta
 */
export async function replyContainer(interaction, embed, ephemeral = false) {
  if (interaction.deferred) {
    await interaction.editReply({
      embeds: [embed],
      ephemeral: ephemeral,
    });
  } else {
    await interaction.reply({
      embeds: [embed],
      ephemeral: ephemeral,
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