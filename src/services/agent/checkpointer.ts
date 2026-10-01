import "server-only";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { connectDb } from "@/lib/db/mongoose";
import { getEnv } from "@/lib/utils/env";

const globalForSaver = globalThis as unknown as { mailmindCheckpointer?: MongoDBSaver };

/**
 * Short-term agent memory. LangGraph saves the agent's full state (messages, tool calls,
 * pending interrupts) after every step, keyed by `thread_id` = the conversation id. That is
 * what lets a conversation continue across requests and lets a paused run (waiting for
 * send approval) resume later — even after a server restart.
 */
export async function getCheckpointer(): Promise<MongoDBSaver> {
  if (globalForSaver.mailmindCheckpointer) return globalForSaver.mailmindCheckpointer;
  const mongoose = await connectDb();
  const saver = new MongoDBSaver({
    // The checkpointer bundles its own copy of the MongoDB driver; the client object is
    // compatible at runtime, so reuse Mongoose's connection pool instead of opening another.
    client: mongoose.connection.getClient() as unknown as ConstructorParameters<typeof MongoDBSaver>[0]["client"],
    dbName: getEnv().MONGODB_DB,
    checkpointCollectionName: "agent_checkpoints",
    checkpointWritesCollectionName: "agent_checkpoint_writes",
  });
  globalForSaver.mailmindCheckpointer = saver;
  return saver;
}
