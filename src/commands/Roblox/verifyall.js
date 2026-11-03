// src/commands/Roblox/verifyall.js
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getVerifiedUser } from '../../utils/verifyStorage.js';
import { getRobloxUserByDiscord } from '../../utils/bloxlink.js';
import { syncRoles } from '../../utils/rankSync.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verifyall')
    .setDescription('Force update all members\' roles based on their Roblox rank')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const members = await interaction.guild.members.fetch();
    let updated = 0;
    let skipped = 0;

    await interaction.editReply({ content: `⏳ Verifying **${members.size}** members...` });

    for (const [id, member] of members) {
      if (member.user.bot) continue;

      let robloxId = null;
      const localData = getVerifiedUser(id);
      
      if (localData) {
        robloxId = localData.robloxId;
      } else {
        const bloxlinkData = await getRobloxUserByDiscord(id);
        if (bloxlinkData && bloxlinkData.robloxID) robloxId = bloxlinkData.robloxID;
      }

      if (!robloxId) { skipped++; continue; }

      const result = await syncRoles(member, robloxId);
      if (result.success) updated++;
      
      await new Promise(r => setTimeout(r, 500));
    }

    await interaction.editReply({ content: `✅ Updated **${updated}** members. Skipped **${skipped}** (not verified).` });
  },
};