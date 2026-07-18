import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getPersistence } from "../persistence.js";

registerMainMenuItem({ label: "⏸ Pause", data: "pause:now", order: 30 });

const composer = new Composer<Ctx>();

function isOwner(ctx: Ctx): boolean {
  const ownerId = process.env.OWNER_ID;
  if (!ownerId) return true;
  return ctx.from?.id === Number(ownerId);
}

composer.command("pause_now", async (ctx) => {
  if (!isOwner(ctx)) {
    await ctx.reply("Only the bot owner can pause breaks.");
    return;
  }
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);
  schedule.is_active = true;
  schedule.next_break_time = 0;
  await store.setBreakSchedule(chatId, schedule);
  await ctx.reply("🍉 Break time! Everyone take a breather. Back soon!", {
    reply_markup: inlineKeyboard([[inlineButton("✅ Resume", "resume:now")]]),
  });
});

composer.callbackQuery("pause:now", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!isOwner(ctx)) {
    await ctx.reply("Only the bot owner can pause breaks.");
    return;
  }
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);
  schedule.is_active = true;
  schedule.next_break_time = 0;
  await store.setBreakSchedule(chatId, schedule);
  await ctx.editMessageText("🍉 Break time! Everyone take a breather. Back soon!", {
    reply_markup: inlineKeyboard([[inlineButton("✅ Resume", "resume:now")]]),
  });
});

export default composer;
