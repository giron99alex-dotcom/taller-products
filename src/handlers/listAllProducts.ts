import { withCORS } from "../common/cors";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import {
  ScanCommand,
  type ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamo";
import { internalError, ok } from "../lib/responses";
import type { Product } from "../types/product";

const handler = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const productsTable = process.env.PRODUCTS_TABLE;

    if (!productsTable) {
      throw new Error("No está configurada la variable PRODUCTS_TABLE.");
    }

    const products: Product[] = [];
    let lastKey: ScanCommandInput["ExclusiveStartKey"];

    do {
      const result = await dynamo.send(
        new ScanCommand({
          TableName: productsTable,
          ExclusiveStartKey: lastKey,
        })
      );

      products.push(...((result.Items ?? []) as Product[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return ok({ products });
  } catch (error) {
    console.error("Error al listar los productos:", error);
    return internalError();
  }
};

export const listAllProducts = withCORS(handler);
