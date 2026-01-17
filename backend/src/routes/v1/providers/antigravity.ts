import express from "express";
import { findAccount } from "../../../utils/account-utils";
import { getModels as getAntigravityModels } from "../../../antigravity";

const router = express.Router();

router.get("/models", async (req, res) => {
  try {
    const account = findAccount(req, "Antigravity");
    if (!account) {
      res.status(401).json({ error: "No valid Antigravity account found" });
      return;
    }
    const models = await getAntigravityModels(account);
    res.json(models);
  } catch (error: any) {
    console.error("[Server] Get Antigravity Models Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
