import { Hono } from "hono";
import { AvailableModels } from "../lib/constants";

const models = new Hono().get("/", (c) => {
  return c.json(AvailableModels);
});

export default models;
