import { withCORS } from "../common/cors";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamo";
import {
  badRequest,
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
      return forbidden("Solo puedes actualizar tus propios productos.");
    }

    const body: unknown = JSON.parse(event.body ?? "{}");

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return badRequest("Debes enviar un objeto JSON.");
    }

    const { name, description, price, stock } =
      body as Record<string, unknown>;

    const updates: string[] = ["#updatedAt = :updatedAt"];

    const attributeNames: Record<string, string> = {
      "#updatedAt": "updatedAt",
      "#sellerId": "sellerId",
    };

    const attributeValues: Record<string, unknown> = {
      ":updatedAt": new Date().toISOString(),
      ":callerId": callerId,
    };

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return badRequest("El nombre debe ser un texto no vacío.");
      }

      updates.push("#name = :name");
      attributeNames["#name"] = "name";
      attributeValues[":name"] = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" || !description.trim()) {
        return badRequest("La descripción debe ser un texto no vacío.");
      }

      updates.push("#description = :description");
      attributeNames["#description"] = "description";
      attributeValues[":description"] = description.trim();
    }

    if (price !== undefined) {
      if (
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return badRequest("El precio debe ser un número mayor a cero.");
      }

      updates.push("#price = :price");
      attributeNames["#price"] = "price";
      attributeValues[":price"] = price;
    }

    if (stock !== undefined) {
      if (
        typeof stock !== "number" ||
        !Number.isInteger(stock) ||
        stock < 0
      ) {
        return badRequest("El stock debe ser un entero mayor o igual a cero.");
      }

      updates.push("#stock = :stock");
      attributeNames["#stock"] = "stock";
      attributeValues[":stock"] = stock;
    }

    if (updates.length === 1) {
      return badRequest("Envía al menos un campo para actualizar.");
    }

    const result = await dynamo.send(
      new UpdateCommand({
        TableName: productsTable,
        Key: { productId },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeNames: attributeNames,
        ExpressionAttributeValues: attributeValues,
        ConditionExpression:
          "attribute_exists(productId) AND #sellerId = :callerId",
        ReturnValues: "ALL_NEW",
      })
    );

    return ok({
      message: "Producto actualizado.",
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
      return notFound("El producto ya no existe o cambió de propietario.");
    }

    console.error("Error al actualizar el producto:", error);
    return internalError();
  }
};

export const updateProduct = withCORS(handler);
