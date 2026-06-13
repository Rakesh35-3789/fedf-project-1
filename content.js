const studyWords = [
  "study", "studying", "education", "educational", "learn", "learning",
  "tutorial", "lecture", "course", "class", "lesson", "revision",
  "exam", "notes", "motivation", "motivational", "discipline",
  "focus", "productivity", "coding", "programming", "developer",
  "software", "computer science", "html", "css", "javascript",
  "typescript", "react", "nodejs", "python", "java", "c++", "cpp",
  "c programming", "dsa", "data structures", "algorithm", "algorithms",
  "leetcode", "system design", "dbms", "sql", "mongodb",
  "machine learning", "ai", "data science", "cyber security",
  "aws", "devops", "git", "github", "interview", "placement",
  "career", "internship", "aptitude", "jee", "neet", "upsc",
  "gate", "eamcet", "math", "maths", "physics", "chemistry",
  "biology", "engineering", "operating system", "oops"
];

function isYouTubeVideo() {
  const url = location.href.toLowerCase();

  return (
    url.includes("youtube.com/watch") ||
    url.includes("youtube.com/shorts") ||
    url.includes("youtube.com/live")
  );
}

function getYouTubeTitle() {
  return (
    document.querySelector("h1 yt-formatted-string")?.innerText ||
    document.querySelector("h1")?.innerText ||
    document.title ||
    ""
  ).toLowerCase();
}

function isStudyTitle(title) {
  return studyWords.some((word) => title.includes(word));
}

function sendPageCheck() {
  chrome.runtime.sendMessage({
    type: "CHECK_PAGE",
    title: document.title || "",
    url: location.href,
    text: document.body ? document.body.innerText.slice(0, 5000) : ""
  }).catch(() => {});
}

function blockNow() {
  chrome.runtime.sendMessage({
    type: "BLOCK_TAB_NOW"
  }).catch(() => {});
}

function checkNow() {
  if (!isYouTubeVideo()) {
    sendPageCheck();
    return;
  }

  setTimeout(() => {
    const title = getYouTubeTitle();

    if (!title || title.length < 3) {
      sendPageCheck();
      return;
    }

    if (isStudyTitle(title)) {
      sendPageCheck();
    } else {
      blockNow();
    }
  }, 600);
}

checkNow();

let lastUrl = location.href;
let lastTitle = document.title;

setInterval(() => {
  if (location.href !== lastUrl || document.title !== lastTitle) {
    lastUrl = location.href;
    lastTitle = document.title;
    checkNow();
  }
}, 700);

window.addEventListener("yt-navigate-finish", checkNow);
window.addEventListener("focus", checkNow);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkNow();
});

setInterval(checkNow, 2500);