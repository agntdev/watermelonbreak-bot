import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getPersistence } from "../persistence.js";

registerMainMenuItem({ label: "🚀 Execute", data: "do:run", order: 40 });

const composer = new Composer<Ctx>();

function isOwner(ctx: Ctx): boolean {
  const ownerId = process.env.OWNER_ID;
  if (!ownerId) return true;
  return ctx.from?.id === Number(ownerId);
}

composer.command("do", async (ctx) => {
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);

  if (schedule.is_active && !isOwner(ctx)) {
    await ctx.reply(
      "🍉 We're on break! This command will be available again when we're back.",
    );
    return;
  }

  const raw = ctx.message?.text ?? "";
  const task = raw.replace(/\/do\s*/, "").trim();
  if (!task) {
    await ctx.reply(
      "What would you like to do?\nUsage: /do <task description>",
    );
    return;
  }

  await store.addCommandLog(chatId, {
    timestamp: Date.now(),
    command_name: task,
    user_id: ctx.from?.id ?? 0,
  });

  await ctx.reply(`✅ Done: ${task}`);
});

composer.callbackQuery("do:run", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);

  if (schedule.is_active && !isOwner(ctx)) {
    await ctx.editMessageText(
      "🍉 We're on break! This command will be available again when we're back.",
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  await ctx.editMessageText(
    "What would you like to do?\nType /do <task description> to execute.",
    { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
  );
});

export default composer;
