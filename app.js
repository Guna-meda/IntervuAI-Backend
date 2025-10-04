import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
}))

// Limit on data
app.use(express.json({
    limit: "16kb"
}))

app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))

//routes import
import speechRoutes from "./routes/speech.route.js";

// routes
app.use("/api/v1/speech", speechRoutes);



export { app };