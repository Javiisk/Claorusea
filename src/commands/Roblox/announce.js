// src/commands/Roblox/announce.js
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export default {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Generate a DS-genre style announcement with AI')
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('style')
        .setDescription('Type of announcement')
        .setRequired(true)
        .addChoices(
          { name: '🍳 Breakfast', value: 'breakfast' },
          { name: '🍔 Lunch', value: 'lunch' },
          { name: '🍽️ Dinner', value: 'dinner' },
          { name: '🌙 Lights Out', value: 'lightsout' },
          { name: '🔒 Lockdown', value: 'lockdown' },
          { name: '📋 Roll Call', value: 'rollcall' },
          { name: '🏃 Free Time', value: 'freetime' },
          { name: '🚿 Shower Time', value: 'shower' },
          { name: '🏋️ Yard Time', value: 'yard' },
          { name: '🚨 Emergency', value: 'emergency' },
        ))
    .addIntegerOption(opt =>
      opt.setName('length')
        .setDescription('Approximate number of characters (100-2000)')
        .setRequired(true)
        .setMinValue(100)
        .setMaxValue(2000))
    .addStringOption(opt =>
      opt.setName('build')
        .setDescription('Type of facility')
        .setRequired(true)
        .addChoices(
          { name: '🔒 Prison', value: 'prison' },
          { name: '🏥 Asylum', value: 'asylum' },
          { name: '🏫 Institute', value: 'institute' },
          { name: '🏠 Orphanage', value: 'orphanage' },
          { name: '⛪ Monastery', value: 'monastery' },
          { name: '🏕️ Boot Camp', value: 'bootcamp' },
        ))
    .addStringOption(opt =>
      opt.setName('extra')
        .setDescription('Optional extra context')
        .setRequired(false)
        .setMaxLength(500))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply();

    const style = interaction.options.getString('style');
    const length = interaction.options.getInteger('length');
    const build = interaction.options.getString('build');
    const extra = interaction.options.getString('extra') || '';

    if (!GROQ_API_KEY) {
      return interaction.editReply({
        content: '❌ Missing `GROQ_API_KEY` in environment variables.',
      });
    }

    const prompt = buildPrompt(style, length, build, extra);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a facility announcer in a Roblox DS-genre game. You address people over the intercom in a serious, authoritative, slightly theatrical tone. You never break character. You never use emojis.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.9,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return interaction.editReply({
          content: `❌ Groq error (${response.status}): ${err.error?.message || 'Unknown'}`,
        });
      }

      const data = await response.json();
      const announcement = data.choices?.[0]?.message?.content?.trim();

      if (!announcement) {
        return interaction.editReply({ content: '❌ AI returned an empty response.' });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📢 ${capitalize(style)} — ${capitalize(build)}`)
        .setDescription(announcement)
        .setFooter({ text: `Requested by ${interaction.user.tag} • ${announcement.length} chars` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      if (announcement.length < 1900) {
        await interaction.followUp({
          content: `\`\`\`\n${announcement}\n\`\`\``,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Announce error:', error);
      await interaction.editReply({ content: `❌ Error: ${error.message}` });
    }
  },
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildPrompt(style, length, build, extra) {
  const facilityMap = {
    prison: { type: 'prison', people: 'inmates', staff: 'guards', uniform: 'uniform' },
    asylum: { type: 'asylum', people: 'patients', staff: 'nurses', uniform: 'patient gown' },
    institute: { type: 'institute', people: 'subjects', staff: 'researchers', uniform: 'uniform' },
    orphanage: { type: 'orphanage', people: 'orphans', staff: 'caretakers', uniform: 'uniform' },
    monastery: { type: 'monastery', people: 'monks', staff: 'elders', uniform: 'robe' },
    bootcamp: { type: 'boot camp', people: 'recruits', staff: 'drill sergeants', uniform: 'uniform' },
  };

  const facility = facilityMap[build] || facilityMap.prison;

  const contextMap = {
    breakfast: `announcing breakfast time. ${facility.people} must go to the cafeteria in ${facility.uniform}. Mention the food (eggs, toast, coffee, etc).`,
    lunch: `announcing lunch time. ${facility.people} must go to the cafeteria in ${facility.uniform}. Mention the food (burgers, sandwiches, juice, etc).`,
    dinner: `announcing dinner time. ${facility.people} must go to the cafeteria in ${facility.uniform}. Mention the food (pasta, chicken, vegetables, etc).`,
    lightsout: `announcing lights out. All ${facility.people} must return to their cells immediately. No talking after the announcement.`,
    lockdown: `announcing a lockdown. All ${facility.people} must return to their cells immediately. No movement allowed. ${facility.staff} will be patrolling.`,
    rollcall: `announcing roll call. All ${facility.people} must line up for attendance. ${facility.staff} will verify.`,
    freetime: `announcing free time. ${facility.people} may roam designated areas. No fighting, no contraband.`,
    shower: `announcing shower time. ${facility.people} must proceed to the showers in an orderly line.`,
    yard: `announcing yard time. ${facility.people} may go outside to the yard. No weapons, no gang activity.`,
    emergency: `announcing an emergency. All ${facility.people} must remain calm and stay where they are. ${facility.staff} is handling the situation.`,
  };

  return `You are the announcer for a ${facility.type} in a Roblox DS-genre game. You address ${facility.people} over the intercom with a serious, authoritative, slightly theatrical tone.

Context: ${contextMap[style] || style}

CRITICAL REQUIREMENTS:
- The announcement MUST be approximately ${length} characters long. Not less than ${Math.floor(length * 0.85)} and not more than ${Math.floor(length * 1.15)}.
- Address them as "${facility.people}".
- Do NOT use emojis.
- Do NOT add quotation marks or preamble. Output ONLY the announcement text.
- End with a clear closing line (e.g. "See you at the cafeteria, ${facility.people}." or "That is all. Dismissed.").
${extra ? `\nExtra context: ${extra}` : ''}

Write ONLY the announcement, nothing else.`;
}