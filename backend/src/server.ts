import "dotenv/config";
import express from "express";
import cors from "cors";
import agentRoutes from "./routes/agent";
import dataRoutes from "./routes/data";
import approvalRoutes from "./routes/approvals";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/agent", agentRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/approvals", approvalRoutes);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`AI Purchasing Agent backend listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("WARNING: ANTHROPIC_API_KEY is not set. Agent runs will fail until it is configured in .env.");
  }
});
