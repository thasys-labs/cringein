// ===== Cringe Personas =====
const PERSONAS = [
  {
    name: "Chad Hustleworth",
    title: "Chief Disruption Officer | 7-Figure Entrepreneur | Speaker | Father of 3 | #Blessed",
    initials: "CH",
    color: "#0a66c2",
    reactions: [1247, 312, 48],
  },
  {
    name: "Brent Synergizer",
    title: "CEO & Founder | Thought Leader | Forbes 30 Under 30 | Building the Future 🚀",
    initials: "BS",
    color: "#6200ea",
    reactions: [3821, 501, 97],
  },
  {
    name: "Gary Mindset",
    title: "Serial Entrepreneur | Angel Investor | Author | Keynote Speaker | Dog Dad 🐕",
    initials: "GM",
    color: "#915907",
    reactions: [892, 203, 31],
  },
  {
    name: "Alexandra Leverage",
    title: "VP of Innovation | TEDx Speaker | Disrupting Industries | Mom | Coffee ☕",
    initials: "AL",
    color: "#c37d16",
    reactions: [2104, 448, 62],
  },
  {
    name: "Derek Pivotman",
    title: "Founder & Visionary | 8-Figure Exit | Now Helping Others Scale | #Grateful",
    initials: "DP",
    color: "#057642",
    reactions: [4512, 672, 118],
  },
  {
    name: "Melissa Authentic",
    title: "LinkedIn Top Voice | Culture Builder | EQ Evangelist | Helping Teams Thrive 💜",
    initials: "MA",
    color: "#b24020",
    reactions: [1688, 389, 55],
  },
];

const CRINGE_LABELS = {
  1: "1 — Barely Cringe",
  2: "2 — Mild Cringe",
  3: "3 — Noticeable Cringe",
  4: "4 — Solid Cringe",
  5: "5 — Strong Cringe",
  6: "6 — Heavy Cringe",
  7: "7 — Intense Cringe",
  8: "8 — Maximum Cringe",
  9: "9 — Transcendent Cringe",
  10: "10 — LEGENDARY",
};

// ===== State =====
let currentEventSource = null;
let fullPostText = "";
let currentPersona = PERSONAS[0];

// ===== DOM refs =====
const topicInput = document.getElementById("topic-input");
const cringeSlider = document.getElementById("cringe-slider");
const cringeBadge = document.getElementById("cringe-badge");
const generateBtn = document.getElementById("generate-btn");
const postContent = document.getElementById("post-content");
const postCard = document.getElementById("post-card");
const postReactions = document.getElementById("post-reactions");
const postActions = document.getElementById("post-actions");
const cardFooter = document.getElementById("card-footer");

// ===== Cringe slider =====
function updateCringeBadge(val) {
  cringeBadge.textContent = CRINGE_LABELS[val] || val;
  const hue = Math.round(120 - ((val - 1) / 9) * 120); // 120 (green) → 0 (red)
  cringeBadge.style.background = `hsl(${hue}, 75%, 38%)`;
}

cringeSlider.addEventListener("input", () => updateCringeBadge(parseInt(cringeSlider.value)));
updateCringeBadge(parseInt(cringeSlider.value)); // set initial color

// ===== Generate =====
function generatePost() {
  const topic = topicInput.value.trim();
  if (!topic) {
    topicInput.focus();
    topicInput.style.borderColor = "#cc0000";
    topicInput.placeholder = "Please enter a topic first! ☝️";
    setTimeout(() => {
      topicInput.style.borderColor = "";
      topicInput.placeholder =
        "e.g. I made a great cup of coffee this morning\ne.g. My 6-year-old asked me a question\ne.g. I got rejected from a job";
    }, 2000);
    return;
  }

  const postType = document.querySelector('input[name="post_type"]:checked')?.value || "humble_brag";
  const cringeLevel = parseInt(cringeSlider.value);

  // Cancel any ongoing stream
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }

  // Pick a random persona
  currentPersona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
  updatePersona(currentPersona);

  // Reset UI
  fullPostText = "";
  setGenerating(true);
  showContent("");
  hidePostExtras();

  // SSE fetch approach (POST with streaming)
  fetchStream("/generate", { topic, post_type: postType, cringe_level: cringeLevel });
}

function moreCringe() {
  const current = parseInt(cringeSlider.value);
  if (current < 10) {
    cringeSlider.value = Math.min(10, current + 2);
    cringeBadge.textContent = CRINGE_LABELS[parseInt(cringeSlider.value)];
  }
  generatePost();
}

// ===== SSE via fetch (POST) =====
async function fetchStream(url, body) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      showError(`Server error: ${response.status} — ${err}`);
      setGenerating(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            handleEvent(event);
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  } catch (err) {
    showError(`Connection error: ${err.message}`);
    setGenerating(false);
  }
}

function handleEvent(event) {
  if (event.type === "text") {
    fullPostText += event.content;
    showContent(fullPostText, true); // true = streaming cursor
  } else if (event.type === "done") {
    showContent(fullPostText, false);
    setGenerating(false);
    showPostExtras();
  } else if (event.type === "error") {
    showError(event.content);
    setGenerating(false);
  }
}

// ===== UI helpers =====
function updatePersona(persona) {
  document.getElementById("post-avatar").textContent = persona.initials;
  document.getElementById("post-avatar").style.background = persona.color;
  document.getElementById("post-author-name").textContent = persona.name;
  document.getElementById("post-author-title").textContent = persona.title;

  const [reactions, comments, reposts] = persona.reactions;
  document.getElementById("reaction-count").textContent = reactions.toLocaleString();
  document.querySelector(".reaction-right").innerHTML = `
    <span>${comments.toLocaleString()} comments</span>
    <span>•</span>
    <span>${reposts} reposts</span>
  `;
}

function showContent(text, streaming = false) {
  if (streaming) {
    postContent.className = "post-content streaming-cursor";
    postContent.textContent = text;
  } else {
    postContent.className = "post-content";
    postContent.innerHTML = marked.parse(text);
  }
}

function showError(msg) {
  postContent.className = "post-content";
  postContent.innerHTML = `<div class="error-message">❌ ${msg}</div>`;
}

function showPostExtras() {
  postReactions.style.display = "flex";
  postActions.style.display = "flex";
  cardFooter.style.display = "flex";
}

function hidePostExtras() {
  postReactions.style.display = "none";
  postActions.style.display = "none";
  cardFooter.style.display = "none";
}

function setGenerating(isGenerating) {
  generateBtn.disabled = isGenerating;
  if (isGenerating) {
    generateBtn.classList.add("generating");
    generateBtn.innerHTML = `<span class="btn-icon">⏳</span> Generating cringe...`;
  } else {
    generateBtn.classList.remove("generating");
    generateBtn.innerHTML = `<span class="btn-icon">🚀</span> Generate Post`;
  }
}

// ===== Copy to clipboard =====
function copyPost() {
  if (!fullPostText) return;
  navigator.clipboard.writeText(fullPostText).then(() => {
    const btn = document.getElementById("copy-btn");
    btn.classList.add("copied");
    btn.textContent = "✅ Copied!";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = "📋 Copy Post";
    }, 2000);
  });
}

// ===== Allow Enter+Ctrl to generate =====
topicInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    generatePost();
  }
});
