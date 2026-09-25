// src/commands/roblox/publishgame.js
import { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  EmbedBuilder 
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('publishgame')
    .setDescription('Publish a .rbxl or .rbxlx file to any Roblox game via Open Cloud')
    .addAttachmentOption(option => 
      option.setName('file')
        .setDescription('The Roblox place file (.rbxl or .rbxlx)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('universe_id')
        .setDescription('The Universe ID of the game')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('place_id')
        .setDescription('The Place ID of the place')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('version_type')
        .setDescription('Publish type (default: Published)')
        .setRequired(false)
        .addChoices(
          { name: 'Published (Live)', value: 'Published' },
          { name: 'Saved (Draft)', value: 'Saved' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment('file');
    const universeId = interaction.options.getString('universe_id');
    const placeId = interaction.options.getString('place_id');
    const versionType = interaction.options.getString('version_type') || 'Published';

    // 1. Validar extensión del archivo
    const validExtensions = ['.rbxl', '.rbxlx'];
    const fileExtension = attachment.name.slice(attachment.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      return interaction.editReply({
        content: '❌ El archivo debe ser formato `.rbxl` (binario) o `.rbxlx` (XML).'
      });
    }

    // 2. Leer API Key (única variable de entorno necesaria)
    const apiKey = process.env.ROBLOX_API_KEY;

    if (!apiKey) {
      return interaction.editReply({
        content: '❌ Falta la variable de entorno `ROBLOX_API_KEY`.'
      });
    }

    try {
      // 3. Descargar el archivo desde Discord
      const fileResponse = await fetch(attachment.url);
      if (!fileResponse.ok) {
        throw new Error(`No se pudo descargar el archivo: ${fileResponse.status}`);
      }
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

      // 4. Content-Type según extensión
      const contentType = fileExtension === '.rbxlx' 
        ? 'application/xml' 
        : 'application/octet-stream';

      // 5. Endpoint de publicación con IDs del comando
      const url = `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=${versionType}`;

      // 6. Petición POST a Roblox
      const robloxResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': contentType,
        },
        body: fileBuffer,
      });

      const result = await robloxResponse.json();

      // 7. Manejo de errores
      if (!robloxResponse.ok) {
        console.error('Roblox API Error:', result);
        
        if (robloxResponse.status === 403) {
          return interaction.editReply({
            content: '❌ **Error 403**: La API Key no tiene permisos `universe-places` (Write) para este juego o la IP no está autorizada.'
          });
        }
        
        if (robloxResponse.status === 404) {
          return interaction.editReply({
            content: '❌ **Error 404**: No se encontró el juego. Verifica el Universe ID y Place ID.'
          });
        }

        if (robloxResponse.status === 400) {
          return interaction.editReply({
            content: `❌ **Error 400**: ${result.message || 'IDs inválidos o no coinciden entre sí.'}`
          });
        }

        if (robloxResponse.status === 429) {
          return interaction.editReply({
            content: '❌ **Error 429**: Demasiadas publicaciones seguidas. Espera unos minutos.'
          });
        }

        return interaction.editReply({
          content: `❌ Error de Roblox (${robloxResponse.status}): ${result.message || 'Error desconocido'}`
        });
      }

      // 8. Éxito
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Publicación Exitosa')
        .setDescription(`El archivo **${attachment.name}** se publicó correctamente.`)
        .addFields(
          { name: '📦 Versión', value: `\`${result.versionNumber}\``, inline: true },
          { name: '📤 Tipo', value: versionType, inline: true },
          { name: '🎮 Universe ID', value: `\`${universeId}\``, inline: true },
          { name: '📍 Place ID', value: `\`${placeId}\``, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      console.log(`[PublishGame] ${interaction.user.tag} publicó ${attachment.name} en U:${universeId} P:${placeId} como versión ${result.versionNumber}`);

    } catch (error) {
      console.error('Error ejecutando /publishgame:', error);
      await interaction.editReply({
        content: `❌ Error crítico: ${error.message}`
      });
    }
  },
};