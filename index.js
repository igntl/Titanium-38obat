const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
  InteractionType,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;

// 🔧 IDs
const LOG_CHANNEL = "1490286354175758366";

const ROLES = {
  warn1: "1498706230292779080",
  warn2: "1498706272248266834",
  warn3: "1498706307228631200",
  block: "1498706342649663549",
  black: "1498706382587822191"
};

// ⏱️ المدد
const DURATIONS = {
  test: 60000,
  day: 86400000,
  day2: 172800000,
  day3: 259200000,
  week: 604800000,
  week2: 1209600000,
  month: 2592000000
};

client.once("ready", async () => {
  console.log("Bot Ready");

  const command = new SlashCommandBuilder()
    .setName("عقوبات")
    .setDescription("لوحة العقوبات")
    .addUserOption(option =>
      option.setName("الشخص")
        .setDescription("اختر الشخص")
        .setRequired(true)
    );

  await client.application.commands.set([command]);
});

// 🧠 حفظ الحالة مؤقت
const tempData = new Map();

client.on("interactionCreate", async (interaction) => {

  // 📌 سلاش
  if (interaction.isChatInputCommand()) {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: "❌ ما عندك صلاحية", ephemeral: true });
    }

    const user = interaction.options.getUser("الشخص");

    const menu = new StringSelectMenuBuilder()
      .setCustomId("type")
      .setPlaceholder("اختر نوع العقوبة")
      .addOptions([
        { label: "انذار 1", value: "warn1" },
        { label: "انذار 2", value: "warn2" },
        { label: "انذار 3", value: "warn3" },
        { label: "منع من التقسيمة", value: "block" },
        { label: "بلاك ليست", value: "black" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    tempData.set(interaction.user.id, { target: user.id });

    await interaction.reply({
      content: "اختر نوع العقوبة:",
      components: [row],
      ephemeral: true
    });
  }

  // 📋 اختيار نوع
  if (interaction.isStringSelectMenu() && interaction.customId === "type") {

    const data = tempData.get(interaction.user.id);
    data.type = interaction.values[0];

    const menu = new StringSelectMenuBuilder()
      .setCustomId("duration")
      .setPlaceholder("اختر المدة")
      .addOptions([
        { label: "تجربة (دقيقة)", value: "test" },
        { label: "يوم", value: "day" },
        { label: "يومين", value: "day2" },
        { label: "3 أيام", value: "day3" },
        { label: "أسبوع", value: "week" },
        { label: "أسبوعين", value: "week2" },
        { label: "شهر", value: "month" },
        { label: "دائم", value: "permanent" }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.update({
      content: "اختر المدة:",
      components: [row]
    });
  }

  // ⏱️ اختيار مدة
  if (interaction.isStringSelectMenu() && interaction.customId === "duration") {

    const data = tempData.get(interaction.user.id);
    data.duration = interaction.values[0];

    await interaction.update({
      content: "📝 اكتب سبب العقوبة:",
      components: []
    });

    const filter = m => m.author.id === interaction.user.id;

    const collected = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 30000
    }).catch(() => null);

    if (!collected) return interaction.followUp({ content: "❌ انتهى الوقت", ephemeral: true });

    const reason = collected.first().content;
    const member = await interaction.guild.members.fetch(data.target);

    const role = interaction.guild.roles.cache.get(ROLES[data.type]);
    await member.roles.add(role);

    // ⏱️ تحديد المدة
    let durationText = "دائم";
    if (data.duration !== "permanent") {
      durationText = Object.keys(DURATIONS).includes(data.duration)
        ? interaction.values[0]
        : data.duration;

      setTimeout(async () => {
        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
        }
      }, DURATIONS[data.duration]);
    }

    // 📢 إرسال لوق
    const log = interaction.guild.channels.cache.get(LOG_CHANNEL);

    log.send(`
🚨 تم إعطاء عقوبة

👤 المستخدم: <@${member.id}>
👮 الإداري: <@${interaction.user.id}>
📝 السبب: ${reason}
⏱️ المدة: ${data.duration === "permanent" ? "دائم" : data.duration}
`);

    await interaction.followUp({
      content: "✅ تم تنفيذ العقوبة",
      ephemeral: true
    });

    tempData.delete(interaction.user.id);
  }
});

client.login(TOKEN);
