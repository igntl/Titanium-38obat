const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;

// 📌 IDs
const LOG_CHANNEL = "1490286354175758366";

const ROLES = {
  warn1: { id: "1498706230292779080", name: "انذار اول", color: 0x7E2217 },
  warn2: { id: "1498706272248266834", name: "انذار ثاني", color: 0x7E2217 },
  warn3: { id: "1498706307228631200", name: "انذار ثالث", color: 0xF62817 },
  block: { id: "1498706342649663549", name: "مستبعد من التقسيمة", color: 0x736F6E },
  black: { id: "1498706382587822191", name: "بلاك ليست كبتنية", color: 0x2B1B17 }
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

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: "❌ ما عندك صلاحية", ephemeral: true });
    }

    const user = interaction.options.getUser("الشخص");

    temp.set(interaction.user.id, { target: user.id });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("types")
      .setPlaceholder("اختر العقوبات")
      .setMinValues(1)
      .setMaxValues(5)
      .addOptions([
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

  // ⏱️ اختيار المدة (🔥 بدون defer)
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

    return interaction.showModal(modal); // 🔥 هذا يكفي
  }

  // 📝 بعد كتابة السبب
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

    // 🎨 اللون حسب أقوى عقوبة
    let color = ROLES.warn1.color;
    if (data.types.includes("black")) color = ROLES.black.color;
    else if (data.types.includes("warn3")) color = ROLES.warn3.color;
    else if (data.types.includes("block")) color = ROLES.block.color;

    const punishNames = data.types.map(t => ROLES[t].name).join(" + ");

    const embed = new EmbedBuilder()
      .setTitle("🚨 تم إعطاء عقوبات")
      .setColor(color)
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
