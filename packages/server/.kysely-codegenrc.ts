import {
  type DatabaseMetadata,
  type GeneratorDialect,
  type InterfaceDeclarationNode,
  ObjectExpressionNode,
  RawExpressionNode,
  type SerializeFileOptions,
  TypeScriptSerializer,
} from "kysely-codegen";
import type { Config } from "kysely-codegen/dist/cli/config";

class CustomTypeScriptSerializer extends TypeScriptSerializer {
  constructor(options = {}) {
    super(options);
    this.serializeFile = this.serializeFile.bind(this);
  }

  override serializeFile(
    metadata: DatabaseMetadata,
    dialect: GeneratorDialect,
    options?: SerializeFileOptions,
  ) {
    const data = super.serializeFile(metadata, dialect, options);
    return data.replace(
      "import",
      [
        'import type { ExternalIntegrationSlack } from "./external-integration";',
        'import type { Message } from "./messages";',
        'import type { UserEvent } from "./user-event";',
        'import type { Environment } from "../types";',
        'import type { JSONColumnType } from "kysely"',
        "import",
      ].join("\n"),
    );
  }

  override serializeInterfaceDeclaration(node: InterfaceDeclarationNode) {
    if (node.id.isTableIdentifier && node.id.name === "ExternalIntegration") {
      return this.serializeExternalIntegrationInterfaceDeclaration(node);
    }

    let data = "";
    data += "interface ";
    data += this.serializeIdentifier(node.id);
    data += " ";
    data += this.serializeObjectExpression(node.body);
    return data;
  }

  serializeExternalIntegrationInterfaceDeclaration(
    node: InterfaceDeclarationNode,
  ) {
    let data = "type ExternalIntegration = ExternalIntegrationSlack & ";
    const body = new ObjectExpressionNode(
      node.body.properties.filter(
        (property) => property.key !== "provider" && property.key !== "payload",
      ),
    );
    data += this.serializeObjectExpression(body);
    return data;
  }
}

export default {
  serializer: new CustomTypeScriptSerializer(),
  overrides: {
    columns: {
      "task.event": new RawExpressionNode("JSONColumnType<UserEvent> | null"),
      "task.messages": new RawExpressionNode(
        "Generated<JSONColumnType<Message[]>>",
      ),
      "task.environment": new RawExpressionNode(
        "JSONColumnType<Environment> | null",
      ),
    },
  },
} satisfies Config;
