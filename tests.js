// Test suite — runs in browser via tests.html
// Pure unit tests against app.js logic.

const TESTS = [];
function test(name, fn) { TESTS.push({ name, fn }); }
function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + (msg || ""));
}
function assertEq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(`Expected ${jb}, got ${ja}` + (msg ? " — " + msg : ""));
}

// In-memory storage shim mimicking localStorage
function memStorage() {
  const store = {};
  return {
    getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _dump: () => store
  };
}

// === DATA INTEGRITY ===
test("every activity has required fields", () => {
  for (const a of ACTIVITIES) {
    assert(a.id, "missing id");
    assert(a.title, "missing title on " + a.id);
    assert(a.category, "missing category on " + a.id);
    assert(["elite", "strong", "solid"].includes(a.tier), "bad tier on " + a.id);
    assert(typeof a.impact === "number" && a.impact >= 1 && a.impact <= 5, "bad impact on " + a.id);
    assert(typeof a.initiative === "number" && a.initiative >= 1 && a.initiative <= 5, "bad initiative on " + a.id);
    assert(a.summary && a.summary.length > 10, "weak summary on " + a.id);
    assert(Array.isArray(a.steps) && a.steps.length >= 2, "needs >=2 steps on " + a.id);
    assert(a.tip && a.tip.length > 10, "weak tip on " + a.id);
  }
});

test("activity ids are unique", () => {
  const ids = ACTIVITIES.map(a => a.id);
  const set = new Set(ids);
  assert(ids.length === set.size, "duplicate id detected");
});

test("at least 25 activities curated", () => {
  assert(ACTIVITIES.length >= 25, "only " + ACTIVITIES.length + " activities");
});

test("all categories used in CATEGORIES exist on at least one activity (except 'All')", () => {
  const used = new Set(ACTIVITIES.map(a => a.category));
  for (const cat of CATEGORIES) {
    if (cat === "All") continue;
    assert(used.has(cat), "category in dropdown but no activity uses it: " + cat);
  }
});

// === STATE ===
test("defaultState has expected shape", () => {
  const s = defaultState();
  assertEq(s.saved, []);
  assertEq(s.customNotes, {});
  assert(s.profile);
  assert(Array.isArray(s.chat));
});

test("loadState returns default when storage empty", () => {
  const storage = memStorage();
  const s = loadState(storage);
  assertEq(s.saved, []);
});

test("saveState then loadState round-trips", () => {
  const storage = memStorage();
  const s = defaultState();
  s.saved = ["found-club", "research-with-prof"];
  s.customNotes["found-club"] = "Started AI Ethics Club, 30 members";
  saveState(s, storage);
  const reloaded = loadState(storage);
  assertEq(reloaded.saved, ["found-club", "research-with-prof"]);
  assertEq(reloaded.customNotes["found-club"], "Started AI Ethics Club, 30 members");
});

test("loadState handles corrupted storage gracefully", () => {
  const storage = memStorage();
  storage.setItem(STORAGE_KEY, "{not json");
  const s = loadState(storage);
  assertEq(s.saved, []);
});

// === SAVE/UNSAVE ===
test("toggleSaved adds then removes", () => {
  const s = defaultState();
  toggleSaved(s, "found-nonprofit");
  assertEq(s.saved, ["found-nonprofit"]);
  assert(isSaved(s, "found-nonprofit"));
  toggleSaved(s, "found-nonprofit");
  assertEq(s.saved, []);
  assert(!isSaved(s, "found-nonprofit"));
});

test("toggleSaved supports multiple ids", () => {
  const s = defaultState();
  toggleSaved(s, "a");
  toggleSaved(s, "b");
  toggleSaved(s, "c");
  toggleSaved(s, "b");
  assertEq(s.saved, ["a", "c"]);
});

test("setNote stores and clears", () => {
  const s = defaultState();
  setNote(s, "found-club", "Hello");
  assertEq(s.customNotes["found-club"], "Hello");
  setNote(s, "found-club", "");
  assertEq(s.customNotes["found-club"], undefined);
});

// === FILTER ===
test("filterActivities by category", () => {
  const techOnly = filterActivities(ACTIVITIES, { category: "Tech" });
  assert(techOnly.length > 0, "should have tech activities");
  for (const a of techOnly) assertEq(a.category, "Tech");
});

test("filterActivities by tier", () => {
  const elite = filterActivities(ACTIVITIES, { tier: "elite" });
  for (const a of elite) assertEq(a.tier, "elite");
  assert(elite.length >= 4, "expected several elite picks");
});

test("filterActivities search hits title", () => {
  const r = filterActivities(ACTIVITIES, { search: "non-profit" });
  assert(r.length > 0);
  assert(r.some(a => a.id === "found-nonprofit"));
});

test("filterActivities search hits summary", () => {
  const r = filterActivities(ACTIVITIES, { search: "cold-email" });
  assert(r.some(a => a.id === "research-with-prof"), "should find professor outreach via summary");
});

test("filterActivities combines filters", () => {
  const r = filterActivities(ACTIVITIES, { category: "Research", tier: "elite" });
  for (const a of r) {
    assertEq(a.category, "Research");
    assertEq(a.tier, "elite");
  }
  assert(r.length >= 2);
});

test("filterActivities 'All' is no-op for category", () => {
  const r = filterActivities(ACTIVITIES, { category: "All" });
  assertEq(r.length, ACTIVITIES.length);
});

// === SUGGESTION ENGINE ===
test("suggestActivities returns elite-tier when no interests given", () => {
  const r = suggestActivities(ACTIVITIES, []);
  for (const a of r) assertEq(a.tier, "elite");
});

test("suggestActivities prioritizes by interest", () => {
  const r = suggestActivities(ACTIVITIES, ["medicine"], { limit: 3 });
  assert(r.length === 3);
  // First result should be a Medical or Research category
  assert(["Medical", "Research"].includes(r[0].category),
    "expected Medical/Research first, got " + r[0].category);
});

test("suggestActivities respects excludeIds", () => {
  const allIds = ACTIVITIES.map(a => a.id);
  const r = suggestActivities(ACTIVITIES, ["tech"], { excludeIds: allIds });
  assertEq(r.length, 0, "should be empty if everything excluded");
});

test("suggestActivities handles unknown interests", () => {
  const r = suggestActivities(ACTIVITIES, ["alchemy"], { limit: 3 });
  assert(r.length === 3, "should still return picks even if interest unknown");
});

test("suggestActivities scores tech-bound applicants right", () => {
  const r = suggestActivities(ACTIVITIES, ["cs", "tech"], { limit: 5 });
  const techCount = r.filter(a => a.category === "Tech").length;
  assert(techCount >= 2, "expected several Tech picks for cs/tech, got " + techCount);
});

// === CHAT BOT ===
test("botReply returns greeting on empty input", () => {
  const r = botReply("", defaultState());
  assert(r.text.length > 0);
  assert(!r.suggestions);
});

test("botReply detects 'medicine' and returns suggestions", () => {
  const r = botReply("I want to study medicine", defaultState());
  assert(r.suggestions && r.suggestions.length > 0);
  // Should suggest medical/research-tier activities
  const hasMedicalOrResearch = r.suggestions.some(id => {
    const a = findActivity(id);
    return a && (a.category === "Medical" || a.category === "Research");
  });
  assert(hasMedicalOrResearch, "expected medical/research suggestions for 'medicine'");
});

test("botReply detects ivy/harvard and returns elite picks", () => {
  const r = botReply("how do I get into Harvard?", defaultState());
  assert(r.suggestions && r.suggestions.length > 0);
  for (const id of r.suggestions) {
    const a = findActivity(id);
    assertEq(a.tier, "elite", "ivy reply should suggest elite tier");
  }
});

test("botReply 'resume' acknowledges saved count", () => {
  const s = defaultState();
  let r = botReply("show my resume", s);
  assert(r.text.toLowerCase().includes("empty"));
  toggleSaved(s, "found-club");
  r = botReply("show my resume", s);
  assert(r.text.includes("1"), "should mention 1 activity, got: " + r.text);
});

test("botReply gives generic help when input is unparseable", () => {
  const r = botReply("blarg fluberty", defaultState());
  assert(r.text.length > 0);
  assert(!r.suggestions);
});

// === EXPORT ===
test("exportResume on empty state", () => {
  const out = exportResume(defaultState());
  assert(out.includes("No activities"));
});

test("exportResume includes saved activities grouped by category", () => {
  const s = defaultState();
  s.profile.name = "Alex Test";
  s.profile.grade = "11";
  toggleSaved(s, "found-nonprofit");
  toggleSaved(s, "research-with-prof");
  setNote(s, "found-nonprofit", "Founded XYZ Foundation, $12K raised");
  const out = exportResume(s);
  assert(out.includes("Alex Test"));
  assert(out.includes("Grade: 11"));
  assert(out.includes("NON-PROFIT"));
  assert(out.includes("RESEARCH"));
  assert(out.includes("Founded XYZ Foundation"));
  assert(out.includes("Found a 501(c)(3)"));
});

test("exportResume skips notes when none set", () => {
  const s = defaultState();
  toggleSaved(s, "found-club");
  const out = exportResume(s);
  assert(!out.includes("Notes:"));
});

// === COLLEGE DATA INTEGRITY ===
test("every college has required fields and sane ranges", () => {
  for (const c of COLLEGES) {
    assert(c.name, "missing name");
    assert(typeof c.admitRate === "number" && c.admitRate > 0 && c.admitRate <= 1, "bad admitRate on " + c.name);
    assert(c.sat25 > 800 && c.sat25 < 1600, "bad sat25 on " + c.name);
    assert(c.sat75 > c.sat25 && c.sat75 <= 1600, "bad sat75 on " + c.name);
    assert(c.avgGpa > 2 && c.avgGpa < 5, "bad avgGpa on " + c.name);
    assert(["elite","strong","solid"].includes(c.ecTier), "bad ecTier on " + c.name);
  }
});

test("at least 25 colleges across all tiers", () => {
  assert(COLLEGES.length >= 25);
  const tiers = new Set(COLLEGES.map(c => c.tier));
  assert(tiers.has("ivy_plus"));
  assert(tiers.has("t30"));
  assert(tiers.has("match"));
});

// === ODDS CALCULATOR ===
test("estimateOdds: weak profile at Harvard returns reach with low probability", () => {
  const profile = { unweightedGpa: 3.2, sat: 1200, apCount: 1 };
  const harvard = COLLEGES.find(c => c.name === "Harvard");
  const r = estimateOdds(profile, [], harvard);
  assertEq(r.bucket, "reach");
  assert(r.probability < 0.05, "weak profile should be << admit rate, got " + r.probability);
});

test("estimateOdds: strong profile at Harvard improves vs base", () => {
  const profile = { unweightedGpa: 3.98, sat: 1570, apCount: 12, classRank: 2 };
  const harvard = COLLEGES.find(c => c.name === "Harvard");
  const saved = ACTIVITIES.filter(a => a.tier === "elite").slice(0, 3).map(a => a.id);
  const r = estimateOdds(profile, saved, harvard);
  assert(r.probability > harvard.admitRate, "strong profile should beat base " + harvard.admitRate + ", got " + r.probability);
});

test("estimateOdds: probability bounded between 0.005 and 0.92", () => {
  const harvard = COLLEGES.find(c => c.name === "Harvard");
  const trash = estimateOdds({ unweightedGpa: 1.0, sat: 600, apCount: 0 }, [], harvard);
  assert(trash.probability >= 0.005);
  const safety = COLLEGES.find(c => c.tier === "match");
  const perfect = estimateOdds({ unweightedGpa: 4.0, sat: 1600, apCount: 15, classRank: 1 }, ACTIVITIES.slice(0,5).map(a=>a.id), safety);
  assert(perfect.probability <= 0.92);
});

test("estimateOdds: empty profile still returns valid result", () => {
  const harvard = COLLEGES.find(c => c.name === "Harvard");
  const r = estimateOdds({}, [], harvard);
  assert(r.probability >= 0.005 && r.probability <= 0.92);
  assert(["reach","target","likely","safety"].includes(r.bucket));
  assert(Array.isArray(r.factors) && r.factors.length > 0);
});

test("estimateOdds: ACT converts to SAT equivalent", () => {
  const harvard = COLLEGES.find(c => c.name === "Harvard");
  const withACT = estimateOdds({ unweightedGpa: 3.9, act: 35 }, [], harvard);
  const withSAT = estimateOdds({ unweightedGpa: 3.9, sat: 1560 }, [], harvard);
  // Should land in same ballpark (within 2x of each other)
  const ratio = withACT.probability / withSAT.probability;
  assert(ratio > 0.5 && ratio < 2.0, "ACT 35 (~SAT 1560) should be similar, got ratio " + ratio);
});

test("rankColleges: returns sorted by probability descending", () => {
  const profile = { unweightedGpa: 3.7, sat: 1300, apCount: 4 };
  const ranked = rankColleges(profile, [], COLLEGES);
  assertEq(ranked.length, COLLEGES.length);
  for (let i = 1; i < ranked.length; i++) {
    assert(ranked[i-1].probability >= ranked[i].probability, "not sorted at " + i);
  }
});

test("rankColleges: safety schools rank higher than ivies for average student", () => {
  const profile = { unweightedGpa: 3.5, sat: 1250, apCount: 2 };
  const ranked = rankColleges(profile, [], COLLEGES);
  const harvardIdx = ranked.findIndex(r => r.college.name === "Harvard");
  const indianaIdx = ranked.findIndex(r => r.college.name === "Indiana");
  assert(indianaIdx < harvardIdx, "Indiana should outrank Harvard for average student");
});

// === ESSAY GRADER ===
test("gradeEssay: empty essay scores 0", () => {
  const r = gradeEssay("");
  assertEq(r.overall, 0);
  assertEq(r.grade, "F");
});

test("gradeEssay: very short essay penalized on length", () => {
  const r = gradeEssay("I am a student. I love coding. I want to go to Harvard.");
  assert(r.breakdown.length < 30, "expected length penalty, got " + r.breakdown.length);
});

test("gradeEssay: cliché-heavy essay scores low on cliches", () => {
  const cliched = ("Ever since I was little, I have always been passionate about my journey to make a difference and change the world. " +
    "I felt that this experience taught me to step outside my comfort zone and at the end of the day it was beyond my wildest dreams. ").repeat(5);
  const r = gradeEssay(cliched);
  assert(r.breakdown.cliches < 30, "cliche-heavy should score < 30, got " + r.breakdown.cliches);
  assert(r.stats.clicheHits.length > 0);
});

test("gradeEssay: specific essay with numbers and proper nouns scores well on specificity", () => {
  const specific = ("On October 14, 2024, I walked into Dr. Patel's lab at Rutgers University and asked if I could help. " +
    "She handed me 47 cell cultures to image. By December I had logged 312 hours and co-authored a paper with Dr. Patel and Sarah Chen. " +
    "We submitted to the Journal of Neuroscience on January 8, 2025. " +
    "I expected nothing. The acceptance came back six weeks later. ").repeat(3);
  const r = gradeEssay(specific);
  assert(r.breakdown.specificity > 50, "specific essay should score > 50 on specificity, got " + r.breakdown.specificity);
});

test("gradeEssay: returns letter grade matching overall", () => {
  // Build a strong essay
  const good = ("On a Tuesday morning in October, Dr. Chen handed me a notebook with 47 unsolved equations from a 1962 paper. " +
    "I spent 73 hours over three weeks working through them. By November 4 I had reproduced 41 results and found two mistakes. " +
    "We submitted a correction to the journal. The senior author replied within nine hours. " +
    "What I learned was not the math. It was the rhythm of small daily progress. ").repeat(3);
  const r = gradeEssay(good);
  assert(r.overall > 50, "should be reasonable, got " + r.overall);
  if (r.overall >= 90) assertEq(r.grade, "A");
  else if (r.overall >= 80) assertEq(r.grade, "A-");
  else if (r.overall >= 70) assertEq(r.grade, "B+");
});

test("gradeEssay: feedback array always populated", () => {
  const r = gradeEssay("Short.");
  assert(Array.isArray(r.feedback));
  assert(r.feedback.length > 0);
});

test("gradeEssay: word count and sentence count are correct", () => {
  const text = "First sentence here. Second sentence! Third one?";
  const r = gradeEssay(text);
  assertEq(r.stats.wordCount, 7);
  assertEq(r.stats.sentenceCount, 3);
});

// === ESSAY GENERATOR ===
test("generateEssay: returns placeholder when no topic AND no activities", () => {
  const r = generateEssay({ name: "X" }, [], "");
  assert(r.isPlaceholder);
  assert(r.draft.toLowerCase().includes("activity") || r.draft.toLowerCase().includes("about"));
});

test("generateEssay: works with topic only (no activities)", () => {
  const r = generateEssay({ intendedMajor: "Biology" }, [], "", undefined, { topic: "growing up bilingual" });
  assert(!r.isPlaceholder, "topic alone should be a valid anchor");
  assert(r.draft.toLowerCase().includes("growing up bilingual"));
  assertEq(r.topic, "growing up bilingual");
});

test("generateEssay: produces a real draft with saved activities", () => {
  const r = generateEssay({ intendedMajor: "Computer Science", name: "Sam" }, ["build-ship-app", "research-with-prof"], ESSAY_PROMPTS[0]);
  assert(!r.isPlaceholder);
  assert(r.draft.length > 200, "draft too short: " + r.draft.length);
  assert(r.draft.toLowerCase().includes("computer science"));
  assertEq(r.builtFrom.length, 2);
});

test("generateEssay: hooks vary by activity id", () => {
  const a = generateEssay({}, ["found-nonprofit"], "");
  const b = generateEssay({}, ["build-ship-app"], "");
  assert(a.draft.split("\n")[0] !== b.draft.split("\n")[0], "hooks should differ across activity types");
});

test("generateEssay: weaves user-supplied details into the draft", () => {
  const r = generateEssay(
    { intendedMajor: "Bio" },
    ["research-with-prof"],
    "",
    undefined,
    { topic: "my grandmother's garden", details: "the smell of cut tomato vines, an oxidized iron trowel, August humidity" }
  );
  assert(!r.isPlaceholder);
  assert(r.draft.toLowerCase().includes("grandmother"));
  assert(r.draft.toLowerCase().includes("cut tomato vines"), "first detail should appear");
  assert(r.detailsUsed.length >= 2, "should record details used");
});

test("generateEssay: topic + activity bridges them in body", () => {
  const r = generateEssay(
    { intendedMajor: "CS" },
    ["build-ship-app"],
    "",
    undefined,
    { topic: "stuttering" }
  );
  assert(!r.isPlaceholder);
  assert(r.draft.toLowerCase().includes("stuttering"), "topic should appear");
  assert(r.draft.toLowerCase().includes("ship") || r.draft.toLowerCase().includes("app"), "activity should appear too");
});

test("generateEssay: profile.likes feed in as fallback details", () => {
  const r = generateEssay(
    { intendedMajor: "Bio", likes: "the smell of formaldehyde, my grandfather's hands" },
    ["hospital-volunteer"],
    "",
    undefined,
    { topic: "becoming a doctor" }
  );
  assert(r.draft.toLowerCase().includes("formaldehyde") || r.draft.toLowerCase().includes("grandfather"),
    "profile.likes should populate details when opts.details is empty");
});

test("generateEssay: name appears in conclusion when provided", () => {
  const withName = generateEssay({ name: "Maya", intendedMajor: "X" }, [], "", undefined, { topic: "loss" });
  assert(withName.draft.includes("Maya"), "name should appear in topic-mode conclusion");
});

// === TRANSCRIPT PARSER ===
test("parseTranscript: empty input returns empty object", () => {
  assertEq(parseTranscript(""), {});
  assertEq(parseTranscript(null), {});
  assertEq(parseTranscript(undefined), {});
});

test("parseTranscript: extracts unweighted GPA explicitly labeled", () => {
  const r = parseTranscript("Unweighted GPA: 3.85");
  assertEq(r.unweightedGpa, 3.85);
});

test("parseTranscript: extracts weighted GPA explicitly labeled", () => {
  const r = parseTranscript("Weighted GPA: 4.32");
  assertEq(r.weightedGpa, 4.32);
});

test("parseTranscript: extracts both weighted + unweighted", () => {
  const r = parseTranscript("Cumulative GPA (Unweighted): 3.85\nWeighted GPA: 4.32");
  assertEq(r.unweightedGpa, 3.85);
  assertEq(r.weightedGpa, 4.32);
});

test("parseTranscript: plain GPA over 4.0 is treated as weighted", () => {
  const r = parseTranscript("GPA: 4.21");
  assertEq(r.weightedGpa, 4.21);
});

test("parseTranscript: plain GPA at or under 4.0 is treated as unweighted", () => {
  const r = parseTranscript("GPA: 3.7");
  assertEq(r.unweightedGpa, 3.7);
});

test("parseTranscript: extracts SAT", () => {
  const r = parseTranscript("SAT: 1480");
  assertEq(r.sat, 1480);
});

test("parseTranscript: extracts ACT but not when ambiguous with course names", () => {
  const r1 = parseTranscript("ACT Composite: 33");
  assertEq(r1.act, 33);
  const r2 = parseTranscript("AP Government: A"); // should NOT mistakenly extract
  assert(!r2.act, "should not pick up AP Government as ACT");
});

test("parseTranscript: counts AP courses (deduped)", () => {
  const text = "AP Biology - A\nAP Calculus AB - A\nAP English Literature - B+\nAP Biology - A";
  const r = parseTranscript(text);
  assertEq(r.apCount, 3);
});

test("parseTranscript: counts mix of AP, IB, and Honors", () => {
  const text = "AP Biology - A\nIB History - 5\nHonors Chemistry - A";
  const r = parseTranscript(text);
  assertEq(r.apCount, 3);
});

test("parseTranscript: class rank as N of M -> percentile", () => {
  const r = parseTranscript("Class Rank: 12 of 380");
  assertEq(r.classRank, 3); // 12/380 = 3.16% -> 3
});

test("parseTranscript: top X% pattern", () => {
  const r = parseTranscript("Top 5% of class");
  assertEq(r.classRank, 5);
});

test("parseTranscript: full realistic transcript blob", () => {
  const blob = `
    Cumulative GPA (Unweighted): 3.92
    Weighted GPA: 4.45
    SAT: 1520
    Class Rank: 8 of 412

    AP Biology - A
    AP Chemistry - A
    AP Calculus BC - B+
    AP US History - A
    Honors English - A
    Honors Spanish - A

    Intended Major: Bioengineering
  `;
  const r = parseTranscript(blob);
  assertEq(r.unweightedGpa, 3.92);
  assertEq(r.weightedGpa, 4.45);
  assertEq(r.sat, 1520);
  assertEq(r.apCount, 6);
  assertEq(r.classRank, 2); // 8/412 -> 1.94 -> rounded to 2
  assert(r.intendedMajor && r.intendedMajor.toLowerCase().includes("bioengineering"));
});

test("parseTranscript: ignores out-of-range numbers", () => {
  const r = parseTranscript("SAT: 9999");
  assert(!r.sat, "should reject 9999 as SAT");
});

test("parseTranscript: ignores invalid rank (pos > total)", () => {
  const r = parseTranscript("Rank 500 of 100");
  assert(!r.classRank);
});

// === RUNNER ===
function runTests() {
  const log = document.getElementById("test-output");
  let passed = 0, failed = 0;
  const failures = [];

  for (const t of TESTS) {
    const row = document.createElement("div");
    row.className = "test-row";
    try {
      t.fn();
      row.classList.add("pass");
      row.textContent = "PASS  " + t.name;
      passed++;
    } catch (e) {
      row.classList.add("fail");
      row.textContent = "FAIL  " + t.name + "  ::  " + e.message;
      failed++;
      failures.push({ name: t.name, err: e });
    }
    log.appendChild(row);
  }

  const summary = document.getElementById("test-summary");
  summary.textContent = `${passed}/${TESTS.length} passed` + (failed ? `, ${failed} FAILED` : " - ALL GREEN");
  summary.className = failed ? "fail" : "pass";

  // Programmatic accessors for headless verification
  window.__TEST_RESULTS__ = { passed, failed, total: TESTS.length, failures: failures.map(f => ({ name: f.name, message: f.err.message })) };
}

if (typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", runTests);
}
