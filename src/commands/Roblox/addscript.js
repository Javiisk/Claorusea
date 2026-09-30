// src/commands/roblox/addscript.js
import { 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  EmbedBuilder 
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('addscript')
    .setDescription('Create a new script inside your Roblox game via Luau Execution')
    .addStringOption(opt =>
      opt.setName('script_type')
        .setDescription('Type of script to create')
        .setRequired(true)
        .addChoices(
          { name: 'ServerScript', value: 'Script' },
          { name: 'LocalScript', value: 'LocalScript' },
          { name: 'ModuleScript', value: 'ModuleScript' }
        ))
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name of the script')
        .setRequired(true)
        .setMaxLength(100))
    .addStringOption(opt =>
      opt.setName('location')
        .setDescription('Where to place the script')
        .setRequired(true)
        .addChoices(
          { name: 'ServerScriptService', value: 'ServerScriptService' },
          { name: 'ReplicatedStorage', value: 'ReplicatedStorage' },
          { name: 'Workspace', value: 'Workspace' },
          { name: 'StarterPlayerScripts', value: 'StarterPlayerScripts' },
          { name: 'StarterCharacterScripts', value: 'StarterCharacterScripts' },
          { name: 'StarterGui', value: 'StarterGui' },
          { name: 'SoundService', value: 'SoundService' },
        ))
    .addStringOption(opt =>
      opt.setName('source')
        .setDescription('Luau code for the script')
        .setRequired(true)
        .setMaxLength(6000))
    .addStringOption(opt =>
      opt.setName('universe_id')
        .setDescription('Universe ID of the game')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('place_id')
        .setDescription('Place ID of the place')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const scriptType = interaction.options.getString('script_type');
    const scriptName = interaction.options.getString('name');
    const location = interaction.options.getString('location');
    const source = interaction.options.getString('source');
    const universeId = interaction.options.getString('universe_id');
    const placeId = interaction.options.getString('place_id');
    const apiKey = process.env.ROBLOX_API_KEY;

    if (!apiKey) {
      return interaction.editReply({ content: '❌ Missing `ROBLOX_API_KEY` in environment.' });
    }

    // ─── Construir el código Luau que se ejecutará ──────────────────────
    const luauCode = `
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterPlayer = game:GetService("StarterPlayer")
local StarterGui = game:GetService("StarterGui")
local Workspace = game:GetService("Workspace")
local SoundService = game:GetService("SoundService")

local locationName = "${location}"
local target

if locationName == "ServerScriptService" then
    target = ServerScriptService
elseif locationName == "ReplicatedStorage" then
    target = ReplicatedStorage
elseif locationName == "Workspace" then
    target = Workspace
elseif locationName == "StarterPlayerScripts" then
    target = StarterPlayer:WaitForChild("StarterPlayerScripts")
elseif locationName == "StarterCharacterScripts" then
    target = StarterPlayer:WaitForChild("StarterCharacterScripts")
elseif locationName == "StarterGui" then
    target = StarterGui
elseif locationName == "SoundService" then
    target = SoundService
else
    target = ServerScriptService
end

-- Verify the script doesn't already exist
local existing = target:FindFirstChild("${scriptName}")
if existing then
    existing:Destroy()
end

local newScript = Instance.new("${scriptType}")
newScript.Name = "${scriptName}"
newScript.Source = [==[
${source}
]==]
newScript.Parent = target

-- Save the place so changes persist
game:GetService("DataModel"):GetService("ServerScriptService") -- touch
local success, err = pcall(function()
    game:SavePlaceAsync()
end)

if success then
    return "OK:Created " .. newScript:GetFullName()
else
    return "PARTIAL:Created but not saved: " .. tostring(err)
end
`;

    try {
      // ─── 1. Crear la tarea de Luau Execution ─────────────────────────
      const createRes = await fetch(
        `https://apis.roblox.com/cloud/v2/universes/${universeId}/places/${placeId}/luau-execution-session-tasks`,
        {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            script: luauCode,
            timeout: "300s",
          }),
        }
      );

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        console.error('Luau Execution Error:', err);
        return interaction.editReply({
          content: `❌ Error creating task (${createRes.status}): ${err.message || JSON.stringify(err)}`
        });
      }

      const taskData = await createRes.json();
      const taskPath = taskData.path;

      // ─── 2. Polling hasta que la tarea termine ───────────────────────
      let attempts = 0;
      const maxAttempts = 40;
      let finalState = null;

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;

        const pollRes = await fetch(
          `https://apis.roblox.com/cloud/v2/${taskPath}`,
          { headers: { 'x-api-key': apiKey } }
        );

        if (pollRes.ok) {
          const pollData = await pollRes.json();
          if (pollData.state === 'COMPLETE' || pollData.state === 'FAILED') {
            finalState = pollData;
            break;
          }
        }
      }

      if (!finalState) {
        return interaction.editReply({
          content: '⏳ La tarea está tardando demasiado. Verifica tu juego en unos segundos.'
        });
      }

      if (finalState.state === 'FAILED') {
        return interaction.editReply({
          content: `❌ La ejecución falló:\n\`\`\`\n${JSON.stringify(finalState.error || finalState, null, 2).slice(0, 1500)}\n\`\`\``
        });
      }

      // ─── 3. Éxito ─────────────────────────────────────────────────────
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Script Created')
        .addFields(
          { name: '📄 Name', value: `\`${scriptName}\``, inline: true },
          { name: '📂 Type', value: scriptType, inline: true },
          { name: '📍 Location', value: location, inline: true },
          { name: '🎮 Universe ID', value: `\`${universeId}\``, inline: true },
          { name: '📍 Place ID', value: `\`${placeId}\``, inline: true }
        )
        .setFooter({ text: 'Changes should appear in your game shortly.' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      console.log(`[AddScript] ${interaction.user.tag} created ${scriptName} (${scriptType}) in ${location}`);

    } catch (error) {
      console.error('Error in /addscript:', error);
      await interaction.editReply({ content: `❌ Critical error: ${error.message}` });
    }
  },
};