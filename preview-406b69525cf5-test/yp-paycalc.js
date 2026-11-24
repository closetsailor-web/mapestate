/* Pay Calculator — calculation engine only (no UI).
 *
 * Australian resident income tax and Medicare levy for a full year,
 * then split across Annually, Monthly, Fortnightly, Weekly and Daily.
 *
 * Update YP_PAYCALC_RATES each 1 July from the ATO pages linked below.
 * This module is standalone. The game still uses its own 2025–26 helpers
 * (incomeTax, lito, taxNet, medicare, netIncome in index.html). The plan
 * is for this engine to become the single shared source later.
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
   *   shade-in at 10c per $1 above $28,011; full 2% above $35,013
   *   ($35,013 = $28,011 × 1.25). ATO example: $29,000 → $98.90 levy
   *   (10% × ($29,000 − $28,011)). The page still introduces the table
   *   under 2025–26 wording (updated 30 June 2026); 2026–27 professional
   *   summaries as at 1 July 2026 use the same single-taxpayer thresholds.
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
      /* Single taxpayer, not entitled to SAPTO. */
      lowIncomeLower: 28011,
      lowIncomeUpper: 35013,
      shadeInRate: 0.10
    },
    weeksPerYear: 52,
    fortnightsPerYear: 26,
    monthsPerYear: 12,
    workDaysPerYear: 260
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

  function periodSlice(yearly, divisor) {
    const d = divisor || 1;
    return {
      gross: money(yearly.gross / d),
      incomeTax: money(yearly.incomeTax / d),
      medicareLevy: money(yearly.medicareLevy / d),
      takeHome: money(yearly.takeHome / d)
    };
  }

  function yearlyGrossFrom(input) {
    input = input || {};
    if (input.yearlyGross != null && input.yearlyGross !== '') {
      const y = +input.yearlyGross;
      if (!isFinite(y) || y < 0) return null;
      return y;
    }
    const rate = +input.hourlyRate;
    const hours = +input.hoursPerWeek;
    if (!isFinite(rate) || !isFinite(hours) || rate < 0 || hours < 0) return null;
    const weeks = (input.weeksPerYear != null) ? +input.weeksPerYear : YP_PAYCALC_RATES.weeksPerYear;
    if (!isFinite(weeks) || weeks <= 0) return null;
    return rate * hours * weeks;
  }

  /**
   * Estimate Australian resident tax and take-home pay.
   *
   * @param {{yearlyGross?: number, hourlyRate?: number, hoursPerWeek?: number, weeksPerYear?: number}} input
   *   Pass yearlyGross, or hourlyRate plus hoursPerWeek (× 52 weeks, unless weeksPerYear is set).
   * @returns {object|null} Yearly totals plus Annually, Monthly, Fortnightly, Weekly and Daily slices, or null if the input is invalid.
   */
  function ypPayCalc(input) {
    const rates = YP_PAYCALC_RATES;
    const gross = yearlyGrossFrom(input);
    if (gross == null) return null;
    const yearlyGross = money(gross);
    const tax = incomeTax(yearlyGross, rates);
    const levy = medicareLevy(yearlyGross, rates);
    const take = money(yearlyGross - tax - levy);
    const yearly = { gross: yearlyGross, incomeTax: tax, medicareLevy: levy, takeHome: take };
    return {
      year: rates.year,
      yearlyGross: yearly.gross,
      incomeTax: yearly.incomeTax,
      medicareLevy: yearly.medicareLevy,
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

  root.ypPayCalc = ypPayCalc;
  root.YP_PAYCALC_RATES = YP_PAYCALC_RATES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ypPayCalc;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
