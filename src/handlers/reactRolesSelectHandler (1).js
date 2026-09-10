import { MessageFlags, ComponentType } from 'discord.js';
import { InteractionHelper } from '../../utils/InteractionHelper.js'; // ajusta el path
import { logger } from '../../utils/logger.js'; // ajusta el path

/**
 * customId: reactroles:select
 * El value de cada opción del select ES el roleId real (no un key inventado),
 * así que no necesitamos ninguna config externa ni base de datos para esto.
 */
export async function handleReactRolesSelect(interaction) {
  try {
    await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const member = interaction.member;
    const selectedRoleIds = interaction.values; // roles que el usuario dejó marcados

    // Buscamos el propio select menu dentro del mensaje para saber TODOS
    // los roles posibles de este panel (para poder quitar los deseleccionados)
    const allRoleIds = findSelectMenuOptionValues(interaction.message, interaction.customId);

    if (!allRoleIds || allRoleIds.length === 0) {
      return InteractionHelper.safeEditReply(interaction, {
        content: '❌ No se pudo leer la configuración de este panel.',
      });
    }

    const toAdd = selectedRoleIds.filter((id) => !member.roles.cache.has(id));
    const toRemove = allRoleIds.filter(
      (id) => !selectedRoleIds.includes(id) && member.roles.cache.has(id)
    );

    if (toAdd.length > 0) await member.roles.add(toAdd);
    if (toRemove.length > 0) await member.roles.remove(toRemove);

    const addedMentions = toAdd.map((id) => `<@&${id}>`);
    const removedMentions = toRemove.map((id) => `<@&${id}>`);

    let content = '✅ Roles actualizados.';
    if (addedMentions.length) content += `\n➕ Agregado: ${addedMentions.join(', ')}`;
    if (removedMentions.length) content += `\n➖ Quitado: ${removedMentions.join(', ')}`;
    if (!addedMentions.length && !removedMentions.length) content = 'ℹ️ No hubo cambios en tus roles.';

    await InteractionHelper.safeEditReply(interaction, { content });
  } catch (error) {
    logger.error('Error en reactRolesSelectHandler:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content:
        '❌ Hubo un error al actualizar tus roles. Verifica que el bot tenga el rol por encima de los roles del panel.',
    });
  }
}

/**
 * Recorre los componentes del mensaje (incluye los que están dentro de un
 * Container de Components V2) buscando el StringSelectMenu con el customId
 * dado, y devuelve el array de "value" de sus opciones (los roleId).
 */
function findSelectMenuOptionValues(message, customId) {
  const stack = [...message.components];

  while (stack.length > 0) {
    const component = stack.pop();

    if (component.type === ComponentType.StringSelect && component.customId === customId) {
      return component.options.map((opt) => opt.value);
    }

    // Container y ActionRow tienen sub-componentes anidados
    if (component.components && component.components.length > 0) {
      stack.push(...component.components);
    }
  }

  return null;
}
