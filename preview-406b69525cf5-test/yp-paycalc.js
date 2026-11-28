/* Pay Calculator — 2026–27 calculation engine plus the Option C UI (no game figures).
 *
 * Australian resident income tax, Medicare levy and employer Superannuation
 * Guarantee for a full year, then split across Annually, Monthly, Fortnightly,
 * Weekly and Daily.
 *
 * Update YP_PAYCALC_RATES each 1 July from the ATO pages linked below.
 * Real-life take-home (Reality Check, Real Life Income, Real Week) reads this engine.
 * In-game pay still uses the older helpers in index.html (incomeTax, lito,
 * taxNet, medicare, netIncome).
 */
(function (root) {
  'use strict';

  /* =====================================================================
   * Rates table — 2026–27 (1 July 2026 to 30 June 2027)
   * Update this object each 1 July. Do not scatter rates through the math.
   *
   * Income tax (Australian resident, full tax-free threshold):
   *   https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents/
   *   ATO table last checked 24 Nov 2026 (page last updated 13 August 2026).
   *   0 – $18,200: nil
   *   $18,201 – $45,000: 15c for each $1 over $18,200
   *   $45,001 – $135,000: $4,020 plus 30c for each $1 over $45,000
   *   $135,001 – $190,000: $31,020 plus 37c for each $1 over $135,000
   *   $190,001 and over: $51,370 plus 45c for each $1 over $190,000
   *   These rates do not include the Medicare levy of 2%.
   *
   * Medicare levy: 2% of taxable income.
   * Low-income reduction for a single taxpayer not entitled to SAPTO:
   *   https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners
   *   ATO table last checked 24 Nov 2026: no levy at or below $28,011;
   *   shade-in at 10c per $1 above $28,011; the two formulas meet at
   *   $35,013.75 (published upper figure $35,013). ATO example: $29,000
   *   → $98.90 levy (10% × ($29,000 − $28,011)).
   *
   * Superannuation Guarantee (employer contribution, paid on top of gross,
   * not deducted from take-home):
   *   https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee/
   *   ATO Table 21 last checked 24 Nov 2026 (page last updated 17 April 2026):
   *   general SG rate is 12.00% from 1 July 2025, including 1 July 2026 –
   *   30 June 2027. Maximum contribution base for 2026–27 is $270,830.
   *
   * Low income tax offset (LITO) is not applied here. It is nil from
   * $66,667, so it does not change the $75,000 or $46/hour × 38 hour
   * checks. Include it later only if a published ATO table requires it.
   * ===================================================================== */
  const YP_PAYCALC_RATES = {
    year: '2026-27',
    incomeTax: [
      { upTo: 18200, rate: 0 },
      { upTo: 45000, rate: 0.15 },
      { upTo: 135000, rate: 0.30 },
      { upTo: 190000, rate: 0.37 },
      { upTo: Infinity, rate: 0.45 }
    ],
    medicare: {
      rate: 0.02,
      lowIncomeLower: 28011,
      lowIncomeUpper: 35013,
      shadeInRate: 0.10
    },
    /* General Superannuation Guarantee rate from 1 July 2025. */
    superGuarantee: 0.12,
    superMaxBase: 270830,
    weeksPerYear: 52,
    fortnightsPerYear: 26,
    monthsPerYear: 12,
    workDaysPerYear: 260
  };

  const PERIOD_DIVISOR = {
    annually: 1,
    yearly: 1,
    annual: 1,
    monthly: 12,
    fortnightly: 26,
    weekly: 52,
    daily: 260
  };

  function money(n) {
    if (!isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  function incomeTax(taxable, rates) {
    const brackets = (rates && rates.incomeTax) || YP_PAYCALC_RATES.incomeTax;
    let tax = 0;
    let lo = 0;
    const inc = Math.max(0, +taxable || 0);
    for (let i = 0; i < brackets.length; i++) {
      const hi = brackets[i].upTo;
      const rate = brackets[i].rate;
      if (inc > lo) tax += (Math.min(inc, hi) - lo) * rate;
      lo = hi;
    }
    return money(tax);
  }

  function medicareLevy(taxable, rates) {
    const m = (rates && rates.medicare) || YP_PAYCALC_RATES.medicare;
    const inc = Math.max(0, +taxable || 0);
    if (inc <= m.lowIncomeLower) return 0;
    /* Lesser of the 2% levy and the 10% shade-in. The published upper
       threshold ($35,013) is the rounded ATO figure; the two formulas
       meet at lower / 0.8 = $35,013.75, so a $35,013 income still has
       a $700.20 reduction amount, 6c under a raw 2%. */
    return money(Math.min(inc * m.rate, m.shadeInRate * (inc - m.lowIncomeLower)));
  }

  function employerSuperOnGross(gross, rates) {
    const r = rates || YP_PAYCALC_RATES;
    const g = Math.max(0, +gross || 0);
    const cap = r.superMaxBase != null ? +r.superMaxBase : Infinity;
    const base = Math.min(g, isFinite(cap) ? cap : g);
    return money(base * r.superGuarantee);
  }

  /* When the entered figure is a package (pay includes super), invert it
     so gross + employer super = package, honouring the contribution cap. */
  function splitPackage(packageAmt, rates) {
    const r = rates || YP_PAYCALC_RATES;
    const pack = Math.max(0, +packageAmt || 0);
    const sg = +r.superGuarantee || 0;
    const cap = r.superMaxBase != null && isFinite(+r.superMaxBase) ? +r.superMaxBase : Infinity;
    if (!(sg > 0)) return { gross: money(pack), employerSuper: 0, package: money(pack) };
    let gross = money(pack / (1 + sg));
    if (gross > cap) gross = money(pack - cap * sg);
    const superAmt = money(Math.max(0, pack - gross));
    return { gross, employerSuper: superAmt, package: money(pack) };
  }

  function periodSlice(yearly, divisor) {
    const d = divisor || 1;
    const gross = money(yearly.gross / d);
    const incomeTax = money(yearly.incomeTax / d);
    const medicareLevy = money(yearly.medicareLevy / d);
    const employerSuper = money(yearly.employerSuper / d);
    const packageAmt = money(yearly.package / d);
    /* Period lines add up: take-home is the rounded gross minus tax and Medicare. */
    return {
      gross,
      incomeTax,
      medicareLevy,
      employerSuper,
      takeHome: money(gross - incomeTax - medicareLevy),
      package: packageAmt
    };
  }

  function yearlyGrossFrom(input, rates) {
    input = input || {};
    const weeks = (input.weeksPerYear != null) ? +input.weeksPerYear : rates.weeksPerYear;
    if (input.yearlyGross != null && input.yearlyGross !== '') {
      const y = +input.yearlyGross;
      if (!isFinite(y) || y < 0) return null;
      return y;
    }
    if (input.amount != null && input.amount !== '' && input.period) {
      const amt = +input.amount;
      if (!isFinite(amt) || amt < 0) return null;
      const key = String(input.period).toLowerCase();
      if (key === 'hourly') {
        const hours = +input.hoursPerWeek;
        if (!isFinite(hours) || hours < 0 || !isFinite(weeks) || weeks <= 0) return null;
        return amt * hours * weeks;
      }
      const div = PERIOD_DIVISOR[key];
      if (!div) return null;
      return amt * div;
    }
    const rate = +input.hourlyRate;
    const hours = +input.hoursPerWeek;
    if (!isFinite(rate) || !isFinite(hours) || rate < 0 || hours < 0) return null;
    if (!isFinite(weeks) || weeks <= 0) return null;
    return rate * hours * weeks;
  }

  /**
   * Estimate Australian resident tax, Medicare, employer super and take-home.
   *
   * @param {{yearlyGross?: number, hourlyRate?: number, hoursPerWeek?: number, weeksPerYear?: number, amount?: number, period?: string, includesSuper?: boolean}} input
   *   Pass yearlyGross, or hourlyRate plus hoursPerWeek (× 52 weeks unless
   *   weeksPerYear is set), or amount plus period (annually/monthly/
   *   fortnightly/weekly/daily/hourly). When includesSuper is true, that
   *   figure is treated as a package and gross = package / (1 + SG rate).
   *   Employer super is paid on top and is not deducted from take-home.
   * @returns {object|null}
   */
  function ypPayCalc(input) {
    const rates = YP_PAYCALC_RATES;
    const raw = yearlyGrossFrom(input, rates);
    if (raw == null) return null;
    const includesSuper = !!(input && input.includesSuper);
    let yearlyGross, employerSuper, packageAmt;
    if (includesSuper) {
      const split = splitPackage(raw, rates);
      yearlyGross = split.gross;
      employerSuper = split.employerSuper;
      packageAmt = split.package;
    } else {
      yearlyGross = money(raw);
      employerSuper = employerSuperOnGross(yearlyGross, rates);
      packageAmt = money(yearlyGross + employerSuper);
    }
    const tax = incomeTax(yearlyGross, rates);
    const levy = medicareLevy(yearlyGross, rates);
    const take = money(yearlyGross - tax - levy);
    const yearly = {
      gross: yearlyGross,
      incomeTax: tax,
      medicareLevy: levy,
      employerSuper,
      takeHome: take,
      package: packageAmt
    };
    return {
      year: rates.year,
      includesSuper,
      sgRate: rates.superGuarantee,
      yearlyGross: yearly.gross,
      incomeTax: yearly.incomeTax,
      medicareLevy: yearly.medicareLevy,
      employerSuper: yearly.employerSuper,
      package: yearly.package,
      takeHome: yearly.takeHome,
      annually: periodSlice(yearly, 1),
      monthly: periodSlice(yearly, rates.monthsPerYear),
      fortnightly: periodSlice(yearly, rates.fortnightsPerYear),
      weekly: periodSlice(yearly, rates.weeksPerYear),
      daily: periodSlice(yearly, rates.workDaysPerYear)
    };
  }

  ypPayCalc.rates = YP_PAYCALC_RATES;
  ypPayCalc.incomeTax = function (taxable) { return incomeTax(taxable, YP_PAYCALC_RATES); };
  ypPayCalc.medicareLevy = function (taxable) { return medicareLevy(taxable, YP_PAYCALC_RATES); };
  ypPayCalc.employerSuper = function (gross) { return employerSuperOnGross(gross, YP_PAYCALC_RATES); };
  ypPayCalc.splitPackage = function (pack) { return splitPackage(pack, YP_PAYCALC_RATES); };
  ypPayCalc.money = money;

  function taxBandOf(gross, rates) {
    const brackets = (rates && rates.incomeTax) || YP_PAYCALC_RATES.incomeTax;
    const inc = Math.max(0, +gross || 0);
    let lo = 0;
    let band = brackets[0] || { upTo: 0, rate: 0 };
    for (let i = 0; i < brackets.length; i++) {
      if (inc > lo) band = brackets[i];
      if (inc <= brackets[i].upTo) { band = brackets[i]; break; }
      lo = brackets[i].upTo;
    }
    return { rate: band.rate, upTo: band.upTo };
  }
  ypPayCalc.taxBandOf = taxBandOf;

  root.ypPayCalc = ypPayCalc;
  root.YP_PAYCALC_RATES = YP_PAYCALC_RATES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ypPayCalc;

  /* =====================================================================
   * Option C UI — compact card. Only runs in the browser.
   * ===================================================================== */
  if (typeof document === 'undefined') return;

  const FREQS = [
    { key: 'annually', label: 'Annually' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'fortnightly', label: 'Fortnightly' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'daily', label: 'Daily' }
  ];
  const PERIODS = FREQS.concat([{ key: 'hourly', label: 'Hourly' }]);
  const BAND_SCALE = 220000; /* tax-band bar: 0–$18,200–$45,000–$135,000–$190,000–$220,000 */
  const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l5 5 9-10"/></svg>';

  let state = null;

  function css() {
    if (document.getElementById('yp-paycalc-css')) return;
    const s = document.createElement('style');
    s.id = 'yp-paycalc-css';
    s.textContent = `
#yp-paycalc{position:fixed;top:0;left:0;right:0;width:100%;height:100dvh;max-height:100dvh;z-index:52;display:flex;align-items:center;justify-content:center;overflow:hidden;overscroll-behavior:none;touch-action:pan-y;padding:88px 12px 96px;box-sizing:border-box;background:rgba(11,37,69,.28)}
html.yp-home #yp-paycalc{background:rgba(11,37,69,.28)}
#yp-paycalc .card,#yp-paycalc .yp-listing{background:#fff;border-radius:24px;width:min(440px,100%);max-width:440px;padding:0 18px 12px;text-align:left;box-shadow:0 20px 50px rgba(0,0,0,.35);color:#14213d;display:flex!important;flex-direction:column!important;max-height:calc(100dvh - 184px);overflow:hidden!important;overscroll-behavior:none}
#yp-paycalc .yp-card-head{flex:none;position:relative;top:auto;margin:0 -18px 0;width:calc(100% + 36px);max-width:none}
#yp-paycalc .yp-pc-body{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding:8px 0 4px;scrollbar-width:none;-ms-overflow-style:none}
#yp-paycalc .yp-pc-body::-webkit-scrollbar{display:none;width:0;height:0}
#yp-paycalc .yp-pc-foot{flex:none;padding:8px 0 0;background:#fff;position:relative;z-index:2}
#yp-paycalc .yp-pc-done{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:0;border-radius:999px;background:#b8410a;color:#fff;font:700 17px Inter,system-ui,sans-serif;cursor:pointer;touch-action:manipulation;box-shadow:0 10px 22px rgba(184,65,10,.32)}
#yp-paycalc .yp-pc-done:focus-visible{outline:3px solid #0a3a8c;outline-offset:2px}
#yp-paycalc #yp-paycalc-setpay{margin-top:0;margin-bottom:8px}
#yp-paycalc .yp-pc-one{background:#f4f7fb;border:1px solid #dfe5ef;border-radius:18px;padding:10px;margin:0 0 8px}
#yp-paycalc .yp-pc-top{display:grid;grid-template-columns:1.15fr .85fr;gap:8px;margin:0 0 8px}
#yp-paycalc .yp-pc-field{margin:0 0 10px;min-width:0}
#yp-paycalc .yp-pc-top .yp-pc-field{margin:0}
#yp-paycalc .yp-pc-field label{display:block;font-size:13.5px;font-weight:700;margin:0 0 6px 2px;color:#14213d}
#yp-paycalc .yp-pc-ctl{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;min-height:44px;margin:0;padding:0 8px 0 10px;border:1.5px solid #dfe5ef;border-radius:16px;background:#fff;color:#14213d;font:650 12.5px/1.2 Inter,system-ui,sans-serif;letter-spacing:-.2px;text-align:left;cursor:pointer;touch-action:manipulation}
#yp-paycalc .yp-pc-ctl span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#yp-paycalc .yp-pc-ctl svg{width:18px;height:18px;color:#5a6780;flex:none}
#yp-paycalc .yp-pc-ctl.open{border-color:#1557c0;box-shadow:0 0 0 4px rgba(21,87,192,.15)}
#yp-paycalc .yp-pc-ctl.open svg{transform:rotate(180deg);color:#1557c0}
#yp-paycalc .yp-pc-hint{margin:-2px 2px 8px;font:500 13px/1.35 Inter,system-ui,sans-serif;color:#b8410a}
#yp-paycalc .yp-pc-toggle{display:flex;align-items:center;gap:12px;background:#fff;border:1.5px solid #dfe5ef;border-radius:16px;min-height:48px;padding:6px 10px 6px 14px;margin:0 0 8px;width:100%;text-align:left;cursor:pointer;color:#14213d;font:inherit}
#yp-paycalc .yp-pc-toggle .copy{flex:1;min-width:0}
#yp-paycalc .yp-pc-toggle strong{display:block;font-size:14.5px;font-weight:750}
#yp-paycalc .yp-pc-toggle .sub{display:block;font-size:11.5px;color:#b8410a;font-weight:500;line-height:1.3;margin-top:1px}
#yp-paycalc .yp-pc-sw{width:48px;height:28px;border-radius:999px;background:#cfd6e2;position:relative;flex:none}
#yp-paycalc .yp-pc-sw i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(11,37,69,.25);transition:left .15s ease}
#yp-paycalc .yp-pc-toggle.on .yp-pc-sw{background:#1557c0}
#yp-paycalc .yp-pc-toggle.on .yp-pc-sw i{left:23px}
#yp-paycalc .yp-pc-exact{margin:0 0 10px}
#yp-paycalc .yp-pc-payrow{display:grid;grid-template-columns:1fr 128px;gap:8px;align-items:end}
#yp-paycalc .yp-pc-payrow .yp-pc-field{margin:0}
#yp-paycalc .yp-pc-money{justify-content:flex-start;gap:0;padding-left:12px;background:#fff;min-height:46px}
#yp-paycalc .yp-pc-money .cur{color:#5a6780;font-weight:700;flex:none;margin-right:2px}
#yp-paycalc .yp-pc-money input{flex:1;min-width:0;border:0;background:transparent;font:750 16px/1.2 Inter,system-ui,sans-serif;color:#14213d;padding:0;margin:0;width:100%;font-variant-numeric:tabular-nums}
#yp-paycalc .yp-pc-money input:focus{outline:none}
#yp-paycalc .yp-pc-menu{margin-top:8px;background:#fff;border:1.5px solid #dfe5ef;border-radius:16px;box-shadow:0 14px 32px rgba(11,37,69,.18);padding:6px;list-style:none;max-height:240px;overflow-x:hidden;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch}
#yp-paycalc .yp-pc-menu::-webkit-scrollbar{display:none;width:0;height:0}
#yp-paycalc .yp-pc-menu button{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:40px;margin:0;padding:0 12px;border:0;border-radius:10px;background:transparent;font:650 15px Inter,system-ui,sans-serif;color:#14213d;text-align:left;cursor:pointer}
#yp-paycalc .yp-pc-menu button.on{background:#eef4ff;color:#1557c0;font-weight:800}
#yp-paycalc .yp-pc-menu button svg{width:18px;height:18px;color:#1557c0;flex:none}
#yp-paycalc .yp-pc-hours{margin-top:12px}
#yp-paycalc .yp-pc-hours .yp-pc-field{margin:0}
#yp-paycalc .yp-pc-tabs{display:grid;grid-template-columns:1fr 1fr;background:#fff;border:1.5px solid #dfe5ef;border-radius:999px;padding:3px;margin:0 0 8px}
#yp-paycalc .yp-pc-tabs button{appearance:none;-webkit-appearance:none;border:0;background:transparent;min-height:36px;border-radius:999px;font:750 13.5px Inter,system-ui,sans-serif;color:#5a6780;cursor:pointer}
#yp-paycalc .yp-pc-tabs button.on{background:#0a3a8c;color:#fff}
#yp-paycalc .yp-pc-sum{display:grid;grid-template-columns:100px 1fr;gap:4px 10px;align-items:center}
#yp-paycalc .yp-pc-donut{width:100px;height:100px;display:block}
#yp-paycalc .yp-pc-lines{min-width:0}
#yp-paycalc .yp-pc-line{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:4px 0}
#yp-paycalc .yp-pc-line + .yp-pc-line{border-top:1px solid #e3e9f2}
#yp-paycalc .yp-pc-line .lbl{font-size:13px;font-weight:600;min-width:0;line-height:1.25}
#yp-paycalc .yp-pc-line .amt{font-size:13.5px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums;letter-spacing:-.2px}
#yp-paycalc .yp-pc-line.tax .amt,#yp-paycalc .yp-pc-line.med .amt{color:#b8410a}
#yp-paycalc .yp-pc-line.super .amt{color:#1557c0}
#yp-paycalc .yp-pc-superhint{margin:2px 0 6px;font:500 12px/1.35 Inter,system-ui,sans-serif;color:#b8410a}
#yp-paycalc .yp-pc-take{margin-top:8px;padding-top:8px;border-top:1px solid #e3e9f2;display:flex;align-items:baseline;justify-content:space-between;gap:8px}
#yp-paycalc .yp-pc-take .lbl,#yp-paycalc .yp-pc-take .amt{color:#0a3a8c;font-weight:800}
#yp-paycalc .yp-pc-take .lbl{font-size:13.5px;line-height:1.25;min-width:0}
#yp-paycalc .yp-pc-take .amt{font-size:15px;white-space:nowrap;font-variant-numeric:tabular-nums;letter-spacing:-.2px}
#yp-paycalc .yp-pc-legend{display:flex;flex-wrap:wrap;gap:8px 12px;justify-content:center;margin:8px 0 0}
#yp-paycalc .yp-pc-legend i{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:650;color:#14213d;font-style:normal}
#yp-paycalc .yp-pc-legend i::before{content:"";width:9px;height:9px;border-radius:3px;background:currentColor}
#yp-paycalc .yp-pc-legend .p{color:#1557c0}
#yp-paycalc .yp-pc-legend .t{color:#b8410a}
#yp-paycalc .yp-pc-legend .m{color:#c46a28}
#yp-paycalc .yp-pc-bandbox h3{margin:0 0 2px;font-size:13.5px;font-weight:750;color:#14213d}
#yp-paycalc .yp-pc-band{position:relative;margin-top:6px;padding-top:26px}
#yp-paycalc .yp-pc-you{position:absolute;top:0;transform:translateX(-50%);font-size:11px;font-weight:800;color:#b8410a;white-space:nowrap;letter-spacing:-.15px;line-height:1}
#yp-paycalc .yp-pc-you::after{content:"";display:block;margin:3px auto 0;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #b8410a}
#yp-paycalc .yp-pc-track{display:flex;height:18px;border-radius:9px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(11,37,69,.08)}
#yp-paycalc .yp-pc-track i{display:flex;align-items:center;justify-content:center;min-width:0;font-style:normal}
#yp-paycalc .yp-pc-track i span{font-size:9px;font-weight:800;color:#fff;letter-spacing:.02em;text-shadow:0 1px 1px rgba(0,0,0,.25)}
#yp-paycalc .yp-pc-track .b0{background:#c5d3ea;flex:18200}
#yp-paycalc .yp-pc-track .b0 span{color:#1557c0;text-shadow:none}
#yp-paycalc .yp-pc-track .b15{background:#7fa6e8;flex:26800}
#yp-paycalc .yp-pc-track .b30{background:#1557c0;flex:90000}
#yp-paycalc .yp-pc-track .b37{background:#0a3a8c;flex:55000}
#yp-paycalc .yp-pc-track .b45{background:#0b2545;flex:30000}
#yp-paycalc .yp-pc-ticks{position:relative;height:32px;margin-top:4px}
#yp-paycalc .yp-pc-ticks span{position:absolute;transform:translateX(-50%);font-size:10px;font-weight:700;color:#5a6780;white-space:nowrap;letter-spacing:-.2px}
#yp-paycalc .yp-pc-ticks span:nth-child(odd){top:0}
#yp-paycalc .yp-pc-ticks span:nth-child(even){top:14px}
#yp-paycalc .yp-pc-footnote{margin:2px 2px 4px;font:500 12.5px/1.35 Inter,system-ui,sans-serif;color:#b8410a}
#yp-paycalc .yp-paycalc-link,button.yp-paycalc-link{appearance:none;-webkit-appearance:none;border:0;background:none;padding:0;margin:8px 0 0;color:#0a3a8c;font:700 14px/1.3 Inter,system-ui,sans-serif;cursor:pointer;text-decoration:underline}
`;
    document.head.appendChild(s);
  }

  function fmtMoney(n, hideCentsIfWhole) {
    const v = money(+n || 0);
    if (hideCentsIfWhole && Math.abs(v - Math.round(v)) < 0.005) {
      return '$' + Math.round(v).toLocaleString('en-AU');
    }
    return '$' + v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function rawPayAmount(s) {
    if (s == null || s === '') return '';
    let raw = String(s).replace(/[^\d.]/g, '');
    const dot = raw.indexOf('.');
    if (dot >= 0) raw = raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, '');
    return raw;
  }

  function fmtPayAmount(s) {
    const raw = rawPayAmount(s);
    if (raw === '') return '';
    const dot = raw.indexOf('.');
    let intPart = dot < 0 ? raw : raw.slice(0, dot);
    const decPart = dot < 0 ? null : raw.slice(dot + 1);
    intPart = intPart.replace(/^0+(?=\d)/, '');
    const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (dot < 0) return intFmt;
    return intFmt + '.' + decPart;
  }

  function parsePayAmount(s) {
    if (s == null || s === '') return NaN;
    const raw = rawPayAmount(s);
    if (raw === '' || raw === '.') return NaN;
    const n = +raw;
    return n;
  }

  function applyPayAmountInput(el) {
    const old = el.value;
    const start = el.selectionStart == null ? old.length : el.selectionStart;
    const keep = rawPayAmount(old.slice(0, start)).length;
    const formatted = fmtPayAmount(old);
    el.value = formatted;
    let pos = formatted.length;
    if (keep === 0) {
      pos = 0;
    } else {
      let count = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/[\d.]/.test(formatted[i])) {
          count++;
          if (count >= keep) { pos = i + 1; break; }
        }
      }
    }
    try { el.setSelectionRange(pos, pos); } catch (e) {}
    return rawPayAmount(formatted);
  }

  function bandList() {
    if (typeof PAY_BANDS !== 'undefined' && PAY_BANDS && PAY_BANDS.length) return PAY_BANDS;
    const out = [];
    for (let lo = 0; lo < 200000; lo += 5000) out.push([lo, lo + 5000]);
    return out;
  }

  function bandLabelOf(i) {
    const b = bandList()[i];
    return b ? ('$' + Number(b[0]).toLocaleString('en-AU') + '–$' + Number(b[1]).toLocaleString('en-AU')) : '';
  }

  function bandMidOf(i) {
    if (typeof bandMid === 'function') return bandMid(i);
    const b = bandList()[i];
    return b ? (b[0] + b[1]) / 2 : 0;
  }

  function playerBand() {
    const inc = (typeof INC === 'function' && INC()) || {};
    if (Number.isInteger(inc.band) && bandList()[inc.band]) return inc.band;
    if (typeof BAND_DEFAULT === 'number') return BAND_DEFAULT;
    if (typeof bandOf === 'function') return bandOf(75000);
    return 15;
  }

  function playerFreq() {
    const inc = (typeof INC === 'function' && INC()) || {};
    const v = String(inc.view || '').toLowerCase();
    if (v === 'monthly' || v === 'month') return 'monthly';
    if (v === 'fortnightly' || v === 'fortnight') return 'fortnightly';
    if (v === 'weekly' || v === 'week') return 'weekly';
    if (v === 'annually' || v === 'annual' || v === 'yearly') return 'annually';
    return 'weekly';
  }

  function amountLabel(period) {
    return ({
      annually: 'Yearly Pay',
      monthly: 'Monthly Pay',
      fortnightly: 'Fortnightly Pay',
      weekly: 'Weekly Pay',
      daily: 'Daily Pay',
      hourly: 'Hourly Rate'
    })[period] || 'Pay Amount';
  }

  function resultOf() {
    if (!state) return null;
    const includesSuper = !!state.includesSuper;
    if (state.exact) {
      const amt = parsePayAmount(state.amount);
      if (!isFinite(amt) || amt < 0) return ypPayCalc({ yearlyGross: 0, includesSuper });
      if (state.period === 'hourly') {
        const hours = isFinite(+state.hours) ? +state.hours : 38;
        return ypPayCalc({ hourlyRate: amt, hoursPerWeek: hours, includesSuper });
      }
      return ypPayCalc({ amount: amt, period: state.period, includesSuper });
    }
    return ypPayCalc({ yearlyGross: bandMidOf(state.band), includesSuper });
  }

  function sliceOf(r) {
    if (!r) return null;
    return r[state.freq] || r.weekly;
  }

  function closeMenus() {
    if (state) state.openMenu = null;
  }

  function shut() {
    const panel = document.getElementById('yp-paycalc');
    if (panel) panel.remove();
    state = null;
    if (typeof ypUseHome === 'function') ypUseHome();
  }

  function setOpenMenu(name) {
    if (!state) return;
    state.openMenu = state.openMenu === name ? null : name;
    paint();
  }

  function donutSvg(r) {
    const c = 2 * Math.PI * 40;
    const gross = Math.max(0, r && r.yearlyGross || 0);
    const take = Math.max(0, r && r.takeHome || 0);
    const tax = Math.max(0, r && r.incomeTax || 0);
    const med = Math.max(0, r && r.medicareLevy || 0);
    const part = (n) => gross > 0 ? (n / gross) * c : 0;
    const t = part(take), x = part(tax), m = part(med);
    return `<svg class="yp-pc-donut" viewBox="0 0 120 120" aria-hidden="true">
  <circle cx="60" cy="60" r="40" fill="none" stroke="#e6edf6" stroke-width="16"/>
  <circle cx="60" cy="60" r="40" fill="none" stroke="#1557c0" stroke-width="16" stroke-dasharray="${t.toFixed(3)} ${c.toFixed(3)}" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>
  <circle cx="60" cy="60" r="40" fill="none" stroke="#b8410a" stroke-width="16" stroke-dasharray="${x.toFixed(3)} ${c.toFixed(3)}" stroke-dashoffset="${(-t).toFixed(3)}" transform="rotate(-90 60 60)"/>
  <circle cx="60" cy="60" r="40" fill="none" stroke="#f0a060" stroke-width="16" stroke-dasharray="${m.toFixed(3)} ${c.toFixed(3)}" stroke-dashoffset="${(-(t + x)).toFixed(3)}" transform="rotate(-90 60 60)"/>
</svg>`;
  }

  function taxBandHtml(r) {
    const gross = r ? r.yearlyGross : 0;
    const pct = Math.max(0, Math.min(100, (gross / BAND_SCALE) * 100));
    const band = taxBandOf(gross, YP_PAYCALC_RATES);
    const ratePct = Math.round((band.rate || 0) * 100);
    const hint = ratePct === 0
      ? 'Your yearly pay sits in the tax-free threshold.'
      : 'Your yearly pay sits in the ' + ratePct + '% tax band.';
    const ticks = [
      { n: 18200, p: (18200 / BAND_SCALE) * 100 },
      { n: 45000, p: (45000 / BAND_SCALE) * 100 },
      { n: 135000, p: (135000 / BAND_SCALE) * 100 },
      { n: 190000, p: (190000 / BAND_SCALE) * 100 }
    ];
    return `<div class="yp-pc-bandbox" id="yp-pc-taxband">
      <h3>Tax Band</h3>
      <div class="yp-pc-band">
        <div class="yp-pc-you" id="yp-pc-you" style="left:${pct}%">You · ${fmtMoney(gross, true)}</div>
        <div class="yp-pc-track" aria-hidden="true">
          <i class="b0"></i>
          <i class="b15"><span>15%</span></i>
          <i class="b30"><span>30%</span></i>
          <i class="b37"><span>37%</span></i>
          <i class="b45"><span>45%</span></i>
        </div>
        <div class="yp-pc-ticks">${ticks.map(t => `<span style="left:${t.p}%">${fmtMoney(t.n, true)}</span>`).join('')}</div>
      </div>
      <p class="yp-pc-hint" id="yp-pc-bandhint" style="margin:8px 2px 0">${hint}</p>
    </div>`;
  }

  function menuHtml(kind, items, selected) {
    if (!state || state.openMenu !== kind) return '';
    return `<ul class="yp-pc-menu" role="listbox" id="yp-pc-menu-${kind}">${items.map(it => {
      const on = it.key === selected;
      return `<li><button type="button" role="option" class="${on ? 'on' : ''}" data-pc-pick="${kind}" data-pc-key="${it.key}" aria-selected="${on ? 'true' : 'false'}">${it.label}${on ? TICK : ''}</button></li>`;
    }).join('')}</ul>`;
  }

  function paint() {
    const body = document.getElementById('yp-pc-body');
    if (!body || !state) return;
    const r = resultOf();
    const sl = sliceOf(r) || { gross: 0, incomeTax: 0, medicareLevy: 0, employerSuper: 0, takeHome: 0 };
    const mid = bandMidOf(state.band);
    let hint;
    if (state.exact) {
      hint = 'Using your exact pay, not the middle of the band.';
    } else if (state.includesSuper) {
      hint = 'We use the middle of your band as a package: ' + fmtMoney(mid, true) + ' a year.';
    } else {
      hint = 'We use the middle of your band: ' + fmtMoney(mid, true) + ' a year.';
    }
    const bands = bandList().map((b, i) => ({ key: String(i), label: bandLabelOf(i) }));
    const freqLab = (FREQS.find(f => f.key === state.freq) || FREQS[3]).label;
    const perLab = (PERIODS.find(f => f.key === state.period) || PERIODS[0]).label;

    const exactFields = state.exact ? `
      <div class="yp-pc-exact" id="yp-pc-exact-fields">
        <div class="yp-pc-payrow">
          <div class="yp-pc-field">
            <label for="yp-pc-amt">${amountLabel(state.period)}</label>
            <div class="yp-pc-ctl yp-pc-money">
              <span class="cur">$</span>
              <input id="yp-pc-amt" inputmode="decimal" autocomplete="off" aria-label="${amountLabel(state.period)}" value="${fmtPayAmount(state.amount)}">
            </div>
          </div>
          <div class="yp-pc-field">
            <label for="yp-pc-period">Period</label>
            <button type="button" class="yp-pc-ctl${state.openMenu === 'period' ? ' open' : ''}" id="yp-pc-period" aria-haspopup="listbox" aria-expanded="${state.openMenu === 'period' ? 'true' : 'false'}" data-pc-menu="period"><span>${perLab}</span>${CHEVRON}</button>
          </div>
        </div>
        ${menuHtml('period', PERIODS, state.period)}
        ${state.period === 'hourly' ? `<div class="yp-pc-hours" id="yp-pc-hours">
          <div class="yp-pc-field">
            <label for="yp-pc-hours-in">Hours Per Week</label>
            <div class="yp-pc-ctl yp-pc-money">
              <input id="yp-pc-hours-in" inputmode="decimal" autocomplete="off" aria-label="Hours Per Week" value="${state.hours}">
            </div>
            <p class="yp-pc-hint" id="yp-pc-hours-hint" style="margin:8px 2px 0">Full-time is 38 hours.${r && r.yearlyGross != null ? ' That is ' + fmtMoney(state.includesSuper ? r.package : r.yearlyGross, true) + ' a year.' : ''}</p>
          </div>
        </div>` : ''}
      </div>` : '';

    const summary = `
      <div class="yp-pc-sum" id="yp-pc-summary">
        <div class="yp-pc-donutwrap">${donutSvg(r)}</div>
        <div class="yp-pc-lines">
          <div class="yp-pc-line"><span class="lbl">Gross Pay</span><span class="amt" id="yp-pc-gross">${fmtMoney(sl.gross)}</span></div>
          <div class="yp-pc-line tax"><span class="lbl">Income Tax</span><span class="amt" id="yp-pc-tax">${fmtMoney(sl.incomeTax)}</span></div>
          <div class="yp-pc-line med"><span class="lbl">Medicare</span><span class="amt" id="yp-pc-med">${fmtMoney(sl.medicareLevy)}</span></div>
          <div class="yp-pc-line super"><span class="lbl">Employer Super</span><span class="amt" id="yp-pc-super">${fmtMoney(sl.employerSuper)}</span></div>
        </div>
      </div>
      <p class="yp-pc-superhint" id="yp-pc-superhint">Paid on top of your pay. Super is not take-home.</p>
      <div class="yp-pc-take"><span class="lbl">Estimated Take-Home Pay</span><span class="amt" id="yp-pc-take">${fmtMoney(sl.takeHome)}</span></div>
      <div class="yp-pc-legend" aria-hidden="true"><i class="p">Pay</i><i class="t">Tax</i><i class="m">Medicare</i></div>`;

    body.innerHTML = `
      <div class="yp-pc-one">
        <div class="yp-pc-top">
          <div class="yp-pc-field">
            <label for="yp-pc-band">Yearly Income Band</label>
            <button type="button" class="yp-pc-ctl${state.openMenu === 'band' ? ' open' : ''}" id="yp-pc-band" aria-haspopup="listbox" aria-expanded="${state.openMenu === 'band' ? 'true' : 'false'}" data-pc-menu="band"><span>${bandLabelOf(state.band)}</span>${CHEVRON}</button>
          </div>
          <div class="yp-pc-field">
            <label for="yp-pc-freq">Pay Frequency</label>
            <button type="button" class="yp-pc-ctl${state.openMenu === 'freq' ? ' open' : ''}" id="yp-pc-freq" aria-haspopup="listbox" aria-expanded="${state.openMenu === 'freq' ? 'true' : 'false'}" data-pc-menu="freq"><span>${freqLab}</span>${CHEVRON}</button>
          </div>
        </div>
        ${state.openMenu === 'band' ? menuHtml('band', bands, String(state.band)) : ''}
        ${state.openMenu === 'freq' ? menuHtml('freq', FREQS, state.freq) : ''}
        <p class="yp-pc-hint" id="yp-pc-midhint">${hint}</p>
        <button type="button" class="yp-pc-toggle${state.exact ? ' on' : ''}" id="yp-pc-exact" role="switch" aria-checked="${state.exact ? 'true' : 'false'}" aria-label="Use Exact Pay" data-pc-toggle="exact">
          <div class="copy"><strong>Use Exact Pay</strong><span class="sub">Optional. Type an exact amount.</span></div>
          <div class="yp-pc-sw" aria-hidden="true"><i></i></div>
        </button>
        ${exactFields}
        <button type="button" class="yp-pc-toggle${state.includesSuper ? ' on' : ''}" id="yp-pc-insuper" role="switch" aria-checked="${state.includesSuper ? 'true' : 'false'}" aria-label="Pay Includes Super" data-pc-toggle="includesSuper">
          <div class="copy"><strong>Pay Includes Super</strong><span class="sub">The amount is a package. Super is not take-home.</span></div>
          <div class="yp-pc-sw" aria-hidden="true"><i></i></div>
        </button>
        <div class="yp-pc-tabs" role="tablist">
          <button type="button" role="tab" class="${state.tab === 'summary' ? 'on' : ''}" id="yp-pc-tab-summary" aria-selected="${state.tab === 'summary' ? 'true' : 'false'}" data-pc-tab="summary">Summary</button>
          <button type="button" role="tab" class="${state.tab === 'tax' ? 'on' : ''}" id="yp-pc-tab-tax" aria-selected="${state.tab === 'tax' ? 'true' : 'false'}" data-pc-tab="tax">Tax Band</button>
        </div>
        ${state.tab === 'summary' ? summary : taxBandHtml(r)}
      </div>
      <p class="yp-pc-footnote" id="yp-pc-footnote">This is an estimate for the 2026–27 tax year. It does not include tax offsets or extra deductions.</p>`;

    const amt = document.getElementById('yp-pc-amt');
    if (amt) {
      amt.addEventListener('input', ev => {
        state.amount = applyPayAmountInput(ev.target);
        /* Update figures without rebuilding the focused field. */
        refreshFigures();
      });
    }
    const hrs = document.getElementById('yp-pc-hours-in');
    if (hrs) {
      hrs.addEventListener('input', ev => {
        state.hours = ev.target.value;
        refreshFigures();
      });
    }
    /* Keep a long band list scrolled to the selected row. */
    const bandMenu = document.getElementById('yp-pc-menu-band');
    if (bandMenu) {
      const on = bandMenu.querySelector('button.on');
      if (on) on.scrollIntoView({ block: 'center' });
    }
  }

  function refreshFigures() {
    const r = resultOf();
    const sl = sliceOf(r) || { gross: 0, incomeTax: 0, medicareLevy: 0, employerSuper: 0, takeHome: 0 };
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('yp-pc-super', fmtMoney(sl.employerSuper));
    set('yp-pc-gross', fmtMoney(sl.gross));
    set('yp-pc-tax', fmtMoney(sl.incomeTax));
    set('yp-pc-med', fmtMoney(sl.medicareLevy));
    set('yp-pc-take', fmtMoney(sl.takeHome));
    const wrap = document.querySelector('#yp-paycalc .yp-pc-donutwrap');
    if (wrap) wrap.innerHTML = donutSvg(r);
    const hh = document.getElementById('yp-pc-hours-hint');
    if (hh && r) hh.textContent = 'Full-time is 38 hours. That is ' + fmtMoney(state.includesSuper ? r.package : r.yearlyGross, true) + ' a year.';
    const you = document.getElementById('yp-pc-you');
    if (you && r) {
      const pct = Math.max(0, Math.min(100, (r.yearlyGross / BAND_SCALE) * 100));
      you.style.left = pct + '%';
      you.textContent = 'You · ' + fmtMoney(r.yearlyGross, true);
    }
  }

  function onClick(ev) {
    const t = ev.target.closest('[data-pc-menu],[data-pc-pick],[data-pc-toggle],[data-pc-tab],#yp-pc-done,#yp-paycalc-x,#yp-paycalc-done');
    if (!t || !state) return;
    if (t.id === 'yp-pc-done' || t.id === 'yp-paycalc-done' || t.id === 'yp-paycalc-x') { ev.preventDefault(); shut(); return; }
    if (t.getAttribute('data-pc-menu')) { ev.preventDefault(); setOpenMenu(t.getAttribute('data-pc-menu')); return; }
    if (t.getAttribute('data-pc-pick')) {
      ev.preventDefault();
      const kind = t.getAttribute('data-pc-pick');
      const key = t.getAttribute('data-pc-key');
      if (kind === 'band') state.band = +key;
      if (kind === 'freq') state.freq = key;
      if (kind === 'period') state.period = key;
      state.openMenu = null;
      paint();
      return;
    }
    if (t.getAttribute('data-pc-toggle')) {
      ev.preventDefault();
      const which = t.getAttribute('data-pc-toggle');
      if (which === 'exact') {
        state.exact = !state.exact;
        if (state.exact && (state.amount === '' || state.amount == null)) {
          /* Prefill the band mid as a yearly amount so the figures stay put. */
          state.period = 'annually';
          state.amount = String(bandMidOf(state.band));
          if (state.hours === '' || state.hours == null) state.hours = 38;
        }
      } else if (which === 'includesSuper') {
        state.includesSuper = !state.includesSuper;
      }
      closeMenus();
      paint();
      return;
    }
    if (t.getAttribute('data-pc-tab')) {
      ev.preventDefault();
      state.tab = t.getAttribute('data-pc-tab');
      closeMenus();
      paint();
    }
  }

  function ypPayCalcOpen() {
    css();
    if (typeof ypExclusive === 'function') ypExclusive('yp-paycalc');
    if (typeof ypUseHome === 'function') ypUseHome();
    document.getElementById('yp-paycalc')?.remove();
    state = {
      band: playerBand(),
      freq: playerFreq(),
      exact: false,
      includesSuper: false,
      period: 'annually',
      amount: '',
      hours: 38,
      tab: 'summary',
      openMenu: null
    };
    const panel = document.createElement('div');
    panel.id = 'yp-paycalc';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'yp-paycalc-title');
    const card = document.createElement('div');
    card.className = 'card yp-listing';
    if (typeof ypCardHeader === 'function') {
      card.appendChild(ypCardHeader({ title: 'Pay Calculator', titleId: 'yp-paycalc-title', id: 'yp-paycalc-x', onClose: shut }));
    } else {
      const h = document.createElement('h2');
      h.id = 'yp-paycalc-title';
      h.textContent = 'Pay Calculator';
      card.appendChild(h);
    }
    const body = document.createElement('div');
    body.className = 'yp-pc-body';
    body.id = 'yp-pc-body';
    card.appendChild(body);
    const foot = document.createElement('div');
    foot.className = 'yp-pc-foot';
    const setPay = document.createElement('button');
    setPay.type = 'button';
    setPay.className = 'btn sec';
    setPay.id = 'yp-paycalc-setpay';
    setPay.textContent = 'Set Pay';
    setPay.addEventListener('click', ev => { ev.preventDefault(); ypPayCalcSetPay(); });
    foot.appendChild(setPay);
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'yp-pc-done';
    done.id = 'yp-paycalc-done';
    done.textContent = 'Done';
    done.addEventListener('click', ev => { ev.preventDefault(); shut(); });
    foot.appendChild(done);
    card.appendChild(foot);
    panel.appendChild(card);
    panel.addEventListener('click', ev => {
      if (ev.target === panel) { shut(); return; }
      onClick(ev);
    });
    if (document.getElementById('flow')) panel.style.zIndex = '10050';
    document.body.appendChild(panel);
    paint();
    return panel;
  }


  function ypPayCalcBandIndex(yearlyGross) {
    const g = Math.max(0, +yearlyGross || 0);
    if (typeof bandOf === 'function') return bandOf(g);
    const bands = (typeof PAY_BANDS !== 'undefined' && PAY_BANDS) || [];
    for (let i = bands.length - 1; i >= 0; i--) if (g >= bands[i][0]) return i;
    return 0;
  }
  function ypPayCalcApplyToIncome(yearlyGross, freq) {
    const idx = ypPayCalcBandIndex(yearlyGross);
    const fr = document.getElementById('flowframe');
    const doc = fr && (fr.contentDocument || (fr.contentWindow && fr.contentWindow.document));
    const win = fr && fr.contentWindow;
    const onboarding = !!(doc && doc.getElementById('band') && (doc.getElementById('f-income') || doc.getElementById('s-income') || doc.getElementById('h-income')));
    if (onboarding) {
      const sel = doc.getElementById('band');
      if (sel && idx != null) {
        sel.value = String(idx);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const fmap = { weekly: 'week', fortnightly: 'fortnight', monthly: 'month' };
      if (win && win.P && win.P.income && fmap[freq]) {
        win.P.income.freq = fmap[freq];
        if (typeof win.renderIncome === 'function') win.renderIncome();
      }
      return;
    }
    const sel = document.getElementById('inc_band');
    if (sel && idx != null) {
      sel.value = String(idx);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof incLive === 'function') incLive();
    }
    if (typeof G !== 'undefined' && G && G.income && typeof G.income === 'object' && idx != null) {
      G.income.band = idx;
      if (typeof bandMid === 'function') G.income.amt = bandMid(idx);
      if (freq === 'weekly' || freq === 'fortnightly' || freq === 'monthly') G.income.view = freq;
      if (typeof save === 'function') save();
      if (typeof hud === 'function') hud();
      if (typeof incLive === 'function' && document.getElementById('inc_band')) incLive();
    }
  }
  function ypPayCalcSetPay() {
    if (!state) return;
    if (state.exact) {
      const amt = parsePayAmount(state.amount);
      if (!isFinite(amt) || amt < 0) return;
    }
    const r = resultOf();
    const yearly = r && (r.yearlyGross != null ? r.yearlyGross : 0);
    const freq = state.freq;
    shut();
    ypPayCalcApplyToIncome(yearly, freq);
  }

  root.ypPayCalcSetPay = ypPayCalcSetPay;
  root.ypPayCalcApplyToIncome = ypPayCalcApplyToIncome;
  root.ypPayCalcOpen = ypPayCalcOpen;
  root.ypOpenPayCalc = ypPayCalcOpen;
  root.ypPayCalcClose = shut;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', css);
  else css();
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
