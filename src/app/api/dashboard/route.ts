import { NextResponse } from "next/server";
import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { transactionParts, transactions } from "@/db/schema";
import { dbErrorResponse } from "@/lib/api-errors";
import { calculateTransactionTotal } from "@/lib/finance";
import { redisGetJson, redisSetJson } from "@/lib/redis";
import { DashboardDTO, MonthGroupDTO, TransactionDTO } from "@/types/finance";

const DASHBOARD_CACHE_KEY = "finance:dashboard:v1";
const DASHBOARD_CACHE_TTL_SECONDS = 60;

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export async function GET() {
  try {
    const cached = await redisGetJson<DashboardDTO>(DASHBOARD_CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const db = getDb();
    const txRows = await db.select().from(transactions).orderBy(desc(transactions.occurredAt));
    const partRows = await db.select().from(transactionParts).orderBy(asc(transactionParts.createdAt));

    const partsByTransaction = new Map<string, typeof partRows>();
    for (const part of partRows) {
      const list = partsByTransaction.get(part.transactionId) ?? [];
      list.push(part);
      partsByTransaction.set(part.transactionId, list);
    }

    let balance = 0;
    const monthMap = new Map<string, MonthGroupDTO>();

    for (const transaction of txRows) {
      const parts = partsByTransaction.get(transaction.id) ?? [];
      const totalAmount = calculateTransactionTotal(
        parts.map((part) => ({
          amount: Number(part.amount),
          effect: part.effect,
        })),
      );

      const dto: TransactionDTO = {
        id: transaction.id,
        title: transaction.title,
        type: transaction.type,
        occurredAt: transaction.occurredAt.toISOString(),
        notes: transaction.notes,
        totalAmount,
        parts: parts.map((part) => ({
          id: part.id,
          label: part.label,
          amount: Number(part.amount),
          effect: part.effect,
          subpartId: part.subpartId,
        })),
      };

      const key = monthKey(transaction.occurredAt);
      const existing = monthMap.get(key) ?? {
        monthKey: key,
        monthLabel: monthLabel(transaction.occurredAt),
        incomeTotal: 0,
        expenseTotal: 0,
        profitLoss: 0,
        transactions: [],
      };

      if (transaction.type === "INCOME") {
        existing.incomeTotal = Number((existing.incomeTotal + totalAmount).toFixed(2));
        balance = Number((balance + totalAmount).toFixed(2));
      } else {
        existing.expenseTotal = Number((existing.expenseTotal + totalAmount).toFixed(2));
        balance = Number((balance - totalAmount).toFixed(2));
      }

      existing.profitLoss = Number((existing.incomeTotal - existing.expenseTotal).toFixed(2));
      existing.transactions.push(dto);
      monthMap.set(key, existing);
    }

    const months = Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    const response: DashboardDTO = { balance, months };

    await redisSetJson(DASHBOARD_CACHE_KEY, response, DASHBOARD_CACHE_TTL_SECONDS);

    return NextResponse.json(response);
  } catch (error) {
    return dbErrorResponse(error, "Failed to load dashboard data.");
  }
}
