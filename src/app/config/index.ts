import dotenv from "dotenv";
import path from "path";

// Load .env
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Ensure required env variables exist
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}
// if (!process.env.JWT_SECRET) {
//   throw new Error("JWT_SECRET is missing in .env");
// }
// if (!process.env.JWT_REFRESH_SECRET) {
//   throw new Error("JWT_REFRESH_SECRET is missing in .env");
// }

const config = {
  node_env: process.env.NODE_ENV || "development",
  app_name: process.env.APP_NAME || "ElectroMart",
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  database_url: process.env.DATABASE_URL || "",
  frontend_url: process.env.FRONTEND_URL || "http://localhost:5000",
  backend_url: process.env.BACKEND_URL || "http://localhost:5000",


    accessSecret: process.env.JWT_ACCESS_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  accessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
  refreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",

//   email_user: process.env.EMAIL_USER,
//   email_pass: process.env.EMAIL_PASS,
//   email_host: process.env.EMAIL_HOST,
//   email_port: process.env.EMAIL_PORT,
//   email_from: process.env.APP_EMAIL_FROM,

//   web_app: process.env.WEB_PASSWORD,

//   super_admin_email: process.env.SUPER_ADMIN_EMAIL,
//   super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
//   super_admin_role: process.env.SUPER_ADMIN_ROLE,
//   auto_seed_super_admin: process.env.AUTO_SEED_SUPER_ADMIN,
//   auto_seed_permissions: process.env.AUTO_SEED_PERMISSIONS,
//   jwt_secret: process.env.JWT_SECRET as string,
//   jwt_refresh_secret: process.env.JWT_REFRESH_SECRET as string,

//   // SSLCommerz
//   sslcommerz_store_id: process.env.SSLCOMMERZ_STORE_ID,
//   sslcommerz_store_password: process.env.SSLCOMMERZ_STORE_PASSWORD,
//   sslcommerz_session_url: process.env.SSLCOMMERZ_SESSION_URL,
//   sslcommerz_validation_url: process.env.SSLCOMMERZ_VALIDATION_URL,
//   sslcommerz_success_url_product: process.env.SSLCOMMERZ_SUCCESS_URL_PRODUCT,
//   sslcommerz_fail_url_product: process.env.SSLCOMMERZ_FAIL_URL_PRODUCT,
//   sslcommerz_cancel_url_product: process.env.SSLCOMMERZ_CANCEL_URL_PRODUCT,
//   sslcommerz_success_url_subscription:
//     process.env.SSLCOMMERZ_SUCCESS_URL_SUBSCRIPTION,
//   sslcommerz_fail_url_subscription:
//     process.env.SSLCOMMERZ_FAIL_URL_SUBSCRIPTION,
//   sslcommerz_cancel_url_subscription:
//     process.env.SSLCOMMERZ_CANCEL_URL_SUBSCRIPTION,

//   // config/bkash
//   bkash_username: process.env.BKASH_USERNAME!,
//   bkash_password: process.env.BKASH_PASSWORD!,
//   bkash_apiKey: process.env.BKASH_API_KEY!,
//   bkash_secretKey: process.env.BKASH_SECRET_KEY!,
//   bkash_grantTokenUrl: process.env.BKASH_GRANT_TOKEN_URL!,
//   bkash_createPaymentUrl: process.env.BKASH_CREATE_PAYMENT_URL!,
//   bkash_executePaymentUrl: process.env.BKASH_EXECUTE_PAYMENT_URL!,
  // backend_url: process.env.BACKEND_URL!,
};

export default config;