import {
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} from 'discord.js';

// Handles an incoming message: if it's a DM to the bot, logs it into
// DM_LOG_CHANNEL_ID (using a Components V2 container) and sends a
// confirmation reply to the user.
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
      const container = new ContainerBuilder()
        .setAccentColor(0x22194D)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### 📩 New Direct Message\n**From:** ${message.author.tag} (\`${message.author.id}\`)`,
          ),
        )
        .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(message.content || '*No text content*'),
        );

      // Split attachments into images (shown in a media gallery) and other
      // files (listed as plain links), since Components V2 has no .setImage().
      if (message.attachments.size > 0) {
        const imageAttachments = message.attachments.filter((a) => a.contentType?.startsWith('image/'));
        const otherAttachments = message.attachments.filter((a) => !a.contentType?.startsWith('image/'));

        if (imageAttachments.size > 0) {
          const gallery = new MediaGalleryBuilder().addItems(
            imageAttachments.map((a) => new MediaGalleryItemBuilder().setURL(a.url)),
          );
          container.addMediaGalleryComponents(gallery);
        }

        if (otherAttachments.size > 0) {
          container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Other attachments (${otherAttachments.size}):**\n${otherAttachments.map((a) => a.url).join('\n')}`,
            ),
          );
        }
      }

      await logChannel
        .send({ components: [container], flags: MessageFlags.IsComponentsV2 })
        .catch((error) => {
          console.error('❌ Failed to send the log message:', error);
        });
    }
  }

  // Let the user know their message was received.
  await message
    .reply('You message has been logged.')
    .catch(() => {
      // Reply can fail if the user has DMs closed after sending — safe to ignore.
    });
}
