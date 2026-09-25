const fs = require('fs');
const vm = require('vm');

const htmlPath = fs.existsSync('index.html') ? 'index.html' : 'generic/index.html';
const html = fs.readFileSync(htmlPath, 'utf-8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error("FAIL: No script tag found in " + htmlPath);
  process.exit(1);
}

// Mock comprehensive DOM for full simulation
const elements = {};
function getEl(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      value: '',
      checked: false,
      textContent: '',
      innerHTML: '',
      className: '',
      style: {},
      children: [],
      classList: {
        _classes: new Set(),
        add: function(c) { this._classes.add(c); },
        remove: function(c) { this._classes.delete(c); },
        contains: function(c) { return this._classes.has(c); }
      },
      setAttribute: function(k, v) { this[k] = v; },
      getAttribute: function(k) { return this[k] || ''; },
      appendChild: function(ch) { this.children.push(ch); },
      querySelectorAll: function() { return []; }
    };
  }
  return elements[id];
}

const sandbox = {
  console,
  getEl,
  document: {
    documentElement: {
      setAttribute: () => {},
      getAttribute: () => 'light'
    },
    getElementById: getEl,
    querySelector: (sel) => {
      // Mock radio selectors
      if (sel.includes('jskip_track')) {
        return { value: elements['jskip_track_val'] || 'none' };
      }
      return getEl('mock_' + sel);
    },
    querySelectorAll: () => [],
    createElement: (tag) => getEl('tag_' + Math.random())
  },
  window: {
    addEventListener: () => {}
  },
  localStorage: {
    _data: {},
    getItem: function(k) { return this._data[k] || null; },
    setItem: function(k, v) { this._data[k] = String(v); }
  },
  alert: console.log,
  confirm: () => true
};

const ctx = vm.createContext(sandbox);
vm.runInContext(scriptMatch[1], ctx);

console.log("=== STARTING RIGOROUS LOOP VERIFICATION SUITE ===");

let totalTests = 0;
let failedTests = 0;

function assert(condition, name, details) {
  totalTests++;
  if (!condition) {
    failedTests++;
    console.error(`[FAILED]: ${name} -> ${details}`);
  } else {
    console.log(`[PASSED]: ${name}`);
  }
}

// TEST 1: Statutory Data Integrity
const refs = vm.runInContext('STATUTORY_REFS', ctx);
assert(Array.isArray(refs) && refs.length === 22, "Statutory references length", `Expected 22, got ${refs.length}`);
for (const r of refs) {
  assert(r.ref_id && r.law_title && r.legal_rule && r.failure_mode && r.url, `Ref integrity: ${r.ref_id}`, "Missing required field");
}

// TEST 2: Route Items Integrity
const routes = vm.runInContext('ROUTE_ITEMS', ctx);
const routeKeys = Object.keys(routes);
assert(routeKeys.length === 7, "Route count", `Expected 7, got ${routeKeys.length}`);

// TEST 3: Route Checklists Simulation (Pass / Warning / N/A logic)
routeKeys.forEach(routeName => {
  const items = routes[routeName];
  assert(items.length >= 13, `Route ${routeName} has >= 13 items`, `Got ${items.length}`);
  
  // Test all YES -> compliant
  const answersAllYes = {};
  items.forEach(it => answersAllYes[it.num] = "YES");
  vm.runInContext(`
    updateStatusBanner(ROUTE_ITEMS["${routeName}"], ${JSON.stringify(answersAllYes)}, ${items.length}, 0, 0, 0);
  `, ctx);
  const bannerText = getEl("statusBannerText").innerHTML;
  assert(bannerText.includes("Compliant") && bannerText.includes("0 Red Flags"), `Route ${routeName} all YES compliant`, bannerText);

  // Test one NO -> red flag warning
  const answersWithNo = { ...answersAllYes, [items[0].num]: "NO" };
  vm.runInContext(`
    updateStatusBanner(ROUTE_ITEMS["${routeName}"], ${JSON.stringify(answersWithNo)}, ${items.length - 1}, 1, 0, 0);
  `, ctx);
  const bannerWarning = getEl("statusBannerText").innerHTML;
  assert(bannerWarning.includes("AUDIT WARNING") && bannerWarning.includes("Red Flag"), `Route ${routeName} single NO red flag`, bannerWarning);

  // Test core N/A -> pending warning
  const coreItem = items.find(it => !it.q.trim().startsWith("If "));
  if (coreItem) {
    const answersCoreNa = { ...answersAllYes, [coreItem.num]: "N/A" };
    vm.runInContext(`
      updateStatusBanner(ROUTE_ITEMS["${routeName}"], ${JSON.stringify(answersCoreNa)}, ${items.length - 1}, 0, 1, 0);
    `, ctx);
    const bannerPending = getEl("statusBannerText").innerHTML;
    assert(bannerPending.includes("AUDIT PENDING") && bannerPending.includes("core checkpoint"), `Route ${routeName} core N/A pending`, bannerPending);
  }
});

// TEST 4: Category 1(a) Comprehensive Scoring
vm.runInContext(`
  getEl("calcCategory").value = "1a";
  getEl("calcDegree").value = "30"; // PhD
  getEl("calcMultiDegree").checked = true; // +5
  getEl("calcExperience").value = "15"; // 7y+
  getEl("calcAge").value = "15"; // <30
  getEl("calcSalary").value = "40"; // 10M+
  getEl("resPatent").checked = true; // 1 achievement
  getEl("resPapers").checked = true; // 2 achievements -> 25 pts
  getEl("resGrant").checked = false;
  getEl("resMoj").checked = false;
  getEl("calcInnovation").value = "20"; // SME 20
  getEl("calcSmeRd").checked = true; // +5
  getEl("calcForeignQual").checked = true; // +5
  getEl("calcJapanUni").checked = true; // +10
  getEl("calcJapanese").value = "15"; // N1 +15
  getEl("calcGrowthField").checked = true; // +10
  getEl("calcTopUni").checked = true; // +10
  getEl("calcJica").checked = true; // +5
  getEl("calcLocalGov").checked = true; // +10
  score1a = calculatePoints();
`, ctx);
const score1a = sandbox.score1a;
// 30 (PhD) + 5 (multi) + 15 (exp) + 15 (age) + 40 (sal) + 25 (res) + 20 (innov) + 5 (rd) + 5 (foreign) + 10 (jpUni) + 15 (N1) + 10 (growth) + 10 (topUni) + 5 (jica) + 10 (local)
// Total = 220
assert(score1a === 220, "Category 1(a) Max Points Calculation", `Expected 220, got ${score1a}`);

// TEST 5: Category 1(b) IT National License & ¥3M Salary Minimum
vm.runInContext(`
  getEl("calcCategory").value = "1b";
  getEl("calcDegree").value = "10"; // Bachelor
  getEl("calcMultiDegree").checked = false;
  getEl("calcExperience").value = "20"; // 10y+
  getEl("calcAge").value = "15"; // <30
  getEl("calcSalary").value = "20"; // 6M (<35) -> 20 pts
  getEl("resPatent").checked = false;
  getEl("resPapers").checked = false;
  getEl("calcLicenses1b").value = "10"; // 2+ IT licenses -> 10 pts
  getEl("calcInvManagement").checked = true; // +10
  getEl("calcInnovation").value = "0";
  getEl("calcSmeRd").checked = false;
  getEl("calcForeignQual").checked = false;
  getEl("calcJapanUni").checked = false;
  getEl("calcJapanese").value = "10"; // N2 -> +10
  getEl("calcGrowthField").checked = false;
  getEl("calcTopUni").checked = false;
  getEl("calcJica").checked = false;
  getEl("calcLocalGov").checked = false;
  score1b = calculatePoints();
`, ctx);
const score1b = sandbox.score1b;
// 10 + 20 + 15 + 20 + 0 + 10 (lic) + 10 (inv) + 10 (N2) = 95 pts
assert(score1b === 95, "Category 1(b) Scoring with Licenses & Inv Management", `Expected 95, got ${score1b}`);

// TEST 6: Category 1(b) Salary Age Gating
// If age is 40+ (agePoints = 0), salary of ¥7M (25 pts) should yield 0 points because it requires <40
vm.runInContext(`
  getEl("calcCategory").value = "1b";
  getEl("calcAge").value = "0"; // 40+
  getEl("calcSalary").value = "25"; // 7-8M requires <40
  calculatePoints();
  salaryPointsDiscounted = +getEl("subSalary").textContent;
  ageNotice40 = getEl("salaryAlertAge").textContent;

  // Case 6b: Age 35-39 (agePoints = 5) with ¥6M (20 pts) -> eligible (<40) -> 20 pts
  getEl("calcAge").value = "5"; // 35-39
  getEl("calcSalary").value = "20"; // 6-7M
  calculatePoints();
  salaryPoints35to39 = +getEl("subSalary").textContent;

  // Case 6c: Age 30-34 (agePoints = 10) with ¥5M (15 pts) -> eligible (<35) -> 15 pts
  getEl("calcAge").value = "10"; // 30-34
  getEl("calcSalary").value = "15"; // 5-6M
  calculatePoints();
  salaryPoints30to34 = +getEl("subSalary").textContent;
`, ctx);
assert(sandbox.salaryPointsDiscounted === 0, "1(b) Salary Age Gating at 40+", `Expected 0, got ${sandbox.salaryPointsDiscounted}`);
assert(sandbox.ageNotice40.includes("Age Restriction Notice"), "1(b) Age Restriction notice shown at 40+", sandbox.ageNotice40);
assert(sandbox.salaryPoints35to39 === 20, "1(b) Salary ¥6M eligible for 35-39 (20 pts)", `Expected 20, got ${sandbox.salaryPoints35to39}`);
assert(sandbox.salaryPoints30to34 === 15, "1(b) Salary ¥5M eligible for 30-34 (15 pts)", `Expected 15, got ${sandbox.salaryPoints30to34}`);

// TEST 7: Category 1(c) Zero-Age Points & Executive Status
vm.runInContext(`
  getEl("calcCategory").value = "1c";
  getEl("calcDegree").value = "25"; // MBA
  getEl("calcMultiDegree").checked = false;
  getEl("calcExperience").value = "25"; // 10y+
  getEl("calcAge").value = "15"; // Should be IGNORED for 1(c)
  getEl("calcSalary").value = "50"; // ¥30M+ -> 50 pts
  getEl("resPatent").checked = false;
  getEl("calcPosition1c").value = "10"; // Rep Director -> 10 pts
  getEl("calcInvest100M").checked = true; // Invest 100M+ -> 5 pts
  getEl("calcInvManagement").checked = true; // Inv Management -> 10 pts
  getEl("calcInnovation").value = "0";
  getEl("calcJapanese").value = "0";
  score1c = calculatePoints();
  age1c = +getEl("subAge").textContent;
`, ctx);
const score1c = sandbox.score1c;
const age1c = sandbox.age1c;
assert(age1c === 0, "Category 1(c) Strictly Zero Age Points", `Expected 0, got ${age1c}`);
// 25 (MBA) + 25 (Exp) + 0 (Age) + 50 (Salary) + 0 (Res) + 10 (Rep) + 5 (Invest) + 10 (InvMgmt) = 125 pts
assert(score1c === 125, "Category 1(c) Total Scoring", `Expected 125, got ${score1c}`);

// TEST 8: e-Gov 315000140 Pension Gate 2 Benchmark & Assets Offset Formula
vm.runInContext(`
  getEl("simBenchmark").value = "kiso_all";
  getEl("simHhSize").value = "1";
  getEl("simHhAbroad").value = "0";
  getEl("simIncome").value = "400"; // 4M
  getEl("simSpouseIncome").value = "0";
  getEl("simFamIncome").value = "0";
  getEl("simAge").value = "30";
  getEl("simEndAge").value = "65";
  getEl("simPastKosei").value = "2";
  getEl("simPastKokumin").value = "0";
  getEl("simTeikibin").value = "";
  getEl("simYcap").value = "25";
  runReformSimulation();
`, ctx);

const g1Badge = getEl("simGate1Badge").textContent;
assert(g1Badge.includes("SHORTFALL"), "Reform Simulator Gate 1 Shortfall (¥4M vs ¥5.752M)", g1Badge);

const g2Badge = getEl("simGate2Badge").textContent;
const assetVal = getEl("simAssetOffsetVal").textContent;
assert(g2Badge.includes("SHORTFALL"), "Reform Simulator Gate 2 Shortfall", g2Badge);
assert(assetVal.includes("万円"), "Reform Simulator Asset Offset Calculated", assetVal);

// TEST 9: e-Gov 315000140 Higher Income Pass
vm.runInContext(`
  getEl("simIncome").value = "800"; // 8M
  getEl("simPastKosei").value = "5";
  runReformSimulation();
`, ctx);
const g1Pass = getEl("simGate1Badge").textContent;
const g2Pass = getEl("simGate2Badge").textContent;
assert(g1Pass.includes("PASSED"), "Reform Simulator Gate 1 Passed with ¥8M", g1Pass);
assert(g2Pass.includes("PASSED"), "Reform Simulator Gate 2 Passed with ¥8M", g2Pass);

// TEST 10: Japanese University Degree + N2 vs N1 Mutual Exclusivity Rule
vm.runInContext(`
  getEl("calcCategory").value = "1b";
  getEl("calcDegree").value = "10";
  getEl("calcExperience").value = "0";
  getEl("calcAge").value = "0";
  getEl("calcSalary").value = "0";
  getEl("calcLicenses1b").value = "0";
  getEl("calcInvManagement").checked = false;
  getEl("calcInnovation").value = "0";
  getEl("calcSmeRd").checked = false;
  getEl("calcForeignQual").checked = false;
  
  // Case A: JP Uni (10) + N2 (10) -> N2 should NOT be added
  getEl("calcJapanUni").checked = true;
  getEl("calcJapanese").value = "10"; // N2
  calculatePoints();
  ptsCaseA = +getEl("subAdditions").textContent;

  // Case B: JP Uni (10) + N1 (15) -> Both added = 25
  getEl("calcJapanese").value = "15"; // N1
  calculatePoints();
  ptsCaseB = +getEl("subAdditions").textContent;

  // Case C: No JP Uni + N2 (10) -> N2 added = 10
  getEl("calcJapanUni").checked = false;
  getEl("calcJapanese").value = "10"; // N2
  calculatePoints();
  ptsCaseC = +getEl("subAdditions").textContent;
`, ctx);

assert(sandbox.ptsCaseA === 10, "JP Uni + N2 exclusivity (N2 blocked)", `Expected 10, got ${sandbox.ptsCaseA}`);
assert(sandbox.ptsCaseB === 25, "JP Uni + N1 combination allowed", `Expected 25, got ${sandbox.ptsCaseB}`);
assert(sandbox.ptsCaseC === 10, "No JP Uni + N2 allowed", `Expected 10, got ${sandbox.ptsCaseC}`);

// TEST 11: Innovation SME and R&D Ratio Exclusivity
vm.runInContext(`
  getEl("calcInnovation").value = "10"; // Large Enterprise
  handleInnovationChange();
  rdVisibleWithLarge = getEl("secSmeRd").style.display;
  
  getEl("calcInnovation").value = "20"; // SME
  handleInnovationChange();
  rdVisibleWithSme = getEl("secSmeRd").style.display;
`, ctx);
assert(sandbox.rdVisibleWithLarge === "none", "SME R&D hidden for Large Enterprise", sandbox.rdVisibleWithLarge);
assert(sandbox.rdVisibleWithSme === "flex" || sandbox.rdVisibleWithSme === "block", "SME R&D visible for SME", sandbox.rdVisibleWithSme);

// TEST 12: Dual Timestamp Audit — 80-point route uses the 1-year prior score, 70-point route the 3-year prior score
vm.runInContext(`
  lockedFilingScore = 85; lockedPrior1Score = 85; lockedPrior3Score = null;
  evaluateDualScores();
  verdict1 = getEl("dualVerdict").textContent;

  lockedFilingScore = 85; lockedPrior1Score = 65; lockedPrior3Score = null;
  evaluateDualScores();
  verdict2 = getEl("dualVerdict").textContent;

  lockedFilingScore = 75; lockedPrior1Score = null; lockedPrior3Score = 75;
  evaluateDualScores();
  verdict3 = getEl("dualVerdict").textContent;

  // 80+ one year ago does not prove 70+ three years ago
  lockedFilingScore = 75; lockedPrior1Score = 90; lockedPrior3Score = 60;
  evaluateDualScores();
  verdict4 = getEl("dualVerdict").textContent;

  // 1-year prior below 80 but 3-year prior 70+ -> falls back to the 70-point route
  lockedFilingScore = 85; lockedPrior1Score = 75; lockedPrior3Score = 72;
  evaluateDualScores();
  verdict5 = getEl("dualVerdict").textContent;

  lockedFilingScore = 65; lockedPrior1Score = 90; lockedPrior3Score = 90;
  evaluateDualScores();
  verdict6 = getEl("dualVerdict").textContent;

  lockedFilingScore = null; lockedPrior1Score = 90; lockedPrior3Score = null;
  evaluateDualScores();
  verdict7 = getEl("dualVerdict").textContent;
  lockedFilingScore = null; lockedPrior1Score = null; lockedPrior3Score = null;
`, ctx);
assert(sandbox.verdict1.includes("Qualified for 80-Point"), "Dual Audit: 80+ at filing and 1 year before", sandbox.verdict1);
assert(sandbox.verdict2.includes("below 80") && sandbox.verdict2.includes("3-year prior"), "Dual Audit: 1-year prior below 80 asks for the 3-year prior score", sandbox.verdict2);
assert(sandbox.verdict3.includes("Qualified for 70-Point"), "Dual Audit: 70+ at filing and 3 years before", sandbox.verdict3);
assert(sandbox.verdict4.includes("Disqualified") && sandbox.verdict4.includes("3-year prior score is below 70"), "Dual Audit: 1-year prior score cannot stand in for the 3-year prior", sandbox.verdict4);
assert(sandbox.verdict5.includes("Qualified for 70-Point"), "Dual Audit: falls back to the 70-point route", sandbox.verdict5);
assert(sandbox.verdict6.includes("Disqualified") && sandbox.verdict6.includes("below 70"), "Dual Audit: filing score below 70 disqualifies", sandbox.verdict6);
assert(sandbox.verdict7.includes("Lock the filing date score"), "Dual Audit: filing score required first", sandbox.verdict7);

// TEST 13: J-Skip Track 1 & Track 2 Switching
elements['jskip_track_val'] = 't1';
vm.runInContext(`
  getEl("calcCategory").value = "jskip";
  handleCategoryChange();
  calculatePoints();
  jskipVal1 = getEl("scoreValue").textContent;
`, ctx);

elements['jskip_track_val'] = 'none';
vm.runInContext(`
  calculatePoints();
  jskipValNone = getEl("scoreValue").textContent;
`, ctx);
assert(sandbox.jskipVal1 === "J-SKIP", "J-Skip Track 1 displays J-SKIP badge", sandbox.jskipVal1);
assert(sandbox.jskipValNone === "—", "J-Skip None displays dash", sandbox.jskipValNone);

// TEST 14: 2026 Reform Gate 1 Scaling for Large Households & Dependents
vm.runInContext(`
  getEl("simBenchmark").value = "by_size";
  getEl("simHhSize").value = "5";
  getEl("simHhAbroad").value = "0";
  getEl("simIncome").value = "850"; // 8.5M
  getEl("simSpouseIncome").value = "0";
  getEl("simFamIncome").value = "0";
  getEl("simFamShikakugai").value = "200"; // Should be ignored!
  runReformSimulation();
  // 5 persons requires: 7,532,000 + 800,000 = 8,332,000
  // Qualifying income = 8.5M >= 8.332M -> PASSED
  detail5p = getEl("simGate1Detail").textContent;
  badge5p = getEl("simGate1Badge").textContent;
`, ctx);
assert(sandbox.detail5p.includes("Required Bar: 833.2万円"), "Household size 5 bar calculation (¥8.332M)", sandbox.detail5p);
assert(sandbox.badge5p.includes("PASSED"), "Household size 5 passed with ¥8.5M", sandbox.badge5p);

// TEST 15: Language Switcher and Bilingual Verification
vm.runInContext(`
  setLanguage('id');
  titleId = getEl("siteTitleText").textContent;
  auditTitleId = getEl("homeTitleChecklist").textContent;
  checklistId = getEl("homeTitleAssembly").textContent;
  fNaId = getEl("chkFilterNa").textContent;
  degreeLblId = getEl("calcLabelDegree").textContent;
  calcTitleId = getEl("homeTitleCalculator").textContent;
  reformTitleId = getEl("homeTitleSimulator").textContent;
  langStateId = currentLang;

  // Switch back to English to verify clean roundtrip
  setLanguage('en');
  titleEn = getEl("siteTitleText").textContent;
  langStateEn = currentLang;
`, ctx);
assert(sandbox.langStateId === 'id', "Language state switch to 'id'", sandbox.langStateId);
assert(sandbox.titleId.includes("Kalkulator Poin"), "Indonesian Main Title translated", sandbox.titleId);
assert(sandbox.auditTitleId.includes("Daftar Periksa"), "Indonesian Audit Card translated", sandbox.auditTitleId);
assert(sandbox.checklistId === "Daftar Periksa Dokumen Aplikasi", "Indonesian Checklist Title: Daftar Periksa Dokumen Aplikasi", sandbox.checklistId);
assert(sandbox.fNaId === "Tidak Berlaku (N/A)", "Indonesian N/A filter: Tidak Berlaku (N/A)", sandbox.fNaId);
assert(sandbox.degreeLblId === "Gelar Tertinggi yang Dimiliki:", "Indonesian Degree label: Gelar Tertinggi yang Dimiliki:", sandbox.degreeLblId);
assert(sandbox.langStateEn === 'en', "Language state reset to 'en'", sandbox.langStateEn);
assert(sandbox.titleEn.includes("Self-Diagnostic Checklist"), "English Main Title restored", sandbox.titleEn);

// TEST 16: Professional Experience and Japanese Language Capability Ordering
const jpMatch = html.match(/<select id="calcJapanese"[^>]*>([\s\S]*?)<\/select>/);
assert(!!jpMatch, "calcJapanese select tag found in HTML");
const jpOptions = jpMatch[1];
const idxNone = jpOptions.indexOf("None");
const idxN2 = jpOptions.indexOf("JLPT N2");
const idxN1 = jpOptions.indexOf("JLPT N1");
assert(idxNone < idxN2 && idxN2 < idxN1, "Japanese Language order: None -> N2 -> N1", `indices: None=${idxNone}, N2=${idxN2}, N1=${idxN1}`);

vm.runInContext(`
  getEl("calcCategory").value = "1b";
  handleCategoryChange();
  expHtml1b = getEl("calcExperience").innerHTML;
`, ctx);
const expHtml1b = sandbox.expHtml1b;
const idxLess = expHtml1b.indexOf("Less than 3 years");
const idx3to5 = expHtml1b.indexOf("3 – 5 years");
const idx5to7 = expHtml1b.indexOf("5 – 7 years");
const idx7to10 = expHtml1b.indexOf("7 – 10 years");
const idx10plus = expHtml1b.indexOf("More than 10 years");
assert(idxLess < idx3to5 && idx3to5 < idx5to7 && idx5to7 < idx7to10 && idx7to10 < idx10plus, "Work Experience 1(b) order: Less than 3 -> 3-5 -> 5-7 -> 7-10 -> More than 10", expHtml1b);

// TEST 17: Lock / Unlock Toggle Functionality & Dynamic Button Labels
vm.runInContext(`
  setLanguage('en');
  resetCalculator();
  getEl("calcCategory").value = "1b";
  handleCategoryChange();
  btnLockF_init = getEl("btnLockFiling").textContent;
  btnLockP1_init = getEl("btnLockPrior1").textContent;
  btnLockP3_init = getEl("btnLockPrior3").textContent;
  dualF_init = getEl("dualFiling").textContent;
  dualP1_init = getEl("dualPrior1").textContent;
  dualP3_init = getEl("dualPrior3").textContent;

  saveFilingDateScore();
  lockedF1 = lockedFilingScore;
  btnLockF_locked = getEl("btnLockFiling").textContent;
  dualF_locked = getEl("dualFiling").textContent;
  saveFilingDateScore();
  lockedF2 = lockedFilingScore;
  btnLockF_unlocked = getEl("btnLockFiling").textContent;
  dualF_unlocked = getEl("dualFiling").textContent;

  savePriorDateScore(1);
  lockedP1a = lockedPrior1Score;
  lockedP3untouched = lockedPrior3Score;
  btnLockP1_locked = getEl("btnLockPrior1").textContent;
  dualP1_locked = getEl("dualPrior1").textContent;
  savePriorDateScore(1);
  lockedP1b = lockedPrior1Score;
  btnLockP1_unlocked = getEl("btnLockPrior1").textContent;
  dualP1_unlocked = getEl("dualPrior1").textContent;

  savePriorDateScore(3);
  lockedP3a = lockedPrior3Score;
  btnLockP3_locked = getEl("btnLockPrior3").textContent;
  savePriorDateScore(3);
  lockedP3b = lockedPrior3Score;
  btnLockP3_unlocked = getEl("btnLockPrior3").textContent;

  setLanguage('id');
  saveFilingDateScore();
  btnLockF_id_locked = getEl("btnLockFiling").textContent;
  saveFilingDateScore();
  btnLockF_id_unlocked = getEl("btnLockFiling").textContent;
  savePriorDateScore(1);
  btnLockP1_id_locked = getEl("btnLockPrior1").textContent;
  savePriorDateScore(1);
  btnLockP1_id_unlocked = getEl("btnLockPrior1").textContent;
  savePriorDateScore(3);
  btnLockP3_id_locked = getEl("btnLockPrior3").textContent;
  savePriorDateScore(3);

  saveFilingDateScore();
  savePriorDateScore(1);
  savePriorDateScore(3);
  resetCalculator();
  resetScores = [lockedFilingScore, lockedPrior1Score, lockedPrior3Score];
  btnResetFText = getEl("btnLockFiling").textContent;
  setLanguage('en');
`, ctx);
assert(sandbox.btnLockF_init === "Lock as Current Filing Date Score", "Initial Filing Date Button Label", sandbox.btnLockF_init);
assert(sandbox.btnLockP1_init === "Lock as 1-Year Prior Score", "Initial 1-Year Prior Button Label", sandbox.btnLockP1_init);
assert(sandbox.btnLockP3_init === "Lock as 3-Year Prior Score", "Initial 3-Year Prior Button Label", sandbox.btnLockP3_init);
assert(sandbox.dualF_init === "-" && sandbox.dualP1_init === "-" && sandbox.dualP3_init === "-", "Initial locked scores are '-'", `${sandbox.dualF_init} ${sandbox.dualP1_init} ${sandbox.dualP3_init}`);
assert(typeof sandbox.lockedF1 === "number", "Filing Date successfully locked", sandbox.lockedF1);
assert(sandbox.btnLockF_locked === "Unlock the Current Filing Date Score", "Filing Button dynamic label when locked", sandbox.btnLockF_locked);
assert(sandbox.dualF_locked.includes("points"), "Filing score display updated when locked", sandbox.dualF_locked);
assert(sandbox.lockedF2 === null, "Filing Date unlocked on second click", sandbox.lockedF2);
assert(sandbox.btnLockF_unlocked === "Lock as Current Filing Date Score", "Filing Button label restored on unlock", sandbox.btnLockF_unlocked);
assert(sandbox.dualF_unlocked === "-", "Filing score reset to '-' on unlock", sandbox.dualF_unlocked);
assert(typeof sandbox.lockedP1a === "number", "1-Year Prior successfully locked", sandbox.lockedP1a);
assert(sandbox.lockedP3untouched === null, "Locking the 1-year prior leaves the 3-year prior untouched", sandbox.lockedP3untouched);
assert(sandbox.btnLockP1_locked === "Unlock the 1-Year Prior Score", "1-Year Prior Button dynamic label when locked", sandbox.btnLockP1_locked);
assert(sandbox.dualP1_locked.includes("points"), "1-Year Prior score display updated when locked", sandbox.dualP1_locked);
assert(sandbox.lockedP1b === null, "1-Year Prior unlocked on second click", sandbox.lockedP1b);
assert(sandbox.btnLockP1_unlocked === "Lock as 1-Year Prior Score", "1-Year Prior Button label restored", sandbox.btnLockP1_unlocked);
assert(sandbox.dualP1_unlocked === "-", "1-Year Prior score reset to '-' on unlock", sandbox.dualP1_unlocked);
assert(typeof sandbox.lockedP3a === "number" && sandbox.lockedP3b === null, "3-Year Prior lock toggles", `${sandbox.lockedP3a}, ${sandbox.lockedP3b}`);
assert(sandbox.btnLockP3_locked === "Unlock the 3-Year Prior Score" && sandbox.btnLockP3_unlocked === "Lock as 3-Year Prior Score", "3-Year Prior Button labels", `${sandbox.btnLockP3_locked} / ${sandbox.btnLockP3_unlocked}`);
assert(sandbox.btnLockF_id_locked === "Buka Kunci Skor Tanggal Pengajuan Saat Ini", "Indonesian Filing locked label", sandbox.btnLockF_id_locked);
assert(sandbox.btnLockF_id_unlocked === "Kunci Skor Tanggal Pengajuan Saat Ini", "Indonesian Filing unlocked label", sandbox.btnLockF_id_unlocked);
assert(sandbox.btnLockP1_id_locked === "Buka Kunci Skor 1 Tahun Sebelumnya", "Indonesian 1-Year Prior locked label", sandbox.btnLockP1_id_locked);
assert(sandbox.btnLockP1_id_unlocked === "Kunci Skor 1 Tahun Sebelumnya", "Indonesian 1-Year Prior unlocked label", sandbox.btnLockP1_id_unlocked);
assert(sandbox.btnLockP3_id_locked === "Buka Kunci Skor 3 Tahun Sebelumnya", "Indonesian 3-Year Prior locked label", sandbox.btnLockP3_id_locked);
assert(sandbox.resetScores.every(v => v === null), "resetCalculator clears all locked scores", JSON.stringify(sandbox.resetScores));
assert(sandbox.btnResetFText.includes("Kunci") || sandbox.btnResetFText.includes("Lock"), "resetCalculator resets Filing Button label", sandbox.btnResetFText);

// TEST 18: Only one reset button in the calculator
assert(!html.includes('id="calcBtnResetTop"'), "Top calculator reset button removed", "calcBtnResetTop still present");
assert((html.match(/onclick="resetCalculator\(\)"/g) || []).length === 1, "Exactly one Reset Calculator button", (html.match(/onclick="resetCalculator\(\)"/g) || []).length);

// TEST 19: ¥3M salary floor disqualifies 1(b)/1(c) but not 1(a)
vm.runInContext(`
  resetCalculator();
  getEl("calcCategory").value = "1b";
  getEl("calcDegree").value = "30";
  getEl("calcExperience").value = "20";
  getEl("calcAge").value = "15";
  getEl("calcSalary").value = "disqualify";
  getEl("calcJapanUni").checked = true;
  getEl("calcJapanese").value = "15";
  under3m_1b = calculatePoints();
  under3m_1b_status = getEl("scoreStatus").textContent;
  under3m_1b_alert = getEl("salaryAlertMin").style.display;

  getEl("calcCategory").value = "1c";
  getEl("calcSalary").value = "disqualify";
  under3m_1c = calculatePoints();

  getEl("calcCategory").value = "1a";
  getEl("calcExperience").value = "15";
  getEl("calcSalary").value = "under3m";
  under3m_1a = calculatePoints();
  under3m_1a_alert = getEl("salaryAlertMin").style.display;
  under3m_1a_status = getEl("scoreStatus").textContent;
  resetCalculator();
`, ctx);
assert(sandbox.under3m_1b === 0, "1(b) under ¥3M scores 0", sandbox.under3m_1b);
assert(sandbox.under3m_1b_status.includes("Not Eligible"), "1(b) under ¥3M shows Not Eligible", sandbox.under3m_1b_status);
assert(sandbox.under3m_1b_alert === "block", "1(b) under ¥3M shows the salary alert", sandbox.under3m_1b_alert);
assert(sandbox.under3m_1c === 0, "1(c) under ¥3M scores 0", sandbox.under3m_1c);
assert(sandbox.under3m_1a === 30 + 15 + 15 + 10 + 15, "1(a) under ¥3M only loses salary points", sandbox.under3m_1a);
assert(sandbox.under3m_1a_alert === "none" && !sandbox.under3m_1a_status.includes("Not Eligible"), "1(a) has no ¥3M floor", `${sandbox.under3m_1a_alert} / ${sandbox.under3m_1a_status}`);
const salOpts1a = (() => { vm.runInContext(`getEl("calcCategory").value = "1a"; handleCategoryChange(); salHtml1a = getEl("calcSalary").innerHTML; getEl("calcCategory").value = "1b"; handleCategoryChange(); salHtml1b = getEl("calcSalary").innerHTML;`, ctx); return [sandbox.salHtml1a, sandbox.salHtml1b]; })();
assert(salOpts1a[0].includes('value="under3m"') && !salOpts1a[0].includes('value="disqualify"'), "1(a) salary list has a 0-pt under-¥3M option", salOpts1a[0].slice(0, 120));
assert(salOpts1a[1].includes('value="disqualify"'), "1(b) salary list keeps the disqualifying under-¥3M option", salOpts1a[1].slice(0, 120));

// TEST 20: 1(c) has no research-achievement points
vm.runInContext(`
  resetCalculator();
  getEl("calcCategory").value = "1c";
  handleCategoryChange();
  research1cDisplay = getEl("cardResearch").style.display;
  getEl("resPatent").checked = true;
  getEl("resPapers").checked = true;
  calculatePoints();
  research1c = +getEl("subResearch").textContent;
  getEl("calcCategory").value = "1b";
  handleCategoryChange();
  research1bDisplay = getEl("cardResearch").style.display;
  calculatePoints();
  research1b = +getEl("subResearch").textContent;
  resetCalculator();
`, ctx);
assert(sandbox.research1c === 0, "1(c) research achievements score 0", sandbox.research1c);
assert(sandbox.research1cDisplay === "none", "1(c) research card hidden", sandbox.research1cDisplay);
assert(sandbox.research1b === 15 && sandbox.research1bDisplay === "block", "1(b) research achievements still 15 pts", `${sandbox.research1b} / ${sandbox.research1bDisplay}`);

// TEST 21: Household income bar follows household size by default
vm.runInContext(`
  getEl("simBenchmark").value = "by_size";
  getEl("simHhAbroad").value = "0";
  getEl("simIncome").value = "400";
  getEl("simSpouseIncome").value = "0";
  getEl("simFamIncome").value = "0";
  getEl("simHhSize").value = "1"; runReformSimulation(); bar1 = getEl("simGate1Detail").textContent; badge1 = getEl("simGate1Badge").textContent;
  getEl("simHhSize").value = "2"; runReformSimulation(); bar2 = getEl("simGate1Detail").textContent;
  getEl("simHhSize").value = "3"; getEl("simHhAbroad").value = "2"; runReformSimulation(); barAbroad = getEl("simGate1Detail").textContent;
  getEl("simHhAbroad").value = "0";
  getEl("simBenchmark").value = "kiso_all"; getEl("simHhSize").value = "1"; runReformSimulation(); barFlat = getEl("simGate1Detail").textContent;
  getEl("simBenchmark").value = "by_size";
`, ctx);
assert(sandbox.bar1.includes("Required Bar: 318.3万円"), "1-person household bar is ¥3.183M", sandbox.bar1);
assert(sandbox.badge1.includes("PASSED"), "1-person household with ¥4M passes", sandbox.badge1);
assert(sandbox.bar2.includes("Required Bar: 475.6万円"), "2-person household bar is ¥4.756M", sandbox.bar2);
assert(sandbox.barAbroad.includes("Required Bar: 833.2万円") && sandbox.barAbroad.includes("5-person"), "Overseas dependents added to household size", sandbox.barAbroad);
assert(sandbox.barFlat.includes("Required Bar: 575.2万円"), "Flat benchmark used as-is", sandbox.barFlat);

// TEST 22: State validation for saved and imported backups
vm.runInContext(`
  currentLang = "en"; currentRoute = "10-Year Standard Route"; checklistAnswers = {};
  lockedFilingScore = null; lockedPrior1Score = null; lockedPrior3Score = null;
  firstNum = String(ROUTE_ITEMS["10-Year Standard Route"][0].num);
  badOk = applyState({
    currentLang: "fr",
    currentRoute: "Nonexistent Route",
    checklistAnswers: { "10-Year Standard Route": { [firstNum]: "YES", "999": "YES", [String(ROUTE_ITEMS["10-Year Standard Route"][1].num)]: "<img>" }, "Fake": { "1": "YES" } },
    lockedFilingScore: "80",
    lockedPrior1Score: 82,
    lockedPrior3Score: -5
  });
  st_lang = currentLang; st_route = currentRoute;
  st_answers = JSON.stringify(checklistAnswers);
  st_scores = [lockedFilingScore, lockedPrior1Score, lockedPrior3Score];
  rejectArray = applyState([1, 2]);
  rejectNull = applyState(null);
  goodOk = applyState({ currentLang: "id", currentRoute: "Spouse of Japanese or PR" });
  st_lang2 = currentLang; st_route2 = currentRoute;
  currentLang = "en"; currentRoute = "10-Year Standard Route"; checklistAnswers = {};
  lockedFilingScore = null; lockedPrior1Score = null; lockedPrior3Score = null;
`, ctx);
assert(sandbox.badOk === true && sandbox.st_lang === "en" && sandbox.st_route === "10-Year Standard Route", "Invalid language and route ignored", `${sandbox.st_lang} ${sandbox.st_route}`);
assert(sandbox.st_answers === JSON.stringify({ "10-Year Standard Route": { [sandbox.firstNum]: "YES" } }), "Only valid checklist answers kept", sandbox.st_answers);
assert(sandbox.st_scores[0] === null && sandbox.st_scores[1] === 82 && sandbox.st_scores[2] === null, "Only numeric non-negative locked scores kept", JSON.stringify(sandbox.st_scores));
assert(sandbox.rejectArray === false && sandbox.rejectNull === false, "Non-object backups rejected", `${sandbox.rejectArray} ${sandbox.rejectNull}`);
assert(sandbox.goodOk === true && sandbox.st_lang2 === "id" && sandbox.st_route2 === "Spouse of Japanese or PR", "Valid language and route applied", `${sandbox.st_lang2} ${sandbox.st_route2}`);

// TEST 23: Calculator inputs are saved and restored
vm.runInContext(`
  setLanguage('en');
  resetCalculator();
  getEl("calcCategory").value = "1b";
  handleCategoryChange();
  getEl("calcDegree").value = "30";
  getEl("calcSalary").value = "40";
  getEl("calcTopUni").checked = true;
  calculatePoints();
  snapshot = JSON.parse(localStorage.getItem("japan_pr_state")).calcInputs;
  resetCalculator();
  restoreCalcInputs(snapshot);
  restoredDeg = getEl("calcDegree").value;
  restoredSal = getEl("calcSalary").value;
  restoredTop = getEl("calcTopUni").checked;
  resetCalculator();
`, ctx);
assert(sandbox.snapshot && sandbox.snapshot.category === "1b" && sandbox.snapshot.selects.calcDegree === "30", "Calculator inputs saved to state", JSON.stringify(sandbox.snapshot));
assert(sandbox.restoredDeg === "30" && sandbox.restoredSal === "40" && sandbox.restoredTop === true, "Calculator inputs restored", `${sandbox.restoredDeg} ${sandbox.restoredSal} ${sandbox.restoredTop}`);

// TEST 24: Removed dead code and relabeled external link
assert(!html.includes("TEST_SUITE"), "Unused in-page TEST_SUITE removed", "TEST_SUITE found");
assert(!html.includes("checklistNotes"), "Unused checklistNotes state removed", "checklistNotes found");
assert(!html.includes("(.xlsx)") && html.includes("(Google Sheets)"), "Google Sheets link labeled as Google Sheets", "still labeled .xlsx");
assert(!/Ordinance No\. 426M60000010037/.test(html), "Ordinance cited by number, not e-Gov ID", "426M60000010037 used as ordinance number");

console.log(`\n=== FINAL VERIFICATION SUMMARY: ${totalTests} TOTAL TESTS RUN, ${failedTests} FAILURES ===`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log("ZERO ERRORS ACHIEVED ACROSS ALL COMPREHENSIVE EDGE CASES.");
}
