// CollegeMax core app logic
// Pure functions are exported for tests; UI wiring happens at the bottom.

const STORAGE_KEY = "collegemax_v1";
const API_KEY_STORAGE = "collegemax_anthropic_key";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// === STATE ===
function defaultState() {
  return {
    saved: [],          // array of activity ids
    customNotes: {},    // { activityId: "user notes about how they did it" }
    profile: {
      name: "",
      grade: "",
      interests: [],
      unweightedGpa: null,
      weightedGpa: null,
      sat: null,
      act: null,
      apCount: null,
      classRank: null,    // percentile (top X%)
      intendedMajor: "",
      likes: "",
      doing: ""
    },
    essay: {
      prompt: "",
      draft: "",
      topic: "",
      details: "",
      lastGrade: null
    },
    chat: []            // { role: 'user'|'bot', text, ts }
  };
}

function loadState(storage) {
  storage = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!storage) return defaultState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    const merged = Object.assign({}, base, parsed);
    // Deep-merge nested objects so newly added fields keep their defaults.
    merged.profile = Object.assign({}, base.profile, parsed.profile || {});
    merged.essay = Object.assign({}, base.essay, parsed.essay || {});
    if (!Array.isArray(merged.saved)) merged.saved = [];
    if (!merged.customNotes || typeof merged.customNotes !== "object") merged.customNotes = {};
    if (!Array.isArray(merged.chat)) merged.chat = [];
    return merged;
  } catch (e) {
    return defaultState();
  }
}

function saveState(state, storage) {
  storage = storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// === ACTIVITY OPERATIONS ===
function findActivity(id, source) {
  source = source || ACTIVITIES;
  return source.find(a => a.id === id) || null;
}

function toggleSaved(state, activityId) {
  const idx = state.saved.indexOf(activityId);
  if (idx >= 0) {
    state.saved.splice(idx, 1);
  } else {
    state.saved.push(activityId);
  }
  return state;
}

function isSaved(state, activityId) {
  return state.saved.indexOf(activityId) >= 0;
}

function setNote(state, activityId, note) {
  if (!note || note.trim() === "") {
    delete state.customNotes[activityId];
  } else {
    state.customNotes[activityId] = note;
  }
  return state;
}

// === FILTER & SEARCH ===
function filterActivities(activities, opts) {
  opts = opts || {};
  let results = activities.slice();
  if (opts.category && opts.category !== "All") {
    results = results.filter(a => a.category === opts.category);
  }
  if (opts.tier && opts.tier !== "All") {
    results = results.filter(a => a.tier === opts.tier);
  }
  if (opts.search) {
    const q = opts.search.toLowerCase().trim();
    if (q) {
      results = results.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.tip && a.tip.toLowerCase().includes(q))
      );
    }
  }
  return results;
}

// === SUGGESTION ENGINE ===
// Maps interests → relevant categories with weights.
const INTEREST_MAP = {
  medicine: { Medical: 3, Research: 2, Service: 1, "Non-Profit": 1, Academic: 1 },
  biology: { Research: 3, Medical: 2, Academic: 2, "Non-Profit": 1 },
  science: { Research: 3, Academic: 2, Tech: 1 },
  cs: { Tech: 3, Research: 2, Business: 1, Academic: 1 },
  programming: { Tech: 3, Research: 1, Business: 1 },
  tech: { Tech: 3, Business: 1, Research: 1 },
  engineering: { Tech: 3, Research: 2, Academic: 1 },
  business: { Business: 3, Tech: 1, Leadership: 2, Civic: 1 },
  finance: { Business: 3, Academic: 1, Career: 2 },
  entrepreneurship: { Business: 3, Tech: 2, Career: 2 },
  art: { Arts: 3, Writing: 1, Media: 1 },
  music: { Arts: 3, Academic: 1 },
  writing: { Writing: 3, Media: 2, Civic: 1 },
  journalism: { Writing: 3, Media: 2, Civic: 2 },
  politics: { Civic: 3, Writing: 2, Leadership: 2 },
  law: { Civic: 3, Leadership: 2, Writing: 2, Academic: 1 },
  service: { "Non-Profit": 3, Service: 3, Civic: 1, Medical: 1 },
  community: { "Non-Profit": 3, Service: 2, Civic: 2 },
  athletics: { Athletics: 3, Leadership: 1 },
  sports: { Athletics: 3, Leadership: 1 },
  math: { Academic: 3, Research: 2, Tech: 1 },
  film: { Arts: 2, Media: 3, Writing: 1 }
};

function suggestActivities(activities, interests, opts) {
  opts = opts || {};
  const limit = opts.limit || 5;
  const excludeIds = opts.excludeIds || [];

  if (!interests || interests.length === 0) {
    // No interests provided → return elite-tier picks
    return activities
      .filter(a => excludeIds.indexOf(a.id) < 0)
      .filter(a => a.tier === "elite")
      .slice(0, limit);
  }

  // Score each activity by interest weights
  const categoryWeights = {};
  for (const interest of interests) {
    const key = interest.toLowerCase().trim();
    const map = INTEREST_MAP[key];
    if (map) {
      for (const cat in map) {
        categoryWeights[cat] = (categoryWeights[cat] || 0) + map[cat];
      }
    }
  }

  const scored = activities
    .filter(a => excludeIds.indexOf(a.id) < 0)
    .map(a => {
      const catScore = categoryWeights[a.category] || 0;
      const tierBonus = a.tier === "elite" ? 2 : a.tier === "strong" ? 1 : 0;
      return { activity: a, score: catScore * 2 + tierBonus + a.impact };
    })
    .sort((x, y) => y.score - x.score);

  return scored.slice(0, limit).map(s => s.activity);
}

// === CHAT (rule-based bot) ===
function botReply(message, state) {
  const text = (message || "").toLowerCase().trim();
  if (!text) return { text: "Tell me what you're interested in and I'll suggest activities." };

  // Detect interests in the message
  const detected = [];
  for (const key in INTEREST_MAP) {
    if (text.includes(key)) detected.push(key);
  }

  if (detected.length > 0) {
    const excludeIds = state ? state.saved : [];
    const suggestions = suggestActivities(ACTIVITIES, detected, { limit: 3, excludeIds });
    return {
      text: `Based on "${detected.join(", ")}", here are 3 high-leverage activities I'd prioritize:`,
      suggestions: suggestions.map(a => a.id)
    };
  }

  if (text.includes("ivy") || text.includes("harvard") || text.includes("stanford") || text.includes("mit") || text.includes("yale") || text.includes("princeton")) {
    return {
      text: "For top-20 schools, you need 1-2 elite-tier signals. Here are the highest-leverage ones:",
      suggestions: ACTIVITIES.filter(a => a.tier === "elite").slice(0, 3).map(a => a.id)
    };
  }
  if (text.includes("resume") || text.includes("my list") || text.includes("saved")) {
    const count = state && state.saved ? state.saved.length : 0;
    return { text: count === 0
      ? "Your resume is empty. Add activities from the catalog or tell me your interests."
      : `You have ${count} activities on your resume. Click Export to see the full list.` };
  }
  if (text.includes("help") || /\bhow\b/.test(text)) {
    return { text: "Tell me what you care about (e.g. 'medicine', 'tech', 'writing'). I'll match it to activities that top schools actually weigh." };
  }

  return { text: "Try telling me a subject area (medicine, tech, business, art, writing, athletics, etc.) and I'll suggest matching activities." };
}

// === RESUME EXPORT ===
function exportResume(state, source) {
  source = source || ACTIVITIES;
  if (state.saved.length === 0) return "No activities saved yet.";

  const lines = ["MY COLLEGE RESUME", "=================", ""];
  if (state.profile.name) lines.push(`Name: ${state.profile.name}`);
  if (state.profile.grade) lines.push(`Grade: ${state.profile.grade}`);
  lines.push("");

  // Group by category
  const byCategory = {};
  for (const id of state.saved) {
    const a = findActivity(id, source);
    if (!a) continue;
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  }

  for (const cat in byCategory) {
    lines.push(`-- ${cat.toUpperCase()} --`);
    for (const a of byCategory[cat]) {
      lines.push(`* ${a.title} [${a.tier}]`);
      lines.push(`  ${a.summary}`);
      const note = state.customNotes[a.id];
      if (note) lines.push(`  Notes: ${note}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

// === COLLEGE ODDS CALCULATOR ===
// Returns { probability: 0..1, bucket: "reach"|"target"|"likely"|"safety", factors: [...] }
function estimateOdds(profile, savedIds, college, source) {
  source = source || ACTIVITIES;
  let multiplier = 1.0;
  const factors = [];

  // ---- GPA (unweighted preferred) ----
  const gpa = profile.unweightedGpa || (profile.weightedGpa ? profile.weightedGpa - 0.5 : null);
  if (gpa !== null && gpa !== undefined && !isNaN(gpa)) {
    const diff = gpa - college.avgGpa;
    if (diff <= -0.4) { multiplier *= 0.15; factors.push(`GPA ${gpa.toFixed(2)} well below ${college.name} avg ${college.avgGpa}`); }
    else if (diff <= -0.2) { multiplier *= 0.4; factors.push(`GPA ${gpa.toFixed(2)} below avg ${college.avgGpa}`); }
    else if (diff <= -0.05) { multiplier *= 0.75; factors.push(`GPA slightly below avg`); }
    else if (diff <= 0.05) { multiplier *= 1.0; factors.push(`GPA at admit average`); }
    else { multiplier *= 1.15; factors.push(`GPA above admit average`); }
  } else {
    factors.push("GPA unknown — fill profile for sharper estimate");
  }

  // ---- SAT / ACT ----
  let sat = profile.sat;
  if (!sat && profile.act) {
    // Rough ACT->SAT concordance
    const map = { 36:1590, 35:1560, 34:1530, 33:1500, 32:1470, 31:1440, 30:1410, 29:1370, 28:1340, 27:1300, 26:1260, 25:1230, 24:1190, 23:1150, 22:1110, 21:1080, 20:1040 };
    sat = map[Math.round(profile.act)] || null;
  }
  if (sat) {
    if (sat < college.sat25 - 60) { multiplier *= 0.25; factors.push(`SAT ${sat} well below ${college.name} 25th percentile (${college.sat25})`); }
    else if (sat < college.sat25) { multiplier *= 0.55; factors.push(`SAT ${sat} below 25th pctl`); }
    else if (sat < (college.sat25 + college.sat75) / 2) { multiplier *= 0.85; factors.push(`SAT in lower-mid range`); }
    else if (sat < college.sat75) { multiplier *= 1.05; factors.push(`SAT in upper-mid range`); }
    else { multiplier *= 1.25; factors.push(`SAT at/above 75th pctl`); }
  } else {
    factors.push("Test score unknown");
  }

  // ---- AP / course rigor ----
  if (typeof profile.apCount === "number") {
    if (college.tier === "ivy_plus") {
      if (profile.apCount < 4) { multiplier *= 0.55; factors.push(`Only ${profile.apCount} APs — top schools expect 8+`); }
      else if (profile.apCount < 7) { multiplier *= 0.85; factors.push(`Moderate course rigor`); }
      else if (profile.apCount < 10) { multiplier *= 1.0; factors.push(`Strong course rigor`); }
      else { multiplier *= 1.1; factors.push(`Exceptional course rigor`); }
    } else if (college.tier === "t30") {
      if (profile.apCount < 3) multiplier *= 0.7;
      else if (profile.apCount >= 7) multiplier *= 1.1;
    }
  }

  // ---- Class rank (top %) ----
  if (typeof profile.classRank === "number" && profile.classRank > 0) {
    if (college.tier === "ivy_plus") {
      if (profile.classRank > 10) { multiplier *= 0.6; factors.push(`Class rank top ${profile.classRank}% — Ivies usually expect top 5-10%`); }
      else if (profile.classRank <= 2) { multiplier *= 1.1; factors.push(`Top of class`); }
    }
  }

  // ---- Extracurriculars (saved activities) ----
  let eliteCount = 0, strongCount = 0, solidCount = 0;
  for (const id of savedIds || []) {
    const a = source.find(x => x.id === id);
    if (!a) continue;
    if (a.tier === "elite") eliteCount++;
    else if (a.tier === "strong") strongCount++;
    else solidCount++;
  }
  if (college.ecTier === "elite") {
    if (eliteCount === 0 && strongCount < 2) { multiplier *= 0.35; factors.push(`No elite-tier ECs — top schools expect 1-2 standout signals`); }
    else if (eliteCount >= 2) { multiplier *= 1.5; factors.push(`Multiple elite-tier ECs — strong signal`); }
    else if (eliteCount === 1) { multiplier *= 1.15; factors.push(`One elite EC — solid hook`); }
    else if (strongCount >= 2) { multiplier *= 0.9; factors.push(`Several strong ECs but no elite hook`); }
  } else if (college.ecTier === "strong") {
    if (eliteCount + strongCount === 0 && solidCount < 2) { multiplier *= 0.6; factors.push(`Light EC profile`); }
    else if (eliteCount >= 1) { multiplier *= 1.25; factors.push(`Elite EC stands out at this tier`); }
    else if (strongCount >= 2) { multiplier *= 1.1; factors.push(`Solid EC profile`); }
  }

  let probability = college.admitRate * multiplier;
  probability = Math.min(0.92, Math.max(0.005, probability));

  let bucket;
  if (probability < 0.15) bucket = "reach";
  else if (probability < 0.40) bucket = "target";
  else if (probability < 0.70) bucket = "likely";
  else bucket = "safety";

  return { probability, bucket, factors, multiplier };
}

function rankColleges(profile, savedIds, colleges, source) {
  colleges = colleges || COLLEGES;
  return colleges.map(c => {
    const odds = estimateOdds(profile, savedIds, c, source);
    return { college: c, ...odds };
  }).sort((a, b) => b.probability - a.probability);
}

// === TRANSCRIPT PARSER ===
// Best-effort extraction from any pasted text or OCR output.
// Returns { name, unweightedGpa, weightedGpa, sat, act, apCount, classRank, intendedMajor }.
function parseTranscript(text) {
  const out = {};
  if (!text || typeof text !== "string") return out;
  const t = text;

  // Helper: pick the LAST occurrence of a regex (for transcripts with per-year + cumulative)
  function lastMatch(re) {
    const all = [...t.matchAll(re)];
    return all.length ? all[all.length - 1] : null;
  }

  // ---- Name ----
  let m = t.match(/(?:student\s*name|legal\s*name|full\s*name|name)[ \t]*[:=-]+[ \t]*([A-Z][a-zA-Z'-]+(?:[ \t]+[A-Z][a-zA-Z'.-]+){1,3})/i);
  if (m) {
    out.name = m[1].trim();
  } else {
    // Fallback: first line that looks like "First Last" (no digits, 2-4 cap-words)
    const lines = t.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length > 60) continue;
      const nameLine = trimmed.match(/^([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'.-]+){1,3})$/);
      if (nameLine && !/(grade|school|gpa|sat|act|year|semester|quarter|fall|spring|cumulative)/i.test(trimmed)) {
        out.name = nameLine[1];
        break;
      }
    }
  }

  // ---- Cumulative GPA gets priority ----
  // If "Cumulative GPA: X.XX" appears, that wins over per-year GPAs.
  m = lastMatch(/cumulative\s*(?:un[-\s]*weighted)?\s*(?:gpa|grade\s*point\s*average)?[\s:=]*(\d\.\d{1,3})/gi);
  if (m) {
    const val = parseFloat(m[1]);
    if (val > 4.0) out.weightedGpa = val;
    else if (val >= 1.0) out.unweightedGpa = val;
  }

  // ---- Unweighted GPA (explicit label) — pick the LAST one ----
  m = lastMatch(/un[-\s]*weighted\s*(?:gpa|grade\s*point\s*average)?[\s:=]+(\d\.\d{1,3})/gi)
   || lastMatch(/gpa\s*\(?\s*un[-\s]*weighted\s*\)?[\s:=]+(\d\.\d{1,3})/gi)
   || lastMatch(/\buw\s*gpa[\s:=]+(\d\.\d{1,3})/gi);
  if (m && !out.unweightedGpa) out.unweightedGpa = parseFloat(m[1]);

  // ---- Weighted GPA (explicit label) — pick the LAST one ----
  m = lastMatch(/weighted\s*(?:gpa|grade\s*point\s*average)?[\s:=]+(\d\.\d{1,3})/gi)
   || lastMatch(/gpa\s*\(?\s*weighted\s*\)?[\s:=]+(\d\.\d{1,3})/gi)
   || lastMatch(/\bw\s*gpa[\s:=]+(\d\.\d{1,3})/gi);
  if (m && !out.weightedGpa) out.weightedGpa = parseFloat(m[1]);

  // ---- "X.XX/4.0" -> unweighted; "X.XX/5.0" -> weighted ----
  if (!out.unweightedGpa) {
    m = t.match(/(\d\.\d{1,3})\s*\/\s*4(?:\.0+)?\b/);
    if (m) {
      const val = parseFloat(m[1]);
      if (val >= 0 && val <= 4.0) out.unweightedGpa = val;
    }
  }
  if (!out.weightedGpa) {
    m = t.match(/(\d\.\d{1,3})\s*\/\s*5(?:\.0+)?\b/);
    if (m) {
      const val = parseFloat(m[1]);
      if (val >= 0 && val <= 5.0) out.weightedGpa = val;
    }
  }

  // ---- Plain "GPA: X.XX" / "GPA X.XX" / "Cumulative: X.XX" / "Cumulative GPA X.XX" ----
  if (!out.unweightedGpa && !out.weightedGpa) {
    m = t.match(/(?:cumulative\s+)?gpa\s*[:=]?\s*(\d\.\d{1,3})/i)
     || t.match(/cumulative[\s:=]+(\d\.\d{1,3})/i)
     || t.match(/grade\s*point\s*average[\s:=]+(\d\.\d{1,3})/i);
    if (m) {
      const val = parseFloat(m[1]);
      if (val > 4.0) out.weightedGpa = val;
      else if (val >= 1.0) out.unweightedGpa = val;
    }
  }

  // ---- Bare GPA in conversational text: "I have a 3.85" near "GPA" ----
  if (!out.unweightedGpa && !out.weightedGpa) {
    m = t.match(/(\d\.\d{1,3})\s+(?:gpa|cumulative|unweighted|weighted)/i);
    if (m) {
      const val = parseFloat(m[1]);
      if (val > 4.0) out.weightedGpa = val;
      else if (val >= 1.0) out.unweightedGpa = val;
    }
  }

  // ---- SAT ----
  m = t.match(/\bsat[\s:=-]+(\d{3,4})\b/i)
   || t.match(/\b(\d{3,4})\s*(?:total\s*)?(?:on\s+(?:the\s+|my\s+)?)?sat\b/i)
   || t.match(/sat\s*(?:score|composite|total)?[\s:=]+(\d{3,4})/i)
   || t.match(/scored?\s+(?:a\s+)?(\d{3,4})\s+on\s+(?:the\s+)?sat/i);
  if (m) {
    const val = parseInt(m[1], 10);
    if (val >= 400 && val <= 1600) out.sat = val;
  }

  // ---- ACT (avoid course names like "AP Government") ----
  m = t.match(/\bact\s*(?:composite|score|total)?[\s:=-]+(\d{1,2})\b/i)
   || t.match(/\b(\d{1,2})\s*(?:on\s+(?:the\s+)?)?act\b/i)
   || t.match(/scored?\s+(?:a\s+)?(\d{1,2})\s+on\s+(?:the\s+)?act/i);
  if (m) {
    const val = parseInt(m[1], 10);
    if (val >= 10 && val <= 36) out.act = val;
  }

  // ---- AP/IB/Honors course count ----
  // Many transcripts: course on its own line, with year/grade in adjacent columns.
  // Match per-line so column data doesn't bleed across courses.
  const allRigorous = new Set();
  const lines = t.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 1. AP <Course Name> — match ALL on the line (handles "AP Bio, AP Chem, AP Calc")
    const apMatches = [...line.matchAll(/\bAP\s+([A-Z][A-Za-z&]+(?:\s+[A-Z][A-Za-z&]+){0,3})/g)];
    for (const apM of apMatches) allRigorous.add(("ap " + apM[1]).toLowerCase().trim());

    // 2. IB <Course Name> or IB HL/SL <Course> — match ALL on the line
    const ibMatches = [...line.matchAll(/\bIB\s+(?:HL\s+|SL\s+)?([A-Z][A-Za-z&]+(?:\s+[A-Z][A-Za-z&]+){0,3})/g)];
    for (const ibM of ibMatches) allRigorous.add(("ib " + ibM[1]).toLowerCase().trim());

    // 3. "<Course> Honors" or "Honors <Course>"
    const honorsPrefix = line.match(/\bhonors\s+([A-Z][A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    const honorsSuffix = line.match(/([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s+honors\b/i);
    if (honorsPrefix) allRigorous.add(("honors " + honorsPrefix[1]).toLowerCase().trim());
    else if (honorsSuffix) allRigorous.add(("honors " + honorsSuffix[1]).toLowerCase().trim());

    // 4. Column-code Honors: "(H)", "[H]", " H " marker on a course line
    const honorsCode = line.match(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\s*[\[(]?H[\])]?\b/);
    if (honorsCode && /[\(\[]H[\)\]]|\sH\s|\sH$/.test(line)) {
      const courseName = honorsCode[1];
      // Avoid misfiring on "AP Biology" already captured
      if (!/^AP\b/i.test(courseName) && !/^IB\b/i.test(courseName)) {
        allRigorous.add(("honors " + courseName).toLowerCase().trim());
      }
    }
  }
  if (allRigorous.size > 0) out.apCount = allRigorous.size;

  // 2. "X AP classes/courses/exams" or "X APs" — overrides if larger
  const countPatterns = [
    /(\d+)\s+ap\s+(?:classes|courses|exams|tests)/i,
    /(\d+)\s+aps?\b/i,
    /taken\s+(\d+)\s+ap/i,
    /total\s+ap[\s:=]*(\d+)/i
  ];
  for (const pat of countPatterns) {
    const cm = t.match(pat);
    if (cm) {
      const val = parseInt(cm[1], 10);
      if (val >= 0 && val <= 30 && val > (out.apCount || 0)) out.apCount = val;
    }
  }

  // ---- Class rank: "Rank: 5 of 412" / "5 of 412" / "5/412" ----
  m = t.match(/(?:class\s+)?rank(?:ed|ing)?[\s:#]*(\d+)\s*(?:of|out\s+of|\/)\s*(\d+)/i)
   || t.match(/(\d+)\s*(?:of|out\s+of|\/)\s*(\d+)\s+(?:in\s+)?(?:my\s+)?class/i);
  if (m) {
    const pos = parseInt(m[1], 10);
    const total = parseInt(m[2], 10);
    if (total > 0 && pos > 0 && pos <= total) {
      out.classRank = Math.max(1, Math.round((pos / total) * 100));
    }
  }

  // ---- "top X%" pattern ----
  if (!out.classRank) {
    m = t.match(/top\s*(\d+)\s*%/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (val > 0 && val <= 100) out.classRank = val;
    }
  }

  // ---- Intended major ----
  m = t.match(/(?:intended|prospective|planning\s+to\s+study|want\s+to\s+study|plan\s+to\s+major\s+in|major\s+in)?\s*major\s*[:=-]+\s*([A-Za-z][A-Za-z\s&]*?)(?:[\n.,]|$)/i)
   || t.match(/major\s+in\s+([A-Za-z][A-Za-z\s&]*?)(?:[\n.,]|$)/i)
   || t.match(/study(?:ing)?\s+([A-Z][A-Za-z\s&]*?)(?:[\n.,]|$)/);
  if (m) {
    const major = m[1].trim();
    if (major.length > 2 && major.length < 60) out.intendedMajor = major;
  }

  return out;
}

// === CLAUDE API PARSING ===
// Uses the user's own Anthropic key, called direct from browser.
// Returns same shape as parseTranscript().
async function parseWithClaude(text, apiKey) {
  if (!apiKey) throw new Error("No API key configured");
  if (!text || !text.trim()) return {};

  const systemPrompt = "You extract structured college-application data from messy student-supplied text (transcripts, profile dumps, conversational descriptions, OCR output). Output JSON only.";

  const userPrompt = `Read the text below (it may be a transcript, OCR output, or a free-form profile dump) and return ONE JSON object. OMIT any field you cannot find. Do not guess.

Schema:
{
  "name": string (student's full name),
  "unweightedGpa": number 0-4,
  "weightedGpa": number 0-5,
  "sat": integer 400-1600 (total SAT),
  "act": integer 1-36 (composite ACT),
  "apCount": integer (TOTAL count of AP + IB + Honors courses across ALL years on the transcript, deduplicated),
  "classRank": integer (top X percentile, e.g. "8 of 412" -> 2),
  "intendedMajor": string
}

Critical rules:
- Multi-year transcripts: If the document shows per-year GPAs and a cumulative, ALWAYS use the cumulative. If multiple cumulatives appear (one per term), use the MOST RECENT.
- AP / IB / Honors count: count EVERY rigor-marked course across all years, including current-year courses even if no grade is posted yet. Deduplicate same course taken twice. Honors may appear as "(H)", "[H]", a column "H" code, "Honors X", or "X Honors". Count all of them.
- "X.XX/4.0" implies unweighted. "X.XX/5.0" implies weighted.
- For class rank, convert "8 of 412" to top 2 (percentile), not the literal 8.
- Name: extract the student's actual name if present. Do not invent one.
- Return ONLY valid JSON, no prose, no markdown fences.
- If the text has nothing relevant, return {}.

TEXT:
"""
${text}
"""

JSON:`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  if (!res.ok) {
    let errText;
    try {
      const j = await res.json();
      errText = (j && j.error && j.error.message) || JSON.stringify(j);
    } catch { errText = await res.text(); }
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = data && data.content && data.content[0] && data.content[0].text;
  if (!content) throw new Error("Empty response from Claude");

  // Strip ```json fences if Claude added them despite instructions
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object in response: " + cleaned.slice(0, 200));

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error("Invalid JSON from Claude: " + jsonMatch[0].slice(0, 200));
  }

  // Validate ranges, drop bad fields silently
  const out = {};
  if (typeof parsed.name === "string" && parsed.name.length >= 2 && parsed.name.length < 80 && /[A-Za-z]/.test(parsed.name)) out.name = parsed.name.trim();
  if (typeof parsed.unweightedGpa === "number" && parsed.unweightedGpa >= 0 && parsed.unweightedGpa <= 4.0) out.unweightedGpa = parsed.unweightedGpa;
  if (typeof parsed.weightedGpa === "number" && parsed.weightedGpa >= 0 && parsed.weightedGpa <= 5.0) out.weightedGpa = parsed.weightedGpa;
  if (typeof parsed.sat === "number" && parsed.sat >= 400 && parsed.sat <= 1600) out.sat = Math.round(parsed.sat);
  if (typeof parsed.act === "number" && parsed.act >= 1 && parsed.act <= 36) out.act = Math.round(parsed.act);
  if (typeof parsed.apCount === "number" && parsed.apCount >= 0 && parsed.apCount <= 30) out.apCount = Math.round(parsed.apCount);
  if (typeof parsed.classRank === "number" && parsed.classRank >= 1 && parsed.classRank <= 100) out.classRank = Math.round(parsed.classRank);
  if (typeof parsed.intendedMajor === "string" && parsed.intendedMajor.length > 1 && parsed.intendedMajor.length < 80) out.intendedMajor = parsed.intendedMajor.trim();
  return out;
}

// === ESSAY GRADER ===
function gradeEssay(text) {
  text = (text || "").trim();
  const words = text ? text.split(/\s+/).filter(w => w.length) : [];
  const wordCount = words.length;
  const lower = text.toLowerCase();
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length);

  // Word count score (Common App: 250-650)
  let lengthScore = 0;
  if (wordCount === 0) lengthScore = 0;
  else if (wordCount < 250) lengthScore = (wordCount / 250) * 60;
  else if (wordCount <= 650) lengthScore = 100;
  else if (wordCount <= 700) lengthScore = 80;
  else lengthScore = Math.max(40, 100 - (wordCount - 650) / 4);

  // Cliché count
  const clicheHits = [];
  for (const c of ESSAY_CLICHES) {
    const re = new RegExp("\\b" + c.replace(/ /g, "\\s+") + "\\b", "gi");
    const matches = text.match(re);
    if (matches) clicheHits.push({ phrase: c, count: matches.length });
  }
  const totalCliches = clicheHits.reduce((s, c) => s + c.count, 0);
  const clicheScore = wordCount === 0 ? 0 : Math.max(0, 100 - totalCliches * 18);

  // Specificity: numbers + proper nouns (capitalized words not at sentence start)
  const numberMatches = text.match(/\b\d+([.,]\d+)?\b/g) || [];
  const properNouns = (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [])
    .filter((w, i, a) => i > 0 || w.length > 1); // crude
  const specificityRaw = numberMatches.length * 2 + properNouns.length;
  const specificityScore = wordCount === 0 ? 0 : Math.min(100, (specificityRaw / Math.max(wordCount, 1)) * 1000);

  // Show vs Tell — penalize state verbs ('was', 'is', 'were', 'felt', 'realized')
  const stateVerbs = (text.match(/\b(was|were|is|are|am|been|being|felt|feel|realized|seemed|became)\b/gi) || []).length;
  const showTellRatio = wordCount === 0 ? 0 : stateVerbs / wordCount;
  const showTellScore = Math.max(0, 100 - showTellRatio * 800);

  // First-person voice — should have personal pronouns but not be 100% I/me
  const iCount = (text.match(/\b(i|me|my|myself|mine)\b/gi) || []).length;
  const voiceScore = wordCount === 0 ? 0
    : (iCount === 0 ? 40
       : iCount / wordCount > 0.15 ? 50
       : iCount / wordCount < 0.02 ? 60
       : 100);

  // Sentence variety
  const avgSentence = sentences.length ? wordCount / sentences.length : 0;
  const sentenceVariety = sentences.length < 3 ? 30
    : avgSentence < 8 ? 60
    : avgSentence > 28 ? 60
    : 100;

  // Composite
  const overall = wordCount === 0 ? 0 : Math.round(
    lengthScore * 0.15 +
    clicheScore * 0.25 +
    specificityScore * 0.25 +
    showTellScore * 0.15 +
    voiceScore * 0.10 +
    sentenceVariety * 0.10
  );

  const feedback = [];
  if (wordCount === 0) feedback.push("Empty essay — write at least 250 words.");
  else if (wordCount < 250) feedback.push(`Too short (${wordCount} words). Common App essays should be 250-650.`);
  else if (wordCount > 650) feedback.push(`Over the 650-word Common App limit (${wordCount}).`);
  if (totalCliches >= 3) feedback.push(`Cut clichés: found ${totalCliches} hits (${clicheHits.slice(0, 3).map(c => '"' + c.phrase + '"').join(", ")}).`);
  else if (totalCliches > 0) feedback.push(`Watch for clichés: "${clicheHits[0].phrase}".`);
  if (specificityScore < 40) feedback.push("Add specifics — names, numbers, dates. Replace abstractions with concrete moments.");
  if (showTellScore < 60) feedback.push("Too much telling. Replace 'I felt nervous' with the physical detail (sweaty palms, racing pulse, the second hand on the clock).");
  if (voiceScore < 70) feedback.push(iCount === 0 ? "No personal voice — use 'I' to claim the experience." : "Over-using 'I' — vary sentence openings.");
  if (sentenceVariety < 80) feedback.push("Vary sentence length. Mix short punchy sentences with longer ones.");
  if (overall >= 80) feedback.unshift("Strong draft. Polish and submit.");
  else if (overall >= 65) feedback.unshift("Solid foundation. The fixes below will lift it.");
  else if (overall >= 0) feedback.unshift("Significant revisions needed.");

  return {
    overall,
    grade: overall >= 90 ? "A" : overall >= 80 ? "A-" : overall >= 70 ? "B+" : overall >= 60 ? "B" : overall >= 50 ? "C" : overall >= 35 ? "D" : "F",
    breakdown: {
      length: Math.round(lengthScore),
      cliches: Math.round(clicheScore),
      specificity: Math.round(specificityScore),
      showTell: Math.round(showTellScore),
      voice: Math.round(voiceScore),
      variety: Math.round(sentenceVariety)
    },
    stats: { wordCount, sentenceCount: sentences.length, avgSentence: Math.round(avgSentence * 10) / 10, clicheHits, iCount },
    feedback
  };
}

// === ESSAY GENERATOR (template-based scaffold) ===
// opts: { topic, details } — user-supplied direction. Topic = what the essay is about.
// Details = comma/newline-separated specific things they want mentioned (sensory, factual).
function generateEssay(profile, savedIds, prompt, source, opts) {
  source = source || ACTIVITIES;
  opts = opts || {};
  const topic = (opts.topic || "").trim();
  const detailsRaw = (opts.details || "").trim();

  const acts = (savedIds || []).map(id => source.find(a => a.id === id)).filter(Boolean);
  const top = acts.slice(0, 3);
  const major = profile.intendedMajor || "the field I'm exploring";
  const name = profile.name || "";

  const detailList = detailsRaw.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
  const profileLikes = (profile.likes || "").split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
  const allDetails = detailList.concat(profileLikes);
  const d1 = allDetails[0];
  const d2 = allDetails[1];
  const d3 = allDetails[2];

  if (!topic && top.length === 0) {
    return {
      draft: "Tell me what this essay is about (the \"What it's about\" field above) or add at least one activity to your resume — the generator needs a real anchor to build the draft on.",
      isPlaceholder: true
    };
  }

  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const lcTopic = topic.toLowerCase();

  // ---- HOOK ----
  let hook;
  if (topic) {
    if (d1) {
      hook = `${cap(lcTopic)} started, for me, with ${d1}. I did not understand what I was looking at the first time.`;
    } else if (top.length > 0) {
      hook = `Most of what I have learned about ${lcTopic} did not come from ${top[0].title.toLowerCase()} — it came from the parts of that work no one else saw.`;
    } else {
      hook = `Most of what I have learned about ${lcTopic} came from the parts no one else saw.`;
    }
  } else {
    const hooks = {
      "found-nonprofit": "The day I filed our 501(c)(3) paperwork, the post office clerk asked if I was sure I was the right person to be doing this.",
      "research-with-prof": "On my fifteenth cold email to a professor, the reply came at 11:47 p.m. on a Tuesday: \"Come by Thursday at 3.\"",
      "build-ship-app": "The first time someone I had never met opened my app, I watched the analytics dashboard tick from 0 to 1.",
      "publish-paper": "The reviewer comments came back marked \"major revisions\" and I read them three times before I stopped feeling sick.",
      "hospital-volunteer": "The clipboard was heavier than I expected — paper, plastic, and the weight of every patient name I would not be allowed to discuss.",
      "tutoring-program": "I had budgeted forty-five minutes for our first session. We finished question one in forty-seven."
    };
    hook = hooks[top[0].id] || `The first time I committed seriously to ${top[0].title.toLowerCase()}, I had no idea what I was getting into.`;
  }

  // ---- BODY 1 ----
  let body1;
  if (topic) {
    body1 = `What I had thought ${lcTopic} was about — and what it turned out to be — diverged early. ` +
      (d2 ? `${cap(d2)} kept showing up where I had not planned to find it. ` : "") +
      (d3 ? `So did ${d3}. ` : "") +
      `The version of myself I had been describing to other people was the clean one. The version that showed up when no one was watching was not.`;
  } else {
    body1 = `What started as ${top[0].summary.toLowerCase()} grew into something I couldn't have planned. ` +
      `It forced a different question: not what I was good at, but what I was willing to do badly until I got better.`;
  }

  // ---- BODY 2 (the turn / connection) ----
  let body2;
  if (topic && top.length > 0) {
    body2 = `That is when I started ${top[0].title.toLowerCase()}. ${top[0].summary} ` +
      `The connection to ${lcTopic} was not obvious — to me or to anyone watching — but it kept reappearing in the work. In what I asked. In what bored me. In what I came back to without being told.`;
  } else if (topic) {
    body2 = `By the time I had a vocabulary for ${lcTopic}, the shape of it had already changed me. I stopped trying to explain it cleanly. I started trying to live inside it honestly.`;
  } else if (top.length > 1) {
    body2 = `That mindset carried into ${top[1].title.toLowerCase()}. ${top[1].summary} ` +
      `The connection wasn't obvious at first — ${top[0].category.toLowerCase()} and ${top[1].category.toLowerCase()} aren't typically grouped together — but the discipline transferred. I learned to ship before I felt ready.`;
  } else {
    body2 = `Each week I came back to the same work, even when nothing visible changed. The progress was slow until it wasn't.`;
  }

  // ---- BODY 3 (deepening, optional) ----
  let body3 = "";
  if (topic && top.length > 1) {
    body3 = `${cap(top[1].title.toLowerCase())} confirmed what ${lcTopic} had been hinting at. The two were not in conflict. They were the same question wearing different clothes — and the clothes only mattered to people who weren't doing the work.`;
  } else if (!topic && top.length > 2) {
    body3 = `By the time I added ${top[2].title.toLowerCase()} to the picture, the pattern was clear. What I cared about wasn't a checklist — it was a set of through-lines I was finally beginning to recognize in myself.`;
  }

  // ---- CONCLUSION ----
  let conclusion;
  if (topic) {
    conclusion = `I am applying to study ${major} because ${lcTopic} is not finished with me yet. The questions it raised are the ones I still want to be working on at twenty, at thirty, at fifty. ` +
      (name ? `${name} is not done with this. That is the point.` : `I am not done with this. That is the point.`);
  } else {
    const a2cat = (top[1] || top[0]).category.toLowerCase();
    conclusion = `I am applying to study ${major} because the questions I want to answer don't fit inside any single activity I've listed here. They show up at the intersections — between ${top[0].category.toLowerCase()} and ${a2cat}, between what I planned and what actually happened, between who I was when I started and who I am now writing this. I am not finished, and that is the point.`;
  }

  const draft = [hook, "", body1, "", body2, body3 ? "" : null, body3, body3 ? "" : null, conclusion]
    .filter(p => p !== null && p !== undefined && p !== "")
    .join("\n");

  return {
    draft,
    isPlaceholder: false,
    builtFrom: top.map(a => a.title),
    topic: topic || null,
    detailsUsed: allDetails.slice(0, 3),
    prompt: prompt || ESSAY_PROMPTS[0]
  };
}

// === EXPORTS for tests ===
if (typeof module !== "undefined") {
  module.exports = {
    defaultState, loadState, saveState,
    findActivity, toggleSaved, isSaved, setNote,
    filterActivities, suggestActivities,
    botReply, exportResume,
    estimateOdds, rankColleges,
    gradeEssay, generateEssay, parseTranscript, parseWithClaude,
    STORAGE_KEY, INTEREST_MAP
  };
}

// === UI WIRING (browser only) ===
if (typeof document !== "undefined" && typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    let state = loadState();
    const elCatalog = document.getElementById("catalog");
    const elSavedList = document.getElementById("saved-list");
    const elSavedCount = document.getElementById("saved-count");
    const elSearch = document.getElementById("search");
    const elCategoryFilter = document.getElementById("category-filter");
    const elTierFilter = document.getElementById("tier-filter");
    const elChatLog = document.getElementById("chat-log");
    const elChatInput = document.getElementById("chat-input");
    const elChatSend = document.getElementById("chat-send");
    const elGenerate = document.getElementById("generate-btn");
    const elExport = document.getElementById("export-btn");
    const elExportArea = document.getElementById("export-area");

    function persist() { saveState(state); }

    function renderCategoryOptions() {
      elCategoryFilter.innerHTML = "";
      for (const cat of CATEGORIES) {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        elCategoryFilter.appendChild(opt);
      }
    }

    function renderCatalog() {
      const filters = {
        search: elSearch.value,
        category: elCategoryFilter.value,
        tier: elTierFilter.value
      };
      const results = filterActivities(ACTIVITIES, filters);
      elCatalog.innerHTML = "";
      if (results.length === 0) {
        elCatalog.innerHTML = "<p class=\"muted\">No matches. Try clearing filters.</p>";
        return;
      }
      for (const a of results) {
        elCatalog.appendChild(renderCard(a));
      }
    }

    function renderCard(a) {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.id = a.id;
      const tierMeta = TIERS[a.tier];
      const saved = isSaved(state, a.id);

      card.innerHTML = `
        <div class="card-head">
          <span class="tier-badge" style="background:${tierMeta.color}">${tierMeta.label}</span>
          <span class="cat-badge">${a.category}</span>
        </div>
        <h3>${a.title}</h3>
        <p>${a.summary}</p>
        <div class="meta">
          <span>Impact ${"*".repeat(a.impact)}</span>
          <span>Initiative ${"*".repeat(a.initiative)}</span>
          <span>${a.commitment}</span>
        </div>
        <details>
          <summary>How to do it</summary>
          <ol>${a.steps.map(s => `<li>${s}</li>`).join("")}</ol>
          <p class="tip"><strong>Tip:</strong> ${a.tip}</p>
        </details>
        <button class="add-btn ${saved ? "saved" : ""}" type="button">${saved ? "&#10003; On your resume" : "+ Add to resume"}</button>
      `;
      card.querySelector(".add-btn").addEventListener("click", () => {
        toggleSaved(state, a.id);
        persist();
        renderCatalog();
        renderSaved();
      });
      return card;
    }

    function renderSaved() {
      elSavedCount.textContent = state.saved.length;
      elSavedList.innerHTML = "";
      if (state.saved.length === 0) {
        elSavedList.innerHTML = "<p class=\"muted\">Nothing saved yet. Add activities or chat with the assistant.</p>";
        return;
      }
      for (const id of state.saved) {
        const a = findActivity(id);
        if (!a) continue;
        const item = document.createElement("div");
        item.className = "saved-item";
        const note = state.customNotes[id] || "";
        item.innerHTML = `
          <div class="saved-head">
            <strong>${a.title}</strong>
            <button class="remove-btn" type="button" title="Remove">&times;</button>
          </div>
          <textarea placeholder="Your notes (e.g. specific accomplishments, hours, dates)">${note}</textarea>
        `;
        item.querySelector(".remove-btn").addEventListener("click", () => {
          toggleSaved(state, id);
          persist();
          renderCatalog();
          renderSaved();
        });
        item.querySelector("textarea").addEventListener("input", (e) => {
          setNote(state, id, e.target.value);
          persist();
        });
        elSavedList.appendChild(item);
      }
    }

    function appendChat(role, text, suggestions) {
      const msg = document.createElement("div");
      msg.className = "chat-msg " + role;
      msg.innerHTML = `<div class="chat-bubble">${escapeHtml(text)}</div>`;
      if (suggestions && suggestions.length) {
        const sugWrap = document.createElement("div");
        sugWrap.className = "chat-suggestions";
        for (const id of suggestions) {
          const a = findActivity(id);
          if (!a) continue;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "suggestion-pill" + (isSaved(state, id) ? " saved" : "");
          btn.textContent = (isSaved(state, id) ? "✓ " : "+ ") + a.title;
          btn.addEventListener("click", () => {
            toggleSaved(state, id);
            persist();
            renderCatalog();
            renderSaved();
            btn.className = "suggestion-pill" + (isSaved(state, id) ? " saved" : "");
            btn.textContent = (isSaved(state, id) ? "✓ " : "+ ") + a.title;
          });
          sugWrap.appendChild(btn);
        }
        msg.appendChild(sugWrap);
      }
      elChatLog.appendChild(msg);
      elChatLog.scrollTop = elChatLog.scrollHeight;
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    }

    function sendChatMessage() {
      const text = elChatInput.value.trim();
      if (!text) return;
      appendChat("user", text);
      state.chat.push({ role: "user", text, ts: Date.now() });
      const reply = botReply(text, state);
      appendChat("bot", reply.text, reply.suggestions);
      state.chat.push({ role: "bot", text: reply.text, suggestions: reply.suggestions, ts: Date.now() });
      persist();
      elChatInput.value = "";
    }

    function generateOne() {
      const seedInterests = state.profile.interests.length
        ? state.profile.interests
        : Object.keys(INTEREST_MAP).slice(0, 3);
      const picks = suggestActivities(ACTIVITIES, seedInterests, { limit: 1, excludeIds: state.saved });
      if (picks.length === 0) {
        appendChat("bot", "You've already saved every top match. Try clearing some, or browse the full catalog.");
        return;
      }
      const pick = picks[0];
      appendChat("bot", "One-click pick for you:", [pick.id]);
    }

    // Initial render
    renderCategoryOptions();
    renderCatalog();
    renderSaved();
    if (state.chat.length === 0) {
      appendChat("bot", "Hi! Tell me what you care about (medicine, tech, writing, etc.) and I'll suggest the highest-leverage activities for your college resume.");
    } else {
      for (const m of state.chat) appendChat(m.role, m.text, m.suggestions);
    }

    // Wire events
    elSearch.addEventListener("input", renderCatalog);
    elCategoryFilter.addEventListener("change", renderCatalog);
    elTierFilter.addEventListener("change", renderCatalog);
    elChatSend.addEventListener("click", sendChatMessage);
    elChatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChatMessage();
    });
    elGenerate.addEventListener("click", generateOne);
    elExport.addEventListener("click", () => {
      elExportArea.value = exportResume(state);
      elExportArea.style.display = "block";
      elExportArea.select();
    });

    // ===== TABS =====
    const tabs = document.querySelectorAll(".tab");
    const panels = {
      catalog: document.getElementById("panel-catalog"),
      profile: document.getElementById("panel-profile"),
      essay: document.getElementById("panel-essay"),
      colleges: document.getElementById("panel-colleges")
    };
    tabs.forEach(t => {
      t.addEventListener("click", () => {
        tabs.forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        for (const k in panels) panels[k].classList.add("hidden");
        const target = t.dataset.tab;
        panels[target].classList.remove("hidden");
        if (target === "colleges") renderColleges();
      });
    });

    // ===== PROFILE =====
    const profileForm = document.getElementById("profile-form");
    const profileMsg = document.getElementById("profile-saved-msg");
    function fillProfileForm() {
      const p = state.profile;
      const fields = ["name", "grade", "unweightedGpa", "weightedGpa", "sat", "act", "apCount", "classRank", "intendedMajor", "likes", "doing"];
      for (const f of fields) {
        const el = profileForm.elements[f];
        if (!el) continue;
        const v = p[f];
        el.value = (v === null || v === undefined) ? "" : v;
      }
    }
    // Quick-import: parse pasted transcript and prefill the form
    const elTranscript = document.getElementById("transcript-input");
    const elParseBtn = document.getElementById("parse-transcript");
    const elParseResult = document.getElementById("parse-result");
    const FIELD_LABELS = {
      name: "Name",
      unweightedGpa: "Unweighted GPA",
      weightedGpa: "Weighted GPA",
      sat: "SAT",
      act: "ACT",
      apCount: "AP/Honors count",
      classRank: "Class rank %",
      intendedMajor: "Major"
    };
    const FIELD_ORDER = ["name", "unweightedGpa", "weightedGpa", "sat", "act", "apCount", "classRank", "intendedMajor"];

    // Staged values from the last parse — NOT applied until user confirms
    let stagedParse = null;

    async function runParse(rawText) {
      stagedParse = null;
      const apiKey = localStorage.getItem(API_KEY_STORAGE);
      if (apiKey) {
        elParseResult.innerHTML = `<div class="parse-thinking">Claude is reading your text...</div>`;
        try {
          const aiParsed = await parseWithClaude(rawText, apiKey);
          if (Object.keys(aiParsed).length > 0) {
            stagedParse = { values: aiParsed, mode: "ai" };
            renderStagedPreview();
            return;
          }
        } catch (err) {
          console.warn("Claude parse failed, falling back to regex:", err);
          elParseResult.innerHTML = `<div class="parse-warning">AI parsing failed (${escapeHtml(err.message)}). Falling back to pattern parser.</div>`;
        }
      }
      const parsed = parseTranscript(rawText);
      stagedParse = { values: parsed, mode: "rules" };
      renderStagedPreview();
    }

    function renderStagedPreview() {
      elParseResult.innerHTML = "";
      if (!stagedParse) return;
      const { values, mode } = stagedParse;
      const modeLabel = mode === "ai" ? "Claude AI" : "pattern parser";

      const wrap = document.createElement("div");
      wrap.className = "parse-report staged";

      const found = FIELD_ORDER.filter(f => values[f] !== undefined && values[f] !== null && values[f] !== "");
      const missed = FIELD_ORDER.filter(f => !(values[f] !== undefined && values[f] !== null && values[f] !== ""));

      if (found.length === 0) {
        wrap.innerHTML = `
          <div class="parse-empty">
            <strong>Could not detect anything (${modeLabel}).</strong>
            <p>Try a format like:</p>
            <pre>Name: Alex Kim
GPA: 3.85
Weighted GPA: 4.20
SAT: 1480
AP Biology, AP Calculus AB
Class Rank: 12 of 380</pre>
          </div>
        `;
        elParseResult.appendChild(wrap);
        return;
      }

      const rowsHtml = found.map(f => {
        const val = values[f];
        const inputType = (typeof val === "number") ? "number" : "text";
        return `
          <div class="staged-row" data-field="${f}">
            <label class="staged-check">
              <input type="checkbox" checked />
              <span>${escapeHtml(FIELD_LABELS[f])}</span>
            </label>
            <input type="${inputType}" class="staged-value" value="${escapeHtml(String(val))}" />
          </div>
        `;
      }).join("");

      const missedHtml = missed.length
        ? `<details class="parse-missed-details">
             <summary>${missed.length} field${missed.length === 1 ? "" : "s"} not detected</summary>
             <ul>${missed.map(f => `<li><span class="pill-missed">missing</span> ${escapeHtml(FIELD_LABELS[f])}</li>`).join("")}</ul>
           </details>`
        : "";

      wrap.innerHTML = `
        <div class="parse-success">
          <strong>${found.length} field${found.length === 1 ? "" : "s"} detected</strong>
          <span class="parse-mode">via ${modeLabel}</span>.
          Review and edit below, then click <em>Fill profile</em>.
        </div>
        <div class="staged-rows">${rowsHtml}</div>
        <div class="staged-actions">
          <button id="staged-apply" type="button" class="primary">Fill profile</button>
          <button id="staged-discard" type="button" class="secondary">Discard</button>
        </div>
        ${missedHtml}
      `;
      elParseResult.appendChild(wrap);

      document.getElementById("staged-apply").addEventListener("click", applyStaged);
      document.getElementById("staged-discard").addEventListener("click", () => {
        stagedParse = null;
        elParseResult.innerHTML = "";
      });
    }

    function applyStaged() {
      if (!stagedParse) return;
      const rows = document.querySelectorAll(".staged-row");
      const applied = [];
      rows.forEach(row => {
        const field = row.dataset.field;
        const checked = row.querySelector('input[type="checkbox"]').checked;
        const valEl = row.querySelector(".staged-value");
        if (!checked || !field) return;
        let val = valEl.value;
        // Convert numeric fields
        const numFields = new Set(["unweightedGpa", "weightedGpa", "sat", "act", "apCount", "classRank"]);
        if (numFields.has(field)) {
          const num = Number(val);
          if (!isNaN(num) && val !== "") val = num;
          else return; // skip invalid
        }
        if (profileForm.elements[field]) {
          profileForm.elements[field].value = val;
          state.profile[field] = val;
          applied.push(FIELD_LABELS[field]);
        }
      });
      persist();
      stagedParse = null;
      elParseResult.innerHTML = `<div class="parse-success applied"><strong>Filled ${applied.length} field${applied.length === 1 ? "" : "s"}:</strong> ${applied.join(", ")}. Review the form below and click <em>Save Profile</em>.</div>`;
      setTimeout(() => {
        if (elParseResult.querySelector(".applied")) elParseResult.innerHTML = "";
      }, 8000);
    }

    elParseBtn.addEventListener("click", () => {
      runParse(elTranscript.value);
    });

    // === API KEY MANAGEMENT ===
    const elApiKeyInput = document.getElementById("api-key-input");
    const elApiKeySave = document.getElementById("api-key-save");
    const elApiKeyClear = document.getElementById("api-key-clear");
    const elApiKeyStatus = document.getElementById("api-key-status");
    const elAiStatusPill = document.getElementById("ai-status-pill");

    function refreshAiStatus() {
      const key = localStorage.getItem(API_KEY_STORAGE);
      if (key) {
        const masked = key.slice(0, 12) + "..." + key.slice(-4);
        elAiStatusPill.textContent = "AI parsing: ON";
        elAiStatusPill.className = "ai-status-on";
        elApiKeyInput.placeholder = masked + " (saved)";
        elApiKeyInput.value = "";
      } else {
        elAiStatusPill.textContent = "AI parsing: off";
        elAiStatusPill.className = "ai-status-off";
        elApiKeyInput.placeholder = "sk-ant-api03-...";
      }
    }
    refreshAiStatus();

    elApiKeySave.addEventListener("click", () => {
      const v = elApiKeyInput.value.trim();
      if (!v) {
        elApiKeyStatus.textContent = "Paste your key first.";
        elApiKeyStatus.style.color = "var(--orange)";
        return;
      }
      if (!v.startsWith("sk-ant-")) {
        elApiKeyStatus.textContent = "That doesn't look like an Anthropic key (should start with sk-ant-).";
        elApiKeyStatus.style.color = "var(--orange)";
        return;
      }
      localStorage.setItem(API_KEY_STORAGE, v);
      elApiKeyStatus.textContent = "Saved. Auto-fill will now use Claude.";
      elApiKeyStatus.style.color = "var(--green)";
      refreshAiStatus();
      setTimeout(() => { elApiKeyStatus.textContent = ""; }, 4000);
    });

    elApiKeyClear.addEventListener("click", () => {
      localStorage.removeItem(API_KEY_STORAGE);
      elApiKeyStatus.textContent = "Key removed.";
      elApiKeyStatus.style.color = "var(--text-dim)";
      refreshAiStatus();
      setTimeout(() => { elApiKeyStatus.textContent = ""; }, 3000);
    });

    // === OCR (image upload + drag/drop) ===
    const elDropZone = document.getElementById("screenshot-zone");
    const elImageInput = document.getElementById("transcript-image");
    const elOcrProgress = document.getElementById("ocr-progress");
    const elOcrStatusBadge = document.getElementById("ocr-status-badge");

    // Preload Tesseract worker on demand (or as soon as user shows interest)
    let tesseractWorker = null;
    let tesseractWorkerPromise = null;
    async function getTesseractWorker() {
      if (tesseractWorker) return tesseractWorker;
      if (tesseractWorkerPromise) return tesseractWorkerPromise;
      if (typeof Tesseract === "undefined") {
        throw new Error("OCR library failed to load. Check your internet connection (the library comes from a CDN).");
      }
      setOcrStatus("Loading OCR engine (one-time, ~5MB)...");
      tesseractWorkerPromise = (async () => {
        const w = await Tesseract.createWorker("eng");
        tesseractWorker = w;
        setOcrStatus("OCR ready");
        return w;
      })();
      return tesseractWorkerPromise;
    }
    function setOcrStatus(msg) {
      if (!elOcrStatusBadge) return;
      elOcrStatusBadge.textContent = msg;
      elOcrStatusBadge.className = msg === "OCR ready" ? "ocr-ready" : "ocr-loading";
    }

    // Kick off preload after a tick so the page renders first
    setTimeout(() => {
      getTesseractWorker().catch(err => {
        console.warn("Tesseract preload failed:", err);
        setOcrStatus("OCR unavailable");
      });
    }, 300);

    elDropZone.addEventListener("click", () => elImageInput.click());
    elDropZone.addEventListener("dragenter", (e) => { e.preventDefault(); elDropZone.classList.add("drag-over"); });
    elDropZone.addEventListener("dragover", (e) => { e.preventDefault(); elDropZone.classList.add("drag-over"); });
    elDropZone.addEventListener("dragleave", (e) => {
      // Only remove if leaving the zone entirely (not a child)
      if (!elDropZone.contains(e.relatedTarget)) {
        elDropZone.classList.remove("drag-over");
      }
    });
    elDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      elDropZone.classList.remove("drag-over");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) {
        elOcrProgress.innerHTML = `<span class="ocr-err">No file received from the drop. Try clicking the zone instead.</span>`;
        return;
      }
      if (!file.type || !file.type.startsWith("image/")) {
        elOcrProgress.innerHTML = `<span class="ocr-err">That doesn't look like an image (${escapeHtml(file.type || "unknown type")}). Try a JPG or PNG.</span>`;
        return;
      }
      runOcrOnFile(file);
    });

    // Also block document-level drop so a misfire doesn't navigate away
    document.addEventListener("dragover", (e) => { e.preventDefault(); });
    document.addEventListener("drop", (e) => { e.preventDefault(); });

    function showImagePreview(file) {
      console.log("[CollegeMax] showImagePreview:", file && file.name, file && file.type, file && file.size);
      const elPreview = document.getElementById("image-preview");
      if (!elPreview) {
        console.warn("[CollegeMax] image-preview element not found");
        return;
      }
      const prevImg = elPreview.querySelector("img");
      if (prevImg && prevImg.dataset.objurl) {
        try { URL.revokeObjectURL(prevImg.dataset.objurl); } catch {}
      }
      let url;
      try {
        url = URL.createObjectURL(file);
      } catch (e) {
        console.error("[CollegeMax] createObjectURL failed:", e);
        return;
      }
      const sizeKb = (file.size / 1024).toFixed(0);
      elPreview.innerHTML = `
        <div class="image-preview-head">
          <span class="image-preview-label">Your uploaded photo</span>
          <span class="image-preview-name">${escapeHtml(file.name || "image")} · ${sizeKb} KB</span>
          <button class="image-remove" type="button" aria-label="Remove">&times;</button>
        </div>
        <img src="${url}" alt="Uploaded preview" data-objurl="${url}" />
      `;
      elPreview.removeAttribute("hidden");
      elPreview.style.display = "block";

      const imgEl = elPreview.querySelector("img");
      imgEl.addEventListener("load", () => {
        console.log("[CollegeMax] preview img loaded:", imgEl.naturalWidth + "x" + imgEl.naturalHeight);
      });
      imgEl.addEventListener("error", (err) => {
        console.error("[CollegeMax] preview img failed to load", err);
        elPreview.innerHTML = `<div class="image-preview-head"><span class="image-preview-label">Photo upload</span></div><div class="muted">Could not display the photo. The OCR'd text below should still work.</div>`;
      });

      elPreview.querySelector(".image-remove").addEventListener("click", () => {
        try { URL.revokeObjectURL(url); } catch {}
        elPreview.innerHTML = "";
        elPreview.setAttribute("hidden", "");
        elPreview.style.display = "";
      });

      // Scroll into view so the user actually sees the preview
      requestAnimationFrame(() => {
        elPreview.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }

    async function runOcrOnFile(file) {
      if (!file) return;
      showImagePreview(file);
      elOcrProgress.innerHTML = `<span class="ocr-status">Preparing OCR engine...</span><div class="ocr-bar"><div></div></div>`;
      const bar = elOcrProgress.querySelector(".ocr-bar > div");
      try {
        const worker = await getTesseractWorker();
        const statusEl = elOcrProgress.querySelector(".ocr-status");
        if (statusEl) statusEl.textContent = "Reading image (5-30 seconds)...";

        // v5 createWorker has its own loggerless interface; recognize returns the data
        const result = await worker.recognize(file);
        const text = (result && result.data && result.data.text) || "";
        if (bar) bar.style.width = "100%";

        if (!text.trim()) {
          elOcrProgress.innerHTML = `<span class="ocr-err">OCR returned empty text. The image may be too small or low-contrast. Try a clearer screenshot.</span>`;
          return;
        }
        elTranscript.value = text;
        elOcrProgress.innerHTML = `<span class="ocr-ok">Image read (${text.length} chars). Parsing...</span>`;
        runParse(text);
        setTimeout(() => { elOcrProgress.innerHTML = ""; }, 2500);
      } catch (err) {
        console.error("OCR failed:", err);
        elOcrProgress.innerHTML = `<span class="ocr-err">OCR failed: ${escapeHtml(err.message || String(err))}<br><small>Open the browser console for full error details.</small></span>`;
      }
    }

    elImageInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      try {
        await runOcrOnFile(file);
      } finally {
        elImageInput.value = ""; // allow re-upload of same file
      }
    });

    // === CLIPBOARD PASTE: drop a screenshot anywhere in Quick Import ===
    function handleClipboardImagePaste(e) {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return false;
      for (const item of items) {
        if (item.kind === "file" && item.type && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            runOcrOnFile(file);
            return true;
          }
        }
      }
      return false;
    }

    elTranscript.addEventListener("paste", handleClipboardImagePaste);

    // Also catch paste anywhere in the Quick Import card while it's the focus area
    const quickImportEl = document.querySelector(".quick-import");
    if (quickImportEl) {
      quickImportEl.addEventListener("paste", (e) => {
        if (e.target === elTranscript) return; // textarea handled it
        handleClipboardImagePaste(e);
      });
    }

    // Global paste capture on Profile tab so Ctrl+V works without focusing the textarea
    document.addEventListener("paste", (e) => {
      const onProfile = !document.getElementById("panel-profile").classList.contains("hidden");
      if (!onProfile) return;
      // If focus is in any input/textarea other than transcript, let that field handle paste
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA") && active !== elTranscript) return;
      handleClipboardImagePaste(e);
    });

    profileForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(profileForm);
      const numFields = new Set(["unweightedGpa", "weightedGpa", "sat", "act", "apCount", "classRank"]);
      for (const [k, v] of fd.entries()) {
        if (numFields.has(k)) {
          state.profile[k] = v === "" ? null : Number(v);
        } else {
          state.profile[k] = v;
        }
      }
      persist();
      profileMsg.textContent = "Saved. Switch to College Odds to see updated estimates.";
      setTimeout(() => { profileMsg.textContent = ""; }, 3500);
    });
    fillProfileForm();

    // ===== ESSAY =====
    const elEssayPrompt = document.getElementById("essay-prompt");
    const elEssayText = document.getElementById("essay-text");
    const elEssayTopic = document.getElementById("essay-topic");
    const elEssayDetails = document.getElementById("essay-details");
    const elEssayGenerate = document.getElementById("essay-generate");
    const elEssayGradeBtn = document.getElementById("essay-grade-btn");
    const elEssayReport = document.getElementById("essay-report");

    for (const p of ESSAY_PROMPTS) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p.slice(0, 80) + (p.length > 80 ? "..." : "");
      elEssayPrompt.appendChild(opt);
    }
    if (state.essay.prompt) elEssayPrompt.value = state.essay.prompt;
    if (state.essay.draft) elEssayText.value = state.essay.draft;
    if (state.essay.topic) elEssayTopic.value = state.essay.topic;
    if (state.essay.details) elEssayDetails.value = state.essay.details;

    elEssayPrompt.addEventListener("change", () => {
      state.essay.prompt = elEssayPrompt.value;
      persist();
    });
    elEssayText.addEventListener("input", () => {
      state.essay.draft = elEssayText.value;
      persist();
    });
    elEssayTopic.addEventListener("input", () => {
      state.essay.topic = elEssayTopic.value;
      persist();
    });
    elEssayDetails.addEventListener("input", () => {
      state.essay.details = elEssayDetails.value;
      persist();
    });

    elEssayGenerate.addEventListener("click", () => {
      const result = generateEssay(state.profile, state.saved, elEssayPrompt.value, ACTIVITIES, {
        topic: elEssayTopic.value,
        details: elEssayDetails.value
      });
      elEssayText.value = result.draft;
      state.essay.draft = result.draft;
      state.essay.prompt = elEssayPrompt.value;
      state.essay.topic = elEssayTopic.value;
      state.essay.details = elEssayDetails.value;
      persist();
      if (result.isPlaceholder) {
        elEssayReport.classList.remove("visible");
      }
    });

    elEssayGradeBtn.addEventListener("click", () => {
      const grade = gradeEssay(elEssayText.value);
      state.essay.lastGrade = grade.overall;
      persist();
      renderEssayReport(grade);
    });

    function renderEssayReport(grade) {
      elEssayReport.classList.add("visible");
      const letter = grade.grade.charAt(0); // A/B/C/D/F
      const breakdown = grade.breakdown;
      const fbHtml = grade.feedback.map(f => `<li>${escapeHtml(f)}</li>`).join("");
      const bdHtml = [
        ["Length", breakdown.length],
        ["Cliché-free", breakdown.cliches],
        ["Specificity", breakdown.specificity],
        ["Show vs Tell", breakdown.showTell],
        ["Voice", breakdown.voice],
        ["Sentence variety", breakdown.variety]
      ].map(([k, v]) => `
        <div class="bd-item">
          <div class="label">${k}</div>
          <div class="val">${v}</div>
          <div class="bar"><div style="width:${Math.max(0, Math.min(100, v))}%"></div></div>
        </div>
      `).join("");
      elEssayReport.innerHTML = `
        <div class="report-head">
          <div class="grade-bubble ${letter}">${grade.grade}</div>
          <div class="report-stats">
            <strong>Overall ${grade.overall}/100</strong><br>
            ${grade.stats.wordCount} words, ${grade.stats.sentenceCount} sentences, avg ${grade.stats.avgSentence} words/sentence
          </div>
        </div>
        <div class="breakdown">${bdHtml}</div>
        <ul class="feedback-list">${fbHtml}</ul>
      `;
    }

    if (state.essay.lastGrade !== null && elEssayText.value) {
      // re-render last report on load
      renderEssayReport(gradeEssay(elEssayText.value));
    }

    // ===== COLLEGES =====
    const elCollegeList = document.getElementById("college-list");
    const elRecompute = document.getElementById("recompute-odds");
    const elOddsStale = document.getElementById("odds-stale");

    function profileHasMinimumData(p) {
      const hasGpa = (p.unweightedGpa || p.weightedGpa);
      const hasScore = (p.sat || p.act);
      return !!(hasGpa && hasScore);
    }

    function renderColleges() {
      const profile = state.profile;
      elCollegeList.innerHTML = "";
      elOddsStale.textContent = "";

      if (!profileHasMinimumData(profile)) {
        elCollegeList.innerHTML = `
          <div class="empty-state">
            <h3>Fill your profile first</h3>
            <p>Odds are personal. Without your GPA and a test score, the only number we could show you is the school's raw admit rate, which is the same for every student. That isn't useful to you.</p>
            <p>Add at least:</p>
            <ul>
              <li>Unweighted or weighted GPA</li>
              <li>SAT or ACT score</li>
            </ul>
            <button id="goto-profile" type="button" class="primary">Open My Profile</button>
          </div>
        `;
        document.getElementById("goto-profile").addEventListener("click", () => {
          document.querySelector('[data-tab="profile"]').click();
        });
        return;
      }

      const ranked = rankColleges(profile, state.saved, COLLEGES);
      for (const r of ranked) {
        const row = document.createElement("div");
        row.className = "college-row";
        const pct = (r.probability * 100);
        const pctText = pct >= 10 ? pct.toFixed(0) + "%" : pct.toFixed(1) + "%";
        row.innerHTML = `
          <div>
            <div class="name">${escapeHtml(r.college.name)}</div>
            <div class="stats">Admit ${(r.college.admitRate*100).toFixed(1)}% · SAT ${r.college.sat25}-${r.college.sat75} · GPA ~${r.college.avgGpa}</div>
          </div>
          <span class="bucket ${r.bucket}">${r.bucket}</span>
          <div class="pct">${pctText}</div>
          <details>
            <summary>Why this estimate</summary>
            <ul>${r.factors.map(f => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
          </details>
        `;
        elCollegeList.appendChild(row);
      }
    }
    elRecompute.addEventListener("click", renderColleges);
  });
}
