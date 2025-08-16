import type { ListModelsResponse } from "@getpochi/common/pochi-api";
import { Hono } from "hono";
import { AvailableModels } from "../lib/constants";

const models = new Hono().get("/", (c) => {
  const response = AvailableModels as ListModelsResponse;
  return c.json(response);
});

export default models;
