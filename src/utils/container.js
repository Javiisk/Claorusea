// src/utils/container.js

import {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from 'discord.js';

/**
 * Crear un container (embed moderno V2) con el formato correcto
 */
export function createContainer({ description = '', color = 0x2F3136 } = {}) {
  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addComponents(
      new TextDisplayBuilder()
        .setContent(description.trim())
    );

  return container;
}

/**
 * Crear un container con secciones (más avanzado)
 */
export function createContainerWithSections({ sections = [], color = 0x2F3136 } = {}) {
  const container = new ContainerBuilder().setAccentColor(color);

  sections.forEach((section, index) => {
    const textDisplay = new TextDisplayBuilder().setContent(section.content);

    if (section.button) {
      const sectionBuilder = new SectionBuilder()
        .addTextDisplayComponents(textDisplay)
        .setButtonAccessory(section.button);
      container.addSectionComponents(sectionBuilder);
    } else {
      container.addTextDisplayComponents(textDisplay);
    }

    // Añadir separador entre secciones (excepto la última)
    if (index < sections.length - 1) {
      container.addSeparatorComponents(separator => 
        separator.setSpacing(SeparatorSpacingSize.Medium)
      );
    }
  });

  return container;
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