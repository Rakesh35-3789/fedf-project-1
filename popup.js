document.addEventListener("DOMContentLoaded", () => {
  load();
  setInterval(load, 1000);
});

document.getElementById("toggleFocus").addEventListener("click", toggleFocus);
document.getElementById("resetData").addEventListener("click", resetData);

async function load() {
  const data = await chrome.storage.local.get(["focusMode", "stats"]);
  const stats = normalizeStats(data.stats);

  document.getElementById("toggleFocus").innerText =
    data.focusMode !== false ? "Focus Mode: ON" : "Focus Mode: OFF";

  document.getElementById("score").innerText = stats.score;
  document.getElementById("focusMinutes").innerText = stats.focusMinutes;
  document.getElementById("warnings").innerText = stats.warnings;
  document.getElementById("youtubeBlocked").innerText = stats.youtubeBlocked;
  document.getElementById("tabsClosed").innerText = stats.tabsClosed;

  updateRank(stats.score);
  updateBadge(stats.activityPoints, stats.score);
  updateCoach(stats.graph);
  renderActivity(stats.activityLog || []);
  renderWaveGraph(stats.graph);
}

async function toggleFocus() {
  const data = await chrome.storage.local.get(["focusMode"]);
  await chrome.storage.local.set({ focusMode: data.focusMode === false });
  load();
}

async function resetData() {
  await chrome.storage.local.set({ stats: defaultStats() });
  load();
}

function updateRank(score) {
  const rank = document.getElementById("rank");
  if (score >= 95) rank.innerText = "Focus Master";
  else if (score >= 80) rank.innerText = "Elite Focus";
  else if (score >= 60) rank.innerText = "Focus Warrior";
  else if (score >= 35) rank.innerText = "Building Focus";
  else rank.innerText = "Beginner";
}

function updateBadge(points, score) {
  const badge = document.getElementById("badge");
  const next = document.getElementById("nextBadge");
  const bar = document.getElementById("badgeProgress");

  let text = "🥉 Bronze";
  let target = 30;

  if (points >= 150 && score >= 85) {
    text = "💎 Diamond";
    target = 150;
  } else if (points >= 75 && score >= 75) {
    text = "🥇 Gold";
    target = 150;
  } else if (points >= 30 && score >= 50) {
    text = "🥈 Silver";
    target = 75;
  }

  badge.innerText = text;
  bar.style.width = `${Math.min(100, Math.round((points / target) * 100))}%`;
  next.innerText = text.includes("Diamond") ? "Diamond unlocked." : `${points}/${target} activity points`;
}

function updateCoach(graph) {
  const coach = document.getElementById("coach");
  const mini = document.getElementById("coachMini");
  const trend = document.getElementById("trend");

  if (!graph || graph.length < 2) {
    coach.innerText = "Start from origin. Allowed tabs increase the line. Restricted tabs decrease it.";
    mini.innerText = "Start strong today.";
    trend.innerText = "Origin";
    trend.style.color = "#cbd5e1";
    return;
  }

  const last = graph[graph.length - 1];
  const prev = graph[graph.length - 2];

  if (last.score > prev.score) {
    coach.innerText = `${last.label} increased your focus. Keep going.`;
    mini.innerText = "Excellent focus today. Keep it up! 🔥";
    trend.innerText = "▲ Rising";
    trend.style.color = "#22c55e";
  } else if (last.score < prev.score) {
    coach.innerText = `${last.label} pulled your score down. Avoid distractions.`;
    mini.innerText = "Focus dropped. Recover now.";
    trend.innerText = "▼ Dropping";
    trend.style.color = "#ef4444";
  } else {
    coach.innerText = "Focus is stable.";
    trend.innerText = "Stable";
  }
}

function renderActivity(log) {
  const box = document.getElementById("activity");
  box.innerHTML = "";

  if (!log.length) {
    box.innerHTML = `<p>No activity yet.</p>`;
    return;
  }

  log.forEach((item) => {
    const row = document.createElement("div");
    row.className = "activity-row";

    const positive = item.change > 0;

    row.innerHTML = `
      <span>${positive ? "▲" : "▼"} ${item.label}</span>
      <strong class="${positive ? "up" : "down"}">${positive ? "+" : ""}${item.change}</strong>
    `;

    box.appendChild(row);
  });
}

function renderWaveGraph(graph) {
  const box = document.getElementById("graph");
  box.innerHTML = "";

  const width = 410;
  const height = 250;
  const padding = 36;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = "100%";
  svg.style.height = "270px";

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#22c55e" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
    </linearGradient>
  `;
  svg.appendChild(defs);

  [0,25,50,75,100].forEach(level => {
    const y = height - padding - (level / 100) * (height - padding * 2);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", padding);
    line.setAttribute("x2", width - padding);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#334155");
    line.setAttribute("stroke-dasharray", "5 5");
    svg.appendChild(line);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", 6);
    text.setAttribute("y", y + 4);
    text.setAttribute("fill", "#94a3b8");
    text.setAttribute("font-size", "10");
    text.textContent = level;
    svg.appendChild(text);
  });

  const pts = graph.map((p, i) => ({
    x: graph.length === 1 ? padding : padding + i * ((width - padding * 2) / (graph.length - 1)),
    y: height - padding - (p.score / 100) * (height - padding * 2),
    score: p.score,
    activity: p.x
  }));

  if (pts.length === 1) pts.push({ ...pts[0], x: width - padding });

  const smooth = createSmoothPath(pts);
  const area = `${smooth} L ${pts[pts.length - 1].x} ${height - padding} L ${pts[0].x} ${height - padding} Z`;

  const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  areaPath.setAttribute("d", area);
  areaPath.setAttribute("fill", "url(#area)");
  svg.appendChild(areaPath);

  const candleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  pts.forEach((p, i) => {
    if (i % 2 === 0) {
      const candle = document.createElementNS("http://www.w3.org/2000/svg", "line");
      candle.setAttribute("x1", p.x);
      candle.setAttribute("x2", p.x);
      candle.setAttribute("y1", Math.max(p.y - 35, padding));
      candle.setAttribute("y2", Math.min(p.y + 45, height - padding));
      candle.setAttribute("stroke", "#22c55e");
      candle.setAttribute("stroke-opacity", "0.18");
      candle.setAttribute("stroke-width", "5");
      candleGroup.appendChild(candle);
    }
  });
  svg.appendChild(candleGroup);

  const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  glow.setAttribute("d", smooth);
  glow.setAttribute("fill", "none");
  glow.setAttribute("stroke", "#22c55e");
  glow.setAttribute("stroke-width", "12");
  glow.setAttribute("stroke-opacity", "0.35");
  glow.setAttribute("filter", "url(#glow)");
  glow.setAttribute("stroke-linecap", "round");
  glow.setAttribute("stroke-linejoin", "round");
  svg.appendChild(glow);

  const main = document.createElementNS("http://www.w3.org/2000/svg", "path");
  main.setAttribute("d", smooth);
  main.setAttribute("fill", "none");
  main.setAttribute("stroke", "#4ade80");
  main.setAttribute("stroke-width", "5");
  main.setAttribute("filter", "url(#glow)");
  main.setAttribute("stroke-linecap", "round");
  main.setAttribute("stroke-linejoin", "round");
  svg.appendChild(main);

  pts.forEach((p, i) => {
    if (i % 3 === 0 || i === pts.length - 1) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", p.x - 4);
      label.setAttribute("y", height - 8);
      label.setAttribute("fill", "#94a3b8");
      label.setAttribute("font-size", "9");
      label.textContent = p.activity;
      svg.appendChild(label);
    }
  });

  const axisY = document.createElementNS("http://www.w3.org/2000/svg", "line");
  axisY.setAttribute("x1", padding);
  axisY.setAttribute("x2", padding);
  axisY.setAttribute("y1", padding);
  axisY.setAttribute("y2", height - padding);
  axisY.setAttribute("stroke", "#cbd5e1");
  svg.appendChild(axisY);

  const axisX = document.createElementNS("http://www.w3.org/2000/svg", "line");
  axisX.setAttribute("x1", padding);
  axisX.setAttribute("x2", width - padding);
  axisX.setAttribute("y1", height - padding);
  axisX.setAttribute("y2", height - padding);
  axisX.setAttribute("stroke", "#cbd5e1");
  svg.appendChild(axisX);

  box.appendChild(svg);
}

function createSmoothPath(points) {
  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

function normalizeStats(stats) {
  return { ...defaultStats(), ...(stats || {}) };
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
    graph: [{ x: 0, score: 0, label: "Origin", change: 0, time: "Start" }],
    activityLog: []
  };
}