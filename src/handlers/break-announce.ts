import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getPersistence } from "../persistence.js";

const composer = new Composer<Ctx>();

const BREAK_MESSAGES = [
  "🍉 Break time! Put down the watermelon and stretch!",
  "🍉 Watermelon o'clock! Time for a quick breather.",
  "🍉 Break incoming! Even watermelons need a rest.",
  "🍉 Pause button pressed! Go grab a snack.",
  "🍉 The watermelon says: time off!",
];

function pickMessage(): string {
  return BREAK_MESSAGES[Math.floor(Math.random() * BREAK_MESSAGES.length)];
}

async function triggerBreak(chatId: number, ctx: Ctx): Promise<void> {
  const store = getPersistence();
  const schedule = await store.getBreakSchedule(chatId);

  if (schedule.is_active) {
    return; // already on break — ignore overlapping trigger
  }

  schedule.is_active = true;
  schedule.next_break_time = 0;
  await store.setBreakSchedule(chatId, schedule);

  const msg = pickMessage();
  await ctx.api.sendMessage(chatId, msg, {
    reply_markup: inlineKeyboard([[inlineButton("✅ Resume", "resume:now")]]),
  });

  const notif = await store.getNotifications(chatId);
  if (notif.dm_enabled && ctx.from?.id) {
    notif.last_notification_time = Date.now();
    await store.setNotifications(chatId, notif);
    try {
      await ctx.api.sendMessage(ctx.from.id, `🍉 Break started in this chat!`);
    } catch {
      // User may have blocked the bot — tolerate 403
    }
  }
}

composer.command("break_now", async (ctx) => {
  const chatId = ctx.chat!.id;
  await triggerBreak(chatId, ctx);
  await ctx.reply("🍉 Break triggered!");
});

// The scheduler — checks every minute if it's time for a break.
// In production this runs continuously; in tests the harness
// doesn't advance time, so the scheduler is a no-op there.
let schedulerStarted = false;
const checkedChats = new Set<number>();

export function startScheduler(getBotApi: () => { sendMessage: (chatId: number, text: string, extra?: unknown) => Promise<unknown> }): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(async () => {
    const now = Date.now();
    for (const chatId of checkedChats) {
      try {
        const store = getPersistence();
        const schedule = await store.getBreakSchedule(chatId);
        if (schedule.is_active || schedule.next_break_time <= 0) continue;
        if (now >= schedule.next_break_time) {
          schedule.is_active = true;
          schedule.next_break_time = 0;
          await store.setBreakSchedule(chatId, schedule);
          const msg = pickMessage();
          await getBotApi().sendMessage(chatId, msg, {
            reply_markup: inlineKeyboard([[inlineButton("✅ Resume", "resume:now")]]),
          });
        }
      } catch {
        // Best-effort — don't crash the scheduler
      }
    }
  }, 60_000).unref?.();
}

export function trackChat(chatId: number): void {
  checkedChats.add(chatId);
}

// Track every chat that sends a command
composer.on("message", async (ctx, next) => {
  if (ctx.chat) trackChat(ctx.chat.id);
  return next();
});

export default composer;
