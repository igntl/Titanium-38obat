const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;

// 📌 IDs
const LOG_CHANNEL = "1472987165368516679";

// 🔒 رتب المسموح لهم
const ALLOWED_ROLES = [
  "1495462892026200104", // مسؤول السيرفر
  "1477108715290362096", // مسؤول التقييم
  "1472012734592712796"  // مسؤول الشكاوي
];

const ROLES = {
  verbal: { id: "1472588209337925897", name: "انذار شفهي" },

  warn1: { id: "1362556773696930004", name: "انذار اول" },
  warn2: { id: "1362556856580702238", name: "انذار ثاني" },
  warn3: { id: "1472129523267932182", name: "انذار ثالث" },
  block: { id: "1364025035022401536", name: "مستبعد من التقسيمة" },
  black: { id: "1394762550364733440", name: "بلاك ليست كبتنية" }
};

// ⏱️ المدد
const DURATIONS = {
  test: { label: "تجربة", time: 60000 },
  day: { label: "يوم", time: 86400000 },
  day2: { label: "يومين", time: 172800000 },
  day3: { label: "3 ايام", time: 259200000 },
  week: { label: "اسبوع", time: 604800000 },
  week2: { label: "اسبوعين", time: 1209600000 },
  month: { label: "شهر", time: 2592000000 },
  permanent: { label: "دائم", time: null }
};

const temp = new Map();

client.once("ready", async () => {
  console.log("Bot Ready");

  const cmd = new SlashCommandBuilder()
    .setName("عقوبات")
    .setDescription("لوحة العقوبات")
    .addUserOption(o =>
      o.setName("الشخص").setDescription("اختر الشخص").setRequired(true)
    );

  await client.application.commands.set([cmd]);
});

client.on("interactionCreate", async (interaction) => {

  // 🟢 سلاش
  if (interaction.isChatInputCommand()) {

    // 🔥 تحقق الرتب بدل Manage Roles
    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));

    if (!hasRole) {
      return interaction.reply({ content: "❌ ما عندك صلاحية", ephemeral: true });
    }

    const user = interaction.options.getUser("الشخص");

    temp.set(interaction.user.id, { target: user.id });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("types")
      .setPlaceholder("اختر العقوبات")
      .setMinValues(1)
      .setMaxValues(6)
      .addOptions([
        { label: "انذار شفهي", value: "verbal" }, // 🔥 أول خيار
        { label: "انذار 1", value: "warn1" },
        { label: "انذار 2", value: "warn2" },
        { label: "انذار 3", value: "warn3" },
        { label: "مستبعد من التقسيمة", value: "block" },
        { label: "بلاك ليست كبتنية", value: "black" }
      ]);

    return interaction.reply({
      content: "اختر العقوبات:",
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  // 📋 اختيار العقوبات
  if (interaction.isStringSelectMenu() && interaction.customId === "types") {

    const data = temp.get(interaction.user.id);
    data.types = interaction.values;

    const menu = new StringSelectMenuBuilder()
      .setCustomId("duration")
      .setPlaceholder("اختر المدة")
      .addOptions(Object.entries(DURATIONS).map(([k, v]) => ({
        label: v.label,
        value: k
      })));

    return interaction.update({
      content: "اختر المدة:",
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }

  // ⏱️ اختيار المدة
  if (interaction.isStringSelectMenu() && interaction.customId === "duration") {

    const data = temp.get(interaction.user.id);
    data.duration = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId("reasonModal")
      .setTitle("سبب العقوبة");

    const input = new TextInputBuilder()
      .setCustomId("reason")
      .setLabel("اكتب السبب")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    return interaction.showModal(modal);
  }

  // 📝 بعد السبب
  if (interaction.isModalSubmit() && interaction.customId === "reasonModal") {

    await interaction.deferReply({ ephemeral: true });

    const data = temp.get(interaction.user.id);
    const reason = interaction.fields.getTextInputValue("reason");

    const member = await interaction.guild.members.fetch(data.target);

    // إضافة الرتب
    for (const t of data.types) {
      const role = interaction.guild.roles.cache.get(ROLES[t].id);
      if (role) await member.roles.add(role);
    }

    // ⏱️ إزالة مؤقتة
    const duration = DURATIONS[data.duration];
    if (duration.time) {
      setTimeout(async () => {
        for (const t of data.types) {
          const role = interaction.guild.roles.cache.get(ROLES[t].id);
          if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
          }
        }
      }, duration.time);
    }

    const punishNames = data.types.map(t => ROLES[t].name).join(" + ");

    const embed = new EmbedBuilder()
      .setTitle("🚨 تم إعطاء عقوبات")
      .setColor(0xFF4C4C) // 🔥 لون موحد
      .addFields(
        { name: "👤 المستخدم", value: `<@${member.id}>`, inline: true },
        { name: "👮 الإداري", value: `<@${interaction.user.id}>`, inline: true },
        { name: "📋 العقوبات", value: punishNames },
        { name: "⏱️ المدة", value: duration.label, inline: true },
        { name: "📝 السبب", value: reason }
      )
      .setTimestamp();

    const log = interaction.guild.channels.cache.get(LOG_CHANNEL);
    if (log) log.send({ embeds: [embed] });

    await interaction.editReply({
      content: "✅ تم تنفيذ العقوبة"
    });

    temp.delete(interaction.user.id);
  }
});

client.login(TOKEN);
