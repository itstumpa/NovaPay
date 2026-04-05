import axios from "axios";

interface BkashCredentials {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  grantTokenUrl: string;
}

export const getBkashToken = async (
  creds: BkashCredentials
): Promise<string> => {
  const response = await axios.post(
    creds.grantTokenUrl,
    {
      app_key: creds.appKey,
      app_secret: creds.appSecret,
    },
    {
      headers: {
        username: creds.username,
        password: creds.password,
        "Content-Type": "application/json",
      },
    },
  );

  return response.data.id_token;
};