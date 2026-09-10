// src/utils/welcomeMessage.js
import {
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} from 'discord.js';
import { fileURLToPath } from 'url';

// Path to the decorative banner image, relative to this file.
// Place your image at: src/assets/welcome-banner.png
const BANNER_PATH = fileURLToPath(new URL('../assets/welcome-banner.png', import.meta.url));

/**
 * Builds the full welcome message payload (mention + Components V2 container)
 * ready to be sent with channel.send(...).
 *
 * @param {import('discord.js').GuildMember} member
 */
export function buildWelcomeMessage(member) {
  const attachment = new AttachmentBuilder(BANNER_PATH, { name: 'welcome-banner.png' });

  // The mention rendered as its own top-level component (NOT message
  // `content`, since content is disallowed when IsComponentsV2 is set).
  const mention = new TextDisplayBuilder().setContent(`<@${member.id}>`);

  const container = new ContainerBuilder()
    .setAccentColor(null)
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://welcome-banner.png'),
      ),
    )
    .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Welcome, Dear <@${member.id}>! Welcome to the adoresa server! Feel free to follow the guide, and we're happy to have you here.**`,
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '*⸝⸝ Remember to verify your account [here](https://discord.com/channels/1546983561306050580/1546994753940361356) This way you can unlock more channels!*',
          '',
          '*⸝⸝ Remember to read [this](https://discord.com/channels/1546983561306050580/1546994753940361356) This way you can get information and have a guide before talking on the server*',
          '',
          '*⸝⸝ Remember to visit [here](https://discord.com/channels/1546983561306050580/1546986834666590248) This way you can get roles to decorate your profile and avoid mass ping from the server.*',
        ].join('\n'),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "**I hope you feel comfortable on this server, and remember to follow the regulations to maintain a healthy environment.**",
      ),
    );

  return {
    components: [mention, container],
    flags: MessageFlags.IsComponentsV2,
    files: [attachment],
  };
}
