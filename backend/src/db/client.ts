import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { SCHEMA_SQL } from "./schema";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "purchasing.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(SCHEMA_SQL);

export default db;
