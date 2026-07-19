/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-domain-controller-imports',
      severity: 'error',
      comment:
        "An API controller must not import another domain's repositories, services, " +
        'or aggregates directly - that reaches into the owning domain\'s internals and ' +
        'bypasses its command/event architecture. Cross-domain writes must go through the ' +
        "CommandBus. Cross-domain reads must go through the owning domain's existing " +
        'query endpoints, or a small, explicit public query-service module exported from ' +
        "the owning domain (e.g. domains/<owner>/<owner>-directory.query-service.ts) - " +
        'never a direct import from its repositories/, services/, or aggregates/ folders.',
      from: {
        path: '^src/domains/([^/]+)/api/.*\\.controller\\.ts$',
      },
      to: {
        path: '^src/domains/[^/]+/(repositories|services|aggregates)/',
        pathNot: '^src/domains/$1/',
      },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    exclude: {
      path: '(^|/)(node_modules|dist|coverage)(/|$)',
    },
    doNotFollow: {
      path: 'node_modules',
    },
  },
};
