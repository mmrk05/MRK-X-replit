require("dotenv").config();
const {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require("discord.js");
const { Shoukaku } = require("shoukaku");
const config = require("./config");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.prefix = config.prefix;
client.queue = new Map();
client.music = new Shoukaku(client, config.lavalink.nodes);

client.once("ready", () => console.log("🎧 MRK X Online"));

async function playSong(guild, track, channel, member) {
  let q = client.queue.get(guild.id);
  const node = client.music.getNode();
  if (!q) {
    const player = await node.joinChannel({
      guildId: guild.id,
      channelId: member.voice.channel.id,
      shardId: 0
    });
    q = { channel, player, songs: [] };
    client.queue.set(guild.id, q);
  }
  q.songs.push(track);
  if (!q.player.track) q.player.playTrack(track);
}

client.on("messageCreate", async m => {
  if (!m.content.startsWith(client.prefix) || m.author.bot) return;
  const args = m.content.slice(client.prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "play") {
    if (!m.member.voice.channel) return m.reply("❌ Join VC first");
    const node = client.music.getNode();
    const res = await node.rest.resolve(args.join(" "));
    playSong(m.guild, res.tracks[0], m.channel, m.member);
  }
  if (cmd === "skip") {
    const q = client.queue.get(m.guild.id);
    if (!q) return;
    q.player.stopTrack();
    m.reply("⏭ Skipped");
  }
  if (cmd === "stop") {
    const q = client.queue.get(m.guild.id);
    if (!q) return;
    q.player.disconnect();
    client.queue.delete(m.guild.id);
    m.reply("⏹ Stopped");
  }
});

client.music.on("trackStart", (player, track) => {
  const q = client.queue.get(player.guildId);
  if (!q) return;
  const embed = new EmbedBuilder()
    .setTitle("🎶 Now Playing")
    .setDescription(`[${track.info.title}](${track.info.uri})`)
    .setFooter({ text: "MRK X • HQ Music" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("pause").setEmoji("⏸").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("skip").setEmoji("⏭").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("stop").setEmoji("⏹").setStyle(ButtonStyle.Danger)
  );
  q.channel.send({ embeds: [embed], components: [row] });
});

client.on("interactionCreate", async i => {
  if (!i.isButton()) return;
  const q = client.queue.get(i.guild.id);
  if (!q) return;
  if (i.customId === "pause") q.player.setPaused(!q.player.paused);
  if (i.customId === "skip") q.player.stopTrack();
  if (i.customId === "stop") {
    q.player.disconnect();
    client.queue.delete(i.guild.id);
  }
  i.reply({ content: "Done ✅", ephemeral: true });
});

client.login(process.env.TOKEN);