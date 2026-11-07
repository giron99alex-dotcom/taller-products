import { withCORS } from "../common/cors";
    import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../lib/dynamo";
import {
  badRequest,
  created,
  forbidden,
  internalError,
  unauthorized,
} from "../lib/responses";
import type { Product } from "../types/product";

const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const callerId = event.requestContext.authorizer?.userId;
    const callerRole = event.requestContext.authorizer?.role;

    if (typeof callerId !== "string" || !callerId) {
      return unauthorized();
    }

    if (callerRole !== "seller") {
      return forbidden("Solo los vendedores pueden crear productos.");
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

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return badRequest("El nombre y la descripción son requeridos.");
    }

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return badRequest("El precio debe ser un número mayor a cero.");
    }

    if (
      typeof stock !== "number" ||
      !Number.isInteger(stock) ||
      stock <= 0
    ) {
      return badRequest("El stock debe ser un entero mayor a cero.");
    }

    const productsTable = process.env.PRODUCTS_TABLE;

    if (!productsTable) {
      throw new Error("No está configurada la variable PRODUCTS_TABLE.");
    }

    const now = new Date().toISOString();

    const product: Product = {
      productId: uuidv4(),
      sellerId: callerId,
      name: name.trim(),
      description: description.trim(),
      price,
      stock,
      createdAt: now,
      updatedAt: now,
    };

    await dynamo.send(
      new PutCommand({
        TableName: productsTable,
        Item: product,
      })
    );

    return created({
      message: "Producto creado.",
      product,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest("El cuerpo debe contener un JSON válido.");
    }

    console.error("Error al crear el producto:", error);
    return internalError();
  }
};

export const createProduct = withCORS(handler);
