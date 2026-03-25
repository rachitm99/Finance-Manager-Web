export type TransactionType = "INCOME" | "EXPENSE";
export type PartEffect = "ADD" | "SUBTRACT";

export type PartDTO = {
  id: string;
  label: string;
  amount: number;
  effect: PartEffect;
  subpartId: string | null;
};

export type TransactionDTO = {
  id: string;
  title: string;
  type: TransactionType;
  occurredAt: string;
  categoryId: string | null;
  categoryName: string | null;
  notes: string | null;
  totalAmount: number;
  parts: PartDTO[];
};

export type MonthGroupDTO = {
  monthKey: string;
  monthLabel: string;
  incomeTotal: number;
  expenseTotal: number;
  profitLoss: number;
  transactions: TransactionDTO[];
};

export type DashboardDTO = {
  balance: number;
  months: MonthGroupDTO[];
};

export type SubpartDTO = {
  id: string;
  name: string;
};

export type CategoryDTO = {
  id: string;
  name: string;
};
