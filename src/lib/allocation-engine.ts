import { AllocationRule, AllocationLine, AllocationDraft } from "@/types";
import { GLBreakdown } from "./qbo-client";

interface RevenueData {
  divisionAPct: number;
  divisionBPct: number;
}

interface EditableLine extends AllocationLine {
  division_a_description?: string;
  division_b_description?: string;
  division_a_amount_edited?: number;
  division_b_amount_edited?: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  return new Date(parseInt(year), parseInt(month) - 1, 1)
    .toLocaleString("default", { month: "long", year: "numeric" });
}

export function calculateAllocationLines(
  rules: AllocationRule[],
  glBalances: Record<string, GLBreakdown>,
  revenue: RevenueData
): AllocationLine[] {
  return rules.map((rule) => {
    const breakdown = glBalances[rule.qbo_account_id] ?? {
      total: 0, taggedA: 0, taggedB: 0, untagged: 0,
    };

    const divisionAPct = rule.rule_type === "revenue_pct"
      ? revenue.divisionAPct
      : (rule.fixed_pct_division_a ?? 50);
    const divisionBPct = 100 - divisionAPct;

    const untagged = breakdown.untagged;

    return {
      account_id: rule.qbo_account_id,
      account_name: rule.qbo_account_name,
      rule_type: rule.rule_type,
      division_a_pct: divisionAPct,
      division_b_pct: divisionBPct,
      total_amount: breakdown.total,
      already_tagged_a: breakdown.taggedA,
      already_tagged_b: breakdown.taggedB,
      untagged_amount: untagged,
      division_a_amount: round2(untagged * (divisionAPct / 100)),
      division_b_amount: round2(untagged * (divisionBPct / 100)),
    };
  });
}

export function buildJournalEntryPayload(
  draft: AllocationDraft,
  divisionALocationId: string,
  divisionBLocationId: string,
  period: string,
  jeDate?: string,
  description?: string,
  journalNumber?: string
) {
  const txnDate = jeDate || (period + "-01");
  const defaultMemo = description || ("Division allocation - " + formatPeriod(period));

  // Each allocation line produces 3 JE lines:
  //   1. Debit  → Division A (their share of untagged)
  //   2. Debit  → Division B (their share of untagged)
  //   3. Credit → No location (washes out the full untagged amount)

  const lines = (draft.lines as EditableLine[]).flatMap((line, i) => {
    const memo = line.division_a_description || defaultMemo;
    const divAAmount = line.division_a_amount_edited ?? line.division_a_amount;
    const divBAmount = line.division_b_amount_edited ?? line.division_b_amount;
    const untaggedTotal = round2(divAAmount + divBAmount);

    if (untaggedTotal === 0) return [];

    return [
      {
        Id: String(i * 3 + 1),
        Description: memo,
        Amount: divAAmount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: line.account_id },
          DepartmentRef: { value: divisionALocationId },
        },
      },
      {
        Id: String(i * 3 + 2),
        Description: memo,
        Amount: divBAmount,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Debit",
          AccountRef: { value: line.account_id },
          DepartmentRef: { value: divisionBLocationId },
        },
      },
      {
        Id: String(i * 3 + 3),
        Description: memo,
        Amount: untaggedTotal,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: "Credit",
          AccountRef: { value: line.account_id },
        },
      },
    ];
  });

  const payload: Record<string, unknown> = {
    TxnDate: txnDate,
    PrivateNote: defaultMemo,
    Line: lines,
  };

  if (journalNumber) {
    payload.DocNumber = journalNumber;
  }

  return payload;
}
