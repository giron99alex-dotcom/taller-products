import { withCORS } from "../common/cors";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamo";
import {
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
} from "../lib/responses";

const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const productId = event.pathParameters?.id;
    const callerId = event.requestContext.authorizer?.userId;

    if (!productId) {
      return notFound("Producto no encontrado.");
    }

    if (typeof callerId !== "string" || !callerId) {
      return unauthorized();
    }

    const productsTable = process.env.PRODUCTS_TABLE;

    if (!productsTable) {
      throw new Error("No está configurada la variable PRODUCTS_TABLE.");
    }

    const existing = await dynamo.send(
      new GetCommand({
        TableName: productsTable,
        Key: { productId },
        ConsistentRead: true,
      })
    );

    if (!existing.Item) {
      return notFound("Producto no encontrado.");
    }

    if (existing.Item.sellerId !== callerId) {
      return forbidden("Solo puedes borrar tus propios productos.");
    }

    await dynamo.send(
      new DeleteCommand({
        TableName: productsTable,
        Key: { productId },
        ConditionExpression:
          "attribute_exists(productId) AND #sellerId = :callerId",
        ExpressionAttributeNames: {
          "#sellerId": "sellerId",
        },
        ExpressionAttributeValues: {
          ":callerId": callerId,
        },
      })
    );

    return ok({
      message: "Producto eliminado.",
      productId,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return notFound("El producto ya no existe o cambió de propietario.");
    }

    console.error("Error al eliminar el producto:", error);
    return internalError();
  }
};

export const deleteProduct = withCORS(handler);
