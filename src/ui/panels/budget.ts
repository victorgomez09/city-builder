/**
 * Open Skylines — UI Budget Panel
 */

import { U } from '@/core/utils';
import { Sim } from '@/sim/sim';
import { head, bindClose, sv, q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';
import { LoanRecord } from '@/types';

export function renderLoans(p: HTMLElement): void {
  const S = Sim;
  const L = q<HTMLElement>('#loanList', p);
  if (!L) return;
  L.innerHTML =
    S.loans
      .map(
        (l: LoanRecord, k: number) =>
          `<div class="row"><span>${U.money(l.amount)} · ${l.left} months left · ${U.money(l.payment)}/mo</span><button class="btn" data-repay="${k}">Repay ${U.money(l.payment * l.left)}</button></div>`
      )
      .join('') || '<div class="sub">No loans.</div>';

  $$<HTMLElement>('[data-repay]', L).forEach(b => {
    b.onclick = () => {
      if (!S.repayLoan(+b.dataset.repay!)) {
        UI.toast('Not enough money to repay this loan.', 'bad');
      }
      renderLoans(p);
    };
  });
}

export function updBudget(p: HTMLElement): void {
  const S = Sim,
    B = S.budget,
    L = S.last;
  let ti = 0,
    te = 0,
    li = 0,
    le = 0;
  for (const k in B.inc) {
    sv(p, 'ti_' + k, U.money(B.inc[k]));
    sv(p, 'li_' + k, S.month ? U.money(L.inc[k]) : '–');
    ti += B.inc[k];
    li += L.inc[k];
  }
  for (const k in B.exp) {
    sv(p, 'te_' + k, U.money(-B.exp[k]));
    sv(p, 'le_' + k, S.month ? U.money(-L.exp[k]) : '–');
    te += B.exp[k];
    le += L.exp[k];
  }
  sv(p, 'tnet', U.money(ti - te));
  sv(p, 'lnet', S.month ? U.money(li - le) : '–');
}

export function renderBudgetPanel(p: HTMLElement): void {
  const S = Sim;
  const rowsI = [
    ['res', 'Residential tax'],
    ['com', 'Commercial tax'],
    ['ind', 'Industrial tax'],
    ['off', 'Office tax'],
    ['fares', 'Transit fares'],
  ];
  const rowsE = [
    ['services', 'City services'],
    ['roads', 'Road & track upkeep'],
    ['transit', 'Transit vehicles'],
    ['utilities', 'Water & power (automatic)'],
    ['loans', 'Loan payments'],
  ];

  p.innerHTML =
    head('Budget', 'Monthly figures.') +
    `<table class="bud"><tr><td class="lbl">Income</td><td class="lbl">This month</td><td class="lbl">Last month</td></tr>
    ${rowsI.map(r => `<tr><td>${r[1]}</td><td data-v="ti_${r[0]}"></td><td data-v="li_${r[0]}"></td></tr>`).join('')}
    <tr><td class="lbl" style="padding-top:8px">Expenses</td><td></td><td></td></tr>
    ${rowsE.map(r => `<tr><td>${r[1]}</td><td data-v="te_${r[0]}"></td><td data-v="le_${r[0]}"></td></tr>`).join('')}
    <tr class="tot"><td>Net</td><td data-v="tnet"></td><td data-v="lnet"></td></tr></table>
    <div class="sec"><div class="lbl">Tax rates</div>
    ${[
      ['res', 'Residential'],
      ['com', 'Commercial'],
      ['ind', 'Industrial'],
      ['off', 'Office'],
    ]
      .map(
        t =>
          `<div class="tax"><label for="tax_${t[0]}">${t[1]}</label><input type="range" id="tax_${t[0]}" min="0" max="30" value="${S.tax[t[0]]}"><b class="num" data-v="tx_${t[0]}">${S.tax[t[0]]}%</b></div>`
      )
      .join('')}
    <div class="sub" style="font-size:12px">Higher taxes bring in more money but lower demand and happiness. 10% is neutral.</div></div>
    <div class="sec"><div class="lbl">Loans</div><div data-v="loans" class="sub"></div><div id="loanList" style="display:grid;gap:6px"></div>
    <div class="btns">${[25000, 50000, 100000]
      .map(a => `<button class="btn" data-loan="${a}">Borrow ${U.money(a)}</button>`)
      .join('')}</div>
    <div class="sub" style="font-size:12px">Repaid over 24 months with 12% interest. Up to 3 loans at once.</div></div>`;

  bindClose(p, () => UI.openPanel(null));

  for (const t of ['res', 'com', 'ind', 'off']) {
    const inp = q<HTMLInputElement>('#tax_' + t, p);
    if (inp) {
      inp.oninput = () => {
        S.tax[t] = +inp.value;
        sv(p, 'tx_' + t, inp.value + '%');
      };
    }
  }

  $$<HTMLElement>('[data-loan]', p).forEach(b => {
    b.onclick = () => {
      if (!S.takeLoan(+b.dataset.loan!)) {
        UI.toast('You can only hold 3 loans at once.', 'bad');
      }
      renderLoans(p);
    };
  });

  renderLoans(p);
  updBudget(p);
}
