import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
} from 'discord.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { getColor } from '../config/bot.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidHex(str) {
    return /^#[0-9A-Fa-f]{6}$/.test(str);
}

/**
 * Parses the "fields" text parameter.
 * Format: "Name1 | Value1; Name2 | Value2"
 * Each field separated by ";", name/value separated by "|".
 */
function parseFields(raw) {
    if (!raw) return [];

    return raw
        .split(';')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .slice(0, 25)
        .map((chunk) => {
            const [namePart, ...rest] = chunk.split('|');
            const name = (namePart || 'Field').trim().slice(0, 256);
            const value = (rest.join('|') || ' ').trim().slice(0, 1024);
            return { name, value, inline: true };
        });
}

// ─── Command ───────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and send a custom embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addChannelOption((option) =>
        option
            .setName('channel')
            .setDescription('Channel to send the embed to')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName('title')
            .setDescription('Embed title (max 256 characters)')
            .setMaxLength(256)
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('description')
            .setDescription('Embed description (max 4000 characters)')
            .setMaxLength(4000)
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('color')
            .setDescription('Hex color, e.g. #5865F2')
            .setMaxLength(7)
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('image')
            .setDescription('URL of a large image (bottom of embed)')
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('thumbnail')
            .setDescription('URL of a small thumbnail image (top-right)')
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('footer')
            .setDescription('Footer text')
            .setMaxLength(2048)
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('author')
            .setDescription('Author name (shown above the title)')
            .setMaxLength(256)
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('author_icon')
            .setDescription('URL of the author icon')
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName('fields')
            .setDescription('Fields, format: Name1 | Value1; Name2 | Value2')
            .setMaxLength(1000)
            .setRequired(false)
    )
    .addBooleanOption((option) =>
        option
            .setName('timestamp')
            .setDescription('Show the current date/time in the footer')
            .setRequired(false)
    );

export async function execute(interaction) {
    try {
        await InteractionHelper.safeDefer(interaction, { ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const colorRaw = interaction.options.getString('color');
        const image = interaction.options.getString('image');
        const thumbnail = interaction.options.getString('thumbnail');
        const footer = interaction.options.getString('footer');
        const authorName = interaction.options.getString('author');
        const authorIcon = interaction.options.getString('author_icon');
        const fieldsRaw = interaction.options.getString('fields');
        const showTimestamp = interaction.options.getBoolean('timestamp') || false;

        // ─── Validation ──────────────────────────────────────────────────────

        if (!title && !description && !fieldsRaw && !image) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        'Embed Is Empty',
                        'Provide at least a `title`, `description`, `fields`, or `image` to build the embed.'
                    ),
                ],
            });
        }

        if (colorRaw && !isValidHex(colorRaw)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        'Invalid Color',
                        `\`${colorRaw}\` is not a valid hex color. Use the format \`#RRGGBB\` (e.g. \`#5865F2\`).`
                    ),
                ],
            });
        }

        if (image && !isValidUrl(image)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Invalid Image URL', 'The `image` option must be a valid `https://` URL.')],
            });
        }

        if (thumbnail && !isValidUrl(thumbnail)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Invalid Thumbnail URL', 'The `thumbnail` option must be a valid `https://` URL.')],
            });
        }

        if (authorIcon && !isValidUrl(authorIcon)) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Invalid Author Icon URL', 'The `author_icon` option must be a valid `https://` URL.')],
            });
        }

        if (!channel.isTextBased()) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Invalid Channel', 'Please choose a text-based channel.')],
            });
        }

        // ─── Build Embed ─────────────────────────────────────────────────────

        const fields = parseFields(fieldsRaw);

        const embed = new EmbedBuilder().setColor(colorRaw || getColor('primary'));

        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);
        if (image) embed.setImage(image);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (footer) embed.setFooter({ text: footer });
        if (authorName) {
            embed.setAuthor({
                name: authorName,
                iconURL: authorIcon || undefined,
            });
        }
        if (fields.length > 0) embed.addFields(fields);
        if (showTimestamp) embed.setTimestamp();

        // ─── Send ────────────────────────────────────────────────────────────

        try {
            await channel.send({ embeds: [embed] });
        } catch (sendError) {
            logger.error('Failed to send embed from /embed:', sendError);
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        'Failed to Send',
                        `Could not send the embed to ${channel}. Make sure the bot has permission to send messages and embeds there.`
                    ),
                ],
            });
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed('Embed Sent', `Your embed was sent to ${channel}.`)],
        });
    } catch (error) {
        logger.error('Error in /embed:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while building the embed.',
                ephemeral: true,
            }).catch(() => {});
        } else {
            await InteractionHelper.safeEditReply(interaction, {
                content: '❌ An error occurred while building the embed.',
            }).catch(() => {});
        }
    }
  }
