import { Router } from "express";
import * as repo from "../db/repository";
import { resolveApproval } from "../agent/approvalService";

const router = Router();

router.get("/", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json(repo.listApprovals(status));
});

router.post("/:id/approve", (req, res) => {
  try {
    const period = new Date().toISOString().slice(0, 7);
    const result = resolveApproval(req.params.id, "approved", period);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

router.post("/:id/reject", (req, res) => {
  try {
    const period = new Date().toISOString().slice(0, 7);
    const result = resolveApproval(req.params.id, "rejected", period);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

export default router;
