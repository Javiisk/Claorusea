// src/events/guildMemberAdd.js
import { Events } from 'discord.js';
import { buildWelcomeMessage } from '../utils/welcomeMessage.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const channelId = process.env.WELCOME_CHANNEL_ID;

    if (!channelId) {
      console.warn('⚠️ WELCOME_CHANNEL_ID is not set — skipping welcome message.');
      return;
    }

    const channel = await member.guild.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      console.error(`❌ Could not find/access the welcome channel with ID ${channelId}.`);
      return;
    }

    await channel.send(buildWelcomeMessage(member)).catch((error) => {
      console.error('❌ Failed to send the welcome message:', error);
    });
  },
};
