const consumer = 'react/src/lib/__tests__/';
const admin = 'admin/src/lib/__tests__/';
const group = (feature, availability, layer, files, owner) => ({ feature, availability, layer, owner,
  files: files.map(file => `${consumer}${file}.test.ts`) });

export const groups = [
  group('Merged personal Insights', 'available', 'unit', ['personalInsights'], 'personalInsights / plannerRules / insightsFeed'),
  group('Reports and Ask guidance', 'available', 'unit', ['reportsModel', 'askVyactExamples'], 'reportsModel / intent examples (not provider verification)'),
  group('Reports consultation', 'available', 'unit', ['reportRange', 'budgetTrends', 'essentialRunway'], 'reportRange / budgetTrends / essentialRunway (range, scope-matched budgets, stated-baseline runway)'),
  group('Help and adoption guidance', 'available', 'contract-unit', ['helpContent'], 'helpContent / captured media (not deployed service verification)'),
  group('Navigation and category selection', 'available', 'unit', ['navigationVisibility', 'categoryOptions', 'formRoutes'], 'navModel / categoryOptions / formRoutes'),
  { feature: 'Dashboard MVP presentation', availability: 'available', layer: 'contract-unit', owner: 'Dashboard / feature flags (static rendering, not browser geometry)', files: [`${consumer}dashboardPresentation.test.tsx`] },
  group('Money model', 'available', 'unit', ['money', 'moneyModel.engines', 'moneyModel.invariants', 'moneyModel.regression', 'calculations', 'amortization', 'netWorthProjection', 'fxCentralization', 'pulseBudget'], 'calculations / money / netWorth / amortization'),
  group('Categories and ordering', 'available', 'unit', ['categoryModel', 'ordering'], 'constants / categorization / ordering'),
  group('Accounts', 'available', 'unit', ['accountsView'], 'accountsView (card figures · cycles · staleness · summary · delete guard)'),
  group('Net worth history', 'available', 'unit', ['netWorthSnapshots'], 'netWorthSnapshots / local + cloud adapter contract (recorded snapshots, never reconstructed)'),
  group('Formatting and structured content', 'available', 'unit', ['format', 'learnJsonLd'], 'format / learnJsonLd'),
  group('Recurring and budgets', 'available', 'unit', ['recurring', 'rrule', 'v91', 'budgetOrdering'], 'recurring / rrule / calculations / budgetOrdering'),
  group('Onboarding', 'available', 'unit', ['onboarding', 'onboardingWiring', 'onboardingWorkflow'], 'onboarding / wireOnboardingToMoney'),
  group('Reports, Planner, Insights, notifications', 'available', 'unit', ['featureOutputs'], 'calculations / evaluateRecommendations / buildInsightFeed / notifications'),
  group('Permissions and faults', 'available', 'unit', ['permissionsRole', 'faults'], 'permissions / faults'),
  group('Cloud adapter contracts', 'conditional', 'contract-unit', ['accountPatchSafety', 'supabaseAdapter', 'loanPayment', 'cloudTransport'], 'SupabaseAdapter / askVyactModelCall / whatsappLink'),
  group('Shared splits', 'conditional', 'contract-unit', ['sharedSplitsWorkflow'], 'sharedSplits'),
  group('Authentication and invitations', 'conditional', 'contract-unit', ['authTransport'], 'auth'),
  group('Outbox algorithm', 'available', 'unit', ['outbox'], 'sync/outbox (MemoryDriver)'),
  group('Storage and synchronization', 'available', 'storage-integration', ['storage', 'sync', 'cacheInvalidation', 'cacheBoundary', 'outboxIndexedDb'], 'dataAdapter / kvStore / cacheInvalidation / HybridAdapter'),
  group('Ledger and recurring workflows', 'available', 'store-integration', ['ledgerWorkflow', 'recurringApproval', 'loanPaymentWorkflow'], 'useStore / LocalStorageAdapter / IndexedDB'),
  group('Session transitions', 'conditional', 'store-integration', ['sessionWorkflow'], 'cloudAuthSlice / cacheInvalidation / outbox'),
  group('Loan SQL command', 'conditional', 'sql-integration', ['loanPaymentSql'], 'record_loan_payment migrations (focused PGlite fixture)'),
  group('Ask Vyact', 'conditional', 'unit', ['askVyact', 'agentRouter'], 'runAssistant / router'),
  group('Ask gateway', 'conditional', 'handler-integration', ['gatewayWorkflow'], 'ask-vyact/index.ts'),
  group('WhatsApp parser', 'conditional', 'unit', ['whatsappParser'], 'whatsapp-parser'),
  group('WhatsApp handlers', 'conditional', 'handler-integration', ['whatsappWorkflow'], 'whatsapp-webhook / whatsapp-verify-otp'),
  group('Learned ingestion (not connected to entrypoints)', 'infrastructure', 'unit', ['agentAmbiguity', 'agentClassify', 'agentDedupe', 'agentGrammar', 'agentPipeline', 'agentRecipe', 'agentRecipeStore', 'agentResolver', 'agentValidator'], '_shared/agent ingestion modules'),
  group('Server money port parity', 'infrastructure', 'unit', ['moneyPortParity'], '_shared/agent/tools / client money engines'),
  { feature: 'Estimate provenance', availability: 'available', layer: 'unit', owner: 'estimatedTagCopy', files: ['react/src/components/ui/__tests__/estimatedTag.test.ts'] },
  { feature: 'Admin content and permissions', availability: 'conditional', layer: 'unit', owner: 'rowToArticle / slugify / canAccessPage', files: ['contentApi', 'roleGating'].map(file => `${admin}${file}.test.ts`) },
  { feature: 'Admin publication', availability: 'conditional', layer: 'contract-unit', owner: 'contentApi', files: [`${admin}contentWorkflow.test.ts`] },
];

export const optionalFiles = [`${consumer}askVyactLive.test.ts`];
export const retiredIds = ['CON-UNIT-087', 'CON-UNIT-088', 'CON-UNIT-089', 'CON-UNIT-090', 'CON-UNIT-091', 'CON-UNIT-097', 'CON-UNIT-098'];