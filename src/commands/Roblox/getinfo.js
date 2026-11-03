// src/commands/Roblox/getinfo.js
import { 
  SlashCommandBuilder, 
  ContainerBuilder, 
  TextDisplayBuilder, 
  SeparatorBuilder, 
  SeparatorSpacingSize, 
  SectionBuilder, 
  ThumbnailBuilder, 
  MessageFlags 
} from 'discord.js';
import { getRobloxUserByDiscord, getRobloxAvatar } from '../../utils/bloxlink.js';
import { getVerifiedUser } from '../../utils/verifyStorage.js';

export default {
  data: new SlashCommandBuilder()
    .setName('getinfo')
    .setDescription('Get Roblox information for a user')
    // ✅ Opción obligatoria
    .addUserOption(opt => 
      opt.setName('user')
        .setDescription('User to check')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user');

    let robloxId = null;
    let robloxUsername = 'Unknown';
    let avatarUrl = null;
    let accountCreated = 'Unknown';

    // 1. Buscamos primero en nuestra base de datos local
    const localData = getVerifiedUser(target.id);
    if (localData) {
      robloxId = localData.robloxId;
      robloxUsername = localData.robloxUsername;
    } else {
      // 2. Si no está en local, buscamos en Bloxlink
      const bloxlinkData = await getRobloxUserByDiscord(target.id);
      if (bloxlinkData && bloxlinkData.robloxID) {
        robloxId = bloxlinkData.robloxID;
        robloxUsername = bloxlinkData.primaryAccount || 'Unknown';
      }
    }

    if (!robloxId) {
      return interaction.editReply({ 
        content: `❌ **${target.username}** is not verified. They need to use \`/verify\` first.` 
      });
    }

    // 3. Obtenemos el avatar y la fecha de creación desde Roblox
    avatarUrl = await getRobloxAvatar(robloxId);
    
    try {
      const res = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.created) {
          accountCreated = new Date(data.created).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          });
        }
      }
    } catch (e) {
      console.error('Error fetching roblox creation date:', e);
    }

    // 4. Construimos el Container V2 (Igual a la foto)
    const container = new ContainerBuilder()
      .setAccentColor(0x5865F2)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### <:RobloxIcon:1234567890> **${robloxUsername}** (${robloxId})` // Puedes cambiar el emoji
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(avatarUrl || 'https://i.imgur.com/6k5e5.png')
          )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Roblox Information**\n` +
          `**Account Created:** ${accountCreated}`
        )
      )
      .addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Discord Information**\n` +
          `**Tag:** <@${target.id}>\n` +
          `**Account Created:** <t:${Math.floor(target.createdTimestamp / 1000)}:f>`
        )
      );

    // Si el usuario tiene avatar de Discord, lo mostramos a la derecha
    if (target.displayAvatarURL()) {
      // Nota: Un Container solo puede tener un thumbnail principal (el de Roblox),
      // así que la info de Discord la dejamos en texto.
    }

    await interaction.editReply({ 
      components: [container], 
      flags: MessageFlags.IsComponentsV2 
    });
  },
};