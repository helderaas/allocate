import { AllocationRule, AllocationLine, AllocationDraft } from "@/types";
import { GLBreakdown, Division } from "./qbo-client";

interface RevenueData {
  [divisionId: string]: number; // divisionId -> percentage
}

interface EditableLine extends AllocationLine {
  division_a_description?: string;
  division_b_description?: string;
  division_a_amount_edited?: number;
  division_b_amount_edited?: number;
  division_amounts_edited?: Record<string, number>;
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
  revenueSplit: RevenueData,
  divisions: Division[]
): AllocationLine[] {
  return rules.map((rule) => {
    const breakdown = glBalances[rule.qbo_account_id] ?? {
      total: 0,
      taggedPerDivision: {},
      untagged: 0,
    };

    const untagged = breakdown.untagged;

    // Calculate per-division amounts
    const divisionAmounts: Record<string, number> = {};
    divisions.forEach(div => {
      let pct: number;
      if (rule.rule_type === "revenue_pct") {
        pct = revenueSplit[div.id] ?? (100 / divisions.length);
      } else {
        // Fixed split — use fixed_pct_map (N-division) first, fall back to fixed_pct_division_a (legacy 2-div)
        const pctMap = (rule as AllocationRule & { fixed_pct_map?: Record<string, number> }).fixed_pct_map;
        if (pctMap && pctMap[div.id] !== undefined) {
          pct = pctMap[div.id];
        } else if (div.id === divisions[0]?.id) {
          pct = rule.fixed_pct_division_a ?? (100 / divisions.length);
        } else if (divisions.length === 2 && div.id === divisions[1]?.id) {
          pct = 100 - (rule.fixed_pct_division_a ?? 50);
        } else {
          pct = (100 - (rule.fixed_pct_division_a ?? 50)) / (divisions.length - 1);
        }
      }
      divisionAmounts[div.id] = round2(untagged * (pct / 100));
    });

    // Legacy fields for backwards compatibility with 2-division review screen
    const divAAmount = divisionAmounts[divisions[0]?.id] ?? 0;
    const divBAmount = divisionAmounts[divisions[1]?.id] ?? 0;

    return {
      account_id: rule.qbo_account_id,
      account_name: rule.qbo_account_name,
      rule_type: rule.rule_type,
      division_a_pct: revenueSplit[divisions[0]?.id] ?? (rule.fixed_pct_division_a ?? 50),
      division_b_pct: revenueSplit[divisions[1]?.id] ?? (100 - (rule.fixed_pct_division_a ?? 50)),
      total_amount: breakdown.total,
      already_tagged_a: breakdown.taggedPerDivision[divisions[0]?.id] ?? 0,
      already_tagged_b: breakdown.taggedPerDivision[divisions[1]?.id] ?? 0,
      untagged_amount: untagged,
      division_a_amount: divAAmount,
      division_b_amount: divBAmount,
      // New N-division fields
      division_amounts: divisionAmounts,
    } as AllocationLine & { division_amounts: Record<string, number> };
  });
}

export function buildJournalEntryPayload(
  draft: AllocationDraft,
  divisions: Division[],
  trackingType: "location" | "class",
  period: string,
  jeDate?: string,
  description?: string,
  journalNumber?: string
) {
  const txnDate = jeDate || (period + "-01");
  const defaultMemo = description || ("Division allocation - " + formatPeriod(period));

  const lines = (draft.lines as (EditableLine & { division_amounts?: Record<string, number> })[]).flatMap((line, i) => {
    const memo = line.division_a_description || defaultMemo;

    // Use new N-division amounts if available, fall back to legacy 2-division
    const divisionAmounts = line.division_amounts ?? {
      [divisions[0]?.id]: line.division_a_amount_edited ?? line.division_a_amount,
      [divisions[1]?.id]: line.division_b_amount_edited ?? line.division_b_amount,
    };

    const untaggedTotal = round2(
      Object.values(divisionAmounts).reduce((sum, amt) => sum + (amt || 0), 0)
    );

    if (untaggedTotal === 0) return [];

    const debitLines = divisions
      .filter(div => (divisionAmounts[div.id] ?? 0) > 0)
      .map((div, j) => {
        const filterId = trackingType === "class" ? div.qbo_class_id : div.qbo_location_id;
        const lineDetail: Record<string, unknown> = {
          PostingType: "Debit",
          AccountRef: { value: line.account_id },
        };
        if (filterId) {
          if (trackingType === "class") {
            lineDetail.ClassRef = { value: filterId };
          } else {
            lineDetail.DepartmentRef = { value: filterId };
          }
        }
        return {
          Id: String(i * (divisions.length + 1) + j + 1),
          Description: memo,
          Amount: divisionAmounts[div.id] ?? 0,
          DetailType: "JournalEntryLineDetail",
          JournalEntryLineDetail: lineDetail,
        };
      });

    // Credit line — no division tag (offsets the untagged amount)
    const creditLine = {
      Id: String(i * (divisions.length + 1) + divisions.length + 1),
      Description: memo,
      Amount: untaggedTotal,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: {
        PostingType: "Credit",
        AccountRef: { value: line.account_id },
      },
    };

    return [...debitLines, creditLine];
  });

  const payload: Record<string, unknown> = {
    TxnDate: txnDate,
    PrivateNote: defaultMemo,
    Line: lines,
  };

  if (journalNumber) payload.DocNumber = journalNumber;

  return payload;
}
