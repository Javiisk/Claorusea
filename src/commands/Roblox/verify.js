// src/commands/Roblox/verify.js
import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your Roblox account to get your roles'),

  async execute(interaction) {
    const container = new ContainerBuilder()
      .setAccentColor(0x2B2D31)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Hey there, <@${interaction.user.id}>, welcome to **Adoresa!**`))
      .addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `I see you're trying to **verify** your account on this server, great choice!\n\n` +
        `Our bot offers multiple **verification** options for you. Select your preferred verification method below using the buttons.`
      ))
      .addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**Options:**\n` +
        `> **About Me Code** -> This option provides a code consisting of words that you need to place in your 'About Me' section on your Roblox profile.\n` +
        `> **Bloxlink Verification** -> This option works only if you are verified with Bloxlink. Simply click the button, and you should be verified within 5 seconds.`
      ))
      .addSeparatorComponents(sep => sep.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`*Thank you for joining us!*`))
      .addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify_aboutme').setLabel('About Me Code').setEmoji('📋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('verify_bloxlink').setLabel('Bloxlink Verification').setEmoji('🤖').setStyle(ButtonStyle.Secondary)
      ));

    await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  },
};