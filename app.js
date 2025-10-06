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

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Routes import
import speechRoutes from "./routes/speech.route.js";
import llmRoutes from "./routes/llm.route.js";
import userRoutes from "./routes/user.route.js";

// Routes
app.use("/api/v1/speech", speechRoutes);
app.use("/api/v1/llm", llmRoutes);
app.use("/api/v1/users", userRoutes);

export { app };