# Watermelon Break Bot — Bot specification

**Archetype:** community

**Voice:** playful and whimsical — write every user-facing message, button label, error, and empty state in this voice.

A whimsical Telegram bot that executes commands, announces scheduled breaks with playful messages, and allows owner-controlled pauses. Publicly signals availability in chats while maintaining owner privileges for overrides.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- small communities
- group chat participants
- private chat users

## Success criteria

- Public break announcements posted on configured schedule
- Commands execute with correct access control during/after breaks
- Owner receives configurable notifications about break status

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with available commands
- **/help** (command, actor: user, command: /help) — Show command list and usage guide
- **/pause_now** (command, actor: owner, command: /pause_now) — Immediately trigger a break
- **/resume_now** (command, actor: owner, command: /resume_now) — Cancel current break and resume
- **Status Check** (button, actor: user, callback: status:check) — Show current break status and schedule

## Flows

### Break announcement
_Trigger:_ scheduled interval

1. Send public break message
2. Enter break mode ignoring non-owner commands

_Data touched:_ break_schedule, owner_notifications

### Command execution
_Trigger:_ /do <task>

1. Validate user permissions
2. Execute command if not in break mode
3. Return appropriate response

_Data touched:_ command_logs, break_status

### Owner override
_Trigger:_ /pause_now

1. Immediately initiate break
2. Send confirmation to owner

_Data touched:_ break_schedule, owner_notifications

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **break_schedule** _(retention: persistent)_ — Configured break intervals and active status
  - fields: interval_minutes, next_break_time, is_active
- **owner_notifications** _(retention: persistent)_ — Owner's private notification preferences
  - fields: dm_enabled, last_notification_time
- **command_logs** _(retention: persistent)_ — Audit trail of executed commands
  - fields: timestamp, command_name, user_id

## Integrations

- **Telegram** (required) — Chat messaging and command handling
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- /set_break_interval <minutes|hours>
- /pause_now
- /resume_now
- /notifications_on
- /notifications_off
- /status

## Notifications

- Public break announcements in chat
- Owner private DM notifications (configurable)

## Permissions & privacy

- Owner-only commands require verified admin status
- Command logs retained 90 days by default
- Break messages visible to all chat participants

## Edge cases

- Command during active break by non-owner
- Multiple overlapping break triggers
- Schedule change during active break

## Required tests

- Break announcement timing accuracy test
- Command access control validation
- Owner override during scheduled break

## Assumptions

- Default break interval is 60 minutes
- Owner is user who added the bot initially
- Public announcements use exact specified phrasing
