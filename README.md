# Japan Permanent Residency (PR) Self-Diagnostic Checklist & Points Calculator

A standalone, privacy-first, 100% offline single-page web tool to audit permanent residency eligibility under current Japanese immigration law and the Immigration Services Agency of Japan (出入国在留管理庁, ISA) statutory guidelines.

🌐 **Live Web Application**: [https://farislmn.github.io/japan-pr-checklist/](https://farislmn.github.io/japan-pr-checklist/)

---

## Key Features

1. **PR Self-Audit Checklist (永住許可自己診断チェックリスト)**
   - Complete self-audit across **7 statutory application categories**:
     - 10-Year Standard Route (原則10年・就労関係)
     - Spouse of Japanese National or Permanent Resident (日本人・永住者の配偶者)
     - 70-Point Highly Skilled Professional (HSP 3-Year Fast Track) (高度人材70点)
     - 80-Point Highly Skilled Professional (HSP 1-Year Fast Track) (高度人材80点)
     - J-Skip Special Highly Skilled Professional (1-Year Fast Track) (特別高度人材)
     - Long-Term Resident (5-Year Residence) (定住者)
     - Child of Japanese National or Permanent Resident (日本人の実子・永住者の実子)
   - 101 rigorous checkpoints with human-readable proof requirements and explicit failure mode analysis.
   - Real-time audit status banner flagging compliance, red flags, or pending verifications.

2. **Submission Checklist & Assembly Guide (提出書類チェックリスト)**
   - Route-tailored dossier preparation guide following official ISA checklists (`提出書類一覧表`).
   - Official lookback windows for municipal resident tax (`住民税課税・納税証明書`), national withholding tax (`源泉徴収票・納税証明書その3`), Nenkin net public pension (`ねんきん定期便・被保険者記録照会回答票`), and health insurance.
   - Clean, isolated print stylesheet: pressing `Ctrl+P` or clicking Print outputs a clean A4 submission pack without web UI chrome.

3. **HSP Points Calculator & J-Skip Fast Track (高度専門職ポイント計算)**
   - Category-specific calculation for Academic Research (1a), Advanced Technical/Specialist (1b), and Business Management (1c).
   - J-Skip evaluation engine (Track 1 academic/technical salary &ge; ¥20M; Track 2 management salary &ge; ¥40M).
   - Dual-audit scoring: locks the filing-date score and checks it against the score 1 year before (80-point route) and 3 years before (70-point route).
   - Enforces the ¥3,000,000 minimum annual salary for 1(b) and 1(c); 1(a) has no salary floor.

4. **Revised PR Guidelines Assessment (Public Pension & Livelihood Standards)**
   - Simulates proposed guideline changes (April 2026 retroactive / October 2026 implementation):
     - **Gate 1**: Household income bar set by household size (overseas dependents included), with flat national statistics available as what-if alternatives.
     - **Gate 2**: Timely payment and non-delinquency standards for public pension (`厚生年金 / 国民年金`) and social health insurance (`健康保険 / 国民健康保険`).
     - Real-time asset offset calculations for savings, liquid securities, and real estate equity.

5. **Statutory Reference Register & Legal Disclaimer**
   - Full statutory mapping covering 22 legal bases (`REF-01` through `REF-22`): Immigration Control Act Articles 22 and 22-2, National Pension Act Article 7, Local Tax Act, and official ministerial orders.
   - Detailed rejection risk taxonomy (10 primary failure modes).

6. **Bilingual Support (English & Bahasa Indonesia)**
   - Instant language switcher (`[English] | [Bahasa Indonesia]`) on the landing page.
   - Full, verified localized terminology across all 5 modules, all 101 checklist items, assembly guides, point rules, and legal citations.

7. **Institutional Berkshire Hathaway Styling & Privacy**
   - Timeless, distraction-free typographic hierarchy (Times New Roman, `#800080` purple links, `#000080` navy accents, 0px border radius, 1px hairline borders).
   - **Zero external dependencies**: No CDNs, no external tracking scripts, no fonts or frameworks fetched at runtime. The only external link is the optional master checklist on Google Sheets, which opens in a new tab.
   - **100% Client-Side**: Checklist answers, calculator inputs and locked scores stay entirely in your browser (`localStorage`), with optional local JSON save/load.

---

## Quick Start / Offline Usage

### Option 1: Live Web App
Open [https://farislmn.github.io/japan-pr-checklist/](https://farislmn.github.io/japan-pr-checklist/) directly in any modern desktop or mobile browser. The repository also includes a `netlify.toml` if you prefer to deploy your own copy on Netlify.

### Option 2: Run Locally (Zero Setup)
Clone the repository and open `index.html`:
```bash
git clone https://github.com/farislmn/japan-pr-checklist.git
cd japan-pr-checklist
open index.html   # On macOS
xdg-open index.html # On Linux
start index.html  # On Windows
```
Or serve via any simple static HTTP server:
```bash
python3 -m http.server 8000
```
Then navigate to `http://localhost:8000/`.

---

## Development & Testing

The repository includes a Python generator script and an automated verification test suite:

- **Build / Recompile HTML**:
  ```bash
  python3 generate_offline_web_app.py
  ```
  Generates `index.html` by injecting `pr_data.json` directly into the standalone bundle.

- **Run Automated Verification Suite**:
  ```bash
  node test_loop_verification.js
  ```
  Runs 147 test cases verifying:
  - Statutory reference integrity (REF-01 through REF-22)
  - All 7 route checklists and compliance logic
  - HSP scoring formulas, license gating, salary brackets and the ¥3M salary floor
  - Dual-audit verdicts for the 1-year and 3-year lookbacks
  - Saved/imported state validation and calculator input restore
  - 2026/2027 guideline reform calculations and household scaling
  - Bilingual switching and string fidelity

---

## Project Structure

```text
japan-pr-checklist/
├── index.html                 # Complete standalone, single-page web application
├── pr_data.json               # Master dataset (statutory refs, checklist items, translations)
├── generate_offline_web_app.py# Builder script that creates index.html
├── test_loop_verification.js  # Node.js automated test runner (147 tests)
├── netlify.toml               # Optional Netlify deploy config (publish root + security headers)
├── README.md                  # Project documentation
├── LICENSE                    # MIT License
└── .gitignore                 # Standard git ignores
```

---

## Disclaimer

This self-diagnostic checklist and calculator is an informational self-assessment tool based on publicly available Japanese laws, ministerial ordinances, and guidelines published by the Immigration Services Agency of Japan (ISA).

Permanent Residency approval in Japan is granted at the broad discretion of the Minister of Justice (法務大臣の広範な裁量). Use of this tool does not constitute legal representation, administrative scrivener (*gyoseishoshi*) counsel, or a guarantee of application success. Consult a licensed administrative scrivener or immigration lawyer for formal legal representation.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
