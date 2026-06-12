export type TransactionKind =
  | "income"
  | "fixed_expense"
  | "variable_expense"
  | "unexpected_expense"
  | "other_expense";

export type User = {
  email: string;
  email_confirmed: boolean;
  is_subscribed: boolean;
  free_limit: number;
  used_this_month: number;
};

export type Summary = {
  income: string;
  expenses: string;
  balance: string;
  unexpected: string;
  savings_rate: number;
  month: string;
};

export type Transaction = {
  id: number;
  kind: TransactionKind;
  category: string;
  description: string;
  amount: string;
  occurred_on: string;
  created_at: string;
};

export type AuthResponse = {
  token: string | null;
  email: string;
  email_confirmed: boolean;
  message: string;
  confirmation_token: string | null;
};

export type AskResponse = {
  answer: string;
  remaining_free_messages: number | null;
  requires_subscription: boolean;
};
