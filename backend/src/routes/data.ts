import { Router } from "express";
import * as repo from "../db/repository";

const router = Router();

router.get("/world", (_req, res) => {
  res.json(repo.getWorldSnapshot());
});

export default router;
