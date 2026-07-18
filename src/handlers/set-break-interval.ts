import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getPersistence } from "../persistence.js";

registerMainMenuItem({ label: "⚙️ Settings", data: "settings:show", order: 50 });

const composer = new Composer<Ctx>();

function isOwner(ctx: Ctx): boolean {
  const ownerId = process.env.OWNER_ID;
  if (!ownerId) return true;
  return ctx.from?.id === Number(ownerId);
}

composer.command("set_break_interval", async (ctx) => {
  if (!isOwner(ctx)) {
    await ctx.reply("Only the bot owner can change break settings.");
    return;
  }
  const text = ctx.message?.text ?? "";
  const match = text.match(/\/set_break_interval\s+(\d+)(h|m)?/);
  if (!match) {
    await ctx.reply(
      "Usage: /set_break_interval <number><m|h>\nExamples: 30m, 2h",
    );
    return;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2] ?? "m";
  const minutes = unit === "h" ? value * 60 : value;

  if (minutes < 5) {
    await ctx.reply("Minimum interval is 5 minutes — even watermelons need a little break!");
    return;
  }
  if (minutes > 480) {
    await ctx.reply("Maximum interval is 8 hours — that's a lot of waiting between breaks!");
    return;
  }

  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);
  schedule.interval_minutes = minutes;
  if (!schedule.is_active) {
    schedule.next_break_time = Date.now() + minutes * 60 * 1000;
  }
  await store.setBreakSchedule(chatId, schedule);
  await ctx.reply(`Break interval set to ${minutes} minutes. 🍉`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery("settings:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isOwner(ctx)) {
    await ctx.editMessageText("Only the bot owner can view settings.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);
  const notif = await store.getNotifications(chatId);

  const intervalText = schedule.interval_minutes > 0
    ? `${schedule.interval_minutes} min`
    : "not set";
  const notifText = notif.dm_enabled ? "on" : "off";

  await ctx.editMessageText(
    `Break interval: ${intervalText}\nNotifications: ${notifText}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("⏱ Set interval", "settings:interval")],
        [inlineButton(notif.dm_enabled ? "🔕 Notifications off" : "🔔 Notifications on", "settings:toggle_notif")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery("settings:interval", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "Reply with the new break interval.\nExamples: 30m, 1h, 2h",
    { reply_markup: inlineKeyboard([[inlineButton("Cancel", "settings:show")]]) },
  );
});

composer.callbackQuery("settings:toggle_notif", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isOwner(ctx)) {
    await ctx.reply("Only the bot owner can change notification settings.");
    return;
  }
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const notif = await store.getNotifications(chatId);
  notif.dm_enabled = !notif.dm_enabled;
  await store.setNotifications(chatId, notif);

  const label = notif.dm_enabled ? "on" : "off";
  await ctx.editMessageText(`DM notifications turned ${label}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
