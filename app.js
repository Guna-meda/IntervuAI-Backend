import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
}));

app.use(express.json({
    limit: "16kb"
}));

app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

const firebaseServiceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"), // fixes newline issue
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};

// ✅ initialize firebase admin
admin.initializeApp({
  credential: admin.credential.cert(firebaseServiceAccount),
});
;

// Routes import
import speechRoutes from "./routes/speech.route.js";
import llmRoutes from "./routes/llm.route.js";
import userRoutes from "./routes/user.route.js";
import interviewRoutes from "./routes/interview.route.js";

// Routes
app.use("/api/v1/speech", speechRoutes);
app.use("/api/v1/llm", llmRoutes);
app.use("/api/v1/users", userRoutes);
app.use('/api/v1/interviews', interviewRoutes);


export { app };