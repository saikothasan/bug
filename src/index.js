// Telegram Bot Token (you'll need to set this in your Cloudflare Worker environment variables)
const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';

// API endpoints
const QURAN_API = 'http://api.alquran.cloud/v1/ayah';
const HADITH_API = 'https://api.hadith.gading.dev/books';
const PRAYER_TIMES_API = 'http://api.aladhan.com/v1/timingsByCity';
const QIBLA_API = 'http://api.aladhan.com/v1/qibla';

// Cache for storing API responses
const CACHE = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Helper function to fetch data from an API with caching
async function fetchAPI(url, cacheKey) {
  if (CACHE.has(cacheKey)) {
    const cachedData = CACHE.get(cacheKey);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      return cachedData.data;
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  CACHE.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

// Command handlers
async function handleStart(chat_id) {
  const keyboard = {
    inline_keyboard: [
      [{ text: "📖 Quran", callback_data: "quran" }, { text: "📜 Hadith", callback_data: "hadith" }],
      [{ text: "🕌 Prayer Times", callback_data: "prayertimes" }, { text: "📅 Islamic Calendar", callback_data: "calendar" }],
      [{ text: "🧭 Qibla Direction", callback_data: "qibla" }, { text: "👶 Islamic Names", callback_data: "names" }],
      [{ text: "💰 Zakat Calculator", callback_data: "zakat" }, { text: "🌙 Ramadan Countdown", callback_data: "ramadan" }],
      [{ text: "📣 Daily Reminder", callback_data: "reminder" }, { text: "📚 Islamic Quiz", callback_data: "quiz" }],
      [{ text: "🤲 Dua of the Day", callback_data: "dua" }, { text: "🕋 Hajj Guide", callback_data: "hajj" }]
    ]
  };

  const message = `Welcome to the Complete Islamic Info Bot! 🕌

Please choose a feature from the menu below:`;

  await sendTelegramMessage(chat_id, message, keyboard);
}

async function handleQuran(chat_id) {
  try {
    const randomAyah = Math.floor(Math.random() * 6236) + 1;
    const data = await fetchAPI(`${QURAN_API}/${randomAyah}/en.asad`, `quran_${randomAyah}`);
    
    if (data.code === 200) {
      const { text, surah, numberInSurah } = data.data;
      const message = `📖 Quran ${surah.englishName} (${surah.number}):${numberInSurah}

${text}

Translation: ${data.data.edition.name}`;
      await sendTelegramMessage(chat_id, message);
    } else {
      throw new Error('Failed to fetch Quran verse');
    }
  } catch (error) {
    console.error('Error in handleQuran:', error);
    await sendTelegramMessage(chat_id, "I'm sorry, I couldn't fetch a Quran verse at the moment. Please try again later.");
  }
}

async function handleHadith(chat_id) {
  try {
    const books = ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah', 'malik'];
    const randomBook = books[Math.floor(Math.random() * books.length)];
    
    const data = await fetchAPI(`${HADITH_API}/${randomBook}?range=1-300`, `hadith_${randomBook}`);
    
    if (data.code === 200) {
      const hadiths = data.data.hadiths;
      const randomHadith = hadiths[Math.floor(Math.random() * hadiths.length)];
      
      const message = `📜 Hadith from ${data.data.name}

${randomHadith.arab}

Translation:
${randomHadith.id}

Source: ${randomBook.charAt(0).toUpperCase() + randomBook.slice(1)}`;
      await sendTelegramMessage(chat_id, message);
    } else {
      throw new Error('Failed to fetch Hadith');
    }
  } catch (error) {
    console.error('Error in handleHadith:', error);
    await sendTelegramMessage(chat_id, "I'm sorry, I couldn't fetch a Hadith at the moment. Please try again later.");
  }
}

async function handlePrayerTimes(chat_id, city, country) {
  try {
    if (!city || !country) {
      const keyboard = {
        inline_keyboard: [
          [{ text: "Set Location", callback_data: "set_location" }]
        ]
      };
      await sendTelegramMessage(chat_id, "Please provide both city and country. Example: /prayertimes London UK", keyboard);
      return;
    }

    const data = await fetchAPI(`${PRAYER_TIMES_API}?city=${city}&country=${country}&method=2`, `prayer_${city}_${country}`);
    
    if (data.code === 200) {
      const { timings, date } = data.data;
      const message = `🕌 Prayer Times for ${city}, ${country}
Date: ${date.readable} (${date.hijri.day} ${date.hijri.month.en} ${date.hijri.year} AH)

Fajr: ${timings.Fajr}
Sunrise: ${timings.Sunrise}
Dhuhr: ${timings.Dhuhr}
Asr: ${timings.Asr}
Maghrib: ${timings.Maghrib}
Isha: ${timings.Isha}

Method: Islamic Society of North America`;
      await sendTelegramMessage(chat_id, message);
    } else {
      throw new Error('Failed to fetch prayer times');
    }
  } catch (error) {
    console.error('Error in handlePrayerTimes:', error);
    await sendTelegramMessage(chat_id, "I'm sorry, I couldn't fetch the prayer times. Please check the city and country names and try again.");
  }
}

async function handleCalendar(chat_id) {
  try {
    const data = await fetchAPI(`${PRAYER_TIMES_API}?city=Mecca&country=SA&method=2`, 'islamic_calendar');
    
    if (data.code === 200) {
      const { hijri } = data.data.date;
      const message = `📅 Islamic Calendar

Today is:
${hijri.day} ${hijri.month.en} ${hijri.year} AH
(${hijri.designation.abbreviated})

Weekday: ${hijri.weekday.en}
Month: ${hijri.month.number}
Year: ${hijri.year}

Holidays: ${hijri.holidays.join(', ') || 'None'}`;
      await sendTelegramMessage(chat_id, message);
    } else {
      throw new Error('Failed to fetch Islamic calendar');
    }
  } catch (error) {
    console.error('Error in handleCalendar:', error);
    await sendTelegramMessage(chat_id, "I'm sorry, I couldn't fetch the Islamic calendar information. Please try again later.");
  }
}

async function handleQibla(chat_id, latitude, longitude) {
  try {
    if (!latitude || !longitude) {
      const keyboard = {
        inline_keyboard: [
          [{ text: "Share Location", callback_data: "share_location" }]
        ]
      };
      await sendTelegramMessage(chat_id, "Please share your location to get the Qibla direction.", keyboard);
      return;
    }

    const data = await fetchAPI(`${QIBLA_API}/${latitude}/${longitude}`, `qibla_${latitude}_${longitude}`);
    
    if (data.code === 200) {
      const { direction } = data.data;
      const message = `🧭 Qibla Direction

The direction of the Qibla from your location is:
${direction.toFixed(2)}° from North

To face the Qibla, turn ${direction.toFixed(2)}° clockwise from North.`;
      await sendTelegramMessage(chat_id, message);
    } else {
      throw new Error('Failed to calculate Qibla direction');
    }
  } catch (error) {
    console.error('Error in handleQibla:', error);
    await sendTelegramMessage(chat_id, "I'm sorry, I couldn't calculate the Qibla direction. Please try again later.");
  }
}

async function handleIslamicNames(chat_id) {
  const names = [
    { name: "Muhammad", meaning: "Praiseworthy" },
    { name: "Ahmed", meaning: "Most praised" },
    { name: "Fatima", meaning: "One who abstains" },
    { name: "Ali", meaning: "High, exalted" },
    { name: "Aisha", meaning: "Alive, well-living" },
    { name: "Ibrahim", meaning: "Father of many" },
    { name: "Maryam", meaning: "The pious one" },
    { name: "Yusuf", meaning: "God will add" },
    { name: "Zainab", meaning: "Fragrant flower" },
    { name: "Hassan", meaning: "Good, handsome" }
  ];

  const randomName = names[Math.floor(Math.random() * names.length)];
  
  const message = `👶 Islamic Name Suggestion

Name: ${randomName.name}
Meaning: ${randomName.meaning}

Would you like another name?`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "Get Another Name", callback_data: "names" }]
    ]
  };

  await sendTelegramMessage(chat_id, message, keyboard);
}

async function handleZakatCalculator(chat_id) {
  const message = `💰 Zakat Calculator

To calculate your Zakat, please enter your assets in the following format:

/zakat [gold_value] [silver_value] [cash] [other_assets]

All values should be in your local currency. For example:
/zakat 1000 500 5000 2000

This would calculate Zakat for:
Gold value: 1000
Silver value: 500
Cash: 5000
Other assets: 2000`;

  await sendTelegramMessage(chat_id, message);
}

async function calculateZakat(chat_id, assets) {
  const totalAssets = assets.reduce((a, b) => a + b, 0);
  const nisab = 5000; // This is an example value, adjust as needed
  
  if (totalAssets >= nisab) {
    const zakatAmount = totalAssets * 0.025;
    const message = `💰 Zakat Calculation

Total Assets: ${totalAssets}
Nisab Threshold: ${nisab}

Your assets are above the Nisab threshold.
Zakat Due: ${zakatAmount.toFixed(2)}

May Allah accept your Zakat and multiply your wealth.`;
    await sendTelegramMessage(chat_id, message);
  } else {
    const message = `💰 Zakat Calculation

Total Assets: ${totalAssets}
Nisab Threshold: ${nisab}

Your assets are below the Nisab threshold.
No Zakat is due at this time.

May Allah bless you with more wealth.`;
    await sendTelegramMessage(chat_id, message);
  }
}

async function handleRamadanCountdown(chat_id) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const ramadanStart = new Date(currentYear, 2, 10); // Approximate date, adjust yearly
  
  if (today > ramadanStart) {
    ramadanStart.setFullYear(currentYear + 1);
  }
  
  const daysUntilRamadan = Math.ceil((ramadanStart - today) / (1000 * 60 * 60 * 24));
  
  const message = `🌙 Ramadan Countdown

There are approximately ${daysUntilRamadan} days until Ramadan.

May Allah allow us to reach Ramadan and benefit from its blessings.

Note: This is an approximate count. The exact date may vary based on moon sighting.`;

  await sendTelegramMessage(chat_id, message);
}

async function handleDailyReminder(chat_id) {
  const reminders = [
    "Remember to say 'Bismillah' before starting any task.",
    "Seek knowledge, for it is the path to Paradise.",
    "Be kind to your parents, for Paradise lies beneath their feet.",
    "Smile, for it is charity in Islam.",
    "Forgive others, as you would like Allah to forgive you.",
    "Give in charity, even if it is little.",
    "Remember death often, for it is the ultimate reality.",
    "Pray on time, for prayer is the pillar of religion.",
    "Be patient, for Allah is with the patient ones.",
    "Lower your gaze, for it purifies your heart."
  ];

  const randomReminder = reminders[Math.floor(Math.random() * reminders.length)];
  
  const message = `📣 Daily Islamic Reminder

${randomReminder}

May Allah guide us to the straight path.`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "Get Another Reminder", callback_data: "reminder" }]
    ]
  };

  await sendTelegramMessage(chat_id, message, keyboard);
}

async function handleIslamicQuiz(chat_id) {
  const quizQuestions = [
    {
      question: "How many pillars are there in Islam?",
      options: ["3", "4", "5", "6"],
      correctAnswer: 2
    },
    {
      question: "Which month do Muslims fast in?",
      options: ["Shawwal", "Ramadan", "Rajab", "Muharram"],
      correctAnswer: 1
    },
    {
      question: "What is the name of the holy book in Islam?",
      options: ["Injil", "Torah", "Quran", "Zabur"],
      correctAnswer: 2
    },
    {
      question: "Who was the last prophet in Islam?",
      options: ["Ibrahim (AS)", "Musa (AS)", "Isa (AS)", "Muhammad (SAW)"],
      correctAnswer: 3
    },
    {
      question: "How many rak'ahs are there in Maghrib prayer?",
      options: ["2", "3", "4", "5"],
      correctAnswer: 1
    }
  ];

  const randomQuestion = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
  
  const keyboard = {
    inline_keyboard: randomQuestion.options.map((option, index) => 
      [{ text: option, callback_data: `quiz_answer_${index}_${randomQuestion.correctAnswer}` }]
    )
  };

  const message = `📚 Islamic Quiz

${randomQuestion.question}

Please select your answer:`;

  await sendTelegramMessage(chat_id, message, keyboard);
}

async function handleDuaOfTheDay(chat_id) {
  const duas = [
    {
      arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
      transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan waqina 'adhaban-nar",
      meaning: "Our Lord! Grant us good in this world and good in the Hereafter, and save us from the torment of the Fire."
    },
    {
      arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى",
      transliteration: "Allahumma inni as'alukal-huda wat-tuqa wal-'afafa wal-ghina",
      meaning: "O Allah! I ask You for guidance, piety, chastity and self-sufficiency."
    },
    {
      arabic: "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي",
      transliteration: "Rabbish-rahli sadri wa yassir li amri",
      meaning: "My Lord! Expand for me my chest and ease my task for me."
    }
  ];

  const randomDua = duas[Math.floor(Math.random() * duas.length)];

  const message = `🤲 Dua of the Day

Arabic:
${randomDua.arabic}

Transliteration:
${randomDua.transliteration}

Meaning:
${randomDua.meaning}

May Allah accept our duas.`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "Get Another Dua", callback_data: "dua" }]
    ]
  };

  await sendTelegramMessage(chat_id, message, keyboard);
}

async function handleHajjGuide(chat_id) {
  const message = `🕋 Hajj Guide

Hajj is the annual pilgrimage to Mecca, Saudi Arabia. Here's a brief overview of the main steps:

1. Ihram: Enter the state of Ihram and make the intention for Hajj.
2. Tawaf: Circumambulate the Kaaba seven times.
3. Sa'i: Walk or run between the hills of Safa and Marwa seven times.
4. Stand at Arafat: Spend the day in prayer and contemplation at Mount Arafat.
5. Muzdalifah: Spend the night in Muzdalifah and collect pebbles for the next day.
6. Rami: Throw pebbles at the Jamarat (pillars) in Mina.
7. Animal Sacrifice: Perform or arrange for an animal sacrifice.
8. Tawaf al-Ifadah: Perform another Tawaf around the Kaaba.
9. Final Sa'i: Perform Sa'i again if it wasn't done after the arrival Tawaf.

This is a simplified guide. For detailed instructions, please consult with Islamic scholars or refer to comprehensive Hajj guides.

May Allah accept the Hajj of all pilgrims.`;

  await sendTelegramMessage(chat_id, message);
}

// Function to send a message via Telegram Bot API
async function sendTelegramMessage(chat_id, text, reply_markup = null) {
  const payload = {
    chat_id,
    text,
    parse_mode: 'Markdown',
  };

  if (reply_markup) {
    payload.reply_markup = JSON.stringify(reply_markup);
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return response.json();
}

// Main handler for Cloudflare Worker
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'POST') {
    try {
      const payload = await request.json();
      
      if (payload.message) {
        const { chat, text } = payload.message;
        const chat_id = chat.id;

        if (text.startsWith('/start')) {
          await handleStart(chat_id);
        } else if (text.startsWith('/quran')) {
          await handleQuran(chat_id);
        } else if (text.startsWith('/hadith')) {
          await handleHadith(chat_id);
        } else if (text.startsWith('/prayertimes')) {
          const [, city, country] = text.split(' ');
          await handlePrayerTimes(chat_id, city, country);
        } else if (text.startsWith('/calendar')) {
          await handleCalendar(chat_id);
        } else if (text.startsWith('/qibla')) {
          await handleQibla(chat_id);
        } else if (text.startsWith('/names')) {
          await handleIslamicNames(chat_id);
        } else if (text.startsWith('/zakat')) {
          const assets = text.split(' ').slice(1).map(Number);
          if (assets.length === 4) {
            await calculateZakat(chat_id, assets);
          } else {
            await handleZakatCalculator(chat_id);
          }
        } else if (text.startsWith('/ramadan')) {
          await handleRamadanCountdown(chat_id);
        } else if (text.startsWith('/reminder')) {
          await handleDailyReminder(chat_id);
        } else if (text.startsWith('/quiz')) {
          await handleIslamicQuiz(chat_id);
        } else if (text.startsWith('/dua')) {
          await handleDuaOfTheDay(chat_id);
        } else if (text.startsWith('/hajj')) {
          await handleHajjGuide(chat_id);
        } else {
          await handleStart(chat_id);
        }
      } else if (payload.callback_query) {
        const { id, from, data } = payload.callback_query;
        const chat_id = from.id;

        switch (data) {
          case 'quran':
            await handleQuran(chat_id);
            break;
          case 'hadith':
            await handleHadith(chat_id);
            break;
          case 'prayertimes':
            await handlePrayerTimes(chat_id);
            break;
          case 'calendar':
            await handleCalendar(chat_id);
            break;
          case 'qibla':
            await handleQibla(chat_id);
            break;
          case 'names':
            await handleIslamicNames(chat_id);
            break;
          case 'zakat':
            await handleZakatCalculator(chat_id);
            break;
          case 'ramadan':
            await handleRamadanCountdown(chat_id);
            break;
          case 'reminder':
            await handleDailyReminder(chat_id);
            break;
          case 'quiz':
            await handleIslamicQuiz(chat_id);
            break;
          case 'dua':
            await handleDuaOfTheDay(chat_id);
            break;
          case 'hajj':
            await handleHajjGuide(chat_id);
            break;
          default:
            if (data.startsWith('quiz_answer_')) {
              const [, , selectedAnswer, correctAnswer] = data.split('_');
              const isCorrect = selectedAnswer === correctAnswer;
              const responseMessage = isCorrect 
                ? "Correct! Well done." 
                : `I'm sorry, that's not correct. The correct answer was option ${parseInt(correctAnswer) + 1}.`;
              await sendTelegramMessage(chat_id, responseMessage);
            } else {
              await handleStart(chat_id);
            }
        }

        // Answer the callback query to remove the loading state
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ callback_query_id: id }),
        });
      }
    } catch (error) {
      console.error('Error processing request:', error);
    }
  }

  return new Response('OK');
}
