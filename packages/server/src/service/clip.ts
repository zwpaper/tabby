import type { DBMessage } from "@ragdoll/db";
import { clipIdCoder, db } from "../db";

class ClipService {
  async create(data: { messages: DBMessage[] | null }): Promise<string> {
    const { id } = await db
      .insertInto("clip")
      .values({ data })
      .returning("id")
      .executeTakeFirstOrThrow();
    return clipIdCoder.encode(id);
  }

  async get(id: string) {
    const decodedId = clipIdCoder.decode(id);
    const clip = await db
      .selectFrom("clip")
      .select(["data"])
      .where("id", "=", decodedId)
      .executeTakeFirst();

    return clip;
  }
}

export const clipService = new ClipService();
