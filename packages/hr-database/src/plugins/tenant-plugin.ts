import {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  SelectQueryNode,
  UpdateQueryNode,
  DeleteQueryNode,
  WhereNode,
  BinaryOperationNode,
  ColumnNode,
  OperatorNode,
  ValueNode,
  TableNode,
  FromNode,
  AliasNode,
  UnknownRow,
} from 'kysely';
import { getCurrentTenantId } from '../connection/tenant-context.js';

const TENANT_EXEMPT_TABLES = new Set(['tenants']);

function extractTableNames(node: SelectQueryNode | UpdateQueryNode | DeleteQueryNode): string[] {
  const names: string[] = [];

  if (SelectQueryNode.is(node) || DeleteQueryNode.is(node)) {
    if (node.from && FromNode.is(node.from)) {
      for (const fromItem of node.from.froms) {
        if (TableNode.is(fromItem)) {
          names.push(fromItem.table.identifier.name);
        } else if (AliasNode.is(fromItem)) {
          if (TableNode.is(fromItem.node)) {
            names.push(fromItem.node.table.identifier.name);
          }
        }
      }
    }
  }

  if (UpdateQueryNode.is(node) && node.table) {
    if (TableNode.is(node.table)) {
      names.push(node.table.table.identifier.name);
    } else if (AliasNode.is(node.table)) {
      if (TableNode.is(node.table.node)) {
        names.push(node.table.node.table.identifier.name);
      }
    }
  }

  return names;
}



export class TenantFilterPlugin implements KyselyPlugin {
  transformQuery({ node }: PluginTransformQueryArgs): RootOperationNode {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return node;

    const isApplicable =
      SelectQueryNode.is(node) ||
      UpdateQueryNode.is(node) ||
      DeleteQueryNode.is(node);

    if (!isApplicable) return node;

    const tableNames = extractTableNames(node);
    if (tableNames.some((name) => TENANT_EXEMPT_TABLES.has(name))) {
      return node;
    }

    const tenantFilter = BinaryOperationNode.create(
      ColumnNode.create('tenant_id'),
      OperatorNode.create('='),
      ValueNode.create(tenantId)
    );

    const newWhere = node.where
      ? WhereNode.cloneWithOperation(node.where, 'And', tenantFilter)
      : WhereNode.create(tenantFilter);

    if (SelectQueryNode.is(node)) {
      return { ...node, where: newWhere };
    }

    if (UpdateQueryNode.is(node)) {
      return { ...node, where: newWhere };
    }

    if (DeleteQueryNode.is(node)) {
      return { ...node, where: newWhere };
    }

    return node;
  }

  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return args.result;
  }
}
