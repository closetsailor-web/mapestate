/* Shared Real Life Income form styles and take-home summary markup.
 * Used by the in-game Real Life Income modal so it matches the
 * start-of-game Choose Your Income step. Figures come from ypPayCalc. */
(function (root) {
  'use strict';

  const CSS = `
/* Shared Choose Your Income / Real Life Income fields.
   Tokens and rules are the start-of-game form's, scoped to .inc-fields so
   both screens stay identical and in-game sheet styles cannot leak. */
.inc-fields{
  --blue:#0a3a8c;--blue2:#1557c0;--navy:#0b2545;--txt:#14213d;--mute:#5a6780;
  --line:#dfe5ef;--field:#f4f7fb;--err:#b45618;
  font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  color:var(--txt);
  -webkit-font-smoothing:antialiased;
}
/* Same heading as start-of-game Choose Your Income (.sheet h2 + margin-bottom:16px). */
.inc-fields > h2,
.inc-fields #h-income{
  margin:0 0 4px;font-size:24px;font-weight:700;line-height:normal;
  font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  text-align:center;letter-spacing:-.4px;color:#14213d;
}
.inc-fields .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.inc-fields .field{margin-bottom:14px}
.inc-fields .inc-k{margin:0 0 6px;font:700 13px/1.3 Inter,system-ui,sans-serif;color:#3d4a63;text-align:center;letter-spacing:.02em}
.inc-fields .msg{font-size:13px;margin:6px 4px 0;color:var(--mute);min-height:0;font-weight:400;text-align:left}
.inc-fields .field.bad .msg{color:var(--err);font-weight:600}
.inc-fields .selw{position:relative}
.inc-fields .selw::after,
.inc-fields #inc_pay_wrap::after{content:"";position:absolute;right:20px;top:28px;width:10px;height:10px;border-right:2.5px solid var(--blue);border-bottom:2.5px solid var(--blue);transform:translateY(-50%) rotate(45deg);pointer-events:none}
.inc-fields .selw select{width:100%;min-height:56px;-webkit-appearance:none;appearance:none;border:1.5px solid var(--line);border-radius:16px;background:var(--field);padding:0 48px 0 18px;font:600 17px Inter,system-ui,sans-serif;color:var(--txt);cursor:pointer}
.inc-fields .selw select:invalid,
.inc-fields .selw select.ph{color:#8a95a8;font-weight:500}
.inc-fields .selw select:focus{outline:none;border-color:var(--blue2);box-shadow:0 0 0 4px rgba(21,87,192,.15);background:#fff}
.inc-fields .selw select.band-native{position:absolute!important;width:1px!important;height:1px!important;min-height:0!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap;border:0!important;pointer-events:none!important}
.inc-fields .band-btn,
.inc-fields #inc_pay_btn{display:flex;align-items:center;width:100%;min-height:56px;height:auto;border:1.5px solid var(--line);border-radius:16px;background:var(--field);padding:0 48px 0 18px;font:600 17px Inter,system-ui,sans-serif;color:var(--txt);text-align:left;cursor:pointer;box-sizing:border-box;box-shadow:none}
.inc-fields .band-btn.ph,
.inc-fields #inc_pay_btn.ph{color:#8a95a8;font-weight:500}
.inc-fields .band-btn:focus,
.inc-fields .band-btn:focus-visible,
.inc-fields #inc_pay_btn:focus,
.inc-fields #inc_pay_btn:focus-visible{outline:none;border-color:var(--blue2);box-shadow:0 0 0 4px rgba(21,87,192,.15);background:#fff}
.inc-fields .band-list,
.inc-fields #inc_pay_list{position:absolute;left:0;right:0;top:62px;z-index:40;max-height:min(300px,57.5vh);overflow:auto;background:#fff;border:1.5px solid var(--line);border-radius:16px;box-shadow:0 16px 40px rgba(11,37,69,.18);padding:6px}
.inc-fields .band-opt{display:flex;align-items:center;width:100%;min-height:44px;border:0;border-radius:12px;background:#fff;color:var(--txt);text-align:left;padding:8px 14px;font:600 16px Inter,system-ui,sans-serif;cursor:pointer}
.inc-fields .band-opt.on,
.inc-fields .band-opt:focus,
.inc-fields .band-opt:focus-visible,
.inc-fields .band-opt[aria-selected=true]{background:#e7f0ff;color:var(--blue);outline:none}
.inc-fields .pay-opt,
.inc-fields #inc_pay_list .pay-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:44px;border:0;border-radius:12px;background:#fff;color:var(--txt);text-align:left;padding:8px 14px;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}
.inc-fields .pay-opt .pw,
.inc-fields #inc_pay_list .pay-opt .pw{flex:none;font:700 15px Inter,system-ui,sans-serif;color:var(--blue)}
.inc-fields .pay-opt.on,
.inc-fields .pay-opt[aria-selected=true],
.inc-fields #inc_pay_list .pay-opt.on,
.inc-fields #inc_pay_list .pay-opt[aria-selected=true]{background:#e7f0ff;color:var(--blue)}
.inc-fields .ctl{position:relative;display:flex;align-items:center;background:var(--field);border:1.5px solid var(--line);border-radius:16px;min-height:54px;transition:border-color .2s,box-shadow .2s;box-sizing:border-box}
.inc-fields .ctl:focus-within{border-color:var(--blue2);box-shadow:0 0 0 4px rgba(21,87,192,.15);background:#fff}
.inc-fields .ctl.money .cur{margin:0 6px 0 16px;font-weight:700;color:var(--mute);flex:none}
.inc-fields .ctl input,
.inc-fields .ctl input[type=text],
.inc-fields .ctl input[type=number]{
  flex:1!important;min-width:0!important;width:auto!important;height:auto!important;min-height:0!important;
  border:0!important;border-radius:0!important;background:none!important;background-color:transparent!important;
  box-shadow:none!important;outline:none!important;
  font:400 16px Inter,system-ui,sans-serif!important;color:var(--txt)!important;
  padding:14px 14px 14px 0!important;margin:0!important;
  -webkit-appearance:none!important;appearance:none!important;box-sizing:border-box!important;
}
.inc-fields .ctl input::placeholder{color:#8a95a8;font-weight:400}
.inc-fields .ctl input:focus-visible{outline:none}
.inc-fields .field.bad .ctl{border-color:var(--err);background:#fff6f5}
.inc-fields .seg{display:grid;grid-template-columns:repeat(3,1fr);background:var(--field);border:1.5px solid var(--line);border-radius:999px;padding:4px;margin:0 0 16px;gap:0}
.inc-fields .seg button{flex:none;min-height:44px;border:0;border-radius:999px;background:none;font-weight:600;font-size:15px;font-family:inherit;color:var(--mute);cursor:pointer;box-shadow:none;padding:0;white-space:nowrap}
.inc-fields .seg button[aria-checked=true],
.inc-fields .seg button.on{background:var(--blue);color:#fff;box-shadow:0 4px 10px rgba(10,58,140,.25)}
.inc-fields .conv,
.inc-fields #inc_conv,
.inc-fields #inc-conv{background:var(--field);border-radius:14px;padding:10px 14px;font-size:13.5px;font-weight:400;color:var(--mute);line-height:1.6;margin:-4px 0 16px}
.inc-fields .conv b,
.inc-fields #inc_conv b,
.inc-fields #inc-conv b{color:var(--txt);font-weight:700}
.inc-fields .pay-head,
.inc-fields #inc_pay_list .pay-head{padding:10px 14px 4px;font:700 12px Inter,system-ui,sans-serif;color:var(--mute);text-align:left}
.inc-fields #inc_pay_amts .inc-pay-amt{margin:8px 0 4px}
.inc-fields #inc_pay_amts .inc-pay-amt .money13{margin-top:4px}
/* Host sheet layout only (not field styles): give .inc-fields the same
   24px inset / 390px-phone width as the start-of-game .sheet. */
#sheet.yp-income-sheet{width:100%;max-width:none}
#sheet.yp-income-sheet #sheetBody{padding:28px 24px 24px}
.inc-fields .reveal{animation:none}
.inc-fields .yp-paycalc-link,button.yp-paycalc-link{appearance:none;-webkit-appearance:none;border:0;background:none;padding:0;margin:8px 0 16px;color:#0a3a8c;font:700 14px/1.3 Inter,system-ui,sans-serif;cursor:pointer;text-decoration:underline;display:block;width:100%;text-align:center}
`;

  function injectCss() {
    if (document.getElementById('yp-income-form-css')) return;
    const s = document.createElement('style');
    s.id = 'yp-income-form-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function dollars(n) { return Math.round(Math.abs(+n || 0)); }

  /* Real-life yearly gross is always the MIDDLE of the chosen band.
     Exact pay lives only in the Pay Calculator and must not feed other screens. */
  function bandGross(inc) {
    inc = inc || (typeof INC === 'function' && INC()) || {};
    if (!Number.isInteger(inc.band)) return 0;
    if (typeof bandMid === 'function') return Math.max(0, +bandMid(inc.band) || 0);
    const bands = (typeof PAY_BANDS !== 'undefined' && PAY_BANDS) || [];
    const b = bands[inc.band];
    return b ? (b[0] + b[1]) / 2 : 0;
  }

  function figures(yearlyGross) {
    const empty = { weekly: 0, fortnightly: 0, monthly: 0, yearly: 0, calc: null };
    if (typeof ypPayCalc !== 'function') return empty;
    const c = ypPayCalc({ yearlyGross: Math.max(0, +yearlyGross || 0) });
    if (!c) return empty;
    return {
      weekly: dollars(c.weekly.takeHome),
      fortnightly: dollars(c.fortnightly.takeHome),
      monthly: dollars(c.monthly.takeHome),
      yearly: dollars(c.takeHome),
      calc: c
    };
  }

  const VIEW_ALIAS = { week: 'weekly', fortnight: 'fortnightly', month: 'monthly', year: 'yearly', annually: 'yearly', annual: 'yearly' };
  const VIEW_LBL = { weekly: 'a week', fortnightly: 'a fortnight', monthly: 'a month' };

  function moneyText(n) {
    if (typeof fmt === 'function') return fmt(n);
    return '$' + dollars(n).toLocaleString('en-AU');
  }

  function convHTML(yearlyGross, view, opts) {
    opts = opts || {};
    const F = figures(yearlyGross);
    const v = VIEW_ALIAS[view] || view || 'weekly';
    const midNote = opts.midNote ? ' (the middle of your band)' : '';
    const gross = Math.max(0, +yearlyGross || 0);
    const others = ['weekly', 'fortnightly', 'monthly'].filter(k => k !== v)
      .map(k => moneyText(F[k]) + ' ' + VIEW_LBL[k]).join(' · ');
    const extra = opts.extraHTML ? opts.extraHTML : '';
    return 'Your take-home pay is about <b id="inc_per" data-yp-th="' + v + '" data-yp-th-weekly="' + F.weekly + '" data-yp-th-fortnightly="' + F.fortnightly + '" data-yp-th-monthly="' + F.monthly + '" data-yp-th-yearly="' + F.yearly + '">' + moneyText(F[v] || 0) + ' ' + (VIEW_LBL[v] || '') + '</b><br>' +
      others + ' · ' + moneyText(F.yearly) + ' a year<br><small>This is what lands in your account after tax and Medicare. Pay before tax: ' + moneyText(gross) + ' a year' + midNote + '.</small>' + extra;
  }

  /* Push the shared engine into the start-of-game iframe so Choose Your Income
     and the in-game modal cannot drift. */
  function shareCalc(win) {
    if (!win) return;
    try {
      const doc = win.document;
      if (doc && !doc.getElementById('yp-income-form-css')) {
        const s = doc.createElement('style');
        s.id = 'yp-income-form-css';
        s.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(s);
      }
    } catch (e) {}
    if (typeof ypPayCalc === 'function') win.ypPayCalc = ypPayCalc;
    win.ypRealBandGross = bandGross;
    win.ypIncomeFigures = figures;
    win.netYear = function (g) { return figures(g).yearly; };
    win.bandIncome = function (band, f) {
      if (!band) return 0;
      const mid = band.mid != null ? +band.mid : ((+band.min || 0) + (+band.max || 0)) / 2;
      const F = figures(mid);
      const key = VIEW_ALIAS[f] || f;
      return F[key] || 0;
    };
  }


  function fieldsHTML(opts) {
    opts = opts || {};
    const band = opts.band;
    const view = opts.view || 'weekly';
    const cs = opts.childSupport;
    const bands = opts.bands || (typeof PAY_BANDS !== 'undefined' ? PAY_BANDS : []);
    const labelOf = opts.bandLabel || (typeof bandLabel === 'function' ? bandLabel : (k => {
      const b = bands[k];
      return b ? ('$' + b[0].toLocaleString() + ' – $' + b[1].toLocaleString()) : '';
    }));
    const optsHtml = bands.map((b, k) => '<option value="' + k + '"' + (k === band ? ' selected' : '') + '>' + labelOf(k) + '</option>').join('');
    const csVal = cs ? (Math.round(cs * 100) / 100) : '';
    const seg = ['weekly', 'fortnightly', 'monthly'].map(k =>
      '<button type="button" role="radio" data-v="' + k + '" aria-checked="' + (k === view ? 'true' : 'false') + '" onclick="incView(\'' + k + '\')">' + (k[0].toUpperCase() + k.slice(1)) + '</button>'
    ).join('');
    const title = opts.title ? ('<h2 id="h-income" style="margin-bottom:16px">' + opts.title + '</h2>') : '';
    return (
      '<div class="inc-fields">' + title +
      '<div class="field" id="fd-band"><div class="inc-k" id="h-band">Yearly Pay</div><label for="inc_band" class="sr">Yearly Pay Before Tax</label>' +
      '<div class="selw"><select id="inc_band" aria-describedby="inc_m_band" onchange="incLive()">' + optsHtml + '</select></div>' +
      '<p class="msg" id="inc_m_band">Pick the band your yearly pay (before tax) falls in. We then work out your take-home pay.</p></div>' +
      '<div class="field" id="fd-pay"><div class="inc-k" id="h-pay">Payments and Other Income</div>' +
      '<label for="inc_pay_btn" class="sr">Payments and other income</label>' +
      '<div class="selw" id="inc_pay_wrap"></div>' +
      '<p class="msg" id="inc_m_pay">Pick any payments or other money you receive. Amounts are a week.</p>' +
      '<div id="inc_pay_amts"></div></div>' +
      '<div class="field" id="fd-cs"><div class="inc-k" id="h-cs">Child Support Received</div>' +
      '<label for="inc_cs" class="sr">Child Support Received</label>' +
      '<div class="ctl money"><span class="cur">$</span><input id="inc_cs" inputmode="decimal" placeholder="0" value="' + csVal + '" aria-describedby="inc_m_cs" oninput="incLive()"></div>' +
      '<p class="msg" id="inc_m_cs">Type the amount you get each week. Leave blank if none.</p></div>' +
      '<div class="reveal" id="inc-more">' +
      '<div class="seg" id="inc_view" role="radiogroup" aria-label="Show pay per">' + seg + '</div>' +
      '<div class="conv" id="inc_conv" aria-live="polite"></div>' +
      '</div></div>'
    );
  }

  function mountBand(sel) {
    if (!sel || !sel.parentElement || sel.dataset.ypBandMounted) return;
    const wrap = sel.parentElement;
    sel.classList.add('band-native');
    sel.setAttribute('aria-hidden', 'true');
    sel.tabIndex = -1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'inc_band_btn';
    btn.className = 'band-btn ph';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'inc_band_list');
    btn.setAttribute('aria-describedby', 'inc_m_band');
    btn.setAttribute('aria-label', 'Yearly Pay');
    const list = document.createElement('div');
    list.id = 'inc_band_list';
    list.className = 'band-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Yearly Pay');
    list.hidden = true;
    wrap.append(btn, list);
    sel.dataset.ypBandMounted = '1';
    let active = -1;
    const opts = () => [...sel.options].filter(o => o.value !== '');
    const chosen = () => sel.value !== '' && sel.selectedIndex >= 0 && !sel.options[sel.selectedIndex].disabled;
    function paint() {
      btn.textContent = chosen() ? sel.selectedOptions[0].textContent : 'Select your income';
      btn.classList.toggle('ph', !chosen());
      list.replaceChildren();
      opts().forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'band-opt';
        b.id = 'inc_band_opt_' + o.value;
        b.dataset.value = o.value;
        b.textContent = o.textContent;
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', sel.value === o.value ? 'true' : 'false');
        b.tabIndex = -1;
        b.addEventListener('click', () => choose(o.value));
        list.appendChild(b);
      });
    }
    function mark() {
      [...list.children].forEach((el, i) => {
        el.classList.toggle('on', i === active);
        el.tabIndex = i === active ? 0 : -1;
      });
      if (list.children[active]) btn.setAttribute('aria-activedescendant', list.children[active].id);
    }
    function openList(focus) {
      paint();
      list.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      const cur = opts().findIndex(o => o.value === sel.value);
      active = cur >= 0 ? cur : 0;
      mark();
      if (focus && list.children[active]) list.children[active].focus();
    }
    function closeList(back) {
      list.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.removeAttribute('aria-activedescendant');
      active = -1;
      if (back) btn.focus();
    }
    function choose(value) {
      sel.value = String(value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      paint();
      closeList(true);
    }
    btn.addEventListener('click', () => list.hidden ? openList(true) : closeList(true));
    document.addEventListener('pointerdown', e => { if (!wrap.contains(e.target)) closeList(false); });
    sel.addEventListener('change', paint);
    paint();
  }

  injectCss();

  if (typeof ypPayCalc === 'function') {
    ypPayCalc.figures = figures;
    ypPayCalc.convHTML = convHTML;
  }
  root.ypRealBandGross = bandGross;
  root.ypIncomeFigures = figures;
  root.ypIncomeConvHTML = convHTML;
  root.ypIncomeFieldsHTML = fieldsHTML;
  root.ypIncomeMountBand = mountBand;
  root.ypFlowShareCalc = shareCalc;
})(typeof window !== 'undefined' ? window : this);
