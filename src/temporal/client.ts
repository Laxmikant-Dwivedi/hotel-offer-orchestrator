import { Client, Connection } from "@temporalio/client";
import { config } from "../config";
import { hotelAggregationWorkflow, SimulateDownOptions } from "./workflows";
import { HotelOffer } from "../types";

let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Connection.connect({ address: config.temporalAddress }).then(
      (connection) => new Client({ connection, namespace: config.temporalNamespace })
    );
  }
  return clientPromise;
}

export async function runHotelAggregationWorkflow(
  city: string,
  simulateDown?: SimulateDownOptions
): Promise<HotelOffer[]> {
  const client = await getClient();
  const workflowId = `hotel-aggregation-${city.toLowerCase()}-${Date.now()}`;

  return client.workflow.execute(hotelAggregationWorkflow, {
    taskQueue: config.temporalTaskQueue,
    workflowId,
    args: [city.toLowerCase(), simulateDown],
  });
}
