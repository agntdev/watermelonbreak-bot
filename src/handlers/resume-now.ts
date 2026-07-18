import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getPersistence } from "../persistence.js";

const composer = new Composer<Ctx>();

function isOwner(ctx: Ctx): boolean {
  const ownerId = process.env.OWNER_ID;
  if (!ownerId) return true;
  return ctx.from?.id === Number(ownerId);
}

composer.command("resume_now", async (ctx) => {
  if (!isOwner(ctx)) {
    await ctx.reply("Only the bot owner can resume from a break.");
    return;
  }
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);
  if (!schedule.is_active) {
    await ctx.reply("No break is active right now — we're already going!");
    return;
  }
  schedule.is_active = false;
  if (schedule.interval_minutes > 0) {
    schedule.next_break_time = Date.now() + schedule.interval_minutes * 60 * 1000;
  }
  await store.setBreakSchedule(chatId, schedule);
  await ctx.reply("Back in action! What would you like to do?", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery("resume:now", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isOwner(ctx)) {
    await ctx.reply("Only the bot owner can resume from a break.");
    return;
  }
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);
  if (!schedule.is_active) {
    await ctx.editMessageText("No break is active right now — we're already going!", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }
  schedule.is_active = false;
  if (schedule.interval_minutes > 0) {
    schedule.next_break_time = Date.now() + schedule.interval_minutes * 60 * 1000;
  }
  await store.setBreakSchedule(chatId, schedule);
  await ctx.editMessageText("Back in action! What would you like to do?", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
