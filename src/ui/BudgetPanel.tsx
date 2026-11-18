/**
 * Municipal Budget & Tax Panel.
 *
 * Controls sector tax rates (Residential, Commercial, Industrial from 0% to 30%)
 * with realistic citizen and economic behavioral feedback, and manages municipal
 * loans up to ¢100,000 with monthly interest service.
 */
import type { JSX } from 'react';
import {
  DEFAULT_TAX_RATE,
  LOAN_MONTHLY_INTEREST,
  MAX_LOAN,
} from '../shared/constants';
import type { Sector } from '../shared/types';
import { formatFunds } from './format';
import { Icon } from './icons';
import { useCityStore } from './store';
import { LABEL, PANEL_ROUNDED } from './theme';

export interface BudgetPanelProps {
  onClose: () => void;
}

interface SectorTaxConfig {
  sector: Sector;
  label: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  getDescription: (rate: number) => { status: string; detail: string; tone: 'positive' | 'neutral' | 'warning' | 'danger' };
}

const SECTOR_CONFIGS: readonly SectorTaxConfig[] = [
  {
    sector: 'res',
    label: 'Residential',
    badge: 'Residents',
    badgeBg: 'bg-[#5dd06b]/20',
    badgeText: 'text-[#5dd06b]',
    getDescription: (rate) => {
      if (rate < 0.07) {
        return {
          status: 'Low Taxes',
          detail: 'High purchasing power (+civic happiness). Attracts strong immigration.',
          tone: 'positive',
        };
      }
      if (rate <= 0.11) {
        return {
          status: 'Balanced Taxes',
          detail: 'Standard civic equilibrium between tax revenue and household contentment.',
          tone: 'neutral',
        };
      }
      if (rate <= 0.18) {
        return {
          status: 'High Taxes',
          detail: 'Household strain causes citizen discontent (-happiness) and dampens demand.',
          tone: 'warning',
        };
      }
      return {
        status: 'Punitive Taxes',
        detail: 'Severe civic unrest and widespread dissatisfaction (-happiness). Immigration halts.',
        tone: 'danger',
      };
    },
  },
  {
    sector: 'com',
    label: 'Commercial',
    badge: 'Commerce & Offices',
    badgeBg: 'bg-[#4bb3fd]/20',
    badgeText: 'text-[#4bb3fd]',
    getDescription: (rate) => {
      if (rate < 0.07) {
        return {
          status: 'Business Haven',
          detail: 'Low corporate overhead drives aggressive retail and service sector expansion.',
          tone: 'positive',
        };
      }
      if (rate <= 0.11) {
        return {
          status: 'Balanced Taxes',
          detail: 'Sustainable commercial operating margins with dependable municipal receipts.',
          tone: 'neutral',
        };
      }
      if (rate <= 0.18) {
        return {
          status: 'High Taxes',
          detail: 'Reduced profit margins discourage commercial investment and job creation.',
          tone: 'warning',
        };
      }
      return {
        status: 'Exorbitant Taxes',
        detail: 'Unviable operating climate: business stagnation, hiring freeze, and negative demand.',
        tone: 'danger',
      };
    },
  },
  {
    sector: 'ind',
    label: 'Industrial',
    badge: 'Industry & Logistics',
    badgeBg: 'bg-[#f5a623]/20',
    badgeText: 'text-[#f5a623]',
    getDescription: (rate) => {
      if (rate < 0.07) {
        return {
          status: 'Heavy Incentives',
          detail: 'Competitive production costs attract heavy manufacturing and warehouse investment.',
          tone: 'positive',
        };
      }
      if (rate <= 0.11) {
        return {
          status: 'Balanced Taxes',
          detail: 'Standard industrial taxation aligned with regional manufacturing benchmarks.',
          tone: 'neutral',
        };
      }
      if (rate <= 0.18) {
        return {
          status: 'High Taxes',
          detail: 'Operational friction curbs factory modernizations and industrial expansion.',
          tone: 'warning',
        };
      }
      return {
        status: 'Suffocating Taxes',
        detail: 'Prohibitive taxation leads factories to relocate to adjacent jurisdictions.',
        tone: 'danger',
      };
    },
  },
];

export function BudgetPanel({ onClose }: BudgetPanelProps): JSX.Element {
  const stats = useCityStore((s) => s.stats);
  const unlimitedMoney = useCityStore((s) => s.settings.unlimitedMoney);
  const setTaxRate = useCityStore((s) => s.setTaxRate);
  const takeLoan = useCityStore((s) => s.takeLoan);
  const repayLoan = useCityStore((s) => s.repayLoan);

  const monthlyNet = stats.monthlyIncome - stats.monthlyExpenses;
  const netPositive = monthlyNet >= 0;
  const maxAvailableLoan = Math.max(0, MAX_LOAN - stats.loanBalance);
  const interestRate = stats.crises?.bondInterestRate ?? LOAN_MONTHLY_INTEREST;
  const monthlyInterest = Math.round(stats.loanBalance * interestRate);

  return (
    <div
      data-testid="budget-panel"
      className={`pointer-events-auto fixed left-3 top-14 z-20 w-96 max-h-[85vh] overflow-y-auto ${PANEL_ROUNDED} p-4 text-xs text-white shadow-2xl backdrop-blur-md`}
    >
      {/* Header */}
      <div className="mb-3.5 flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2 font-semibold">
          <Icon name="budget" className="h-4 w-4 text-[#ffd9a0]" />
          <span className="text-sm tracking-wide">Municipal Budget & Taxes</span>
        </div>
        <button
          type="button"
          aria-label="Close budget panel"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Icon name="close" className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Treasury & Cash Flow Summary */}
      <div className="mb-4 rounded-lg bg-black/30 p-3 border border-white/10">
        <div className="mb-2 flex items-center justify-between">
          <span className={`${LABEL}`}>Treasury Reserves</span>
          <span
            data-testid="treasury-funds"
            className={`font-mono text-sm font-bold ${
              !unlimitedMoney && stats.funds < 0 ? 'text-[#e5533f]' : 'text-white'
            }`}
          >
            {unlimitedMoney ? '∞ (Unlimited)' : `${stats.funds < 0 ? '-' : ''}${formatFunds(stats.funds)}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[11px]">
          <div>
            <span className="text-white/50 block">Monthly Revenue</span>
            <span className="font-mono text-[#5dd06b] font-medium">
              +{formatFunds(stats.monthlyIncome)}/mo
            </span>
          </div>
          <div>
            <span className="text-white/50 block">Monthly Spending</span>
            <span className="font-mono text-white/70 font-medium">
              -{formatFunds(stats.monthlyExpenses)}/mo
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
          <span className="text-white/60">Net Monthly Balance</span>
          <span
            data-testid="monthly-net-delta"
            className={`font-mono font-semibold ${netPositive ? 'text-[#5dd06b]' : 'text-[#e5533f]'}`}
          >
            {netPositive ? '+' : '-'}{formatFunds(Math.abs(monthlyNet))}/mo
          </span>
        </div>
      </div>

      {/* Sector Tax Sliders */}
      <div className="mb-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className={`${LABEL} uppercase tracking-wider`}>Sector Tax Rates</span>
          <span className="text-[10px] text-white/40">Baseline 9%</span>
        </div>

        {SECTOR_CONFIGS.map(({ sector, label, badge, badgeBg, badgeText, getDescription }) => {
          const rate = stats.taxRates[sector] ?? DEFAULT_TAX_RATE;
          const ratePercent = Math.round(rate * 100);
          const { status, detail, tone } = getDescription(rate);

          const toneColors = {
            positive: 'text-[#5dd06b]',
            neutral: 'text-white/75',
            warning: 'text-[#ffbe53]',
            danger: 'text-[#e5533f]',
          };

          return (
            <div
              key={sector}
              className="rounded-lg bg-black/20 p-2.5 border border-white/5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-white/90">{label}</span>
                  <span className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${badgeBg} ${badgeText}`}>
                    {badge}
                  </span>
                </div>
                <span
                  data-testid={`tax-rate-display-${sector}`}
                  className="font-mono text-xs font-bold text-white bg-white/10 px-1.5 py-0.5 rounded"
                >
                  {ratePercent}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40">0%</span>
                <input
                  type="range"
                  min="0"
                  max="0.30"
                  step="0.01"
                  value={rate}
                  aria-label={`${label} tax rate`}
                  data-testid={`tax-slider-${sector}`}
                  onChange={(e) => setTaxRate(sector, parseFloat(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-white/20 accent-[#ffd9a0]"
                />
                <span className="text-[10px] text-white/40">30%</span>
              </div>

              <div className="text-[10px] leading-tight">
                <span className={`font-semibold ${toneColors[tone]} mr-1`}>{status}:</span>
                <span className="text-white/60">{detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Household Demographics & Economic Stress */}
      {stats.demographics && (
        <div className="mb-4 rounded-lg bg-black/30 p-3 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className={`${LABEL} uppercase tracking-wider`}>Household Demographics</span>
            <span className="text-[10px] text-white/50">
              {stats.demographics.lowIncome + stats.demographics.mediumIncome + stats.demographics.highIncome} Households
            </span>
          </div>

          {/* Income tier distribution bar */}
          {(() => {
            const total = stats.demographics.lowIncome + stats.demographics.mediumIncome + stats.demographics.highIncome;
            const lowPct = total > 0 ? Math.round((stats.demographics.lowIncome / total) * 100) : 0;
            const medPct = total > 0 ? Math.round((stats.demographics.mediumIncome / total) * 100) : 0;
            const highPct = total > 0 ? Math.max(0, 100 - lowPct - medPct) : 0;
            return (
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full flex bg-white/10">
                  {total > 0 ? (
                    <>
                      <div style={{ width: `${lowPct}%` }} className="bg-[#5dd06b] h-full transition-all duration-300" title={`Low Income: ${lowPct}%`} />
                      <div style={{ width: `${medPct}%` }} className="bg-[#4bb3fd] h-full transition-all duration-300" title={`Middle Class: ${medPct}%`} />
                      <div style={{ width: `${highPct}%` }} className="bg-[#ffbe53] h-full transition-all duration-300" title={`Affluent: ${highPct}%`} />
                    </>
                  ) : (
                    <div className="w-full h-full bg-white/5" />
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-white/70">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#5dd06b] inline-block" />
                    Low: {lowPct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#4bb3fd] inline-block" />
                    Mid: {medPct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#ffbe53] inline-block" />
                    High: {highPct}%
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[11px]">
            <div>
              <span className="text-white/50 block">Avg Disposable</span>
              <span
                data-testid="avg-disposable-income"
                className={`font-mono font-medium ${
                  stats.demographics.avgDisposableIncome >= 0 ? 'text-[#5dd06b]' : 'text-[#e5533f]'
                }`}
              >
                {stats.demographics.avgDisposableIncome >= 0 ? '+' : '-'}
                {formatFunds(Math.abs(stats.demographics.avgDisposableIncome))}/mo
              </span>
            </div>
            <div>
              <span className="text-white/50 block">Poverty Rate</span>
              <span
                data-testid="poverty-rate-display"
                className={`font-mono font-medium ${
                  stats.demographics.povertyRate > 0.15 ? 'text-[#e5533f]' : 'text-white/80'
                }`}
              >
                {Math.round(stats.demographics.povertyRate * 100)}%
              </span>
            </div>
          </div>

          {stats.demographics.povertyRate > 0.15 && (
            <div className="rounded bg-[#e5533f]/15 border border-[#e5533f]/30 p-1.5 text-[10px] text-[#e5533f] leading-tight">
              Poverty Alert: High tax rates or living costs exceed household income, causing deficit and unrest.
            </div>
          )}
        </div>
      )}

      {/* Commercial Supply Chain & Business Health */}
      {stats.supplyChain && (
        <div className="mb-4 rounded-lg bg-black/30 p-3 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className={`${LABEL} uppercase tracking-wider`}>Commercial Supply Chain</span>
            <span
              data-testid="goods-delivery-rate"
              className="text-[10px] font-mono font-semibold text-[#4bb3fd]"
            >
              {Math.round(stats.supplyChain.deliveryRate * 100)}% Stocked
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-white/50 block">Operating Margin</span>
              <span
                data-testid="commercial-margin-display"
                className={`font-mono font-medium ${
                  stats.supplyChain.commercialViability >= 10
                    ? 'text-[#5dd06b]'
                    : stats.supplyChain.commercialViability >= 0
                      ? 'text-white/80'
                      : 'text-[#e5533f]'
                }`}
              >
                {stats.supplyChain.commercialViability >= 0 ? '+' : ''}
                {stats.supplyChain.commercialViability}%
              </span>
            </div>
            <div>
              <span className="text-white/50 block">Insolvent Businesses</span>
              <span
                data-testid="insolvent-count-display"
                className={`font-mono font-medium ${
                  stats.supplyChain.insolventCount > 0 ? 'text-[#e5533f]' : 'text-white/80'
                }`}
              >
                {stats.supplyChain.insolventCount}
              </span>
            </div>
          </div>

          {stats.supplyChain.deliveryRate < 0.6 && (
            <div className="rounded bg-[#ffbe53]/15 border border-[#ffbe53]/30 p-1.5 text-[10px] text-[#ffbe53] leading-tight">
              Supply Shortage: Commercial shops lack freight connections to industrial zones or regional highways.
            </div>
          )}
        </div>
      )}

      {/* Municipal Loans & Debt Management */}
      <div className="rounded-lg bg-black/30 p-3 border border-white/10 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`${LABEL} uppercase tracking-wider`}>Municipal Debt</span>
            {stats.crises && (
              <span
                data-testid="credit-rating-badge"
                className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                  stats.crises.creditRating === 'AAA'
                    ? 'bg-[#5dd06b]/20 text-[#5dd06b]'
                    : stats.crises.creditRating === 'A'
                      ? 'bg-[#4bb3fd]/20 text-[#4bb3fd]'
                      : stats.crises.creditRating === 'BBB'
                        ? 'bg-[#ffbe53]/20 text-[#ffbe53]'
                        : 'bg-[#e5533f]/20 text-[#e5533f]'
                }`}
              >
                Rating {stats.crises.creditRating}
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/50">
            {stats.crises ? `${(stats.crises.bondInterestRate * 100).toFixed(1)}%` : '1%'} Monthly Interest
          </span>
        </div>

        {(stats.crises?.creditRating === 'Default' || stats.crises?.creditRating === 'BBB') && (
          <div className="rounded bg-[#e5533f]/15 border border-[#e5533f]/30 p-1.5 text-[10px] text-[#e5533f] leading-tight">
            Fiscal Austerity Warning: High debt under cash deficit has downgraded credit ratings. Interest rates escalated.
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-white/60">Outstanding Loan</span>
          <span data-testid="loan-balance-display" className="font-mono font-semibold text-white">
            {formatFunds(stats.loanBalance)} <span className="text-white/40 font-normal">/ {formatFunds(MAX_LOAN)}</span>
          </span>
        </div>

        {/* Progress Bar of Debt Cap */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all duration-300 ${
              stats.loanBalance >= MAX_LOAN ? 'bg-[#e5533f]' : 'bg-[#ffbe53]'
            }`}
            style={{ width: `${Math.min(100, (stats.loanBalance / MAX_LOAN) * 100)}%` }}
          />
        </div>

        {stats.loanBalance > 0 && (
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>Interest Service:</span>
            <span className="font-mono text-[#e5533f] font-medium">-{formatFunds(monthlyInterest)}/mo</span>
          </div>
        )}

        {/* Loan Controls */}
        <div className="space-y-1.5 pt-1 border-t border-white/10">
          <div className="text-[10px] text-white/50">Drawdown Credit (Borrow):</div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={unlimitedMoney || maxAvailableLoan < 5000}
              onClick={() => takeLoan(5000)}
              data-testid="take-loan-5000"
              className="rounded bg-white/10 py-1 text-center font-mono text-[11px] font-medium text-white/90 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +¢5,000
            </button>
            <button
              type="button"
              disabled={unlimitedMoney || maxAvailableLoan < 20000}
              onClick={() => takeLoan(20000)}
              data-testid="take-loan-20000"
              className="rounded bg-white/10 py-1 text-center font-mono text-[11px] font-medium text-white/90 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +¢20,000
            </button>
            <button
              type="button"
              disabled={unlimitedMoney || maxAvailableLoan <= 0}
              onClick={() => takeLoan(maxAvailableLoan)}
              data-testid="take-loan-max"
              className="rounded bg-white/10 py-1 text-center font-mono text-[11px] font-medium text-white/90 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Max Credit
            </button>
          </div>

          <div className="text-[10px] text-white/50 pt-1">Amortize Debt (Repay):</div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={unlimitedMoney || stats.loanBalance <= 0 || stats.funds <= 0}
              onClick={() => repayLoan(5000)}
              data-testid="repay-loan-5000"
              className="rounded bg-white/10 py-1 text-center font-mono text-[11px] font-medium text-white/90 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              −¢5,000
            </button>
            <button
              type="button"
              disabled={unlimitedMoney || stats.loanBalance <= 0 || stats.funds <= 0}
              onClick={() => repayLoan(20000)}
              data-testid="repay-loan-20000"
              className="rounded bg-white/10 py-1 text-center font-mono text-[11px] font-medium text-white/90 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              −¢20,000
            </button>
            <button
              type="button"
              disabled={unlimitedMoney || stats.loanBalance <= 0 || stats.funds <= 0}
              onClick={() => repayLoan(stats.loanBalance)}
              data-testid="repay-loan-full"
              className="rounded bg-white/10 py-1 text-center font-mono text-[11px] font-medium text-white/90 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Pay in Full
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
