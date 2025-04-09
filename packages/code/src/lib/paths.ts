import path from "node:path";

const PochiHome = path.join(process.env.HOME || "~", ".pochi");

export const KVStoragePath = path.join(PochiHome, "data", "db.sqlite");

export const PochiProjectsPath = path.join(
  process.env.HOME || "~",
  "PochiProjects",
);
