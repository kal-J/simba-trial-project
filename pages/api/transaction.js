import prisma from "../../lib/prisma";
import { getSession } from "next-auth/react";
import crypto from "crypto";
import balancesHandler from "./balances";

export default async function transactionHandler(req, res) {
  const session = await getSession({ req });

  if (req.method === "POST") {
    const trans_no = crypto.randomBytes(4).toString("hex");

    const { receiver, credit, debit, credit_curr, debit_curr, exchange_rate } =
      req.body;

    // Get Balances
    let balances = {};

    const debit_balances = await prisma.transaction.groupBy({
      by: ["debitCurrencyCode"],
      where: {
        senderId: {
          equals: session?.user?.id,
        },
        debitCurrencyCode: {
          equals: debit_curr,
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
        creditCurrencyCode: {
          equals: debit_curr,
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

    const balance =
      parseFloat(balances[debit_curr]?.credit || "0") -
      parseFloat(balances[debit_curr]?.debit || "0");

    if (balance < parseFloat(debit))
      return res.status(400).json({
        message: "Low Balance to complete this transaction",
        error: true,
      });

    if (session?.user?.id) {
      let data = {
        transNo: trans_no,
        debit: parseFloat(debit),
        credit: parseFloat(credit),
        exchangeRate: parseFloat(exchange_rate),
        senderId: parseInt(session.user.id),
        receiverId: parseInt(receiver),
        stateId: 1,
        debitCurrencyCode: debit_curr,
        creditCurrencyCode: credit_curr,
      };

      const transactions = await prisma.transaction.create({
        data: data,
      });

      // Balances after transaction
      const updated_balances = await balancesHandler(req, res);

      if (transactions)
        return res
          .status(200)
          .json({
            message: "Transaction successful",
            status: "success",
            balances: updated_balances,
          });

      return res
        .status(500)
        .json({ message: "Sorry, something went wrong", error: true });
    } else {
      return res.status(500).json({ message: "Session Expired", error: true });
    }
  }
}
