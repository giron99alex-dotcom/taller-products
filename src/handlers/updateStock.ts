import { withCORS } from "../common/cors";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamo";
import {
  badRequest,
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

    const body: unknown = JSON.parse(event.body ?? "{}");

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return badRequest("Debes enviar un objeto JSON.");
    }

    const { quantity } = body as Record<string, unknown>;

    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return badRequest("La cantidad debe ser un entero mayor a cero.");
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

    if (existing.Item.stock < quantity) {
      return badRequest("Stock insuficiente.");
    }

    const result = await dynamo.send(
      new UpdateCommand({
        TableName: productsTable,
        Key: { productId },
        UpdateExpression:
          "SET #stock = #stock - :quantity, #updatedAt = :updatedAt",
        ConditionExpression:
          "attribute_exists(productId) AND #stock >= :quantity",
        ExpressionAttributeNames: {
          "#stock": "stock",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":quantity": quantity,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return ok({
      message: "Stock actualizado.",
      product: result.Attributes,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest("El cuerpo debe contener un JSON válido.");
    }

    if (
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      return badRequest("Stock insuficiente o producto no disponible.");
    }

    console.error("Error al actualizar el stock:", error);
    return internalError();
  }
};

export const updateStock = withCORS(handler);
