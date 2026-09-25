// src/utils/leveling.js
import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } from 'discord.js';
import { getUserData, saveUserData } from './economyStorage.js';

const LEVELUP_CHANNEL_ID = process.env.LEVELUP_CHANNEL_ID || '1547001576454094878';
const MAX_ASCENSION_ROLE_ID = process.env.MAX_ASCENSION_ROLE_ID || '1552410309493522504';
const MAX_ASCENSION_LEVEL = 15;
const XP_COOLDOWN_MS = 60 * 1000; // 1 minute between messages that grant XP

// How much XP is needed to go from `ascension` to `ascension + 1`.
export function xpForNextAscension(ascension) {
  return 5 * ascension * ascension + 50 * ascension + 100;
}

// Call this from messageCreate for every non-bot guild message.
export async function handleMessageXp(message) {
  if (message.author.bot || !message.guild) return;

  const data = getUserData(message.author.id);
  const now = Date.now();

  if (now - data.lastMessageXp < XP_COOLDOWN_MS) return;

  const gained = Math.floor(Math.random() * 11) + 15; // 15-25 XP
  data.xp += gained;
  data.lastMessageXp = now;

  let leveledUp = false;

  while (data.xp >= xpForNextAscension(data.ascension)) {
    data.xp -= xpForNextAscension(data.ascension);
    data.ascension += 1;
    leveledUp = true;
  }

  saveUserData(message.author.id, data);

  if (leveledUp) {
    await announceAscension(message, data);
  }
}

async function announceAscension(message, data) {
  const channel = await message.client.channels.fetch(LEVELUP_CHANNEL_ID).catch(() => null);

  if (channel) {
    const container = new ContainerBuilder()
      .setAccentColor(null)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🌠 Ascension!'))
      .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `<@${message.author.id}> has reached **Ascension ${data.ascension}**!`,
        ),
      );

    await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  }

  if (data.ascension >= MAX_ASCENSION_LEVEL) {
    const member = message.member;
    if (member && !member.roles.cache.has(MAX_ASCENSION_ROLE_ID)) {
      await member.roles.add(MAX_ASCENSION_ROLE_ID).catch(() => {});
    }
  }
}
