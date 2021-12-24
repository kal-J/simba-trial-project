import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export default async function signupHandler(req, res) {
  const { email, name, password, confirmPassword } = req.body;
  // Validate user input here

  // check if user exists
  // Query returns User or null
  const userExists = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (userExists) {
    return res.status(400).json({
      message: "User with this email address already exists",
      error: true,
    });
  }

  // save new user
  const passwordHash = bcrypt.hashSync(password, 10);
  // const verified = bcrypt.compareSync('Pa$$w0rd', passwordHash);

  const trans_no = crypto.randomBytes(4).toString("hex");

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: passwordHash,
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      transNo: trans_no,
      credit: 1000,
      exchangeRate: 1,
      receiverId: user.id,
      stateId: 1,
      creditCurrencyCode: "USD",
    },
  });

  if (user) {
    return res.status(200).json({ email, name });
  }

  return res
    .status(500)
    .json({ message: "Something went wrong, try again", error: true });
}
