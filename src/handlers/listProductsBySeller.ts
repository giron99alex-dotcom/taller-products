import { withCORS } from "../common/cors";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import {
  QueryCommand,
  type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamo";
import { internalError, ok } from "../lib/responses";
import type { Product } from "../types/product";

const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const sellerId = event.pathParameters?.sellerId;

    if (!sellerId) {
      return ok({ products: [] });
    }

    const productsTable = process.env.PRODUCTS_TABLE;

    if (!productsTable) {
      throw new Error("No está configurada la variable PRODUCTS_TABLE.");
    }

    const products: Product[] = [];
    let lastKey: QueryCommandInput["ExclusiveStartKey"];

    do {
      const result = await dynamo.send(
        new QueryCommand({
          TableName: productsTable,
          IndexName: "seller-index",
          KeyConditionExpression: "#sellerId = :sellerId",
          ExpressionAttributeNames: {
            "#sellerId": "sellerId",
          },
          ExpressionAttributeValues: {
            ":sellerId": sellerId,
          },
          ExclusiveStartKey: lastKey,
        })
      );

      products.push(...((result.Items ?? []) as Product[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return ok({
      sellerId,
      products,
    });
  } catch (error) {
    console.error("Error al listar los productos del vendedor:", error);
    return internalError();
  }
};

export const listProductsBySeller = withCORS(handler);
