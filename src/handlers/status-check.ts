import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getPersistence } from "../persistence.js";

registerMainMenuItem({ label: "🔍 Status", data: "status:check", order: 10 });

const composer = new Composer<Ctx>();

function formatTime(ms: number): string {
  if (ms <= 0) return "now";
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `in ${hrs}h ${rem}m` : `in ${hrs}h`;
}

composer.callbackQuery("status:check", async (ctx) => {
  await ctx.answerCallbackQuery();
  const store = getPersistence();
  const chatId = ctx.chat!.id;
  const schedule = await store.getBreakSchedule(chatId);
  const notif = await store.getNotifications(chatId);

  let status: string;
  if (schedule.is_active) {
    status = "🍉 Break is ON — everyone's relaxing!";
  } else if (schedule.next_break_time > 0) {
    const remaining = schedule.next_break_time - Date.now();
    status = `⏰ Next break ${formatTime(remaining)} (every ${schedule.interval_minutes} min)`;
  } else {
    status = "✅ No break scheduled yet.";
  }

  const notifLine = notif.dm_enabled ? "🔔 DM notifications: on" : "🔕 DM notifications: off";

  await ctx.editMessageText(`${status}\n${notifLine}`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
