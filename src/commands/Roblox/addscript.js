// src/commands/Roblox/addscript.js
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('addscript')
    .setDescription('Create or update a script in your Roblox game from a .lua file')
    .addAttachmentOption(opt =>
      opt.setName('file')
        .setDescription('The .lua file with the script code')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name of the script in Roblox')
        .setRequired(true)
        .setMaxLength(100))
    .addStringOption(opt =>
      opt.setName('script_type')
        .setDescription('Type of script')
        .setRequired(true)
        .addChoices(
          { name: 'ServerScript', value: 'Script' },
          { name: 'LocalScript', value: 'LocalScript' },
          { name: 'ModuleScript', value: 'ModuleScript' },
        ))
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
        ))
    .addStringOption(opt =>
      opt.setName('universe_id').setDescription('Universe ID').setRequired(true))
    .addStringOption(opt =>
      opt.setName('place_id').setDescription('Place ID').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const file = interaction.options.getAttachment('file');
    const scriptName = interaction.options.getString('name');
    const scriptType = interaction.options.getString('script_type');
    const location = interaction.options.getString('location');
    const universeId = interaction.options.getString('universe_id');
    const placeId = interaction.options.getString('place_id');
    const apiKey = process.env.ROBLOX_API_KEY;

    if (!apiKey) return interaction.editReply({ content: '❌ Missing `ROBLOX_API_KEY`.' });

    if (!file.name.endsWith('.lua') && !file.name.endsWith('.luau') && !file.name.endsWith('.txt')) {
      return interaction.editReply({ content: '❌ File must be `.lua`, `.luau` or `.txt`.' });
    }

    let source;
    try {
      const fileRes = await fetch(file.url);
      if (!fileRes.ok) throw new Error(`Download failed: ${fileRes.status}`);
      source = await fileRes.text();
    } catch (e) {
      return interaction.editReply({ content: `❌ Could not download file: ${e.message}` });
    }

    if (!source) return interaction.editReply({ content: '❌ The file is empty.' });

    const base = `https://apis.roblox.com/cloud/v2/universes/${universeId}/places/${placeId}`;
    const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 — Create the script and return its Roblox Instance ID as output
    // ═══════════════════════════════════════════════════════════════════════

    // Escape source for embedding in Luau long-string
    // We use long-bracket syntax so the source can contain anything except "]==]"
    const escapedSource = source.includes(']==]') ? source.replace(/]==]/g, ']== ]') : source;

    const createCode = `
local parent = game:GetService("${location}")
if "${location}" == "StarterPlayerScripts" or "${location}" == "StarterCharacterScripts" then
    parent = game:GetService("StarterPlayer"):FindFirstChild("${location}")
end

local existing = parent:FindFirstChild("${scriptName}")
if existing then existing:Destroy() end

local s = Instance.new("${scriptType}")
s.Name = "${scriptName}"
s.Source = [==[
${escapedSource}
]==]
s.Parent = parent

-- Return the new Instance ID so the bot can use it for future updates
return tostring(s:GetDebugId())
`;

    let createRes;
    try {
      createRes = await fetch(`${base}/luau-execution-session-tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ script: createCode, timeout: '300s' }),
      });
    } catch (e) {
      return interaction.editReply({ content: `❌ Network error in step 1: ${e.message}` });
    }

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return interaction.editReply({
        content: `❌ Step 1 failed (${createRes.status}): ${err.message || JSON.stringify(err)}`,
      });
    }

    const taskData = await createRes.json();
    const taskPath = taskData.path;

    let finalState = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(`https://apis.roblox.com/cloud/v2/${taskPath}`, {
        headers: { 'x-api-key': apiKey },
      });
      if (pollRes.ok) {
        const data = await pollRes.json();
        if (data.state === 'COMPLETE' || data.state === 'FAILED') {
          finalState = data;
          break;
        }
      }
    }

    if (!finalState) return interaction.editReply({ content: '⏳ Step 1 timed out.' });

    if (finalState.state === 'FAILED') {
      return interaction.editReply({
        content: `❌ Script execution failed:\n\`\`\`\n${JSON.stringify(finalState.error || finalState, null, 2).slice(0, 1500)}\n\`\`\``,
      });
    }

    // Try to extract the Instance ID from the task output
    const output = finalState.output?.text || finalState.output?.returnValue || '';
    const idMatch = String(output).match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    const instanceId = idMatch ? idMatch[0] : null;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Script Created')
      .addFields(
        { name: '📄 File', value: `\`${file.name}\``, inline: true },
        { name: '📂 Roblox Name', value: `\`${scriptName}\``, inline: true },
        { name: '📦 Type', value: scriptType, inline: true },
        { name: '📍 Location', value: location, inline: true },
        { name: '📏 Size', value: `${source.length} chars`, inline: true },
        {
          name: '🆔 Instance ID',
          value: instanceId ? `\`${instanceId}\`` : '⚠️ Not returned by Roblox',
          inline: false,
        },
      )
      .setFooter({ text: 'Script is now live in your game.' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    console.log(`[AddScript] ${interaction.user.tag} → ${scriptName}`);
  },
};