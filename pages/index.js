import Head from "next/head";
import Loading from "../components/Loading";
import { getSession, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import moment from "moment";
import curr_format from "../utils/curr_format";
import Router from "next/router";
import prisma from "../lib/prisma";
import { signOut } from "next-auth/react";

export const getServerSideProps = async ({ req, res }) => {
  const session = await getSession({ req });
  if (!session?.user?.id) {
    res.statusCode = 403;

    return { props: { balances: [], transactions: [] } };
  }

  const receivers = await prisma.user.findMany({
    where: {
      NOT: {
        email: {
          equals: session?.user?.email,
        },
      },
    },
    select: {
      email: true,
      name: true,
      id: true,
    },
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [
        {
          senderId: {
            equals: session?.user?.id,
          },
        },
        {
          receiverId: {
            equals: session?.user?.id,
          },
        },
      ],
    },
  });

  let receiversIdMap = {};
  receivers.forEach((u, index) => {
    receiversIdMap[u.id] = { ...u };
  });

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

  return {
    props: {
      transactions: JSON.stringify(transactions),
      balances: JSON.stringify(balances),
      receivers: JSON.stringify(receiversIdMap),
    },
  };
};

/** @param {import('next').InferGetServerSidePropsType<typeof getServerSideProps> } props */
export default function Home({ transactions, balances, receivers }) {
  const [loading, setLoading] = useState(false);

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      Router.push("/login");
    },
  });
  
  if (status === "loading") return <Loading message={"Loading..."} />;

  if (status !== "authenticated") return Router.push("/login");

  transactions = JSON.parse(transactions);
  balances = JSON.parse(balances);
  receivers = JSON.parse(receivers);

  return (
    <>
      {loading && <Loading message={"Loading..."} />}

      <div className="flex flex-col items-center min-h-screen py-2">
        <Head>
          <title>S-Pay</title>
          <link rel="icon" href="/favicon.ico" />
        </Head>

        <div className="flex w-screen flex-row-reverse px-8">
        <button onClick={() => {
          setLoading(true);
          signOut();
          }} type="button" className="px-6 py-2.5 bg-gray-200 text-gray-700 font-medium text-xs leading-tight uppercase rounded-full shadow-md hover:bg-gray-300 hover:shadow-lg focus:bg-gray-300 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-gray-400 active:shadow-lg transition duration-150 ease-in-out">Log Out</button>
        </div>

        <div className="flex flex-col container mx-auto px-4">
          <div className="flex w-100 justify-between">
            <div className="flex">
              {Object.keys(balances).map((currencyCode, index) => {
                return (
                  <div
                    key={currencyCode}
                    className="flex flex-col m-4 py-5 px-10 shadow rounded"
                  >
                    <span>
                      {currencyCode} <span className="text-xs"> bal</span>
                    </span>
                    <span className="text-3xl">
                      {curr_format(
                        currencyCode,
                        parseFloat(balances[currencyCode]?.credit || "0") -
                          parseFloat(balances[currencyCode]?.debit || "0")
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="my-auto">
              <button
                onClick={() => {
                  setLoading(true);
                  Router.push("/send-money")
                }}
                type="button"
                className="px-7 py-3 bg-blue-600 text-white font-medium text-sm leading-snug uppercase rounded shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out"
              >
                NEW TRANSACTION
              </button>
            </div>
          </div>
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8 mb-4">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        REF NO.
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        DATE
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        SENDER
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        SENT
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        RECEIVER
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        RECEIVED
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        EX_RATE
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        <span className="">STATE</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((trans, index) => {
                      return (
                        <tr key={trans.transNo}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {trans.transNo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {moment(new Date(trans.createdAt)).format(
                              "YYYY-MM-DD hh:mm"
                            )}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {parseInt(trans.senderId) ===
                              parseInt(session?.user?.id)
                                ? "You"
                                : trans.senderId
                                ? `${receivers[trans.senderId].name}`
                                : "S-Pay"}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            {trans.debit ? (
                              <span>
                                {curr_format(
                                  trans.debitCurrencyCode,
                                  trans.debit
                                )}
                              </span>
                            ) : (
                              <span>
                                {curr_format(
                                  trans.creditCurrencyCode,
                                  trans.credit
                                )}
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            {parseInt(trans.receiverId) ===
                            parseInt(session?.user?.id)
                              ? "You"
                              : `${receivers[trans.receiverId].name}`}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span>
                              {curr_format(
                                trans.creditCurrencyCode,
                                trans.credit
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {trans.exchangeRate}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {trans.stateId != 1 && (
                              <span className="text-red-700 w-100 flex">
                                Failed
                              </span>
                            )}
                            {trans.stateId == 1 && (
                              <span className="text-green-700 w-100 flex">
                                successful
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
