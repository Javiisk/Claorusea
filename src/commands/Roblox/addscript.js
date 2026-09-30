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
      opt.setName('universe_id')
        .setDescription('Universe ID')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('place_id')
        .setDescription('Place ID')
        .setRequired(true))
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

    if (!apiKey) {
      return interaction.editReply({ content: '❌ Missing `ROBLOX_API_KEY`.' });
    }

    // Validate file extension
    if (!file.name.endsWith('.lua') && !file.name.endsWith('.luau') && !file.name.endsWith('.txt')) {
      return interaction.editReply({
        content: '❌ The file must be `.lua`, `.luau` or `.txt`.'
      });
    }

    // Download and read the file
    let source;
    try {
      const fileRes = await fetch(file.url);
      if (!fileRes.ok) throw new Error(`Download failed: ${fileRes.status}`);
      source = await fileRes.text();
    } catch (e) {
      return interaction.editReply({ content: `❌ Could not download file: ${e.message}` });
    }

    if (!source || source.length === 0) {
      return interaction.editReply({ content: '❌ The file is empty.' });
    }

    const base = `https://apis.roblox.com/cloud/v2/universes/${universeId}/places/${placeId}`;
    const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1 — Create an empty placeholder script via Luau Execution
    // ═══════════════════════════════════════════════════════════════════════

    const targetService = location;
    const createCode = `
local parent = game:GetService("${targetService}")
if "${targetService}" == "StarterPlayerScripts" or "${targetService}" == "StarterCharacterScripts" then
    parent = game:GetService("StarterPlayer"):FindFirstChild("${targetService}")
end
local existing = parent:FindFirstChild("${scriptName}")
if existing then existing:Destroy() end
local s = Instance.new("${scriptType}")
s.Name = "${scriptName}"
s.Source = "-- placeholder"
s.Parent = parent
print("__CREATED__:" .. s:GetFullName())
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

    // Poll for completion
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

    if (!finalState) {
      return interaction.editReply({ content: '⏳ Step 1 timed out.' });
    }

    if (finalState.state === 'FAILED') {
      return interaction.editReply({
        content: `❌ Step 1 (create) failed:\n\`\`\`\n${JSON.stringify(finalState.error || finalState, null, 2).slice(0, 1500)}\n\`\`\``,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2 — Find the Instance ID of the newly created script
    // ═══════════════════════════════════════════════════════════════════════

    await new Promise(r => setTimeout(r, 3000));

    let instanceId = null;

    async function findByName(instancePath, depth = 0) {
      if (instanceId || depth > 8) return;
      let pageToken = null;
      do {
        const url = `${base}/instances/${instancePath}/children${pageToken ? `?pageToken=${pageToken}` : ''}`;
        const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
        if (!res.ok) return;
        const data = await res.json();
        for (const child of data.instances || []) {
          if (instanceId) return;
          if (child.name === scriptName) {
            instanceId = child.id;
            return;
          }
          if (child.hasChildren) {
            await findByName(child.id, depth + 1);
          }
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
    }

    try {
      await findByName('root');
    } catch (e) {
      // handled below
    }

    if (!instanceId) {
      return interaction.editReply({
        content: '⚠️ Script was created, but I could not find its Instance ID. Try again — the second run may find it.',
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3 — Write the real source via PATCH
    // ═══════════════════════════════════════════════════════════════════════

    const patchRes = await fetch(`${base}/instances/${instanceId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        engineInstance: {
          details: {
            script: { source },
          },
        },
      }),
    });

    const patchData = await patchRes.json().catch(() => ({}));

    if (!patchRes.ok) {
      return interaction.editReply({
        content: `❌ Step 3 (write source) failed (${patchRes.status}): ${patchData.message || JSON.stringify(patchData)}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DONE
    // ═══════════════════════════════════════════════════════════════════════

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Script Created & Written')
      .addFields(
        { name: '📄 File', value: `\`${file.name}\``, inline: true },
        { name: '📂 Roblox Name', value: `\`${scriptName}\``, inline: true },
        { name: '📦 Type', value: scriptType, inline: true },
        { name: '📍 Location', value: location, inline: true },
        { name: '📏 Size', value: `${source.length} chars`, inline: true },
        { name: '🆔 Instance ID', value: `\`${instanceId}\``, inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    console.log(`[AddScript] ${interaction.user.tag} uploaded ${file.name} → ${scriptName} (${instanceId})`);
  },
};