/**
 * Discord Bot - Roblox Playtime Tracker
 * Author: Javier
 * Description: A Discord bot that fetches a player's total playtime from a Roblox DataStore 
 *              via Open Cloud API and replies with a private, stylized embed.
 * Version: 1.0.0
 */

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// --- CONFIGURATION ---
// In production, it's highly recommended to use environment variables (process.env)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'MTUxMzI0OTUzODMxODUzMjc0OQ.GFM3oe.3h1JV74JBCEpLwvXHKPIaIoKPUwi-j-X4HfybA';
const CLIENT_ID = process.env.CLIENT_ID || '1513249538318532749';
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || '';
const UNIVERSE_ID = process.env.UNIVERSE_ID || 'YOUR_ROBLOX_UNIVERSE_ID';
const DATASTORE_NAME = 'TiempoJugadoDS_v1';

// Initialize Discord Client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- REGISTER SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder()
        .setName('playtime')
        .setDescription('Check a user\'s total playtime in the Roblox game.')
        .addStringOption(option =>
            option.setName('roblox_id')
                .setDescription('The numerical Roblox User ID')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('[Bot] Refreshing application (/) commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('[Bot] Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('[Bot Error] Error registering commands:', error);
    }
})();

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'playtime') {
        const robloxUserId = interaction.options.getString('roblox_id');

        // Validation: Ensure the input consists only of numbers
        if (isNaN(robloxUserId)) {
            return await interaction.reply({ 
                content: '❌ **Invalid ID:** Please provide a valid numerical Roblox User ID.', 
                ephemeral: true 
            });
        }

        // Defer reply immediately to prevent Discord interaction timeout, setting ephemeral to true
        await interaction.deferReply({ ephemeral: true });

        const dataStoreKey = `Jugador_${robloxUserId}`;
        const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${dataStoreKey}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'x-api-key': ROBLOX_API_KEY }
            });

            // Case 1: Player has no saved data yet
            if (response.status === 404) {
                const noDataEmbed = new EmbedBuilder()
                    .setColor('#FFCC00')
                    .setTitle('🎮 Playtime Record Not Found')
                    .setDescription(`The user with ID \`${robloxUserId}\` hasn't played the game yet or their data hasn't been saved.`)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [noDataEmbed] });
            }

            // Case 2: API error from Roblox side
            if (!response.ok) {
                throw new Error(`Roblox API returned status ${response.status}`);
            }

            // Get total seconds from DataStore
            const totalSeconds = await response.json();
            
            // Time math calculations
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);

            // Fetch player's avatar thumbnail from Roblox API for the embed (Optional but looks great)
            const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUserId}&size=150x150&format=Png&isCircular=false`;
            let thumbnailUrl = 'https://images.rbxcdn.com/251a1da43c7df9d94be900e84aa60de3.png'; // Default Roblox logo fallback
            
            try {
                const avatarRes = await fetch(avatarUrl);
                const avatarData = await avatarRes.json();
                if (avatarData.data && avatarData.data[0]) {
                    thumbnailUrl = avatarData.data[0].imageUrl;
                }
            } catch (e) {
                console.log('[Bot Warning] Could not fetch Roblox avatar thumbnail.');
            }

            // Create the Success Private Embed
            const successEmbed = new EmbedBuilder()
                .setColor('#00AAFF')
                .setTitle('📊 Player Playtime Stats')
                .setThumbnail(thumbnailUrl)
                .addFields(
                    { name: '👤 Roblox User ID', value: `\`${robloxUserId}\``, inline: true },
                    { name: '⏱️ Time Tracked', value: `**${hours} hours** and **${minutos} minutes**`, inline: true }
                )
                .setFooter({ text: 'Data directly fetched from Roblox Cloud' })
                .setTimestamp();

            // Send the embed privately
            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('[Bot Error] Failed to fetch data from Roblox:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF3333')
                .setTitle('❌ Database Error')
                .setDescription('An error occurred while connecting to the Roblox database. Please check the bot logs or verify your configuration.')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
});

client.login(DISCORD_TOKEN);
              
