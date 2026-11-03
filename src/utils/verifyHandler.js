// src/utils/verifyHandler.js
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { getRobloxUserByDiscord } from './bloxlink.js';
import { saveVerifiedUser } from './verifyStorage.js';
import { syncRoles } from './rankSync.js';

const pendingVerifications = new Map();
const WORDS = ['share', 'melon', 'profit', 'give', 'climb', 'repair', 'hug', 'sun', 'moon', 'star', 'tree', 'river', 'fire', 'wind', 'cloud', 'rain'];

function generateCode() {
  return Array.from({ length: 6 }, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join(' ');
}

export async function handleVerifyButton(interaction) {
  if (interaction.customId === 'verify_bloxlink') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const bloxlinkData = await getRobloxUserByDiscord(interaction.user.id);
    
    if (!bloxlinkData || !bloxlinkData.robloxID) {
      return interaction.editReply({ content: '❌ Hmm... I can\'t find the account you verified using Bloxlink... Try using the **About Me Code** verification option.' });
    }

    saveVerifiedUser(interaction.user.id, bloxlinkData.robloxID, bloxlinkData.primaryAccount);
    const syncResult = await syncRoles(interaction.member, bloxlinkData.robloxID);

    const container = new ContainerBuilder()
      .setAccentColor(0x57F287)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ **Successfully Verified!**`))
      .addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `> Linked your Roblox account \`${bloxlinkData.primaryAccount || bloxlinkData.robloxID}\` successfully.\n\n` +
        (syncResult.success ? `> Role **${syncResult.roleName}** given!` : `> ⚠️ ${syncResult.reason}`)
      ));
    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }

  if (interaction.customId === 'verify_aboutme') {
    const modal = new ModalBuilder().setCustomId('verify_aboutme_modal').setTitle('Roblox Verification');
    const usernameInput = new TextInputBuilder()
      .setCustomId('roblox_username')
      .setLabel('What is your Roblox Username?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Ejemplo: Cmsmalaxno');
    modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'verify_check_code') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const pending = pendingVerifications.get(interaction.user.id);
    if (!pending) return interaction.editReply({ content: '❌ No tienes una verificación pendiente o el código expiró.' });

    try {
      const robloxRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [pending.robloxUsername], excludeBannedUsers: true })
      });
      const robloxData = await robloxRes.json();
      
      if (!robloxData.data || robloxData.data.length === 0) return interaction.editReply({ content: '❌ No se encontró ese usuario de Roblox. Revisa que esté bien escrito.' });

      const robloxId = robloxData.data[0].id;
      const profileRes = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
      const profileData = await profileRes.json();

      if (profileData.description && profileData.description.includes(pending.code)) {
        pendingVerifications.delete(interaction.user.id);
        saveVerifiedUser(interaction.user.id, robloxId, pending.robloxUsername);
        const syncResult = await syncRoles(interaction.member, robloxId);

        const successContainer = new ContainerBuilder()
          .setAccentColor(0x57F287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ **Verification Successful!**`))
          .addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `> Linked your Roblox account \`${pending.robloxUsername}\` (${robloxId}) successfully.\n\n` +
            (syncResult.success ? `> Role **${syncResult.roleName}** given!` : `> ⚠️ ${syncResult.reason}`)
          ));
        return interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
      } else {
        return interaction.editReply({ content: '❌ El código no se encontró en tu About Me. Asegúrate de haberlo pegado exactamente como se muestra y sin texto extra.' });
      }
    } catch (err) {
      return interaction.editReply({ content: '❌ Hubo un error al verificar con Roblox.' });
    }
  }

  if (interaction.customId === 'verify_cancel') {
    pendingVerifications.delete(interaction.user.id);
    return interaction.update({ content: '❌ Verificación cancelada.', components: [], embeds: [] });
  }
}

export async function handleVerifyModal(interaction) {
  if (interaction.customId === 'verify_aboutme_modal') {
    const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const code = generateCode();
    pendingVerifications.set(interaction.user.id, { code, robloxUsername, expiresAt: Date.now() + 10 * 60 * 1000 });

    for (const [key, val] of pendingVerifications.entries()) {
      if (Date.now() > val.expiresAt) pendingVerifications.delete(key);
    }

    const container = new ContainerBuilder()
      .setAccentColor(0x2B2D31)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`\n${robloxUsername}\n\`\`\``))
      .addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `> Please paste the **code** in the following user's Roblox **About Me** section. After that, please execute the command again to get **verified** or use the buttons on this message.\n\n` +
        `⚠️ **Warning:** Make sure you only have **these words** in your About Me and **nothing else**. The code will become invalid after **10 minutes**.`
      ))
      .addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Username** × ${robloxUsername}\n\n**Code for your About Me:**\n\`\`\`\n${code}\n\`\`\``))
      .addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify_check_code').setLabel('Verify').setEmoji('🔍').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('verify_cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Danger)
      ));

    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  }
}