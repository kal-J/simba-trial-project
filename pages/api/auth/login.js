import prisma from "../../../lib/prisma";
import bcrypt from "bcryptjs";


export default async function loginHandler(req, res) {
  const { email, password } = req.body.user;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      email: true,
      password: true,
      name: true,
      id: true,
    },
  });

  if (user) {
    // validate password
    const verified = bcrypt.compareSync(password, user.password);

    if (verified) {
      let userData = { email: user.email, name: user.name, id: user.id };
      return res.status(200).json(userData);
    }

    return res
      .status(400)
      .json({ message: "Wrong Email or Password", error: true });
  }

  return res
    .status(400)
    .json({ message: `User with email(${email}) does not exist`, error: true });
}
