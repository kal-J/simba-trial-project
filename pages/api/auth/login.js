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

  return new Promise((resolve, reject) => {
    if (user) {
      // validate password
      const verified = bcrypt.compareSync(password, user.password);

      if (verified) {
        let userData = { email: user.email, name: user.name, id: user.id };
        return resolve(userData);
      }

      return reject({ message: "Wrong Email or Password", error: true });
    }

    return reject({
      message: `User with email(${email}) does not exist`,
      error: true,
    });

  });
  
}
