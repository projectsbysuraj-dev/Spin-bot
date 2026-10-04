"""
Telegram Bot for Rohit Giveaway Mini App
Features:
- Strict Channel Gatekeeper: NO Giveaway App link until ALL channels are joined!
- Public & Private Channels support (VIP1 Private Channel permanently set)
- Private Channel Join Request check: User sends request, bot verifies WITHOUT auto-accepting!
- Device verification check: Ek device me sirf ek hi account allow hai
- Congratulations message + Open button only after successful Device Verification
- If Device verification fails: Done button only, website does NOT open!
- Owner-only /ownerhelp, /addchannel, /removechannel, /channels, /owners, /addowner, /delowner
- Instant 1-Second Referral Tracking & Notification to Referrer
- Dynamic /invite, /link, /referral commands (gatekept by channel verification)
- Real-time +1 Free Spin credit in Firebase Realtime Database
- Pure message broadcast (No mini app link attached with broadcasts)
- Resilience against mobile network/Termux drops (handles ReadError/TimedOut gracefully)
- Admin commands: /withdrawals, /payouts, /broadcast, /owners, /addowner, /delowner
- User status commands: /spins, /balance, /invite
- Built-in Render HTTP health-check server for 24/7 uptime on Render.com
"""

import os
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import logging
import json
import time
import re
import urllib.request
import urllib.error
import urllib.parse
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)
from telegram.request import HTTPXRequest
from telegram.error import NetworkError, TimedOut, Conflict, BadRequest
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    ChatJoinRequestHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

# -------------------------------------------------------------------------
# 1. CORE BOT CONFIGURATION
# -------------------------------------------------------------------------
TOKEN = "8973201055:AAGiHa1ewSL0F_mG0v_f1WpMqK2lRySxSko"
BOT_USERNAME = "spin_the_win_bot"
WEB_URL = "https://done-coral-delta.vercel.app/"
RTDB_URL = "https://telebot-26c11-default-rtdb.firebaseio.com"

# -------------------------------------------------------------------------
# 2. PERMANENT CHANNELS (VIP1 Private Channel Configured)
# -------------------------------------------------------------------------
PERMANENT_CHANNELS = [
    {
        "id": "-1003479783999",
        "name": "VIP1 Private Channel",
        "url": "https://t.me/+7clQNCkYuAAxYWQ1",
        "is_private": True,
    },
]

# -------------------------------------------------------------------------
# 3. PERMANENT OWNERS (Only Ye ID / Username /ownerhelp Chala Sakte Hain)
# -------------------------------------------------------------------------
DEFAULT_OWNERS = [
    "rohit79041",
]

# ----------------- Logging Setup -----------------
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("giveaway_bot")


# ----------------- Render Web Service Health Check -----------------
class RenderHealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"OK - Rohit Giveaway Telegram Bot is running live!")

    def do_HEAD(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        return  # Suppress HTTP ping logs


def start_health_server():
    """Runs a minimal HTTP health check server so Render keeps the service Live."""
    port = int(os.environ.get("PORT", 8080))
    try:
        server = HTTPServer(("0.0.0.0", port), RenderHealthCheckHandler)
        logger.info(f"Render health server listening on port {port}")
        server.serve_forever()
    except Exception as e:
        logger.warning(f"Health server notice: {e}")


# ----------------- Database Helpers -----------------
def get_user_from_db(user_id: str) -> dict | None:
    """Fetch user profile from Firebase RTDB."""
    try:
        req = urllib.request.Request(f"{RTDB_URL}/users/{user_id}.json")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode("utf-8")
            if data and data != "null":
                return json.loads(data)
    except Exception as e:
        logger.warning(f"Error fetching user {user_id}: {e}")
    return None


def update_user_in_db(user_id: str, patch_data: dict):
    """Update user fields in Firebase RTDB."""
    try:
        req = urllib.request.Request(
            f"{RTDB_URL}/users/{user_id}.json",
            data=json.dumps(patch_data).encode("utf-8"),
            method="PATCH",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as e:
        logger.warning(f"Error updating user {user_id}: {e}")


def is_already_referred(referrer_id: str, new_user_id: str) -> bool:
    """Check if this new user has already been credited to the referrer."""
    try:
        req = urllib.request.Request(f"{RTDB_URL}/referrals/{referrer_id}/{new_user_id}.json")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode("utf-8")
            return data is not None and data != "null"
    except Exception:
        return False


def save_referral_record(referrer_id: str, new_user_id: str, name: str, username: str):
    """Save referral relationship in Firebase RTDB."""
    try:
        payload = json.dumps({
            "joinerId": str(new_user_id),
            "name": name,
            "username": username or "",
            "timestamp": int(time.time() * 1000),
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{RTDB_URL}/referrals/{referrer_id}/{new_user_id}.json",
            data=payload,
            method="PUT",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as e:
        logger.warning(f"Error saving referral record: {e}")


def award_spins_to_referrer(referrer_id: str, new_user_name: str) -> dict:
    """
    Increment spins and friends count in Firebase Realtime Database.
    Returns the updated referrer stats.
    Only awards to genuine existing referrers in DB (never create phantom users).
    """
    now_ms = int(time.time() * 1000)
    current = get_user_from_db(referrer_id)

    if current:
        if current.get("deviceBlocked"):
            logger.warning(f"Referrer {referrer_id} is deviceBlocked! Denying referral spin.")
            return {"spins": 0, "friendsJoined": 0}

        new_spins = (current.get("spins") or 0) + 1
        new_friends = (current.get("friendsJoined") or 0) + 1
        new_earned = (current.get("spinsEarned") or 0) + 1

        patch_data = {
            "spins": new_spins,
            "friendsJoined": new_friends,
            "spinsEarned": new_earned,
        }
        try:
            req = urllib.request.Request(
                f"{RTDB_URL}/users/{referrer_id}.json",
                data=json.dumps(patch_data).encode("utf-8"),
                method="PATCH",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5):
                pass
        except Exception as e:
            logger.warning(f"Error updating referrer {referrer_id}: {e}")

        # Add transaction record in Firebase
        tx_id = f"tx_{now_ms}_{str(new_friends)}"
        tx_data = {
            "id": tx_id,
            "userId": str(referrer_id),
            "type": "referral_bonus",
            "amount": 0,
            "description": f"Friend {new_user_name} joined! +1 Lucky Spin awarded",
            "status": "completed",
            "createdAt": now_ms,
        }
        try:
            req = urllib.request.Request(
                f"{RTDB_URL}/transactions/{tx_id}.json",
                data=json.dumps(tx_data).encode("utf-8"),
                method="PUT",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5):
                pass
        except Exception:
            pass

        return {"spins": new_spins, "friendsJoined": new_friends}
    else:
        logger.warning(f"Referrer {referrer_id} does not exist in DB! Skipping phantom account creation.")
        return {"spins": 0, "friendsJoined": 0}


# ----------------- Dynamic Channels & Owners Storage -----------------
_CHANNELS_CACHE = []
_OWNERS_CACHE = set(o.lower().lstrip("@") for o in DEFAULT_OWNERS)
_LAST_SYNC_TIME = 0


def load_channels_from_db() -> list[dict]:
    """Combines permanent channels from code with dynamic channels from Firebase."""
    global _CHANNELS_CACHE, _LAST_SYNC_TIME
    now = time.time()
    if _CHANNELS_CACHE and (now - _LAST_SYNC_TIME < 15):
        return _CHANNELS_CACHE

    combined = []
    for p in PERMANENT_CHANNELS:
        combined.append(dict(p))

    try:
        req = urllib.request.Request(f"{RTDB_URL}/bot_config/channels.json")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode("utf-8")
            if data and data != "null":
                parsed = json.loads(data)
                items = list(parsed.values()) if isinstance(parsed, dict) else parsed
                for item in items:
                    if isinstance(item, dict) and item.get("id"):
                        if not any(c.get("id") == item["id"] for c in combined):
                            combined.append(item)
    except Exception as e:
        logger.warning(f"Notice reading channels from DB: {e}")

    _CHANNELS_CACHE = combined
    _LAST_SYNC_TIME = now
    return _CHANNELS_CACHE


def save_channel_to_db(channel_info: dict) -> bool:
    """Save or update a channel in Firebase RTDB."""
    global _CHANNELS_CACHE
    try:
        safe_key = str(channel_info["id"]).replace("@", "at_").replace("-", "neg_").replace(".", "_")
        payload = json.dumps(channel_info).encode("utf-8")
        req = urllib.request.Request(
            f"{RTDB_URL}/bot_config/channels/{safe_key}.json",
            data=payload,
            method="PUT",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5):
            pass

        existing = [c for c in _CHANNELS_CACHE if str(c.get("id")) != str(channel_info["id"])]
        existing.append(channel_info)
        _CHANNELS_CACHE = existing
        return True
    except Exception as e:
        logger.error(f"Error saving channel to RTDB: {e}")
        return False


def delete_channel_from_db(channel_identifier: str) -> bool:
    """Delete a channel from Firebase RTDB."""
    global _CHANNELS_CACHE
    clean_id = channel_identifier.strip()
    try:
        safe_key = clean_id.replace("@", "at_").replace("-", "neg_").replace(".", "_")
        req = urllib.request.Request(
            f"{RTDB_URL}/bot_config/channels/{safe_key}.json",
            method="DELETE",
        )
        with urllib.request.urlopen(req, timeout=5):
            pass

        _CHANNELS_CACHE = [c for c in _CHANNELS_CACHE if str(c.get("id")).lower() != clean_id.lower()]
        return True
    except Exception as e:
        logger.error(f"Error deleting channel from RTDB: {e}")
        return False


def load_owners_from_db() -> set[str]:
    """Load authorized owner IDs / usernames from Firebase RTDB."""
    global _OWNERS_CACHE
    try:
        req = urllib.request.Request(f"{RTDB_URL}/bot_config/owners.json")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode("utf-8")
            if data and data != "null":
                parsed = json.loads(data)
                if isinstance(parsed, dict):
                    for k, v in parsed.items():
                        if isinstance(v, dict) and "identifier" in v:
                            _OWNERS_CACHE.add(str(v["identifier"]).lower().lstrip("@"))
                        else:
                            _OWNERS_CACHE.add(str(k).lower().lstrip("@"))
                elif isinstance(parsed, list):
                    for item in parsed:
                        if item:
                            _OWNERS_CACHE.add(str(item).lower().lstrip("@"))
    except Exception as e:
        logger.warning(f"Notice reading owners from DB: {e}")
    return _OWNERS_CACHE


def save_owner_to_db(identifier: str) -> bool:
    """Save an authorized owner ID or username to Firebase RTDB."""
    clean = identifier.strip().lower().lstrip("@")
    safe_key = clean.replace(".", "_").replace("-", "neg_")
    try:
        payload = json.dumps({
            "identifier": clean,
            "addedAt": int(time.time() * 1000),
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{RTDB_URL}/bot_config/owners/{safe_key}.json",
            data=payload,
            method="PUT",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
        _OWNERS_CACHE.add(clean)
        return True
    except Exception as e:
        logger.error(f"Error saving owner: {e}")
        return False


def delete_owner_from_db(identifier: str) -> bool:
    """Remove an owner from Firebase RTDB."""
    clean = identifier.strip().lower().lstrip("@")
    safe_key = clean.replace(".", "_").replace("-", "neg_")
    try:
        req = urllib.request.Request(
            f"{RTDB_URL}/bot_config/owners/{safe_key}.json",
            method="DELETE",
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
        _OWNERS_CACHE.discard(clean)
        return True
    except Exception as e:
        logger.error(f"Error removing owner: {e}")
        return False


def is_owner(user_id: int | str, username: str | None = None) -> bool:
    """STRICT OWNER AUTHENTICATION."""
    owners = load_owners_from_db()
    uid_str = str(user_id).strip()

    if uid_str in owners:
        return True

    if username:
        clean_user = username.strip().lower().lstrip("@")
        if clean_user in owners:
            return True

    return False


async def process_and_notify_referral(
    bot,
    referrer_id: str,
    new_user_id: int,
    new_user_name: str,
    new_user_username: str,
):
    """Processes referral and sends Telegram notification to the referrer."""
    clean_ref = str(referrer_id).replace("ref_", "").replace("invite_", "").strip()
    clean_new_user = str(new_user_id).strip()

    if not clean_ref:
        return

    # Strictly block self-referral! No self-test loophole!
    if clean_ref == clean_new_user:
        logger.warning(f"[Anti-Fraud] Self-referral strictly blocked for user {clean_new_user}")
        return

    if is_already_referred(clean_ref, clean_new_user):
        logger.info(f"Referral already credited between {clean_ref} and {clean_new_user}")
        return

    save_referral_record(clean_ref, clean_new_user, new_user_name, new_user_username)
    stats = award_spins_to_referrer(clean_ref, new_user_name)
    if not stats or stats.get("spins", 0) <= 0:
        return

    logger.info(f"Awarded +1 spin to referrer {clean_ref}! Total spins: {stats['spins']}")

    try:
        user_mention = f"@{new_user_username}" if new_user_username else new_user_name
        ref_alert = (
            f"🎉 <b>New Referral Joined!</b>\n\n"
            f"👤 <b>{new_user_name}</b> ({user_mention}) just joined using your invite link!\n\n"
            f"🎁 <b>+1 Free Lucky Spin</b> has been credited to your account instantly!\n\n"
            f"🎡 Available Spins: <b>{stats['spins']}</b>\n"
            f"👥 Total Friends Invited: <b>{stats['friendsJoined']}</b>\n\n"
            f"🚀 Open the app and spin the wheel to win instant cash!"
        )

        if clean_ref.isdigit():
            await bot.send_message(
                chat_id=int(clean_ref),
                text=ref_alert,
                parse_mode="HTML",
                reply_markup=build_success_keyboard(),
            )
            logger.info(f"Referral notification delivered to {clean_ref}")
    except Exception as e:
        logger.warning(f"Could not send Telegram message to {clean_ref}: {e}")


# ----------------- Keyboard Builders -----------------
def build_success_keyboard(referrer_id: str | None = None) -> InlineKeyboardMarkup:
    """ONLY called after 100% successful verification across ALL channels & device!"""
    app_url = WEB_URL
    if referrer_id:
        clean_ref = str(referrer_id).replace("ref_", "").strip()
        sep = "&" if "?" in app_url else "?"
        app_url = f"{app_url}{sep}start=ref_{clean_ref}"

    keyboard = [
        [
            InlineKeyboardButton(
                "🚀 Open",
                web_app=WebAppInfo(url=app_url),
            )
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


def build_channel_join_keyboard(channels: list[dict], referrer_id: str | None = None) -> InlineKeyboardMarkup:
    """GATEKEEPER KEYBOARD: Grid of join buttons + Claim button."""
    callback_data = f"claim_{referrer_id}" if referrer_id else "claim_none"
    keyboard = []

    row = []
    for ch in channels:
        url = ch.get("url")
        if not url:
            cid = str(ch.get("id", ""))
            url = f"https://t.me/{cid.lstrip('@')}" if cid.startswith("@") else f"https://t.me/c/{cid.replace('-100', '')}/1"

        row.append(InlineKeyboardButton("Join ↗", url=url))
        if len(row) == 2:
            keyboard.append(row)
            row = []

    if row:
        keyboard.append(row)

    keyboard.append([
        InlineKeyboardButton("🟢 Claim", callback_data=callback_data)
    ])

    return InlineKeyboardMarkup(keyboard)


def build_join_keyboard(missing_channels: list[dict], referrer_id: str | None = None) -> InlineKeyboardMarkup:
    return build_channel_join_keyboard(missing_channels, referrer_id)


def build_invite_keyboard(user_id: int) -> InlineKeyboardMarkup:
    """Build keyboard for sharing referral link."""
    ref_link = f"https://t.me/{BOT_USERNAME}?start=ref_{user_id}"
    share_text = f"🎁 Join Rohit Giveaway! Spin the Lucky Wheel to win instant real cash directly into your UPI/Bank Account! Use my link: {ref_link}"
    share_url = f"https://t.me/share/url?url={ref_link}&text={urllib.parse.quote(share_text)}"

    keyboard = [
        [
            InlineKeyboardButton("📲 Share Link with Friends (1 Click)", url=share_url),
        ],
        [
            InlineKeyboardButton("🚀 Open", web_app=WebAppInfo(url=f"{WEB_URL}?start=ref_{user_id}")),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def build_owner_panel_keyboard() -> InlineKeyboardMarkup:
    keyboard = [
        [
            InlineKeyboardButton("📢 Active Channels", callback_data="owner_channels"),
            InlineKeyboardButton("➕ Add Channel", callback_data="owner_addchannel_guide"),
        ],
        [
            InlineKeyboardButton("👑 Owner List", callback_data="owner_list"),
            InlineKeyboardButton("💳 Withdrawals", callback_data="owner_withdrawals"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


# ----------------- Multi-Channel Verification (Public & Private) -----------------
_JOIN_REQUESTS_CACHE = set()


def record_join_request_to_db(chat_id: str, user_id: str, name: str, username: str):
    """
    Saves join request to memory and Firebase RTDB.
    DOES NOT approve or accept the request (keeps it pending in Telegram).
    """
    clean_chat = str(chat_id).replace("-100", "").replace("-", "")
    _JOIN_REQUESTS_CACHE.add((str(user_id), clean_chat))
    _JOIN_REQUESTS_CACHE.add((str(user_id), str(chat_id)))

    try:
        payload = json.dumps({
            "userId": str(user_id),
            "chatId": str(chat_id),
            "name": name or "",
            "username": username or "",
            "timestamp": int(time.time() * 1000),
            "status": "pending",  # Request kept pending, NOT accepted!
        }).encode("utf-8")
        safe_chat = str(chat_id).replace("-", "neg_")
        req = urllib.request.Request(
            f"{RTDB_URL}/join_requests/{safe_chat}/{user_id}.json",
            data=payload,
            method="PUT",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as e:
        logger.warning(f"Notice saving join request: {e}")


def has_user_sent_join_request(chat_id: str, user_id: str) -> bool:
    """
    Checks if the user has sent a join request to this private channel.
    """
    clean_chat = str(chat_id).replace("-100", "").replace("-", "")
    if (str(user_id), clean_chat) in _JOIN_REQUESTS_CACHE or (str(user_id), str(chat_id)) in _JOIN_REQUESTS_CACHE:
        return True

    try:
        safe_chat = str(chat_id).replace("-", "neg_")
        req = urllib.request.Request(f"{RTDB_URL}/join_requests/{safe_chat}/{user_id}.json")
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = resp.read().decode("utf-8")
            if data and data != "null":
                _JOIN_REQUESTS_CACHE.add((str(user_id), clean_chat))
                _JOIN_REQUESTS_CACHE.add((str(user_id), str(chat_id)))
                return True
    except Exception:
        pass

    return False


async def handle_chat_join_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handles when a user clicks 'Request to Join' on a private channel.
    Records that the user's request has arrived.
    DOES NOT accept or approve the request - leaves it pending as requested!
    """
    req = update.chat_join_request
    if req and req.from_user and req.chat:
        user_id = str(req.from_user.id)
        chat_id = str(req.chat.id)
        name = req.from_user.first_name or "User"
        username = req.from_user.username or ""
        record_join_request_to_db(chat_id, user_id, name, username)
        logger.info(f"📩 Join request received from {user_id} ({name}) in channel {chat_id} (Kept PENDING, NOT approved)")


async def check_user_channels_membership(bot, user_id: int) -> tuple[bool, list[dict]]:
    """
    Checks channel membership.
    For PUBLIC channels: strictly checks that the user is an active member/admin/creator.
    For PRIVATE channels: checks that the join request has arrived (WITHOUT accepting it).
    """
    channels = load_channels_from_db()
    if not channels:
        return True, []

    missing = []
    for ch in channels:
        ch_id = ch.get("id")
        if not ch_id:
            continue

        is_private = (
            ch.get("is_private") is True
            or str(ch_id).startswith("-100")
            or "t.me/+" in str(ch.get("url", ""))
            or "/joinchat/" in str(ch.get("url", ""))
        )

        # Private Channel Rule:
        # Bot only checks that request has arrived; does NOT accept the request!
        if is_private:
            req_arrived = has_user_sent_join_request(str(ch_id), str(user_id))

            if not req_arrived:
                # Also check get_chat_member in case user was already joined
                try:
                    target_chat = int(ch_id) if str(ch_id).lstrip("-").isdigit() else str(ch_id)
                    member = await bot.get_chat_member(chat_id=target_chat, user_id=user_id)
                    if member.status in ["member", "administrator", "creator"]:
                        req_arrived = True
                except Exception:
                    pass

            if not req_arrived:
                logger.info(f"Private channel {ch_id}: Join request NOT yet received from user {user_id}")
                missing.append(ch)
            else:
                logger.info(f"Private channel {ch_id}: Join request verified for user {user_id} (left pending)!")
            continue

        # Public Channel Rule: Strict verification
        try:
            target_chat = int(ch_id) if str(ch_id).lstrip("-").isdigit() else str(ch_id)
            member = await bot.get_chat_member(chat_id=target_chat, user_id=user_id)
            if member.status not in ["member", "administrator", "creator"]:
                missing.append(ch)
        except BadRequest as e:
            logger.info(f"User {user_id} not joined in public channel {ch_id}: {e}")
            missing.append(ch)
        except Exception as e:
            logger.warning(f"Error checking membership for {ch_id} (user {user_id}): {e}")
            pass

    return len(missing) == 0, missing


# ----------------- Command Handlers -----------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handle /start command matching:
    👋 Hey There User Welcome To Bot !
    🛑 Must Join Total Channel To Use Our Bot
    💣 After Joining Click Claim
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    user_id = user.id
    first_name = user.first_name or "User"
    username = user.username or ""

    referrer_id = None
    if context.args and len(context.args) > 0:
        raw_arg = context.args[0]
        referrer_id = raw_arg.replace("ref_", "").strip()

    # Track referrer relationship in DB WITHOUT awarding any spin!
    # Spin is strictly awarded ONLY after the user actually plays their first spin in the app.
    if referrer_id and str(referrer_id) != str(user_id):
        existing_u = get_user_from_db(str(user_id))
        if existing_u:
            if not existing_u.get("referredBy"):
                update_user_in_db(str(user_id), {"referredBy": referrer_id})
        else:
            now_ms = int(time.time() * 1000)
            new_u_data = {
                "id": str(user_id),
                "telegramId": str(user_id),
                "name": first_name,
                "username": username or "",
                "balance": 0,
                "spins": 1,
                "friendsJoined": 0,
                "spinsEarned": 1,
                "createdAt": now_ms,
                "isVerified": False,
                "referredBy": referrer_id,
            }
            try:
                req = urllib.request.Request(
                    f"{RTDB_URL}/users/{user_id}.json",
                    data=json.dumps(new_u_data).encode("utf-8"),
                    method="PUT",
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=5):
                    pass
            except Exception:
                pass

    channels = load_channels_from_db()
    all_joined, missing_channels = await check_user_channels_membership(context.bot, user_id)

    if all_joined and len(channels) > 0:
        db_user = get_user_from_db(str(user_id))
        if db_user and db_user.get("deviceBlocked"):
            await update.message.reply_html(
                "❌ <b>Device Verification Failed!</b>\n\n"
                "Ek device me sirf ek hi account ho sakta hai. Multiple accounts allowed nahi hain! 🚫",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("Done", callback_data="device_blocked_done")]
                ]),
            )
            return

        if db_user and (db_user.get("deviceVerified") or db_user.get("isVerified")):
            # NO referral spin on /start or restart!
            # Spin is strictly awarded ONLY after the user actually plays their first spin in the app.
            success_text = (
                f"🎉 <b>Congratulations {first_name}</b>\n\n"
                "Aap successfully verify ho gaye ho ✅\n\n"
                "Neeche button dabao aur apna Free Spin khelo 🎡"
            )
            await update.message.reply_html(
                success_text,
                reply_markup=build_success_keyboard(referrer_id),
            )
            return
        else:
            # Channels joined, now prompt device verification
            ref_tag = referrer_id if referrer_id else "none"
            verify_url = f"{WEB_URL}?verify=true&ref={ref_tag}" if ref_tag != "none" else f"{WEB_URL}?verify=true"
            verify_text = (
                "✅ <b>Sabhi Channels Verified!</b>\n\n"
                "🛡️ <b>Step 2: Device Verification</b>\n\n"
                "Apna Free Lucky Spin claim karne ke liye neeche <b>Verify Device</b> button par click karein:"
            )
            verify_kb = InlineKeyboardMarkup([
                [InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=verify_url))]
            ])
            await update.message.reply_html(
                verify_text,
                reply_markup=verify_kb,
            )
            return

    # Not all joined -> Show mandatory channels in 2 columns + Claim button
    welcome_text = (
        f"👋 <b>Hey There {first_name} Welcome To Bot !</b>\n\n"
        "🛑 <b>Must Join Total Channel To Use Our Bot</b>\n\n"
        "💣 <b>After Joining Click Claim</b>"
    )
    await update.message.reply_html(
        welcome_text,
        reply_markup=build_channel_join_keyboard(channels, referrer_id),
    )


async def claim_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handles click on '🟢 Claim' button.
    If NOT joined: Rejects immediately and says 'Pehle channel join karo'! No next step.
    If ALL joined: THEN provides Device Verification!
    """
    query = update.callback_query
    if not query or not query.from_user:
        return

    user_id = query.from_user.id
    first_name = query.from_user.first_name or "User"
    username = query.from_user.username or ""

    referrer_id = None
    if query.data and query.data.startswith("claim_"):
        ref_val = query.data.replace("claim_", "").strip()
        if ref_val and ref_val != "none":
            referrer_id = ref_val

    all_joined, missing = await check_user_channels_membership(context.bot, user_id)
    ref_tag = referrer_id if referrer_id else "none"

    if not all_joined:
        await query.answer("⚠️ Pehle sabhi channels join karein!", show_alert=True)
        ch_list = "\n• ".join([c.get("name") or str(c.get("id")) for c in missing])
        channels = load_channels_from_db()
        not_joined_text = (
            f"⚠️ <b>Pehle Channel Join Karein!</b>\n\n"
            f"Jab tak aap sabhi channels join nahi karenge (aur private channel me Request to Join nahi bhejenge), tab tak agla step nahi aayega:\n\n"
            f"• {ch_list}\n\n"
            "Sabhi channels join karne ke baad neeche <b>🟢 Claim</b> dabayein!"
        )
        await query.message.reply_html(
            not_joined_text,
            reply_markup=build_channel_join_keyboard(channels, referrer_id),
        )
        return

    # ALL CHANNELS JOINED! Now provide Device Verification:
    verify_url = f"{WEB_URL}?verify=true&ref={ref_tag}" if ref_tag != "none" else f"{WEB_URL}?verify=true"
    verify_text = (
        "✅ <b>Sabhi Channels Verified!</b>\n\n"
        "🛡️ <b>Step 2: Device Verification</b>\n\n"
        "Apna Free Lucky Spin claim karne ke liye neeche <b>Verify Device</b> button par click karein:"
    )
    verify_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=verify_url))]
    ])
    await query.message.reply_html(
        verify_text,
        reply_markup=verify_kb,
    )


async def done_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handles click on 'Done' button for Device Verification.
    Checks channel membership. If not joined, asks user to join first.
    If all joined, verifies device status.
    """
    query = update.callback_query
    if not query or not query.from_user:
        return

    user_id = query.from_user.id
    first_name = query.from_user.first_name or "User"
    username = query.from_user.username or ""

    referrer_id = None
    if query.data:
        for prefix in ("done_", "verify_", "check_"):
            if query.data.startswith(prefix):
                ref_val = query.data.replace(prefix, "").strip()
                if ref_val and ref_val != "none":
                    referrer_id = ref_val
                break

    all_joined, missing = await check_user_channels_membership(context.bot, user_id)
    ref_tag = referrer_id if referrer_id else "none"

    if not all_joined:
        ch_list = "\n• ".join([c.get("name") or str(c.get("id")) for c in missing])
        await query.answer(
            f"❌ Pehle sabhi channels join karein!\n\nPlease join:\n• {ch_list}",
            show_alert=True,
        )
        channels = load_channels_from_db()
        not_joined_text = (
            f"⚠️ <b>Pehle Channel Join Karein!</b>\n\n"
            f"Jab tak aap sabhi channels join nahi karenge (aur private channel me Request to Join nahi bhejenge), tab tak agla step nahi aayega:\n\n"
            f"• {ch_list}\n\n"
            "Sabhi channels join karne ke baad neeche <b>🟢 Claim</b> dabayein!"
        )
        await query.message.reply_html(
            not_joined_text,
            reply_markup=build_channel_join_keyboard(channels, referrer_id),
        )
        return

    # All channels joined! Check device verification status:
    db_user = get_user_from_db(str(user_id))
    if db_user and db_user.get("deviceBlocked"):
        await query.answer("❌ Ek device me sirf ek hi account ho sakta hai!", show_alert=True)
        await query.message.reply_html(
            "❌ <b>Device Verification Failed!</b>\n\n"
            "Ek device me sirf ek hi account ho sakta hai. Multiple accounts allowed nahi hain! 🚫",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Done", callback_data="device_blocked_done")]
            ]),
        )
        return

    if db_user and (db_user.get("deviceVerified") or db_user.get("isVerified")):
        await complete_verification(query, context, user_id, first_name, username, referrer_id)
        return

    # Not verified yet -> Provide Device Verification:
    verify_url = f"{WEB_URL}?verify=true&ref={ref_tag}" if ref_tag != "none" else f"{WEB_URL}?verify=true"
    verify_text = (
        "✅ <b>Sabhi Channels Verified!</b>\n\n"
        "🛡️ <b>Step 2: Device Verification</b>\n\n"
        "Apna Free Lucky Spin claim karne ke liye neeche <b>Verify Device</b> button par click karein:"
    )
    verify_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("🛡️ Verify Device", web_app=WebAppInfo(url=verify_url))]
    ])
    await query.message.reply_html(
        verify_text,
        reply_markup=verify_kb,
    )


verify_callback = done_callback


async def device_blocked_done_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Handles click on Done button when device verification has failed.
    Alerts user and does NOT open website!
    """
    query = update.callback_query
    if query:
        await query.answer(
            "❌ Device verification fail ho chuka hai! Ek device me sirf 1 account allowed hai.",
            show_alert=True,
        )


async def complete_verification(query, context, user_id, first_name, username, referrer_id):
    """
    Sends Congratulations & Open button.
    Referral spin is strictly awarded ONLY after the user plays their first spin in the app!
    """
    await query.answer("✅ Verification Successful!", show_alert=False)

    success_text = (
        f"🎉 <b>Congratulations {first_name}</b>\n\n"
        "Aap successfully verify ho gaye ho ✅\n\n"
        "Neeche button dabao aur apna Free Spin khelo 🎡"
    )

    try:
        await query.message.reply_html(
            success_text,
            reply_markup=build_success_keyboard(referrer_id),
        )
    except Exception as e:
        logger.warning(f"Notice sending verified message: {e}")


check_membership = verify_callback


async def invite_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /invite command:
    Gatekept by mandatory channel verification.
    """
    if not update.effective_user or not update.message:
        return

    user_id = update.effective_user.id
    first_name = update.effective_user.first_name or "Friend"

    all_joined, missing_channels = await check_user_channels_membership(context.bot, user_id)
    if not all_joined:
        await update.message.reply_html(
            "⚠️ <b>Pehle Sabhi Channels Join Karein!</b>\n\n"
            "Apna referral link aur spins unlock karne ke liye sabhi channels join karke Verify karein:",
            reply_markup=build_join_keyboard(missing_channels),
        )
        return

    db_user = get_user_from_db(str(user_id))
    if db_user and db_user.get("deviceBlocked"):
        await update.message.reply_html(
            "❌ <b>Access Blocked!</b>\n\nEk device me sirf 1 account chal sakta hai. Multi-account misuse prohibited hai! 🚫"
        )
        return

    spins = db_user.get("spins", 1) if db_user else 1
    friends = db_user.get("friendsJoined", 0) if db_user else 0

    ref_link = f"https://t.me/{BOT_USERNAME}?start=ref_{user_id}"
    text = (
        f"🤝 <b>Invite & Earn Lucky Spins, {first_name}!</b>\n\n"
        f"🎁 For every friend who joins using your link, you get <b>+1 Free Lucky Spin</b>!\n"
        f"🎁 Every friend also gets <b>1 Free Sign Up Spin</b>!\n\n"
        f"📊 <b>Your Current Stats:</b>\n"
        f"🎡 Spins Available: <b>{spins}</b>\n"
        f"👥 Friends Joined: <b>{friends}</b>\n\n"
        f"🔗 <b>Your Invite Link:</b>\n"
        f"<code>{ref_link}</code>\n\n"
        "Tap the button below to share directly with your friends on Telegram!"
    )
    await update.message.reply_html(
        text,
        reply_markup=build_invite_keyboard(user_id),
    )


async def check_spins(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User command /spins or /balance to check their stats."""
    if not update.effective_user or not update.message:
        return

    user_id = str(update.effective_user.id)
    first_name = update.effective_user.first_name or "Friend"

    all_joined, missing_channels = await check_user_channels_membership(context.bot, int(user_id))
    if not all_joined:
        await update.message.reply_html(
            "⚠️ <b>Pehle Sabhi Channels Join Karein!</b>\n\n"
            "Giveaway app aur balance unlock karne ke liye sabhi channels join karke Verify karein:",
            reply_markup=build_join_keyboard(missing_channels),
        )
        return

    db_user = get_user_from_db(user_id)
    if db_user and db_user.get("deviceBlocked"):
        await update.message.reply_html(
            "❌ <b>Access Blocked!</b>\n\nEk device me sirf 1 account chal sakta hai. Multi-account misuse prohibited hai! 🚫"
        )
        return

    if db_user:
        spins = db_user.get("spins", 0)
        friends = db_user.get("friendsJoined", 0)
        balance = db_user.get("balance", 0)
        text = (
            f"👤 <b>Account Stats for {first_name}:</b>\n\n"
            f"🎡 <b>Available Spins:</b> {spins}\n"
            f"👥 <b>Friends Joined:</b> {friends}\n"
            f"💰 <b>Wallet Balance:</b> ₹{balance:.2f}\n\n"
            "👉 Open the app to spin or withdraw cash!"
        )
    else:
        text = (
            f"👋 Hello {first_name}!\n\n"
            "🎁 You have <b>1 Free Sign Up Spin</b> waiting in the app!\n"
            "Tap below to open and start winning cash!"
        )

    await update.message.reply_html(
        text,
        reply_markup=build_success_keyboard(),
    )


# ----------------- OWNER COMMANDS & MANAGEMENT -----------------

async def owner_help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /ownerhelp command:
    Comprehensive owner manual and quick interactive buttons.
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    user_id = user.id
    username = user.username or ""

    if not is_owner(user_id, username):
        await update.message.reply_html(
            "⛔ <b>Access Denied!</b>\n\n"
            "This command is restricted. Only authorized bot owners can use <code>/ownerhelp</code>."
        )
        logger.warning(f"Unauthorized /ownerhelp attempt by ID: {user_id}, @{username}")
        return

    channels = load_channels_from_db()
    owners = load_owners_from_db()

    help_text = (
        "👑 <b>ROHIT GIVEAWAY - OWNER CONTROL PANEL</b>\n\n"
        "Welcome Owner! Yahan se aap Public & Private channels add/remove kar sakte hain.\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "📢 <b>CHANNEL MANAGEMENT COMMANDS:</b>\n\n"
        "1️⃣ <b>Public Channel Add Karein:</b>\n"
        "<code>/addchannel @channel_username [Channel Name]</code>\n"
        "<i>Example:</i> <code>/addchannel @sauravsanganya Official Channel</code>\n\n"
        "2️⃣ <b>Private Channel Add Karein:</b>\n"
        "<code>/addchannel &lt;chat_id&gt; &lt;invite_link&gt; [Channel Name]</code>\n"
        "<i>Example:</i> <code>/addchannel -1002345678901 https://t.me/+AbCdEfGh VIP Private Channel</code>\n"
        "<i>(Note: Bot channel me Admin hona chahiye)</i>\n\n"
        "3️⃣ <b>Channel Remove Karein:</b>\n"
        "<code>/removechannel &lt;@username ya chat_id&gt;</code>\n\n"
        "4️⃣ <b>Sabhi Channels Dekhein:</b>\n"
        "<code>/channels</code>\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "👥 <b>OWNER ACCESS:</b>\n"
        "• <code>/addowner &lt;user_id ya @username&gt;</code>\n"
        "• <code>/delowner &lt;user_id ya @username&gt;</code>\n"
        "• <code>/owners</code> - <i>Authorized owners list</i>\n\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "💳 <b>FINANCE & BROADCAST:</b>\n"
        "• <code>/withdrawals</code> - <i>Pending withdrawal requests</i>\n"
        "• <code>/clearwithdrawals</code> - <i>Permanently wipe all withdrawals</i>\n"
        "• <code>/broadcast &lt;message&gt;</code> - <i>Send announcement to all users</i>\n\n"
        f"📊 <b>Active Channels:</b> {len(channels)} | <b>Owners:</b> {len(owners)}"
    )

    await update.message.reply_html(
        help_text,
        reply_markup=build_owner_panel_keyboard(),
    )


async def add_channel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /addchannel command:
    Supports Public (@channel) and Private (-100... + invite link) channels!
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b> Only owners can add channels.")
        return

    if not context.args or len(context.args) == 0:
        await update.message.reply_html(
            "⚠️ <b>Usage:</b>\n\n"
            "<b>Public Channel:</b>\n"
            "<code>/addchannel @username Channel Name</code>\n\n"
            "<b>Private Channel:</b>\n"
            "<code>/addchannel -1001234567890 https://t.me/+joinlink VIP Channel</code>"
        )
        return

    arg0 = context.args[0].strip()

    if arg0.startswith("-100") or (arg0.startswith("-") and arg0[1:].isdigit()):
        channel_id = arg0
        if len(context.args) < 2:
            await update.message.reply_html(
                "⚠️ Private channel ke liye invite link bhi zaroori hai:\n"
                "<code>/addchannel -100xxxxxxxxxx https://t.me/+xxxxxx Channel Name</code>"
            )
            return

        channel_url = context.args[1].strip()
        title = " ".join(context.args[2:]).strip() if len(context.args) > 2 else f"Private Channel {channel_id}"
        is_private = True
    else:
        match = re.search(r"t\.me/([a-zA-Z0-9_]+)", arg0)
        if match:
            uname = match.group(1)
            channel_id = f"@{uname}"
            channel_url = f"https://t.me/{uname}"
        else:
            channel_id = f"@{arg0.lstrip('@')}"
            channel_url = f"https://t.me/{arg0.lstrip('@')}"

        title = " ".join(context.args[1:]).strip() if len(context.args) > 1 else channel_id
        is_private = False

    status_msg = await update.message.reply_text(f"🔄 Checking access to {channel_id}...")

    try:
        target_chat = int(channel_id) if is_private else channel_id
        chat = await context.bot.get_chat(chat_id=target_chat)
        if chat.title and (not title or title == channel_id):
            title = chat.title
        if not is_private and chat.username:
            channel_url = f"https://t.me/{chat.username}"
    except Exception as e:
        logger.warning(f"Could not verify chat with get_chat: {e}")

    channel_info = {
        "id": channel_id,
        "name": title,
        "url": channel_url,
        "is_private": is_private,
        "addedBy": str(user.id),
        "addedAt": int(time.time() * 1000),
    }

    success = save_channel_to_db(channel_info)

    if success:
        if not is_private:
            try:
                req = urllib.request.Request(
                    f"{RTDB_URL}/settings.json",
                    data=json.dumps({"telegramChannelUrl": channel_url}).encode("utf-8"),
                    method="PATCH",
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=5):
                    pass
            except Exception:
                pass

        kind = "🔒 Private" if is_private else "📢 Public"
        await status_msg.edit_text(
            f"✅ <b>{kind} Channel Successfully Added!</b>\n\n"
            f"🏷️ <b>Name:</b> {title}\n"
            f"🆔 <b>ID:</b> <code>{channel_id}</code>\n"
            f"🔗 <b>Link:</b> {channel_url}\n\n"
            f"Ab jab tak koi user is channel me join nahi hoga, tab tak giveaway app link nahi milega!",
            parse_mode="HTML",
        )
    else:
        await status_msg.edit_text("❌ Failed to save channel to database. Please check connection.")


async def remove_channel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /removechannel <@channel_username or id>
    Permanently deletes a channel from mandatory verification.
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b> Only owners can remove channels.")
        return

    if not context.args or len(context.args) == 0:
        channels = load_channels_from_db()
        lines = [f"• <code>{c.get('id')}</code> ({c.get('name')})" for c in channels]
        await update.message.reply_html(
            "⚠️ <b>Usage:</b>\n<code>/removechannel &lt;@username ya chat_id&gt;</code>\n\n"
            "<b>Current Active Channels:</b>\n" + ("\n".join(lines) if lines else "None")
        )
        return

    raw_ident = context.args[0].strip()
    success = delete_channel_from_db(raw_ident)
    if success:
        await update.message.reply_html(
            f"🗑️ <b>Channel Removed!</b>\n\n"
            f"Channel <code>{raw_ident}</code> has been removed from mandatory verification."
        )
    else:
        await update.message.reply_html("❌ Could not remove channel from database.")


async def list_channels_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /channels command:
    Displays all mandatory channels with clickable links.
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b>")
        return

    channels = load_channels_from_db()
    if not channels:
        await update.message.reply_html(
            "ℹ️ No mandatory channels configured.\nUse <code>/addchannel @username</code> to add one!"
        )
        return

    text = f"📢 <b>Mandatory Verification Channels ({len(channels)}):</b>\n\n"
    for i, ch in enumerate(channels, 1):
        name = ch.get("name") or "Channel"
        cid = ch.get("id")
        url = ch.get("url") or "No link"
        kind = "🔒 Private" if ch.get("is_private") else "📢 Public"
        text += f"<b>{i}. {name}</b> ({kind})\n   ID: <code>{cid}</code>\n   Link: {url}\n\n"

    text += "💡 To add a public channel: <code>/addchannel @channel_name</code>\n💡 To add private: <code>/addchannel &lt;id&gt; &lt;link&gt; Title</code>\n💡 To remove: <code>/removechannel &lt;id/name&gt;</code>"
    await update.message.reply_html(text)


async def add_owner_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /addowner <user_id or @username>
    Adds a new owner dynamically.
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b>")
        return

    if not context.args or len(context.args) == 0:
        await update.message.reply_html("⚠️ <b>Usage:</b> <code>/addowner &lt;user_id or @username&gt;</code>")
        return

    new_owner = context.args[0].strip()
    save_owner_to_db(new_owner)
    await update.message.reply_html(f"✅ User <code>{new_owner}</code> has been added as an authorized Bot Owner!")


async def del_owner_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /delowner <user_id or @username>
    Removes an owner dynamically.
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b>")
        return

    if not context.args or len(context.args) == 0:
        await update.message.reply_html("⚠️ <b>Usage:</b> <code>/delowner &lt;user_id or @username&gt;</code>")
        return

    target = context.args[0].strip()
    delete_owner_from_db(target)
    await update.message.reply_html(f"🗑️ Removed <code>{target}</code> from Owner privileges.")


async def list_owners_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /owners command:
    Lists all authorized owners.
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b>")
        return

    owners = load_owners_from_db()
    text = "👑 <b>Authorized Bot Owners:</b>\n\n"
    for o in sorted(owners):
        text += f"• <code>{o}</code>\n"
    text += "\nTo add another owner: <code>/addowner &lt;id or @username&gt;</code>"
    await update.message.reply_html(text)


async def check_withdrawals(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command /withdrawals or /payouts."""
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b>")
        return

    status_msg = await update.message.reply_text("🔄 Checking Firebase database for withdrawals...")

    try:
        req = urllib.request.Request(
            f"{RTDB_URL}/withdrawals.json",
            headers={"User-Agent": "TelegramBot/1.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if not data:
            await status_msg.edit_text("ℹ️ No withdrawal requests found in database.")
            return

        items = list(data.values()) if isinstance(data, dict) else data
        pending = [x for x in items if isinstance(x, dict) and x.get("status") == "pending"]

        if not pending:
            await status_msg.edit_text(f"✅ Total {len(items)} withdrawals on record. 0 Pending!")
            return

        text = f"⚡ <b>Found {len(pending)} PENDING Withdrawal(s):</b>\n\n"
        for i, w in enumerate(pending[:10], start=1):
            amt = w.get("amount", 0)
            user_name = w.get("userName", "User")
            user_id = w.get("userId", "N/A")
            method = w.get("method", "upi").upper()
            detail = w.get("upiId") if method == "UPI" else f"A/C: {w.get('accountNumber')} (IFSC: {w.get('ifsc')})"
            text += f"<b>{i}. ₹{amt}</b> by {user_name} (#{user_id})\n   Type: {method} ({detail})\n\n"

        await status_msg.edit_text(text, parse_mode="HTML")
    except Exception as e:
        await status_msg.edit_text(f"❌ Error fetching withdrawals: {e}")


async def clear_withdrawals_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Owner command /clearwithdrawals to wipe all withdrawal records."""
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b>")
        return

    status_msg = await update.message.reply_text("🔄 Permanently deleting all withdrawals from Firebase RTDB...")
    try:
        req = urllib.request.Request(f"{RTDB_URL}/withdrawals.json", method="DELETE")
        with urllib.request.urlopen(req, timeout=8):
            pass
        await status_msg.edit_text("✅ <b>All withdrawals permanently deleted from Firebase database!</b> Database is now clean and empty.", parse_mode="HTML")
    except Exception as e:
        await status_msg.edit_text(f"❌ Error deleting withdrawals: {e}")


async def execute_broadcast_message(bot, from_chat_id: int, message_id: int, status_reply_msg):
    """
    Broadcasts message to all users in Firebase RTDB using copy_message.
    Preserves 100% of:
    - Direct Gallery photos & videos
    - Telegram Premium Custom Emojis
    - Original captions and formatting
    """
    status_msg = await status_reply_msg.reply_text("🔄 Preparing to forward/broadcast to all users...")

    try:
        req = urllib.request.Request(f"{RTDB_URL}/users.json")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if not data or not isinstance(data, dict):
            await status_msg.edit_text("ℹ️ No users found in database to broadcast.")
            return

        user_ids = list(data.keys())
        sent = 0
        failed = 0

        for uid in user_ids:
            if uid.isdigit():
                try:
                    # copy_message preserves Telegram Premium custom emojis & exact formatting!
                    await bot.copy_message(
                        chat_id=int(uid),
                        from_chat_id=from_chat_id,
                        message_id=message_id,
                    )
                    sent += 1
                except Exception:
                    # Fallback to forward_message
                    try:
                        await bot.forward_message(
                            chat_id=int(uid),
                            from_chat_id=from_chat_id,
                            message_id=message_id,
                        )
                        sent += 1
                    except Exception:
                        failed += 1
                time.sleep(0.04)  # Safe Telegram rate limit

        await status_msg.edit_text(
            f"✅ <b>Broadcast / Forward Finished!</b>\n\n"
            f"🚀 Delivered: <b>{sent}</b> users\n"
            f"⚠️ Inactive/Blocked: <b>{failed}</b>\n\n"
            f"✨ Telegram Premium Emojis & media successfully forwarded!",
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error(f"Error in broadcast: {e}")
        await status_msg.edit_text(f"❌ Error in broadcast: {e}")


async def handle_owner_gallery_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Triggered when Owner sends a photo directly from phone gallery.
    If caption starts with /broadcast: broadcasts immediately!
    Otherwise: offers 1-Click Forward to All Users button.
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        return  # Only authorized bot owners

    msg = update.message
    caption = msg.caption or ""

    if caption.lower().startswith("/broadcast"):
        await execute_broadcast_message(
            bot=context.bot,
            from_chat_id=msg.chat_id,
            message_id=msg.message_id,
            status_reply_msg=msg,
        )
        return

    # Direct photo from gallery without /broadcast -> 1-Click Forward to All
    kb = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🚀 Sabko Forward / Broadcast Karein", callback_data=f"bcast_send_{msg.message_id}"),
        ],
        [
            InlineKeyboardButton("❌ Cancel", callback_data="bcast_cancel"),
        ],
    ])

    await msg.reply_html(
        "🖼️ <b>Gallery Photo Mili Hai!</b>\n\n"
        "✨ <b>Telegram Premium Emojis & Caption</b> bilkul waise hi forward honge jaise aapne bheje hain.\n\n"
        "Kya aap is photo ko sabhi bot users ko forward karna chahte hain?",
        reply_markup=kb,
    )


async def owner_broadcast_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles click on 'Sabko Forward' button for gallery photos."""
    query = update.callback_query
    if not query or not query.data:
        return

    user = query.from_user
    if not is_owner(user.id, user.username):
        await query.answer("⛔ Only owners can perform broadcasts.", show_alert=True)
        return

    data = query.data

    if data.startswith("bcast_send_"):
        mid = int(data.replace("bcast_send_", ""))
        await query.answer("🚀 Forwarding started...")
        await query.edit_message_text("🔄 Forwarding in progress with Premium Emojis...")
        await execute_broadcast_message(
            bot=context.bot,
            from_chat_id=query.message.chat_id,
            message_id=mid,
            status_reply_msg=query.message,
        )
    elif data == "bcast_cancel":
        await query.answer("Broadcast cancelled")
        await query.edit_message_text("❌ Broadcast cancelled.")


async def broadcast_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /broadcast <message>
    Sends announcement message (supports Text or Image with Caption & Premium Emojis).
    Supports:
    1. Photo from gallery (direct or with /broadcast caption)
    2. Reply to any photo/message with /broadcast
    3. Text message: /broadcast <message>
    """
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    if not is_owner(user.id, user.username):
        await update.message.reply_html("⛔ <b>Access Denied!</b>")
        return

    # Case 1: Replied to a photo or message -> Copy & forward that exact message
    if update.message.reply_to_message:
        target_msg = update.message.reply_to_message
        await execute_broadcast_message(
            bot=context.bot,
            from_chat_id=target_msg.chat_id,
            message_id=target_msg.message_id,
            status_reply_msg=update.message,
        )
        return

    # Case 2: Message itself has a photo
    if update.message.photo:
        await execute_broadcast_message(
            bot=context.bot,
            from_chat_id=update.message.chat_id,
            message_id=update.message.message_id,
            status_reply_msg=update.message,
        )
        return

    # Case 3: Text message
    if not context.args or len(context.args) == 0:
        await update.message.reply_html(
            "⚠️ <b>Broadcast Usage:</b>\n\n"
            "🖼️ <b>Direct Gallery Photo:</b>\n"
            "Gallery se photo bhejein aur button dabayein, ya caption me <code>/broadcast</code> likhein.\n\n"
            "💬 <b>Reply karke:</b>\n"
            "Kisi bhi photo/message ka reply karein aur <code>/broadcast</code> likhein.\n\n"
            "📝 <b>Text Broadcast:</b>\n"
            "<code>/broadcast Aapka message yahan</code>\n\n"
            "✨ <i>Telegram Premium Emojis 100% preserve hokar sabhi users ko jayenge!</i>"
        )
        return

    # Plain text broadcast using copy_message to preserve any custom emojis
    await execute_broadcast_message(
        bot=context.bot,
        from_chat_id=update.message.chat_id,
        message_id=update.message.message_id,
        status_reply_msg=update.message,
    )


# ----------------- Owner Callback Query Handlers -----------------
async def owner_callback_router(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Route callbacks for owner interactive control buttons."""
    query = update.callback_query
    if not query or not query.data:
        return

    user_id = query.from_user.id
    username = query.from_user.username or ""

    if not is_owner(user_id, username):
        await query.answer("⛔ Only authorized owners can use these actions.", show_alert=True)
        return

    data = query.data

    if data == "owner_channels":
        await query.answer()
        channels = load_channels_from_db()
        text = f"📢 <b>Active Channels ({len(channels)}):</b>\n\n"
        for i, ch in enumerate(channels, 1):
            kind = "🔒 Private" if ch.get("is_private") else "📢 Public"
            text += f"<b>{i}. {ch.get('name')}</b> ({kind})\nID: <code>{ch.get('id')}</code>\nLink: {ch.get('url')}\n\n"
        text += "To add public: <code>/addchannel @channel_name</code>\nTo add private: <code>/addchannel &lt;id&gt; &lt;link&gt; Title</code>\nTo remove: <code>/removechannel &lt;id/name&gt;</code>"
        await query.message.reply_html(text)

    elif data == "owner_addchannel_guide":
        await query.answer()
        guide = (
            "➕ <b>HOW TO ADD CHANNELS:</b>\n\n"
            "<b>1. Public Channel:</b>\n"
            "<code>/addchannel @channel_username Channel Name</code>\n\n"
            "<b>2. Private Channel:</b>\n"
            "<code>/addchannel -1001234567890 https://t.me/+joinlink Channel Name</code>\n\n"
            "<i>(Zaroori: Bot ko channel me Administrator banayein with Invite Users permission!)</i>"
        )
        await query.message.reply_html(guide)

    elif data == "owner_list":
        await query.answer()
        owners = load_owners_from_db()
        text = "👑 <b>Authorized Owners:</b>\n\n" + "\n".join([f"• <code>{o}</code>" for o in sorted(owners)])
        text += "\n\nAdd new: <code>/addowner &lt;id or username&gt;</code>"
        await query.message.reply_html(text)

    elif data == "owner_withdrawals":
        await query.answer()
        await check_withdrawals(update, context)


# ----------------- Error Handler -----------------
async def global_error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    """Suppress harmless network errors and log unexpected issues."""
    err = context.error
    if isinstance(err, (TimedOut, NetworkError)):
        logger.warning(f"Transient network notice: {err}")
    elif isinstance(err, BadRequest) and "Message is not modified" in str(err):
        pass
    else:
        logger.error(f"Telegram Exception encountered: {err}")


# ----------------- Main Bot Lifecycle -----------------
def main():
    """Start Telegram bot with high resilience against network drops."""
    logger.info("Initializing Rohit Giveaway Telegram Bot...")

    # Start Render Health Check Web Server in background daemon thread
    t = threading.Thread(target=start_health_server, daemon=True)
    t.start()

    load_channels_from_db()
    load_owners_from_db()

    request = HTTPXRequest(
        connect_timeout=25.0,
        read_timeout=25.0,
        write_timeout=25.0,
        pool_timeout=25.0,
    )

    app = ApplicationBuilder().token(TOKEN).request(request).build()

    # User commands (Gatekept by channel check)
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler(["invite", "link", "referral"], invite_command))
    app.add_handler(CommandHandler(["spins", "balance", "stats"], check_spins))

    # Owner commands (Protected by is_owner check)
    app.add_handler(CommandHandler(["ownerhelp", "owner", "adminhelp"], owner_help_command))
    app.add_handler(CommandHandler(["addchannel", "newchannel"], add_channel_command))
    app.add_handler(CommandHandler(["removechannel", "delchannel"], remove_channel_command))
    app.add_handler(CommandHandler(["channels", "listchannels"], list_channels_command))
    app.add_handler(CommandHandler("addowner", add_owner_command))
    app.add_handler(CommandHandler("delowner", del_owner_command))
    app.add_handler(CommandHandler("owners", list_owners_command))
    app.add_handler(CommandHandler(["withdrawals", "payouts"], check_withdrawals))
    app.add_handler(CommandHandler(["clearwithdrawals", "deletewithdrawals"], clear_withdrawals_command))
    app.add_handler(CommandHandler("broadcast", broadcast_command))
    app.add_handler(MessageHandler(filters.PHOTO & filters.CaptionRegex(r"^/broadcast(\s|$)"), broadcast_command))
    app.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO, handle_owner_gallery_photo))

    # Callback Query Handlers
    app.add_handler(CallbackQueryHandler(claim_callback, pattern=r"^claim_"))
    app.add_handler(CallbackQueryHandler(done_callback, pattern=r"^(done_|verify_|check_)"))
    app.add_handler(CallbackQueryHandler(device_blocked_done_callback, pattern=r"^device_blocked_done$"))
    app.add_handler(CallbackQueryHandler(owner_broadcast_callback, pattern=r"^bcast_"))
    app.add_handler(CallbackQueryHandler(owner_callback_router, pattern=r"^owner_"))

    # Chat Join Request Handler (For Private Channels - Request Sent)
    app.add_handler(ChatJoinRequestHandler(handle_chat_join_request))

    # Error handling
    app.add_error_handler(global_error_handler)

    logger.info(f"Bot @{BOT_USERNAME} successfully started! Running polling...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
