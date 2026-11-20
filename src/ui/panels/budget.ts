/**
 * Vira City — UI Budget Panel
 */

import { U } from '@/core/utils';
import { Sim } from '@/sim/sim';
import { head, bindClose, sv, q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';
import { LoanRecord } from '@/types';
import { t } from '@/i18n';

export function renderLoans(p: HTMLElement): void {
  const S = Sim;
  const L = q<HTMLElement>('#loanList', p);
  if (!L) return;
  L.innerHTML =
    S.loans
      .map(
        (l: LoanRecord, k: number) =>
          `<div class="row"><span>${U.money(l.amount)} · ${t('budget.months_left', { count: l.left })} · ${U.money(l.payment)}/mo</span><button class="btn" data-repay="${k}">${t('budget.repay', { amount: U.money(l.payment * l.left) })}</button></div>`
      )
      .join('') || `<div class="sub">${t('budget.loans_none', 'No loans.')}</div>`;

  $$<HTMLElement>('[data-repay]', L).forEach(b => {
    b.onclick = () => {
      if (!S.repayLoan(+b.dataset.repay!)) {
        UI.toast(t('budget.loan_repay_err', 'Not enough money to repay this loan.'), 'bad');
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
    ['res', t('budget.tax_res', 'Residential tax')],
    ['com', t('budget.tax_com', 'Commercial tax')],
    ['ind', t('budget.tax_ind', 'Industrial tax')],
    ['off', t('budget.tax_off', 'Office tax')],
    ['fares', t('budget.fares', 'Transit fares')],
  ];
  const rowsE = [
    ['services', t('budget.exp_services', 'City services')],
    ['roads', t('budget.exp_roads', 'Road & track upkeep')],
    ['transit', t('budget.exp_transit', 'Transit vehicles')],
    ['utilities', t('budget.exp_utilities', 'Water & power (automatic)')],
    ['loans', t('budget.exp_loans', 'Loan payments')],
  ];

  p.innerHTML =
    head(t('budget.title', 'Budget'), t('budget.subtitle', 'Monthly figures.')) +
    `<table class="bud"><tr><td class="lbl">${t('budget.income', 'Income')}</td><td class="lbl">${t('budget.this_month', 'This month')}</td><td class="lbl">${t('budget.last_month', 'Last month')}</td></tr>
    ${rowsI.map(r => `<tr><td>${r[1]}</td><td data-v="ti_${r[0]}"></td><td data-v="li_${r[0]}"></td></tr>`).join('')}
    <tr><td class="lbl" style="padding-top:8px">${t('budget.expenses', 'Expenses')}</td><td></td><td></td></tr>
    ${rowsE.map(r => `<tr><td>${r[1]}</td><td data-v="te_${r[0]}"></td><td data-v="le_${r[0]}"></td></tr>`).join('')}
    <tr class="tot"><td>${t('budget.net', 'Net')}</td><td data-v="tnet"></td><td data-v="lnet"></td></tr></table>
    <div class="sec"><div class="lbl">${t('budget.tax_rates', 'Tax rates')}</div>
    ${[
      ['res', t('budget.res', 'Residential')],
      ['com', t('budget.com', 'Commercial')],
      ['ind', t('budget.ind', 'Industrial')],
      ['off', t('budget.off', 'Office')],
    ]
      .map(
        tr =>
          `<div class="tax"><label for="tax_${tr[0]}">${tr[1]}</label><input type="range" id="tax_${tr[0]}" min="0" max="30" value="${S.tax[tr[0]]}"><b class="num" data-v="tx_${tr[0]}">${S.tax[tr[0]]}%</b></div>`
      )
      .join('')}
    <div class="sub" style="font-size:12px">${t('budget.tax_hint', 'Higher taxes bring in more money but lower demand and happiness. 10% is neutral.')}</div></div>
    <div class="sec"><div class="lbl">${t('budget.loans', 'Loans')}</div><div data-v="loans" class="sub"></div><div id="loanList" style="display:grid;gap:6px"></div>
    <div class="btns">${[25000, 50000, 100000]
      .map(a => `<button class="btn" data-loan="${a}">${t('budget.borrow', { amount: U.money(a) })}</button>`)
      .join('')}</div>
    <div class="sub" style="font-size:12px">${t('budget.loans_sub', 'Repaid over 24 months with 12% interest. Up to 3 loans at once.')}</div></div>`;

  bindClose(p, () => UI.openPanel(null));

  for (const tr of ['res', 'com', 'ind', 'off']) {
    const inp = q<HTMLInputElement>('#tax_' + tr, p);
    if (inp) {
      inp.oninput = () => {
        S.tax[tr] = +inp.value;
        sv(p, 'tx_' + tr, inp.value + '%');
      };
    }
  }

  $$<HTMLElement>('[data-loan]', p).forEach(b => {
    b.onclick = () => {
      if (!S.takeLoan(+b.dataset.loan!)) {
        UI.toast(t('budget.loan_limit_err', 'You can only hold 3 loans at once.'), 'bad');
      }
      renderLoans(p);
    };
  });

  renderLoans(p);
  updBudget(p);
}
