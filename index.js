import "./env.js";

import { app } from "./app.js";

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// Health Check Route 
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is healthy ",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV
    });
});


const server = app.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` Environment: ${NODE_ENV}`);
    console.log(` Health check: http://localhost:${PORT}/api/v1/health`);
});

process.on("uncaughtException", (error) => {
    console.error(" Uncaught Exception:", error);
    process.exit(1); // exit so you don't run in a broken state
});

process.on("unhandledRejection", (reason, promise) => {
    console.error(" Unhandled Rejection at:", promise, "reason:", reason);
    // not exiting immediately, but you can if you prefer
});

export default server;
