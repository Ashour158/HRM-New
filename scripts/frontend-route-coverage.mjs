import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const frontendRoot = join(root, 'apps/hr-web/src');
const apiRoot = join(root, 'apps/hr-api/src');
const highRiskPrefixes = [
  '/admin',
  '/audit',
  '/auth',
  '/employee',
  '/manager/leave',
  '/policy',
  '/absence',
  '/time',
  '/payroll',
  '/hr/core',
  '/hr/organization',
];
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

function toProjectRelative(path) {
  return relative(root, path).split(sep).join('/');
}

function normalizeApiRoute(route) {
  if (!route || typeof route !== 'string') {
    return null;
  }

  let value = route.trim();
  if (value.startsWith('http')) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  if (!value.startsWith('/')) {
    return null;
  }

  value = value.replace(/^\/api\/v\d+/, '') || '/';
  value = value.split('?')[0] ?? value;
  value = value.replace(/\/+/g, '/');
  return value.length > 1 ? value.replace(/\/$/, '') : value;
}

function joinRoute(prefix, suffix) {
  const path = [prefix, suffix]
    .map((part) => (part ?? '').replace(/^\/|\/$/g, ''))
    .filter(Boolean)
    .join('/');
  return `/${path}`.replace(/\/+/g, '/');
}

function routeKey(route) {
  return `${route.method.toUpperCase()} ${route.path}`;
}

function addRoute(routes, route) {
  if (!route.path || !route.method) {
    return;
  }

  const key = routeKey(route);
  const existing = routes.get(key);
  if (existing) {
    existing.sources = mergeUnique([...existing.sources, ...route.sources]);
  } else {
    routes.set(key, { method: route.method.toUpperCase(), path: route.path, sources: mergeUnique(route.sources) });
  }
}

function sourceLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function dynamicSegmentName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  return 'dynamic';
}

function mergeUnique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function routesFromExpression(expression, constants = new Map()) {
  if (!expression) {
    return [];
  }

  if (ts.isStringLiteralLike(expression)) {
    return [expression.text];
  }

  if (ts.isTemplateExpression(expression)) {
    let routes = [expression.head.text];
    for (const span of expression.templateSpans) {
      const replacements = routesFromExpression(span.expression, constants);
      const expressionRoutes = replacements.length > 0 ? replacements : [`:${dynamicSegmentName(span.expression)}`];
      routes = routes.flatMap((route) =>
        expressionRoutes.map((expressionRoute) => `${route}${expressionRoute}${span.literal.text}`),
      );
    }
    return mergeUnique(routes);
  }

  if (ts.isIdentifier(expression)) {
    return constants.get(expression.text) ?? [];
  }

  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isParenthesizedExpression(expression)) {
    return routesFromExpression(expression.expression, constants);
  }

  if (ts.isArrowFunction(expression)) {
    return routesFromExpression(expression.body, constants);
  }

  if (ts.isConditionalExpression(expression)) {
    return mergeUnique([
      ...routesFromExpression(expression.whenTrue, constants),
      ...routesFromExpression(expression.whenFalse, constants),
    ]);
  }

  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = routesFromExpression(expression.left, constants);
    const right = routesFromExpression(expression.right, constants);
    const combined = [];
    for (const leftRoute of left) {
      for (const rightRoute of right) {
        combined.push(`${leftRoute}${rightRoute}`);
      }
    }
    return combined;
  }

  return [];
}

function collectRouteConstants(sourceFile) {
  const constants = new Map();

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const routes = routesFromExpression(node.initializer, constants).filter((route) => normalizeApiRoute(route));
      if (routes.length > 0) {
        constants.set(node.name.text, mergeUnique(routes));
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return constants;
}

function collectApiWrapperFunctions(sourceFile) {
  const wrappers = new Map();

  function paramIndex(params, expression) {
    if (!ts.isIdentifier(expression)) {
      return -1;
    }
    return params.findIndex((param) => ts.isIdentifier(param.name) && param.name.text === expression.text);
  }

  function recordWrapper(name, params, body) {
    if (!name || !body) {
      return;
    }

    function visitBody(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression.getText(sourceFile);
        const method = node.expression.name.text.toLowerCase();
        if ((receiver === 'apiClient' || receiver === 'api') && httpMethods.has(method)) {
          const routeParamIndex = paramIndex(params, node.arguments[0]);
          if (routeParamIndex >= 0) {
            wrappers.set(name, { method, routeParamIndex });
          }
        }
      }
      ts.forEachChild(node, visitBody);
    }

    visitBody(body);
  }

  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      recordWrapper(node.name.text, node.parameters, node.body);
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      recordWrapper(node.name.text, node.initializer.parameters, node.initializer.body);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return wrappers;
}

function methodFromExpression(expression) {
  if (ts.isStringLiteralLike(expression)) {
    const method = expression.text.toLowerCase();
    return httpMethods.has(method) ? method : null;
  }
  return null;
}

function methodFromFetchOptions(expression) {
  if (!expression || !ts.isObjectLiteralExpression(expression)) {
    return 'get';
  }

  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const name = property.name;
    const propertyName = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null;
    if (propertyName === 'method') {
      return methodFromExpression(property.initializer) ?? 'get';
    }
  }

  return 'get';
}

function extractFrontendRoutes(file, content) {
  const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const constants = collectRouteConstants(sourceFile);
  const apiWrappers = collectApiWrapperFunctions(sourceFile);
  const routes = new Map();

  function addFrontendRoutes(method, expressions, node) {
    for (const expression of expressions) {
      for (const rawRoute of routesFromExpression(expression, constants)) {
        const path = normalizeApiRoute(rawRoute);
        if (path) {
          addRoute(routes, {
            method,
            path,
            sources: [`${toProjectRelative(file)}:${sourceLine(sourceFile, node)}`],
          });
        }
      }
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression.getText(sourceFile);
        const method = node.expression.name.text.toLowerCase();
        if ((receiver === 'apiClient' || receiver === 'api') && httpMethods.has(method)) {
          addFrontendRoutes(method, [node.arguments[0]], node);
        }
      } else if (ts.isIdentifier(node.expression)) {
        const callName = node.expression.text;
        if (callName === 'fetch') {
          addFrontendRoutes(methodFromFetchOptions(node.arguments[1]), [node.arguments[0]], node);
        } else if (callName === 'useApiQuery') {
          addFrontendRoutes('get', [node.arguments[1]], node);
        } else if (callName === 'useApiMutation' || callName === 'useOptimisticMutation') {
          addFrontendRoutes(methodFromExpression(node.arguments[1]) ?? 'post', [node.arguments[0]], node);
        } else if (apiWrappers.has(callName)) {
          const wrapper = apiWrappers.get(callName);
          addFrontendRoutes(wrapper.method, [node.arguments[wrapper.routeParamIndex]], node);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...routes.values()];
}

function extractBackendRoutes(file, content) {
  const controllerMatch = content.match(/@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/);
  if (!controllerMatch) {
    return [];
  }

  const controller = controllerMatch[1] ?? '';
  const routes = new Map();
  const pattern = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;

  for (const match of content.matchAll(pattern)) {
    const method = match[1].toUpperCase();
    const path = normalizeApiRoute(joinRoute(controller, match[2] ?? ''));
    const line = content.slice(0, match.index).split(/\r?\n/).length;
    addRoute(routes, {
      method,
      path,
      sources: [`${toProjectRelative(file)}:${line}`],
    });
  }

  return [...routes.values()];
}

function routePatternMatches(backendRoute, frontendRoute) {
  if (backendRoute.method !== frontendRoute.method || backendRoute.path === frontendRoute.path) {
    return backendRoute.method === frontendRoute.method && backendRoute.path === frontendRoute.path;
  }

  const backendParts = backendRoute.path.split('/').filter(Boolean);
  const frontendParts = frontendRoute.path.split('/').filter(Boolean);
  if (backendParts.length !== frontendParts.length) {
    return false;
  }

  return backendParts.every((part, index) => {
    const frontendPart = frontendParts[index] ?? '';
    return part === frontendPart || part.startsWith(':') || frontendPart.startsWith(':');
  });
}

function hasBackendMatch(frontendRoute, backendRoutes) {
  return backendRoutes.some((backendRoute) => routePatternMatches(backendRoute, frontendRoute));
}

function isHighRiskFrontendRoute(route) {
  return highRiskPrefixes.some((prefix) => route.path === prefix || route.path.startsWith(`${prefix}/`));
}

function sortRoutes(routes) {
  return routes.sort((a, b) => routeKey(a).localeCompare(routeKey(b)));
}

const frontendFiles = await walk(frontendRoot);
const apiFiles = await walk(apiRoot);
const frontendRouteMap = new Map();
const backendRouteMap = new Map();

for (const file of frontendFiles) {
  const content = await readFile(file, 'utf8');
  for (const route of extractFrontendRoutes(file, content)) {
    addRoute(frontendRouteMap, route);
  }
}

for (const file of apiFiles) {
  const content = await readFile(file, 'utf8');
  for (const route of extractBackendRoutes(file, content)) {
    addRoute(backendRouteMap, route);
  }
}

const frontendRoutes = sortRoutes([...frontendRouteMap.values()]);
const backendRoutes = sortRoutes([...backendRouteMap.values()]);
const missingHighRisk = frontendRoutes
  .filter((route) => isHighRiskFrontendRoute(route))
  .filter((route) => !hasBackendMatch(route, backendRoutes))
  .map((route) => ({
    method: route.method,
    path: route.path,
    sources: route.sources,
  }));

const output = {
  frontendRoutes: frontendRoutes.length,
  backendRoutes: backendRoutes.length,
  missingHighRisk,
};

if (process.env.ROUTE_COVERAGE_VERBOSE === '1') {
  output.frontendRouteDetails = frontendRoutes;
  output.backendRouteDetails = backendRoutes;
}

console.log(JSON.stringify(output, null, 2));

if (missingHighRisk.length > 0) {
  process.exitCode = 1;
}
