import { withCORS } from "../common/cors";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamo";
import { internalError, notFound, ok } from "../lib/responses";

const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const productId = event.pathParameters?.id;

    if (!productId) {
      return notFound("Producto no encontrado.");
    }

    const productsTable = process.env.PRODUCTS_TABLE;

    if (!productsTable) {
      throw new Error("No está configurada la variable PRODUCTS_TABLE.");
    }

    const result = await dynamo.send(
      new GetCommand({
        TableName: productsTable,
        Key: { productId },
        ConsistentRead: true,
      })
    );

    if (!result.Item) {
      return notFound("Producto no encontrado.");
    }

    return ok({
      message: "Producto encontrado.",
      product: result.Item,
    });
  } catch (error) {
    console.error("Error al obtener el producto:", error);
    return internalError();
  }
};

export const getProduct = withCORS(handler);
