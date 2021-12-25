import Head from "next/head";
import axios from "axios";
import { getSession, useSession } from "next-auth/react";
import Router from "next/router";
import { useEffect, useState } from "react";
import Loading from "../components/Loading";
import prisma from "../lib/prisma";
import curr_format from "../utils/curr_format";

const FREE_CURRENCY_API_KEY = "984cc5f0-63de-11ec-ab5a-879176239fbf";

export const getServerSideProps = async ({ req, res }) => {
  const session = await getSession({ req });
  if (!session) {
    res.statusCode = 403;

    return { props: { receivers: [], currencies: [] } };
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

  const currencies = await prisma.currency.findMany({
    select: {
      code: true,
      id: true,
    },
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
      receivers: JSON.stringify(receivers),
      currencies: JSON.stringify(currencies),
      balances: JSON.stringify(balances),
    },
  };
};

const SendMoney = ({ receivers, currencies, balances }) => {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      Router.push("/login");
    },
  });

  if (status === "loading") return <Loading message={"Loading..."} />;

  if (status !== "authenticated") return Router.push("/login");

  currencies = JSON.parse(currencies);
  receivers = JSON.parse(receivers);
  balances = JSON.parse(balances);

  const [loading, setLoading] = useState(false);
  const [currBalaces, setCurrBalances] = useState(balances);
  const [receiver, setReceiver] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [rates, setRates] = useState({});
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [targetCurrency, setTargetCurrency] = useState("USD");
  const [exRate, setExRate] = useState(1);
  const [debit, setDebit] = useState(""); // Amount to send
  const [credit, setCredit] = useState(""); // Amount to be receieved

  let actualBalances = {};
  Object.keys(currBalaces).forEach((currencyCode) => {
    actualBalances[currencyCode] =
      parseFloat(currBalaces[currencyCode]?.credit || "0") -
      parseFloat(currBalaces[currencyCode]?.debit || "0");
  });

  useEffect(async () => {
    // Fetch exchange rates
    const res = await axios
      .get("https://freecurrencyapi.net/api/v2/latest", {
        params: {
          apikey: FREE_CURRENCY_API_KEY,
          base_currency: baseCurrency,
        },
      })
      .catch((err) => {
        let errorMessage = err?.response?.data?.message || err?.message || err;
        setError(errorMessage);
      });

    if (res) {
      const { EUR, NGN, UGX, GBP, USD } = res.data.data;

      let rates = { EUR, NGN, UGX, GBP, USD };
      setRates(rates);

      // update amount to be received
      let new_rate = rates[targetCurrency] ? rates[targetCurrency] : 1;
      setCredit(parseFloat(debit ? debit : 0) * new_rate);

      setError("");
    }
  }, [baseCurrency]);

  useEffect(() => {
    // set exchange rate
    if (rates[targetCurrency]) {
      setExRate(rates[targetCurrency]);
    }
  }, [targetCurrency, baseCurrency, rates]);

  // Remove messages after 5 seconds
  useEffect(() => {
    if (error) {
      setTimeout(() => {
        setError("");
      }, 5000);
    }
    if (successMessage) {
      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    }
  }, [error, successMessage]);

  const sendMoneyHandler = (e) => {
    e.preventDefault();
    setLoading(true);
    if (
      parseFloat(debit) >
      parseFloat(
        actualBalances[baseCurrency] ? actualBalances[baseCurrency] : 0
      )
    ) {
      setError(
        `You can't send ${curr_format(
          baseCurrency,
          debit
        )} ,your ${baseCurrency} Balance is less`
      );
      setLoading(false);
      return;
    } else {
      setError("");
    }
    // create transaction
    const data = {
      receiver,
      credit,
      debit,
      credit_curr: targetCurrency,
      debit_curr: baseCurrency,
      exchange_rate: exRate,
    };

    axios
      .post("/api/transaction", data)
      .then((res) => {
        setReceiver("");
        setDebit(0);
        setCredit(0);
        setSuccessMessage(res.data.message);
        setError("");
        setCurrBalances(res.data.balances);
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        let errorMessage = err?.response?.data?.message || err?.message || err;
        setError(errorMessage);
        setLoading(false);
      });
  };

  return (
    <div className="lg:h-screen lg:bg-gray-100 w-screen">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      {loading && <Loading message={"Processing..."} />}
      <form onSubmit={(e) => sendMoneyHandler(e)} className="lg:mx-32">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="flex px-4 py-5 sm:px-6 justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              SEND MONEY
            </h3>
            <span>
              {" "}
              {`${baseCurrency} Balance : `}{" "}
              {curr_format(
                baseCurrency,
                actualBalances[baseCurrency] ? actualBalances[baseCurrency] : 0
              )}
            </span>
          </div>
          <div className="border-t border-gray-200">
            {error && (
              <div
                className="flex justify-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
                role="alert"
              >
                {error}
              </div>
            )}
            {successMessage && (
              <div
                className="flex justify-center bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative"
                role="alert"
              >
                {successMessage}
              </div>
            )}
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <div className="text-sm font-medium text-gray-500">To</div>
                <div className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">

                  
                  <div className="mb-3 xl:w-96 w-100">
                    <select
                      required
                      onChange={(e) => setReceiver(e.target.value)}
                      className="form-select form-select-lg block py-3 px-2 lg:text-xl text-md
                            font-normal
                            text-gray-700
                            bg-white bg-clip-padding bg-no-repeat
                            border border-solid border-gray-300
                            rounded
                            transition
                            ease-in-out
                            m-0
                            focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
                    >
                      <option value={""}>-- Select receiver --</option>
                      {receivers.map((user, index) => {
                        return (
                          <option key={user.email} value={user.id}>
                            {`${user.name} - ${user.email}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                </div>
              </div>
              
              <div className="bg-white px-4 lg:py-5 pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <div className="text-sm font-medium text-gray-500">
                  Amount to send
                </div>
                <div className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex">
                    <input
                      required
                      onChange={(e) => {
                        let value = e.target.value;
                        setDebit(value);
                        value = value ? value : 0; // to prevent NaN
                        setCredit(parseFloat(value) * exRate);

                        if (
                          value >
                          parseFloat(
                            actualBalances[baseCurrency]
                              ? actualBalances[baseCurrency]
                              : 0
                          )
                        ) {
                          setError(
                            `You can't send ${curr_format(
                              baseCurrency,
                              value
                            )} ,your ${baseCurrency} Balance is less`
                          );
                        } else {
                          setError("");
                        }
                      }}
                      value={debit}
                      name="debit"
                      type="number"
                      className="
                            form-control
                            py-2
                            px-2
                            lg:text-xl text-md
                            font-normal
                            text-gray-700
                            bg-white bg-clip-padding
                            border border-solid border-gray-300
                            rounded
                            transition
                            ease-in-out
                            m-0
                            focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none
                            "
                      id="exampleFormControlInput2"
                      placeholder="0.0"
                    />

                    <select
                      required
                      onChange={(e) => setBaseCurrency(e.target.value)}
                      className="form-select form-select-lg px-4 py-2 text-xl
                            font-normal
                            text-gray-700
                            bg-white bg-clip-padding bg-no-repeat
                            border border-solid border-gray-300
                            rounded
                            transition
                            ease-in-out
                            m-0
                            focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
                      aria-label=".form-select-lg example"
                    >
                      {currencies.map((curr, index) => {
                        return (
                          <option key={curr.code} value={curr.code}>
                            {curr.code}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 lg:py-5 pt-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <div className="text-sm font-medium text-gray-500">
                  Amount to be received
                </div>
                <div className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex">
                    <input
                      required
                      onChange={(e) => {
                        let value = e.target.value;
                        setCredit(value);
                        value = value ? value : 0; // to prevent NaN
                        setDebit(parseFloat(value) * (1 / exRate));
                      }}
                      value={credit}
                      name="credit"
                      type="number"
                      className="
                            form-control
                            px-2
                            py-2
                            lg:text-xl text-md
                            font-normal
                            text-gray-700
                            bg-white bg-clip-padding
                            border border-solid border-gray-300
                            rounded
                            transition
                            ease-in-out
                            m-0
                            focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none
                            "
                      id="exampleFormControlInput2"
                      placeholder="0.0"
                    />

                    <select
                      required
                      onChange={(e) => {
                        let target_curr = e.target.value;
                        setTargetCurrency(target_curr);

                        let new_rate = rates[target_curr]
                          ? rates[target_curr]
                          : 1;

                        setCredit(parseFloat(debit ? debit : 0) * new_rate);
                      }}
                      name="target_curr"
                      className="form-select form-select-lg px-4 py-2 text-xl
                            font-normal
                            text-gray-700
                            bg-white bg-clip-padding bg-no-repeat
                            border border-solid border-gray-300
                            rounded
                            transition
                            ease-in-out
                            m-0
                            focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
                      aria-label=".form-select-lg example"
                    >
                      {currencies.map((curr, index) => {
                        return (
                          <option key={curr.code} value={curr.code}>
                            {curr.code}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <div className="text-sm font-medium text-gray-500">
                  Exchange rate
                </div>
                <div className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {exRate && (
                    <span>{`1 ${baseCurrency} = ${exRate} ${targetCurrency}`}</span>
                  )}
                </div>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex flex-row-reverse w-100 px-4 py-5 sm:px-6 justify-between">
          <button
            type="submit"
            className="px-7 py-3 bg-blue-600 text-white font-medium text-sm leading-snug uppercase rounded shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out"
          >
            SEND
          </button>
          <button
            onClick={() => {
              setLoading(true);
              Router.push("/");
            }}
            type="button"
            className="px-6 py-2 border-2 border-gray-800 text-gray-800 font-medium text-xs leading-tight uppercase rounded hover:bg-black hover:bg-opacity-5 focus:outline-none focus:ring-0 transition duration-150 ease-in-out"
          >
            {"<< Back"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SendMoney;
