# UI/UX Design (WhatsApp Interface)

**Related Documents:**

- [High-Level Plan](../README.md)
- [System Design & Code Examples](./system_design.md)

Since this is a WhatsApp bot (using Baileys), the UI/UX is entirely conversational. This document outlines the formatting, aesthetics, and user flows for interacting with the economic system.

## 1. Design Principles for WhatsApp

- **Use Native Formatting:** Utilize WhatsApp's markdown for emphasis (`*bold*` for headers/important numbers, `_italic_` for secondary info/lore).
- **Emojis as Visual Anchors:** Use emojis to break up walls of text and create visual hierarchy (e.g., 📉, 💰, 🏦).
- **Conciseness:** Mobile users skim. Keep broadcasts short and punchy.

---

## 2. Broadcast Message Mockup

This is the message sent automatically to whitelisted groups when the daily cron job finishes processing the AI data.

**Message Design:**

```whatsapp
*🏦 WAF Central Bank Update*

*Current Exchange Rate:* $1 = Rp15.520
*Market Trend:* 📉 IDR Weakening

*🔄 Economic Adjustments:*
• Global Inflation Multiplier: *1.04x*
• Shop Prices: ⬆️ *Increased by 4%*
• Loot Value: ⬆️ *Increased by 4%*

_🤖 AI Analyst Note: "The IDR has seen a slight dip over the past 48 hours due to global market shifts. Prices have been raised to maintain economic balance."_
```

---

## 3. User Command Mockups

### A. Checking the Current Economy (`.economy` or `.market`)

Users can check the current state of the economy at any time.

**User:**
`.market`

**Bot Reply:**

```whatsapp
*📊 Current Market Status*

• *Multiplier:* 1.04x
• *Last Updated:* Today at 00:05 AM
• *Current Rate:* Rp15.520 / USD

_Tip: Sell your loot now while inflation is high! 💰_
```

---

### B. Admin Command: Manual Trigger (`.forceupdate`)

For testing or immediate market crashes, admins can force the cron job to run early.

**Admin:**
`.forceupdate`

**Bot Reply:**

```whatsapp
⏳ *Contacting World Markets...*
Fetching data and consulting AI...

*(2 seconds later)*

✅ *Market updated manually!*
New multiplier is *0.98x*. Broadcasts are being sent to 12 whitelisted groups.
```

---

## 4. Error Handling UX

If the API fails or Groq doesn't respond, the system should fail silently for standard users, but alert the bot owner.

**Admin Alert (Direct Message to Owner):**

```whatsapp
⚠️ *SYSTEM ALERT: Economy Update Failed*

The daily cron job failed at step: `Groq AI Analysis`.
_Error: Rate Limit Exceeded._

The economy will remain at yesterday's multiplier (1.04x) until the next successful update.
```
