const TelegramBot = require("node-telegram-bot-api")
const fetch = require("node-fetch")

// Replace 'YOUR_BOT_TOKEN' with your actual bot token
const token = "7722638963:AAHVlmpfjE8i-076pOO_W2n7yMSjY160X2Q"

// Create a bot instance
const bot = new TelegramBot(token, { polling: true })

const QURAN_API = "https://api.quran.com/api/v4"
const PRAYER_TIMES_API = "https://api.aladhan.com/v1"

// In-memory storage (note: this will reset on server restarts)
const userStates = new Map()
const userPreferences = new Map()
const favorites = new Map()

// Main menu command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id
  sendMainMenu(chatId)
})

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id
  sendHelpMenu(chatId)
})

// Settings command
bot.onText(/\/settings/, (msg) => {
  const chatId = msg.chat.id
  sendSettingsMenu(chatId)
})

// Quran command
bot.onText(/\/quran/, async (msg) => {
  const chatId = msg.chat.id
  const quranMenu = await getQuranMenu()
  bot.sendMessage(chatId, quranMenu.text, { reply_markup: quranMenu.keyboard })
})

// Prayer times command
bot.onText(/\/prayertimes/, (msg) => {
  const chatId = msg.chat.id
  sendPrayerTimesMenu(chatId)
})

// Calendar command
bot.onText(/\/calendar/, async (msg) => {
  const chatId = msg.chat.id
  const islamicDate = await getIslamicDate()
  bot.sendMessage(chatId, islamicDate.text, { reply_markup: islamicDate.keyboard, parse_mode: "Markdown" })
})

// Search command
bot.onText(/\/search/, (msg) => {
  const chatId = msg.chat.id
  sendSearchMenu(chatId)
})

// Favorites command
bot.onText(/\/favorites/, async (msg) => {
  const chatId = msg.chat.id
  const favoritesMenu = await getFavorites(chatId)
  bot.sendMessage(chatId, favoritesMenu.text, { reply_markup: favoritesMenu.keyboard, parse_mode: "Markdown" })
})

// Notifications command
bot.onText(/\/notifications/, (msg) => {
  const chatId = msg.chat.id
  sendNotificationsMenu(chatId)
})

// Handle callback queries
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id
  const data = callbackQuery.data

  let response

  if (data.startsWith("quran_surah_")) {
    const [_, surahNumber, page] = data.split("_")
    response = await getQuranSurah(
      Number.parseInt(surahNumber),
      Number.parseInt(page) || 1,
      getUserPreference(chatId, "quranTranslation"),
    )
  } else if (data.startsWith("quran_ayah_")) {
    const [_, surah, ayah] = data.split("_")
    response = await getQuranAyah(
      Number.parseInt(surah),
      Number.parseInt(ayah),
      getUserPreference(chatId, "quranTranslation"),
    )
  } else if (data.startsWith("search_")) {
    const type = data.replace("search_", "")
    userStates.set(chatId, { action: `searching_${type}` })
    response = {
      text: `🔍 Please enter your search query for ${type}:`,
      keyboard: {
        inline_keyboard: [[{ text: "🔙 Back to Search Menu", callback_data: "/search" }]],
      },
    }
  } else if (data.startsWith("set_lang_")) {
    const lang = data.replace("set_lang_", "")
    setUserPreference(chatId, "language", lang)
    response = getSettingsMenu(chatId)
  } else if (data.startsWith("set_prayer_method_")) {
    const method = Number.parseInt(data.replace("set_prayer_method_", ""))
    setUserPreference(chatId, "prayerMethod", method)
    response = getSettingsMenu(chatId)
  } else if (data === "toggle_notifications") {
    toggleNotifications(chatId)
    response = getNotificationsMenu(chatId)
  } else if (data.startsWith("favorite_")) {
    response = await toggleFavorite(chatId, data.replace("favorite_", ""))
  } else {
    response = getMainMenu()
  }

  bot.editMessageText(response.text, {
    chat_id: chatId,
    message_id: callbackQuery.message.message_id,
    reply_markup: response.keyboard,
    parse_mode: "Markdown",
  })
})

// Handle regular messages (for search queries)
bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text

  if (userStates.get(chatId)?.action?.startsWith("searching_")) {
    const searchType = userStates.get(chatId).action.replace("searching_", "")
    const response = await performSearch(searchType, text)
    bot.sendMessage(chatId, response.text, { reply_markup: response.keyboard, parse_mode: "Markdown" })
    userStates.delete(chatId)
  }
})

// Handle location sharing for prayer times
bot.on("location", async (msg) => {
  const chatId = msg.chat.id
  const { latitude, longitude } = msg.location
  const response = await getPrayerTimes(latitude, longitude, getUserPreference(chatId, "prayerMethod"))
  bot.sendMessage(chatId, response.text, { reply_markup: response.keyboard, parse_mode: "Markdown" })
})

function sendMainMenu(chatId) {
  const menu = getMainMenu()
  bot.sendMessage(chatId, menu.text, { reply_markup: menu.keyboard })
}

function sendHelpMenu(chatId) {
  const menu = getHelpMenu()
  bot.sendMessage(chatId, menu.text, { reply_markup: menu.keyboard, parse_mode: "Markdown" })
}

function sendSettingsMenu(chatId) {
  const menu = getSettingsMenu(chatId)
  bot.sendMessage(chatId, menu.text, { reply_markup: menu.keyboard, parse_mode: "Markdown" })
}

function sendPrayerTimesMenu(chatId) {
  const menu = getPrayerTimesMenu()
  bot.sendMessage(chatId, menu.text, { reply_markup: menu.keyboard })
}

function sendSearchMenu(chatId) {
  const menu = getSearchMenu()
  bot.sendMessage(chatId, menu.text, { reply_markup: menu.keyboard, parse_mode: "Markdown" })
}

function sendNotificationsMenu(chatId) {
  const menu = getNotificationsMenu(chatId)
  bot.sendMessage(chatId, menu.text, { reply_markup: menu.keyboard, parse_mode: "Markdown" })
}

function getMainMenu() {
  return {
    text:
      "🌟 Welcome to the Islamic Information Bot!\n\nChoose from these options:\n\n" +
      "📖 /quran - Read Quran verses\n" +
      "🕌 /prayertimes - Get prayer times\n" +
      "📅 /calendar - Islamic calendar\n" +
      "🔍 /search - Search Quran\n" +
      "⚙️ /settings - Settings\n" +
      "⭐ /favorites - Favorites\n" +
      "🔔 /notifications - Notifications\n" +
      "🤝 /help - Help",
    keyboard: {
      inline_keyboard: [
        [{ text: "📖 Quran", callback_data: "/quran" }],
        [{ text: "🕌 Prayer Times", callback_data: "/prayertimes" }],
        [{ text: "📅 Islamic Calendar", callback_data: "/calendar" }],
        [{ text: "🔍 Search", callback_data: "/search" }],
        [{ text: "⚙️ Settings", callback_data: "/settings" }],
        [{ text: "⭐ Favorites", callback_data: "/favorites" }],
        [{ text: "🔔 Notifications", callback_data: "/notifications" }],
        [{ text: "🤝 Help", callback_data: "/help" }],
      ],
    },
  }
}

function getHelpMenu() {
  return {
    text:
      "🤝 *Help & Information*\n\n" +
      "*Available Commands:*\n" +
      "🏠 /start - Main menu\n" +
      "📖 /quran - Read Quran verses\n" +
      "🕌 /prayertimes - Get prayer times\n" +
      "📅 /calendar - Islamic calendar\n" +
      "🔍 /search - Search Quran\n" +
      "⚙️ /settings - Customize your preferences\n" +
      "⭐ /favorites - View your saved items\n" +
      "🔔 /notifications - Manage notifications\n\n" +
      "*Tips:*\n" +
      "• 📍 Share your location for accurate prayer times\n" +
      "• 🔎 Use the search function to find specific verses\n" +
      "• 🌟 Save your favorite items for quick access\n" +
      "• 🛎️ Enable notifications for prayer times",
    keyboard: {
      inline_keyboard: [[{ text: "🔙 Back to Main Menu", callback_data: "/start" }]],
    },
  }
}

function getSettingsMenu(chatId) {
  const prefs = getUserPreferences(chatId)
  return {
    text:
      "⚙️ *Settings*\n\n" +
      `🌐 *Language:* ${prefs.language.toUpperCase()}\n` +
      `🕌 *Prayer Calculation Method:* ${getPrayerMethodName(prefs.prayerMethod)}\n` +
      `🔔 *Notifications:* ${prefs.notificationsEnabled ? "Enabled ✅" : "Disabled ❌"}`,
    keyboard: {
      inline_keyboard: [
        [
          { text: "🌐 Language", callback_data: "set_lang_menu" },
          { text: "🕌 Prayer Method", callback_data: "set_prayer_method_menu" },
        ],
        [
          { text: "🔔 Notifications", callback_data: "/notifications" },
          { text: "📖 Quran Translation", callback_data: "set_quran_translation" },
        ],
        [{ text: "🔙 Back to Main Menu", callback_data: "/start" }],
      ],
    },
  }
}

function getSearchMenu() {
  return {
    text: "🔍 *Search*\n\nWhat would you like to search?",
    keyboard: {
      inline_keyboard: [
        [{ text: "📖 Quran", callback_data: "search_quran" }],
        [{ text: "🔙 Back to Main Menu", callback_data: "/start" }],
      ],
    },
  }
}

function getPrayerTimesMenu() {
  return {
    text: "🕌 Please share your location to get accurate prayer times.",
    keyboard: {
      inline_keyboard: [[{ text: "🔙 Back to Main Menu", callback_data: "/start" }]],
    },
  }
}

function getNotificationsMenu(chatId) {
  const prefs = getUserPreferences(chatId)
  return {
    text: `🔔 *Notifications*\n\nCurrently ${prefs.notificationsEnabled ? "enabled ✅" : "disabled ❌"}.`,
    keyboard: {
      inline_keyboard: [
        [
          {
            text: prefs.notificationsEnabled ? "🔕 Disable Notifications" : "🔔 Enable Notifications",
            callback_data: "toggle_notifications",
          },
        ],
        [{ text: "🔙 Back to Settings", callback_data: "/settings" }],
      ],
    },
  }
}

async function getQuranMenu(page = 1) {
  const response = await fetch(`${QURAN_API}/chapters`)
  const data = await response.json()
  const surahs = data.chapters
  const itemsPerPage = 10
  const startIndex = (page - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSurahs = surahs.slice(startIndex, endIndex)

  const keyboard = paginatedSurahs.map((surah) => [
    {
      text: `${surah.id}. ${surah.name_simple}`,
      callback_data: `quran_surah_${surah.id}_1`,
    },
  ])

  // Add navigation buttons
  const navigationRow = []
  if (page > 1) {
    navigationRow.push({ text: "⬅️ Previous", callback_data: `quran_menu_${page - 1}` })
  }
  if (endIndex < surahs.length) {
    navigationRow.push({ text: "Next ➡️", callback_data: `quran_menu_${page + 1}` })
  }
  if (navigationRow.length > 0) {
    keyboard.push(navigationRow)
  }

  keyboard.push([{ text: "🔙 Back to Main Menu", callback_data: "/start" }])

  return {
    text: "📖 *Quran*\n\nSelect a Surah:",
    keyboard: {
      inline_keyboard: keyboard,
    },
  }
}

async function getQuranSurah(surahNumber, page = 1, translationId) {
  const versesPerPage = 5
  const startVerse = (page - 1) * versesPerPage + 1
  const endVerse = startVerse + versesPerPage - 1

  const response = await fetch(
    `${QURAN_API}/verses/by_chapter/${surahNumber}?translations=${translationId}&language=en&verse_key=${surahNumber}:${startVerse}-${endVerse}`,
  )
  const data = await response.json()
  const verses = data.verses

  let text = `📖 *Surah ${data.verses[0].chapter_name}*\n\n`
  verses.forEach((verse) => {
    text += `*${verse.verse_key}:* ${verse.text_indopak}\n${verse.translations[0].text}\n\n`
  })

  const keyboard = [
    [
      { text: "⬅️ Previous", callback_data: `quran_surah_${surahNumber}_${page - 1}` },
      { text: "Next ➡️", callback_data: `quran_surah_${surahNumber}_${page + 1}` },
    ],
    [{ text: "🔙 Back to Quran Menu", callback_data: "/quran" }],
  ]

  return {
    text,
    keyboard: {
      inline_keyboard: keyboard,
    },
  }
}

async function getQuranAyah(surah, ayah, translationId) {
  const response = await fetch(`${QURAN_API}/verses/by_key/${surah}:${ayah}?translations=${translationId}&language=en`)
  const data = await response.json()
  const verse = data.verse

  const text = `📖 *Quran ${verse.verse_key}*\n\n${verse.text_indopak}\n\n*Translation:*\n${verse.translations[0].text}`

  return {
    text,
    keyboard: {
      inline_keyboard: [
        [{ text: "⭐ Add to Favorites", callback_data: `favorite_quran_${verse.verse_key}` }],
        [{ text: "🔙 Back to Quran Menu", callback_data: "/quran" }],
      ],
    },
  }
}

async function performSearch(type, query) {
  if (type === "quran") {
    const response = await fetch(`${QURAN_API}/search?q=${encodeURIComponent(query)}`)
    const data = await response.json()
    const results = data.search.results.slice(0, 5)

    let text = `🔍 *Search Results for "${query}" in Quran:*\n\n`
    results.forEach((result) => {
      text += `*${result.verse_key}*\n${result.text}\n\n`
    })

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: "🔍 New Search", callback_data: "search_quran" }],
          [{ text: "🔙 Back to Search Menu", callback_data: "/search" }],
        ],
      },
    }
  }
}

async function getPrayerTimes(latitude, longitude, method) {
  const date = new Date()
  const response = await fetch(
    `${PRAYER_TIMES_API}/timings/${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}?latitude=${latitude}&longitude=${longitude}&method=${method}`,
  )
  const data = await response.json()
  const timings = data.data.timings
  return {
    text:
      `🕌 *Prayer Times*\n\n` +
      `🌅 Fajr: ${timings.Fajr}\n` +
      `🌄 Sunrise: ${timings.Sunrise}\n` +
      `☀️ Dhuhr: ${timings.Dhuhr}\n` +
      `🌅 Asr: ${timings.Asr}\n` +
      `🌆 Maghrib: ${timings.Maghrib}\n` +
      `🌙 Isha: ${timings.Isha}`,
    keyboard: {
      inline_keyboard: [[{ text: "🔙 Back to Main Menu", callback_data: "/start" }]],
    },
  }
}

async function getIslamicDate() {
  const response = await fetch(`${PRAYER_TIMES_API}/gToH?date=${new Date().toISOString().split("T")[0]}`)
  const data = await response.json()
  const islamicDate = data.data.hijri
  return {
    text:
      `📅 *Islamic Date*\n\n${islamicDate.day} ${islamicDate.month.en} ${islamicDate.year} AH\n\n` +
      `📆 *Gregorian:* ${data.data.gregorian.date}\n` +
      `📅 *Day:* ${islamicDate.weekday.en}\n` +
      `🎉 *Holidays:* ${islamicDate.holidays.join(", ") || "None"}`,
    keyboard: {
      inline_keyboard: [[{ text: "🔙 Back to Main Menu", callback_data: "/start" }]],
    },
  }
}

async function getFavorites(chatId) {
  const userFavorites = favorites.get(chatId) || []
  if (userFavorites.length === 0) {
    return {
      text: "⭐ You have no favorites yet. Add some by using the ⭐ button when viewing Quran verses.",
      keyboard: {
        inline_keyboard: [[{ text: "🔙 Back to Main Menu", callback_data: "/start" }]],
      },
    }
  }

  let text = "⭐ *Your Favorites:*\n\n"
  const keyboard = []

  for (let i = 0; i < userFavorites.length; i++) {
    const favorite = userFavorites[i]
    text += `${i + 1}. 📖 ${favorite.reference}\n`
    keyboard.push([{ text: `View 📖 ${favorite.reference}`, callback_data: `view_favorite_${i}` }])
  }

  keyboard.push([{ text: "🔙 Back to Main Menu", callback_data: "/start" }])

  return {
    text,
    keyboard: {
      inline_keyboard: keyboard,
    },
  }
}

async function toggleFavorite(chatId, itemId) {
  if (!favorites.has(chatId)) {
    favorites.set(chatId, [])
  }

  const userFavorites = favorites.get(chatId)
  const [type, reference] = itemId.split("_")
  const existingIndex = userFavorites.findIndex((f) => f.type === type && f.reference === reference)

  if (existingIndex !== -1) {
    userFavorites.splice(existingIndex, 1)
    return {
      text: `❌ Removed 📖 ${reference} from favorites.`,
      keyboard: {
        inline_keyboard: [[{ text: "🔙 Back", callback_data: "back" }]],
      },
    }
  } else {
    userFavorites.push({ type, reference })
    return {
      text: `✅ Added 📖 ${reference} to favorites.`,
      keyboard: {
        inline_keyboard: [[{ text: "🔙 Back", callback_data: "back" }]],
      },
    }
  }
}

function getPrayerMethodName(method) {
  const methods = {
    1: "University of Islamic Sciences, Karachi",
    2: "Islamic Society of North America",
    3: "Muslim World League",
    4: "Umm Al-Qura University, Makkah",
    5: "Egyptian General Authority of Survey",
  }
  return methods[method] || "Unknown"
}

function getUserPreferences(chatId) {
  if (!userPreferences.has(chatId)) {
    userPreferences.set(chatId, {
      language: "en",
      prayerMethod: 2,
      quranTranslation: 131, // English - Dr. Mustafa Khattab
      notificationsEnabled: false,
    })
  }
  return userPreferences.get(chatId)
}

function getUserPreference(chatId, key) {
  const prefs = getUserPreferences(chatId)
  return prefs[key]
}

function setUserPreference(chatId, key, value) {
  const prefs = getUserPreferences(chatId)
  prefs[key] = value
  userPreferences.set(chatId, prefs)
}

function toggleNotifications(chatId) {
  const prefs = getUserPreferences(chatId)
  prefs.notificationsEnabled = !prefs.notificationsEnabled
  userPreferences.set(chatId, prefs)
}

// Start the bot
bot.on("polling_error", (error) => {
  console.log(error)
})

console.log("Bot is running...")

