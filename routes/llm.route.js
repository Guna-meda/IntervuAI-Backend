import express from "express";
import { generateFollowUpQuestion } from "../controllers/llm.controller.js";

const router = express.Router();

router.post("/follow-up", generateFollowUpQuestion);

export default router;