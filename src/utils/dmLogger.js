import { ChannelType, EmbedBuilder } from 'discord.js';

// Handles an incoming message: if it's a DM to the bot, logs it into
// DM_LOG_CHANNEL_ID and sends a confirmation reply to the user.
// Called as handleDM(client, message) from app.js's messageCreate listener.
export async function handleDM(client, message) {
  // Ignore messages from bots (including this bot itself) to avoid loops.
  if (message.author.bot) return;

  // message.channel.type is DM only for Direct Messages.
  const isDM = message.channel.type === ChannelType.DM;
  if (!isDM) return;

  console.log(`📩 DM from ${message.author.tag}: ${message.content}`);

  const logChannelId = process.env.DM_LOG_CHANNEL_ID;

  if (!logChannelId) {
    console.warn('⚠️ DM_LOG_CHANNEL_ID is not set — DM was received but not logged anywhere.');
  } else {
    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);

    if (!logChannel) {
      console.error(`❌ Could not find/access the log channel with ID ${logChannelId}.`);
    } else {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({
          name: `${message.author.tag} (${message.author.id})`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTitle('📩 New Direct Message')
        .setDescription(message.content || '*No text content*')
        .setTimestamp();

      // If the DM includes images/files, attach the first one as a preview
      // and list every attachment as a field.
      if (message.attachments.size > 0) {
        const firstAttachment = message.attachments.first();
        if (firstAttachment.contentType?.startsWith('image/')) {
          embed.setImage(firstAttachment.url);
        }

        embed.addFields({
          name: `Attachments (${message.attachments.size})`,
          value: message.attachments.map((a) => a.url).join('\n'),
        });
      }

      await logChannel.send({ embeds: [embed] }).catch((error) => {
        console.error('❌ Failed to send the log message:', error);
      });
    }
  }

  // Let the user know their message was received.
  await message.reply(
    "Thanks for your message! It's been forwarded to our team and someone will get back to you soon.",
  ).catch(() => {
    // Reply can fail if the user has DMs closed after sending — safe to ignore.
  });
}
