import prisma from "../../lib/prisma";
import { getSession } from "next-auth/react";

export default async function balancesHandler(req, res) {
  const session = await getSession({ req });

  let balances = {};

  const debit_balances = await prisma.transaction.groupBy({
    by: ["debitCurrencyCode"],
    where: {
      senderId: {
        equals: session?.user?.id,
      },
    },
    _sum: {
      debit: true,
    },
  });

  const credit_balances = await prisma.transaction.groupBy({
    by: ["creditCurrencyCode"],
    where: {
      receiverId: {
        equals: session?.user?.id,
      },
    },
    _sum: {
      credit: true,
    },
  });

  // Map Credit & Debit Balances to each currency
  [...debit_balances, ...credit_balances].forEach((bal) => {
    if (bal.debitCurrencyCode) {
      if (!balances[bal.debitCurrencyCode])
        balances[bal.debitCurrencyCode] = {};
      balances[bal.debitCurrencyCode].debit = bal?._sum?.debit || 0;
    }

    if (bal.creditCurrencyCode) {
      if (!balances[bal.creditCurrencyCode])
        balances[bal.creditCurrencyCode] = {};
      balances[bal.creditCurrencyCode].credit = bal?._sum?.credit || 0;
    }
  });

  return balances;
}
