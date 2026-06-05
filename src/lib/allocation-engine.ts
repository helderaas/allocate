import { AllocationRule, AllocationLine, AllocationDraft } from "@/types";

interface RevenueData {
  divisionAPct: number;
  divisionBPct: number;
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
  accountBalances: Record<string, number>,
  revenue: RevenueData
): AllocationLine[] {
  return rules.map((rule) => {
    const total = accountBalances[rule.qbo_account_id] ?? 0;
    const divisionAPct = rule.rule_type === "revenue_pct"
      ? revenue.divisionAPct
      : (rule.fixed_pct_division_a ?? 50);
    const divisionBPct = 100 - divisionAPct;

    return {
      account_id: rule.qbo_account_id,
      account_name: rule.qbo_account_name,
      rule_type: rule.rule_type,
      division_a_pct: divisionAPct,
      division_b_pct: divisionBPct,
      total_amount: total,
      division_a_amount: round2(total * (divisionAPct / 100)),
      division_b_amount: round2(total * (divisionBPct / 100)),
    };
  });
}

export function buildJournalEntryPayload(
  draft: AllocationDraft,
  divisionALocationId: string,
  divisionBLocationId: string,
  period: string
) {
  const lines = draft.lines.flatMap((line, i) => [
    {
      Id: String(i * 2 + 1),
      Description: `${line.account_name} — remove Div A over-allocation`,
      Amount: line.division_a_amount,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: {
        PostingType: "Credit",
        AccountRef: { value: line.account_id },
        DepartmentRef: { value: divisionALocationId },
      },
    },
    {
      Id: String(i * 2 + 2),
      Description: `${line.account_name} — add Div B share`,
      Amount: line.division_b_amount,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: {
        PostingType: "Debit",
        AccountRef: { value: line.account_id },
        DepartmentRef: { value: divisionBLocationId },
      },
    },
  ]);

  return {
    TxnDate: `${period}-01`,
    PrivateNote: `Division allocation — ${formatPeriod(period)}`,
    Line: lines,
  };
}
