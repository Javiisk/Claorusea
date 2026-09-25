// src/commands/roblox/publishgame.js
import { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  EmbedBuilder 
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('publishgame')
    .setDescription('Publish a .rbxl or .rbxlx file to your Roblox game via Open Cloud')
    .addAttachmentOption(option => 
      option.setName('file')
        .setDescription('The Roblox place file (.rbxl or .rbxlx)')
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
    const versionType = interaction.options.getString('version_type') || 'Published';

    // 1. Validar extensión del archivo
    const validExtensions = ['.rbxl', '.rbxlx'];
    const fileExtension = attachment.name.slice(attachment.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      return interaction.editReply({
        content: '❌ El archivo debe ser formato `.rbxl` (binario) o `.rbxlx` (XML).'
      });
    }

    // 2. Leer variables de entorno
    const universeId = process.env.ROBLOX_UNIVERSE_ID;
    const placeId = process.env.ROBLOX_PLACE_ID;
    const apiKey = process.env.ROBLOX_API_KEY;

    if (!universeId || !placeId || !apiKey) {
      return interaction.editReply({
        content: '❌ Faltan variables de entorno: `ROBLOX_UNIVERSE_ID`, `ROBLOX_PLACE_ID` o `ROBLOX_API_KEY`.'
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

      // 5. Endpoint de publicación
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
            content: '❌ **Error 403**: La API Key no tiene permisos `universe-places` (Write) o la IP no está autorizada.'
          });
        }
        
        if (robloxResponse.status === 404) {
          return interaction.editReply({
            content: '❌ **Error 404**: No se encontró el juego. Verifica `ROBLOX_UNIVERSE_ID` y `ROBLOX_PLACE_ID`.'
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
      console.log(`[PublishGame] ${interaction.user.tag} publicó ${attachment.name} como versión ${result.versionNumber}`);

    } catch (error) {
      console.error('Error ejecutando /publishgame:', error);
      await interaction.editReply({
        content: `❌ Error crítico: ${error.message}`
      });
    }
  },
};