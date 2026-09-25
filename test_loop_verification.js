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
`, ctx);
assert(sandbox.salaryPointsDiscounted === 0, "1(b) Salary Age Gating at 40+", `Expected 0, got ${sandbox.salaryPointsDiscounted}`);

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

// Summary
console.log(`=== SUMMARY: ${totalTests} TOTAL TESTS RUN, ${failedTests} FAILURES ===`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log("ZERO ERRORS ACHIEVED ACROSS ALL TEST SUITES.");
}

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

// TEST 12: Dual Timestamp Continuous Audit Logic
vm.runInContext(`
  // Case 1: 85 now, 85 prior -> 80-point qualified
  lockedFilingScore = 85;
  lockedPriorScore = 85;
  evaluateDualScores();
  verdict1 = getEl("dualVerdict").innerHTML;

  // Case 2: 85 now, 65 prior -> not yet 1 year maintained
  lockedFilingScore = 85;
  lockedPriorScore = 65;
  evaluateDualScores();
  verdict2 = getEl("dualVerdict").innerHTML;

  // Case 3: 75 now, 75 prior -> 70-point qualified
  lockedFilingScore = 75;
  lockedPriorScore = 75;
  evaluateDualScores();
  verdict3 = getEl("dualVerdict").innerHTML;
`, ctx);
assert(sandbox.verdict1.includes("Qualified for 80-Point"), "Dual Audit: 80+ maintained", sandbox.verdict1);
assert(sandbox.verdict2.includes("must maintain 80+ points for a full 1 year"), "Dual Audit: 80+ not maintained for 1 year", sandbox.verdict2);
assert(sandbox.verdict3.includes("Qualified for 70-Point"), "Dual Audit: 70+ maintained", sandbox.verdict3);

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
  getEl("simBenchmark").value = "kiso_all"; // 5.752M floor
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
assert(sandbox.detail5p.includes("Required Bar: ¥833.2万"), "Household size 5 bar calculation (¥8.332M)", sandbox.detail5p);
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

console.log(`\n=== FINAL VERIFICATION SUMMARY: ${totalTests} TOTAL TESTS RUN, ${failedTests} FAILURES ===`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log("ZERO ERRORS ACHIEVED ACROSS ALL COMPREHENSIVE EDGE CASES.");
}
