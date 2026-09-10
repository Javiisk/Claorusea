import {
  SlashCommandBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { InteractionHelper } from '../utils/InteractionHelper.js'; // ajusta el path a tu proyecto
import { logger } from '../utils/logger.js'; // ajusta el path a tu proyecto

const MAX_ROLES = 8; // límite de roles por panel (StringSelectMenu soporta hasta 25 opciones)

export const data = new SlashCommandBuilder()
  .setName('reactroles')
  .setDescription('Crea un panel de reaction roles con Components V2')
  .addStringOption((option) =>
    option.setName('titulo').setDescription('Título que aparece arriba del panel').setRequired(true)
  )
  .addRoleOption((option) => option.setName('rol1').setDescription('Rol #1').setRequired(true))
  .addStringOption((option) =>
    option.setName('descripcion').setDescription('Texto descriptivo del panel').setRequired(false)
  )
  .addAttachmentOption((option) =>
    option.setName('imagen').setDescription('Imagen/banner que se muestra arriba del panel').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('color').setDescription('Color del container en hex, ej: #5865F2').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('emoji1').setDescription('Emoji para el rol #1 (opcional)').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName('etiqueta1').setDescription('Texto a mostrar para el rol #1 (opcional, default = nombre del rol)').setRequired(false)
  )
  .addRoleOption((option) => option.setName('rol2').setDescription('Rol #2').setRequired(false))
  .addStringOption((option) => option.setName('emoji2').setDescription('Emoji para el rol #2').setRequired(false))
  .addStringOption((option) => option.setName('etiqueta2').setDescription('Texto para el rol #2').setRequired(false))
  .addRoleOption((option) => option.setName('rol3').setDescription('Rol #3').setRequired(false))
  .addStringOption((option) => option.setName('emoji3').setDescription('Emoji para el rol #3').setRequired(false))
  .addStringOption((option) => option.setName('etiqueta3').setDescription('Texto para el rol #3').setRequired(false))
  .addRoleOption((option) => option.setName('rol4').setDescription('Rol #4').setRequired(false))
  .addStringOption((option) => option.setName('emoji4').setDescription('Emoji para el rol #4').setRequired(false))
  .addStringOption((option) => option.setName('etiqueta4').setDescription('Texto para el rol #4').setRequired(false))
  .addRoleOption((option) => option.setName('rol5').setDescription('Rol #5').setRequired(false))
  .addStringOption((option) => option.setName('emoji5').setDescription('Emoji para el rol #5').setRequired(false))
  .addStringOption((option) => option.setName('etiqueta5').setDescription('Texto para el rol #5').setRequired(false))
  .addRoleOption((option) => option.setName('rol6').setDescription('Rol #6').setRequired(false))
  .addStringOption((option) => option.setName('emoji6').setDescription('Emoji para el rol #6').setRequired(false))
  .addStringOption((option) => option.setName('etiqueta6').setDescription('Texto para el rol #6').setRequired(false))
  .addRoleOption((option) => option.setName('rol7').setDescription('Rol #7').setRequired(false))
  .addStringOption((option) => option.setName('emoji7').setDescription('Emoji para el rol #7').setRequired(false))
  .addStringOption((option) => option.setName('etiqueta7').setDescription('Texto para el rol #7').setRequired(false))
  .addRoleOption((option) => option.setName('rol8').setDescription('Rol #8').setRequired(false))
  .addStringOption((option) => option.setName('emoji8').setDescription('Emoji para el rol #8').setRequired(false))
  .addStringOption((option) => option.setName('etiqueta8').setDescription('Texto para el rol #8').setRequired(false))
  .addIntegerOption((option) =>
    option
      .setName('max_selecciones')
      .setDescription('Cuántos roles puede elegir a la vez un usuario (default: todos)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  try {
    await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

    const titulo = interaction.options.getString('titulo');
    const descripcion =
      interaction.options.getString('descripcion') ??
      'Usa el menú de abajo para elegir tus roles. Puedes deseleccionar en cualquier momento.';
    const imagen = interaction.options.getAttachment('imagen');
    const colorHex = interaction.options.getString('color') ?? '#5865F2';
    const accentColor = parseInt(colorHex.replace('#', ''), 16);

    // ---------------- Recolectar roles desde las opciones del comando ----------------
    const roles = [];
    for (let i = 1; i <= MAX_ROLES; i++) {
      const role = interaction.options.getRole(`rol${i}`);
      if (!role) continue;

      const emoji = interaction.options.getString(`emoji${i}`) ?? undefined;
      const etiqueta = interaction.options.getString(`etiqueta${i}`) ?? role.name;

      roles.push({ roleId: role.id, label: etiqueta, emoji });
    }

    if (roles.length === 0) {
      return InteractionHelper.safeEditReply(interaction, {
        content: '❌ Tienes que elegir al menos un rol (rol1).',
      });
    }

    // Evitar el rol @everyone
    const invalidRole = roles.find((r) => r.roleId === interaction.guild.id);
    if (invalidRole) {
      return InteractionHelper.safeEditReply(interaction, {
        content: '❌ No puedes usar el rol @everyone.',
      });
    }

    const maxSelecciones = interaction.options.getInteger('max_selecciones') ?? roles.length;

    // ---------------- Container (Components V2) ----------------
    const container = new ContainerBuilder().setAccentColor(accentColor);

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${titulo}\n${descripcion}`)
    );

    if (imagen) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imagen.url))
      );
    }

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large).setDivider(true)
    );

    // Select menu con los roles elegidos (el value de cada opción ES el roleId real)
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('reactroles:select')
      .setPlaceholder('Elige tus roles')
      .setMinValues(0)
      .setMaxValues(Math.min(maxSelecciones, roles.length))
      .addOptions(
        roles.map((r) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(r.label)
            .setValue(r.roleId)
            .setEmoji(r.emoji ?? undefined)
        )
      );

    const actionRow = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [container, actionRow],
    });

    await InteractionHelper.safeEditReply(interaction, {
      content: `✅ Panel de reaction roles publicado con ${roles.length} rol(es).`,
    });
  } catch (error) {
    logger.error('Error en /reactroles:', error);
    await InteractionHelper.safeEditReply(interaction, {
      content: '❌ Hubo un error al crear el panel de reaction roles.',
    });
  }
}
