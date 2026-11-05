// src/utils/styleHandler.js
import { MessageFlags } from 'discord.js';

// ⚠️ Endpoint NO OFICIAL que usa Discord internamente
const DISCORD_API = 'https://discord.com/api/v9';

export async function handleStyleInteraction(interaction) {
  // Si seleccionan un efecto en el menú
  if (interaction.isStringSelectMenu() && interaction.customId === 'style_effect_select') {
    const effect = interaction.values[0];
    // Aquí guardarías la selección en memoria para el usuario
    return interaction.reply({ content: `✅ Effect changed to **${effect}**. Click **Update** to apply.`, ephemeral: true });
  }

  // Si le dan al botón de Actualizar (El que hace la magia)
  if (interaction.isButton() && interaction.customId === 'style_update') {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Llamada al endpoint interno de Discord
      const response = await fetch(`${DISCORD_API}/users/@me`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Aquí van los datos del estilo
          // Ejemplo: Fuente "Vampyre" (8), Efecto "Gradient" (2)
          // Los colores van en formato decimal (hex a int)
          display_name_font_id: 8, 
          display_name_effect_id: 2,
          display_name_colors: [12430531, 16777215] // bde8c3 y ffffff
        })
      });

      if (response.ok) {
        await interaction.editReply({ content: '✅ **Estilo actualizado exitosamente!** El cambio puede tardar unos segundos en reflejarse en el perfil.' });
      } else {
        const error = await response.json();
        console.error('Error de Discord:', error);
        await interaction.editReply({ content: '❌ No se pudo actualizar el estilo. Discord rechazó la petición (posiblemente cambiaron la API).' });
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: '❌ Error de red al intentar actualizar.' });
    }
  }
}
