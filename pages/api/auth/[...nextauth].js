import NextAuth from "next-auth";
import credentialProvider from "next-auth/providers/credentials";
import axios from "axios";
import loginHandler from "./login";

const baseUrl = process.env.BASEURL;

const providers = [
  credentialProvider({
    name: "credentials",
    authorize: async (credentials,req) => {
      try {
        const user = await loginHandler(req,false);

        if (user) {

          return { status: "success", data: user.data };
        }
      } catch (e) {
        const errorMessage = e?.response?.data?.message || e?.message || e;
        // Redirecting to the login page with error message          in the URL
        throw new Error(errorMessage);
      }
    },
  }),
];

const callbacks = {
  async jwt(objData) {
    const token = objData.token;
    const user = objData?.user?.data;
    const account = objData.account;
    //const isNewUser = objData.isNewUser;

    if (account) {
      token.accessToken = account.access_token;
      token.user = user || {};
    }
 
    return token;
  },

  async session({ session, token }) {
    //console.log(token.user)
    session.accessToken = token.accessToken;
    session.user = token?.user || {};
    return session;
  },
};

const options = {
  providers,
  callbacks,
  secret: process.env.NEXTAUTH_SECRET,
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    error: "/login", // Changing the error redirect page to our custom login page
  },
};

export default (req, res) => NextAuth(req, res, options);
