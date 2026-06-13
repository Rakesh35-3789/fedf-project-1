const CLOSE_DELAY_MS = 2200;

const allowedSites = [
  "whatsapp.com","web.whatsapp.com","telegram.org","web.telegram.org",
  "linkedin.com","github.com","stackoverflow.com","chatgpt.com",
  "leetcode.com","geeksforgeeks.org","w3schools.com","developer.mozilla.org"
];

const blockedSites = [
  "instagram.com","facebook.com","fb.com","messenger.com","twitter.com","x.com",
  "reddit.com","snapchat.com","pinterest.com","threads.net","tumblr.com","quora.com",
  "discord.com","twitch.tv","netflix.com","primevideo.com","hotstar.com","jiocinema.com",
  "sonyliv.com","zee5.com","mxplayer.in","netmirror.app","netmirror.xyz","netmirror.live",
  "tiktok.com","sharechat.com","mojapp.in","likee.video","cricbuzz.com","espncricinfo.com",
  "roblox.com","steamcommunity.com","store.steampowered.com","epicgames.com","garena.com",
  "pubg.com","freefire.com","bgmi.com","9gag.com","imgur.com"
];

const studyWords = [
  "study","studying","education","educational","learn","learning","tutorial","lecture",
  "course","class","lesson","revision","exam","notes","motivation","discipline","focus",
  "productivity","coding","programming","software","computer science","html","css",
  "javascript","typescript","react","nodejs","python","java","c++","cpp","dsa",
  "algorithm","leetcode","system design","dbms","sql","mongodb","machine learning",
  "ai","data science","cyber security","aws","devops","git","github","interview",
  "placement","career","jee","neet","upsc","gate","eamcet","math","physics",
  "chemistry","biology","engineering","operating system","oops"
];

const closingTabs = {};
const lastTracked = {};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["stats", "focusMode"]);

  await chrome.storage.local.set({
    focusMode: data.focusMode !== false,
    stats: data.stats || defaultStats()
  });
});

chrome.tabs.onActivated.addListener((info) => checkTab(info.tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (
    changeInfo.status === "loading" ||
    changeInfo.status === "complete" ||
    changeInfo.url ||
    changeInfo.title
  ) {
    checkTab(tabId);
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender.tab || !sender.tab.id) return;

  if (msg.type === "CHECK_PAGE") checkTab(sender.tab.id, msg);
  if (msg.type === "BLOCK_TAB_NOW") blockTab(sender.tab.id, true);
});

async function checkTab(tabId, info = {}) {
  try {
    if (closingTabs[tabId]) return;

    const mode = await chrome.storage.local.get(["focusMode"]);
    if (mode.focusMode === false) return;

    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.url.startsWith("http")) return;

    const url = tab.url.toLowerCase();
    const title = (info.title || tab.title || "").toLowerCase();
    const text = (info.text || "").toLowerCase();

    if (isYouTube(url)) {
      const combined = `${title} ${text} ${url}`;
      const allowed = studyWords.some((word) => combined.includes(word));

      if (allowed) {
        trackAllowed(tabId, url, "Study YouTube", 15);
      } else {
        blockTab(tabId, true);
      }

      return;
    }

    if (isBlockedSite(url)) {
      blockTab(tabId, false);
      return;
    }

    trackAllowed(tabId, url, "Allowed Site", 10);
  } catch (error) {
    console.log("FocusForge error:", error);
  }
}

function isBlockedSite(url) {
  if (allowedSites.some((site) => url.includes(site))) return false;
  return blockedSites.some((site) => url.includes(site));
}

function isYouTube(url) {
  return (
    url.includes("youtube.com/watch") ||
    url.includes("youtube.com/shorts") ||
    url.includes("youtube.com/live")
  );
}

async function trackAllowed(tabId, url, label, points) {
  const key = `${tabId}_${url}`;
  const now = Date.now();

  if (lastTracked[key] && now - lastTracked[key] < 9000) return;
  lastTracked[key] = now;

  const data = await chrome.storage.local.get(["stats"]);
  const stats = normalizeStats(data.stats);

  const oldScore = stats.score;

  stats.activityPoints += 1;
  stats.allowedTabs += 1;
  stats.focusMinutes += 1;
  stats.xp += points;
  stats.score = Math.min(100, stats.score + points);

  addPoint(stats, label, points);

  const voiceMessage = getPositiveVoice(stats.score, oldScore, label);
  const bonusVoice = getAchievementVoice(stats);

  await chrome.storage.local.set({ stats });

  if (bonusVoice) {
    speakVoice(bonusVoice, "celebrate");
  } else {
    speakVoice(voiceMessage, "up");
  }
}

async function blockTab(tabId, isYoutube) {
  if (closingTabs[tabId]) return;
  closingTabs[tabId] = true;

  const data = await chrome.storage.local.get(["stats"]);
  const stats = normalizeStats(data.stats);

  const loss = isYoutube ? 25 : 20;

  stats.activityPoints += 1;
  stats.tabsClosed += 1;
  stats.distractions += 1;
  stats.score = Math.max(0, stats.score - loss);
  stats.xp = Math.max(0, stats.xp - 5);

  if (isYoutube) stats.youtubeBlocked += 1;
  else stats.warnings += 1;

  addPoint(stats, isYoutube ? "YouTube Blocked" : "Site Blocked", -loss);

  await chrome.storage.local.set({ stats });

  const message = isYoutube
    ? "Strict warning. Non study YouTube detected. This activity is hurting your focus. Video blocked."
    : "Strict warning. Distraction detected. This website is pulling your focus down. Tab closing now.";

  await speakVoice(message, "down");

  setTimeout(async () => {
    try {
      await chrome.tabs.remove(tabId);
    } catch {}

    delete closingTabs[tabId];
  }, CLOSE_DELAY_MS);
}

function getPositiveVoice(newScore, oldScore, label) {
  const gain = newScore - oldScore;

  if (newScore >= 100) {
    return "Outstanding. Focus master level achieved. Exceptional performance.";
  }

  if (gain >= 15) {
    return `${label} improved your score strongly. Excellent work. Keep pushing.`;
  }

  if (gain >= 10) {
    return "Good move. Your focus graph is rising. Keep going.";
  }

  return "Nice. Your focus is improving. Stay on track.";
}

function getAchievementVoice(stats) {
  const score = stats.score;
  const points = stats.activityPoints;

  if (!stats.unlocked) stats.unlocked = {};

  if (score >= 100 && !stats.unlocked.score100) {
    stats.unlocked.score100 = true;
    return "Focus score one hundred. Focus master level achieved.";
  }

  if (score >= 75 && !stats.unlocked.score75) {
    stats.unlocked.score75 = true;
    return "Excellent focus performance. You crossed seventy five.";
  }

  if (score >= 50 && !stats.unlocked.score50) {
    stats.unlocked.score50 = true;
    return "Halfway strong. Your discipline is improving.";
  }

  if (points >= 150 && score >= 85 && !stats.unlocked.diamond) {
    stats.unlocked.diamond = true;
    return "Elite discipline. Diamond badge unlocked.";
  }

  if (points >= 75 && score >= 75 && !stats.unlocked.gold) {
    stats.unlocked.gold = true;
    return "Amazing work. Gold badge achieved.";
  }

  if (points >= 30 && score >= 50 && !stats.unlocked.silver) {
    stats.unlocked.silver = true;
    return "Congratulations. Silver badge unlocked.";
  }

  return "";
}

function addPoint(stats, label, change) {
  stats.graph.push({
    x: stats.activityPoints,
    score: stats.score,
    label,
    change,
    time: new Date().toLocaleTimeString([], {
      minute: "2-digit",
      second: "2-digit"
    })
  });

  stats.activityLog.unshift({
    label,
    change,
    score: stats.score,
    time: "now"
  });

  if (stats.graph.length > 30) stats.graph.shift();
  if (stats.activityLog.length > 6) stats.activityLog.pop();
}

async function speakVoice(message, mode) {
  try {
    await ensureOffscreen();

    chrome.runtime.sendMessage({
      type: "SPEAK_FOCUSFORGE",
      message,
      mode
    });
  } catch (error) {
    console.log("Voice error:", error);
  }
}

async function ensureOffscreen() {
  if (!chrome.offscreen) return;

  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL("voice.html")]
  });

  if (existing.length > 0) return;

  await chrome.offscreen.createDocument({
    url: "voice.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play FocusForge voice coach warnings and motivation."
  });
}

function normalizeStats(stats) {
  return {
    ...defaultStats(),
    ...(stats || {}),
    unlocked: stats?.unlocked || {}
  };
}

function defaultStats() {
  return {
    score: 0,
    xp: 0,
    focusMinutes: 0,
    warnings: 0,
    tabsClosed: 0,
    youtubeBlocked: 0,
    distractions: 0,
    allowedTabs: 0,
    activityPoints: 0,
    unlocked: {},
    graph: [
      {
        x: 0,
        score: 0,
        label: "Origin",
        change: 0,
        time: "Start"
      }
    ],
    activityLog: []
  };
}