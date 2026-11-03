// src/commands/Roblox/getrole.js
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getVerifiedUser } from '../../utils/verifyStorage.js';
import { getRobloxUserByDiscord } from '../../utils/bloxlink.js';
import { syncRoles } from '../../utils/rankSync.js';

export default {
  data: new SlashCommandBuilder()
    .setName('getrole')
    .setDescription('Sync your Roblox rank to your Discord roles'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let robloxId = null;
    const localData = getVerifiedUser(interaction.user.id);
    
    if (localData) {
      robloxId = localData.robloxId;
    } else {
      const bloxlinkData = await getRobloxUserByDiscord(interaction.user.id);
      if (bloxlinkData && bloxlinkData.robloxID) robloxId = bloxlinkData.robloxID;
    }

    if (!robloxId) return interaction.editReply({ content: '❌ You need to verify first. Use `/verify`.' });

    const result = await syncRoles(interaction.member, robloxId);

    if (result.success) {
      await interaction.editReply({ content: `✅ Successfully synced! You received the **${result.roleName}** role.` });
    } else {
      await interaction.editReply({ content: `❌ Failed to sync: ${result.reason}` });
    }
  },
};