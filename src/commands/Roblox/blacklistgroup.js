import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GROUPS_PATH = join(__dirname, '../../../../blacklisted-groups.json');

// 🔥 ID DEL CANAL DONDE ESTARÁ EL EMBED
const TARGET_CHANNEL_ID = '1502421151123509300';

const ALLOWED_ROLES = [
  '1505673879069393024',
  '1505673808097574912',
  '1505671309915328713',
  '1505671296883757158',
  '1505671292873867544',
];

function loadGroups() {
  if (!existsSync(GROUPS_PATH)) writeFileSync(GROUPS_PATH, JSON.stringify([]));
  return JSON.parse(readFileSync(GROUPS_PATH, 'utf8'));
}

function saveGroups(groups) {
  writeFileSync(GROUPS_PATH, JSON.stringify(groups, null, 2));
}

async function getRobloxGroupInfo(groupId) {
  try {
    const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);
    const data = await res.json();
    return data?.name ? data : null;
  } catch { return null; }
}

// 🔥 Genera el embed con el formato exacto que pediste
function generateBlacklistEmbed(groups) {
  // Separamos los que son de Geisha (para el primer bloque) y los que no
  const geishaGroups = groups.filter(g => g.name !== 'la vélvoria');
  const otherGroups = groups.filter(g => g.name === 'la vélvoria');

  let description = `> **Before you can play and visit our amazing islands, these groups are blacklisted! If you are one of the owners of this group and your blacklist is appealable, open a ticket.**\n\n`;

  // Bloque 1: Grupos de Geisha
  geishaGroups.forEach(g => {
    const status = g.appealable === true ? 'Appealable' : 'Not appealable';
    description += `> *${g.name}* - **${status}**\n`;
  });

  description += `\n> **All the blacklisted groups mentioned were created by Geisha except Empyreum, which was gifted to Geisha! If geisha sold you one of these you can appeal! Any other community created by a geisha will automatically be blacklisted.**\n`;
  description += `> -# Other blacklist not owned by geisha.\n\n`;

  // Bloque 2: Otros grupos
  otherGroups.forEach(g => {
    const status = g.appealable === true ? 'Appealable' : 'Not appealable';
    description += `> *${g.name}* - **${status}**\n`;
  });

  description += `\n> -# Leave this communities to be able to freely play our game and its future games, note that we have a professional moderation system if detects you are evading blacklist or evading ban you will be Immediately perm banned from server, reasons of blacklists on tickets.`;

  return new EmbedBuilder()
    .setTitle('Adoresa Blacklisted Groups')
    .setDescription(description)
    .setColor(3F3F3F)
    .setTimestamp();
}

export default {
  data: new SlashCommandBuilder()
    .setName('blacklistgroup')
    .setDescription('Add or remove a Roblox group from the blacklist 🚫')
    .addStringOption(opt =>
      opt.setName('groupid').setDescription('Roblox group ID').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('appealable')
        .setDescription('Is this group appealable?')
        .setRequired(true)
        .addChoices(
          { name: '✅ Appealable', value: 'true' },
          { name: '❌ Not appealable', value: 'false' }
        )
    )
    .addStringOption(opt =>
      opt.setName('action').setDescription('Add or remove').setRequired(true)
        .addChoices(
          { name: '🚫 Blacklist', value: 'add' },
          { name: '✅ Remove', value: 'remove' },
        )
    ),

  async execute(interaction) {
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));
    if (!hasRole) {
      return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', ephemeral: true });
    }

    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) {
      logger.warn('BlacklistGroup interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId, commandName: 'blacklistgroup' });
      return;
    }

    try {
      const groupId = interaction.options.getString('groupid');
      const action = interaction.options.getString('action');
      const appealable = interaction.options.getString('appealable') === 'true';
      
      const groupInfo = await getRobloxGroupInfo(groupId);
      if (!groupInfo) return await InteractionHelper.safeEditReply(interaction, { content: '❌ Group not found on Roblox.' });

      const groups = loadGroups();
      const exists = groups.find(g => g.id === groupId);

      let replyMessage = '';

      if (action === 'add') {
        if (exists) return await InteractionHelper.safeEditReply(interaction, { content: `⚠️ **${groupInfo.name}** is already blacklisted.` });
        
        groups.push({ id: groupId, name: groupInfo.name, appealable: appealable });
        saveGroups(groups);
        
        const statusText = appealable ? 'Appealable' : 'Not appealable';
        replyMessage = `✅ Added **${groupInfo.name}** to the blacklist as **${statusText}**.`;
      } 
      else if (action === 'remove') {
        if (!exists) return await InteractionHelper.safeEditReply(interaction, { content: `⚠️ **${groupInfo.name}** is not blacklisted.` });
        const removedName = exists.name;
        saveGroups(groups.filter(g => g.id !== groupId));
        replyMessage = `✅ Removed **${removedName}** from the blacklist.`;
      }

      // 🔥 ACTUALIZAR O ENVIAR EL EMBED EN EL CANAL
      const channel = interaction.client.channels.cache.get(TARGET_CHANNEL_ID);
      if (channel) {
        const newEmbed = generateBlacklistEmbed(loadGroups()); // Recargamos la lista actualizada
        
        // Buscar si ya hay un mensaje del bot en ese canal con el título correcto
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMsg = messages.find(m => 
          m.author.id === interaction.client.user.id && 
          m.embeds.length > 0 && 
          m.embeds[0].title === 'Adoresa Blacklisted Groups'
        );

        if (botMsg) {
          // Si ya existe, lo editamos
          await botMsg.edit({ embeds: [newEmbed] });
        } else {
          // Si no existe, lo enviamos
          await channel.send({ embeds: [newEmbed] });
        }
      } else {
        logger.warn(`[BlacklistGroup] Channel ID ${TARGET_CHANNEL_ID} not found.`);
      }

      // Responder al moderador en el chat
      return await InteractionHelper.safeEditReply(interaction, { content: replyMessage });

    } catch (error) {
      logger.error('BlacklistGroup command error:', error);
      try { return await InteractionHelper.safeReply(interaction, { content: '❌ An error occurred.' }); } catch (e) { logger.error('Failed to send error reply:', e); }
    }
  },
};