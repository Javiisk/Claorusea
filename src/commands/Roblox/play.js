import { SlashCommandBuilder } from 'discord.js';
import play from 'play-dl';
import { enqueueAndPlay } from '../../utils/musicPlayer.js';

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song in your voice channel')
    .addStringOption(opt =>
      opt.setName('music')
        .setDescription('Song name or URL')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();

    if (!focused || play.yt_validate(focused) === 'video') {
      return interaction.respond([]);
    }

    try {
      const results = await play.search(focused, { limit: 5, source: { youtube: 'video' } });

      await interaction.respond(
        results.map(video => ({
          name: `${video.title} — ${video.channel?.name || 'Unknown'}`.slice(0, 100),
          value: video.url,
        })),
      );
    } catch {
      await interaction.respond([]);
    }
  },

  async execute(interaction) {
    const query = interaction.options.getString('music');
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ You need to be in a voice channel to play music.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      let url = query;
      let title = query;
      let artist = 'Unknown';

      if (play.yt_validate(query) !== 'video') {
        const results = await play.search(query, { limit: 1, source: { youtube: 'video' } });

        if (!results.length) {
          return interaction.editReply({ content: '❌ No results found for that search.' });
        }

        url = results[0].url;
        title = results[0].title;
        artist = results[0].channel?.name || 'Unknown';
      } else {
        const info = await play.video_basic_info(url);
        title = info.video_details.title;
        artist = info.video_details.channel?.name || 'Unknown';
      }

      const track = { url, title, artist, requestedBy: interaction.user.id };

      const result = await enqueueAndPlay({
        guild: interaction.guild,
        voiceChannel,
        textChannel: interaction.channel,
        track,
      });

      if (result.queued) {
        await interaction.editReply({ content: `✅ Added to queue (position ${result.position}): **${title}**` });
      } else {
        await interaction.editReply({ content: `✅ Now playing **${title}**` });
      }
    } catch (error) {
      console.error('❌ /play error:', error);
      await interaction.editReply({ content: '❌ Something went wrong trying to play that.' });
    }
  },
};
