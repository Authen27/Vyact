'use strict';

/* ════════════════════════════════════════════════════════════════
   FinFlow — Family Finance OS  ·  app.js v4.0
   Paper-warm design · Multi-currency · i18n · Debts · Balance sheet
   ════════════════════════════════════════════════════════════════ */

// ── Storage Keys ──────────────────────────────────────────────
const STORAGE_KEYS = {
  txns:    'ff_transactions',
  budgets: 'ff_budgets',
  goals:   'ff_goals',
  members: 'ff_members',
  debts:   'ff_debts',
  assets:  'ff_assets',
  profile: 'ff_profile',
  rates:   'ff_rates',
  theme:   'ff_theme',
  language:'ff_language',
  lastBackup: 'ff_last_backup',
};

// ── CATEGORIES ────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Food & Dining',    icon: '🍔', color: '#E8A87C' },
  { id: 'transport',     label: 'Transport',         icon: '🚗', color: '#4A6FA5' },
  { id: 'shopping',      label: 'Shopping',          icon: '🛍️', color: '#E26D5C' },
  { id: 'entertainment', label: 'Entertainment',     icon: '🎬', color: '#6E4555' },
  { id: 'health',        label: 'Health & Wellness', icon: '💊', color: '#85A88A' },
  { id: 'utilities',     label: 'Utilities',         icon: '⚡', color: '#F4D27A' },
  { id: 'rent',          label: 'Rent / Mortgage',   icon: '🏠', color: '#C44536' },
  { id: 'education',     label: 'Education',         icon: '📚', color: '#6B7C53' },
  { id: 'travel',        label: 'Travel',            icon: '✈️', color: '#4A6FA5' },
  { id: 'childcare',     label: 'Childcare',         icon: '👶', color: '#F4B6A8' },
  { id: 'insurance',     label: 'Insurance',         icon: '🛡️', color: '#6B635C' },
  { id: 'debt_payment',  label: 'Debt Payment',      icon: '⬇️', color: '#C44536' },
  { id: 'debt_interest', label: 'Debt Interest',     icon: '💸', color: '#C44536' },
  { id: 'debt_principal',label: 'Debt Principal',    icon: '⬇️', color: '#85A88A' },
  { id: 'transfer',      label: 'Transfer',          icon: '⇄',  color: '#4A6FA5' },
  { id: 'investment_in', label: 'Investment Buy',    icon: '📈', color: '#E8A87C' },
  { id: 'investment_out',label: 'Investment Sell',   icon: '📉', color: '#E8A87C' },
  { id: 'other_exp',     label: 'Other',             icon: '📦', color: '#6B635C' },
];
const INCOME_CATEGORIES = [
  { id: 'salary',     label: 'Salary',        icon: '💼', color: '#85A88A' },
  { id: 'freelance',  label: 'Freelance',     icon: '💻', color: '#6B7C53' },
  { id: 'investment', label: 'Investment',    icon: '📈', color: '#E8A87C' },
  { id: 'gift',       label: 'Gift / Bonus',  icon: '🎁', color: '#E26D5C' },
  { id: 'rental',     label: 'Rental Income', icon: '🏘️', color: '#4A6FA5' },
  { id: 'business',   label: 'Business Revenue', icon: '🏢', color: '#6E4555' },
  { id: 'other_inc',  label: 'Other Income',  icon: '💰', color: '#85A88A' },
];
const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
const BUDGET_COLORS  = ['#E26D5C','#85A88A','#C44536','#E8A87C','#4A6FA5','#6E4555','#F4D27A','#6B7C53','#F4B6A8'];
const MEMBER_COLORS  = ['#E26D5C','#85A88A','#E8A87C','#4A6FA5','#6E4555','#6B7C53'];

// ── DEBT & ASSET METADATA ────────────────────────────────────
const DEBT_TYPES = {
  credit_card:    { icon: '💳', label: 'Credit Card',     liquidity: 'short' },
  mortgage:       { icon: '🏠', label: 'Mortgage',         liquidity: 'long' },
  auto_loan:      { icon: '🚗', label: 'Auto Loan',        liquidity: 'short' },
  student_loan:   { icon: '🎓', label: 'Student Loan',     liquidity: 'long' },
  personal_loan:  { icon: '📝', label: 'Personal Loan',    liquidity: 'short' },
  business_loan:  { icon: '🏢', label: 'Business Loan',    liquidity: 'short' },
  line_of_credit: { icon: '💼', label: 'Line of Credit',   liquidity: 'short' },
  medical:        { icon: '🏥', label: 'Medical Debt',     liquidity: 'short' },
  family:         { icon: '👪', label: 'Family Loan',      liquidity: 'short' },
  other:          { icon: '📦', label: 'Other',             liquidity: 'short' },
};
const ASSET_TYPES = {
  cash:        { icon: '💵', label: 'Cash',             liquidity: 'liquid' },
  checking:    { icon: '🏦', label: 'Checking',         liquidity: 'liquid' },
  savings:     { icon: '💰', label: 'Savings',          liquidity: 'liquid' },
  investment:  { icon: '📈', label: 'Investment',       liquidity: 'short' },
  retirement:  { icon: '🏛️', label: 'Retirement',       liquidity: 'long' },
  real_estate: { icon: '🏠', label: 'Real Estate',      liquidity: 'long' },
  vehicle:     { icon: '🚗', label: 'Vehicle',          liquidity: 'long' },
  business:    { icon: '🏢', label: 'Business Equity',  liquidity: 'long' },
  receivable:  { icon: '📋', label: 'Money Owed',       liquidity: 'short' },
  collectible: { icon: '💎', label: 'Collectible',      liquidity: 'long' },
};
const GOAL_ICONS  = { emergency:'🛡️', savings:'💰', debt:'⬇️', investment:'📈', purchase:'🎯', custom:'✨' };
const GOAL_COLORS = { emergency:'#4A6FA5', savings:'#85A88A', debt:'#C44536', investment:'#E8A87C', purchase:'#E26D5C', custom:'#6E4555' };
const ROLE_LABELS = { primary:'Primary', partner:'Partner', child:'Child', elder:'Elder' };

// ── CURRENCIES & RATES (USD-base) ────────────────────────────
const CURRENCIES = {
  USD: { symbol:'$',   name:'US Dollar',          locale:'en-US', decimals:2 },
  EUR: { symbol:'€',   name:'Euro',               locale:'de-DE', decimals:2 },
  GBP: { symbol:'£',   name:'British Pound',      locale:'en-GB', decimals:2 },
  INR: { symbol:'₹',   name:'Indian Rupee',       locale:'en-IN', decimals:2 },
  JPY: { symbol:'¥',   name:'Japanese Yen',       locale:'ja-JP', decimals:0 },
  AUD: { symbol:'A$',  name:'Australian Dollar',  locale:'en-AU', decimals:2 },
  CAD: { symbol:'C$',  name:'Canadian Dollar',    locale:'en-CA', decimals:2 },
  CHF: { symbol:'CHF', name:'Swiss Franc',        locale:'de-CH', decimals:2 },
  CNY: { symbol:'¥',   name:'Chinese Yuan',       locale:'zh-CN', decimals:2 },
  AED: { symbol:'AED', name:'UAE Dirham',         locale:'en-AE', decimals:2 },
  SGD: { symbol:'S$',  name:'Singapore Dollar',   locale:'en-SG', decimals:2 },
  BRL: { symbol:'R$',  name:'Brazilian Real',     locale:'pt-BR', decimals:2 },
};
const DEFAULT_RATES = { USD:1.00, EUR:0.92, GBP:0.79, INR:83.20, JPY:149.00, AUD:1.51, CAD:1.35, CHF:0.88, CNY:7.21, AED:3.67, SGD:1.34, BRL:5.05 };

// ── i18n LOCALES ─────────────────────────────────────────────
const LOCALES = {
  en: { name:'English', strings: {
    'dashboard':'Dashboard','transactions':'Transactions','budgets':'Budgets','goals':'Goals','debts':'Debts','networth':'Net Worth','reports':'Reports','settings':'Settings','help':'Help & Guide',
    'nav-track':'TRACK','nav-plan':'PLAN','nav-analyze':'ANALYZE',
    'add-transaction':'Add Transaction','add-budget':'Add Budget','add-goal':'Add Goal','add-debt':'Add Debt','add-asset':'Add Asset',
    'total-balance':'Total Balance','monthly-income':'Monthly Income','monthly-expenses':'Monthly Expenses','savings-rate':'Savings Rate','of-income-saved':'of income saved','this-month':'This month',
    'view-all':'View all →','view-details':'View details →',
    'budget-progress':'Budget Progress','recent-transactions':'Recent Transactions','active-goals':'Active Goals','spending-by-category':'Spending by Category',
    'net-worth-snapshot':'Net Worth Snapshot','debt-overview':'Debt Overview','net-worth':'Net Worth','total-assets':'Total Assets','total-liabilities':'Total Liabilities',
    'total-debt':'Total Debt','monthly-payments':'Monthly Payments','minimum-due':'Minimum due','debt-to-income':'Debt-to-Income','payoff-eta':'Payoff ETA',
    'payoff-strategy':'Payoff Strategy','avalanche':'Avalanche','snowball':'Snowball','payoff-schedule':'Payoff Order & Schedule','based-on-strategy':'Based on selected strategy',
    'liquidity-ratio':'Liquidity Ratio','debt-asset-ratio':'Debt-to-Asset','emergency-coverage':'Emergency Coverage','months-of-expenses':'months of expenses','savings-ratio':'Savings Ratio','of-monthly-income':'of monthly income',
    'assets':'Assets','liabilities':'Liabilities',
    'all-types':'All Types','income':'Income','expense':'Expense','all-categories':'All Categories','all-months':'All Months','all-members':'All Members',
    'monthly-limits':'Monthly spending limits by category','family-milestones':'Your family\'s financial milestones','debt-sub':'Loans, credit cards & payoff strategy','balance-sheet-sub':'Balance sheet · Assets minus Liabilities','performance-over-time':'Financial performance over time','all-household-flows':'All household income & expenses',
    'day':'Day','week':'Week','month':'Month','quarter':'Quarter','year':'Year','monthly':'Monthly',
    'all-time-income':'All-Time Income','all-time-expenses':'All-Time Expenses','net-flow':'Net Flow','income-vs-expenses':'Income vs Expenses Trend','net-by-period':'Net by Period','category-breakdown':'Category Breakdown','this-period':'This period','period-summary':'Period Summary','top-expenses':'Top Expense Categories',
    'profile':'Profile','full-name':'Full Name','email':'Email','household-type':'Household Type','date-format':'Date Format','save-profile':'Save Profile',
    'localization':'Localization & Currency','language':'Language','base-currency':'Base Currency','exchange-rates':'Exchange Rates','reset-rates':'Reset to defaults','currency-note':'Transactions, budgets, debts and assets store their original currency. Reports convert everything to your base currency using rates below.',
    'appearance':'Appearance','debt-preferences':'Debt Preferences','default-payoff-strategy':'Default Payoff Strategy','extra-monthly-payment':'Extra Monthly Payment Capacity',
    'data-sync':'Data Sync & Backup','sync-desc':'Your data is stored locally on this device. Use backup files to sync between devices, share with your accountant, or migrate.','account-stats':'Account Stats',
    'help-title':'Help & Guide','help-sub':'Everything you need to master FinFlow',
    'export-csv':'Export CSV','clear-data':'Clear All Data','dash-sub':'Family Finance Overview','settings-sub':'Profile · Preferences · Data sync',
  }},
  es: { name:'Español', strings: {
    'dashboard':'Panel','transactions':'Transacciones','budgets':'Presupuestos','goals':'Metas','debts':'Deudas','networth':'Patrimonio','reports':'Informes','settings':'Ajustes','help':'Ayuda y Guía',
    'nav-track':'SEGUIR','nav-plan':'PLANIFICAR','nav-analyze':'ANALIZAR',
    'add-transaction':'Añadir Transacción','add-budget':'Añadir Presupuesto','add-goal':'Añadir Meta','add-debt':'Añadir Deuda','add-asset':'Añadir Activo',
    'total-balance':'Saldo Total','monthly-income':'Ingresos Mensuales','monthly-expenses':'Gastos Mensuales','savings-rate':'Tasa de Ahorro','of-income-saved':'de ingresos ahorrados','this-month':'Este mes',
    'view-all':'Ver todo →','view-details':'Ver detalles →',
    'budget-progress':'Progreso del Presupuesto','recent-transactions':'Transacciones Recientes','active-goals':'Metas Activas','spending-by-category':'Gastos por Categoría',
    'net-worth-snapshot':'Patrimonio Actual','debt-overview':'Resumen de Deudas','net-worth':'Patrimonio Neto','total-assets':'Activos Totales','total-liabilities':'Pasivos Totales',
    'total-debt':'Deuda Total','monthly-payments':'Pagos Mensuales','minimum-due':'Mínimo a pagar','debt-to-income':'Deuda-Ingreso','payoff-eta':'ETA de Pago','payoff-strategy':'Estrategia de Pago','avalanche':'Avalancha','snowball':'Bola de Nieve','payoff-schedule':'Orden y Calendario de Pago','based-on-strategy':'Según la estrategia',
    'liquidity-ratio':'Ratio de Liquidez','debt-asset-ratio':'Deuda-Activo','emergency-coverage':'Cobertura de Emergencia','months-of-expenses':'meses de gastos','savings-ratio':'Ratio de Ahorro','of-monthly-income':'de ingresos mensuales','assets':'Activos','liabilities':'Pasivos',
    'all-types':'Todos','income':'Ingreso','expense':'Gasto','all-categories':'Todas las categorías','all-months':'Todos los meses','all-members':'Todos los miembros',
    'day':'Día','week':'Semana','month':'Mes','quarter':'Trimestre','year':'Año','monthly':'Mensual',
    'profile':'Perfil','full-name':'Nombre Completo','email':'Correo','household-type':'Tipo de Hogar','date-format':'Formato de Fecha','save-profile':'Guardar Perfil',
    'localization':'Idioma y Moneda','language':'Idioma','base-currency':'Moneda Base','exchange-rates':'Tasas de Cambio','reset-rates':'Restablecer','appearance':'Apariencia','debt-preferences':'Preferencias de Deuda','data-sync':'Copia y Sincronización','account-stats':'Estadísticas','help-title':'Ayuda y Guía','help-sub':'Todo lo que necesitas para dominar FinFlow',
    'export-csv':'Exportar CSV','clear-data':'Borrar Datos','this-period':'Este período','monthly-limits':'Límites mensuales por categoría','family-milestones':'Hitos financieros de tu familia',
  }},
  fr: { name:'Français', strings: {
    'dashboard':'Tableau','transactions':'Transactions','budgets':'Budgets','goals':'Objectifs','debts':'Dettes','networth':'Patrimoine','reports':'Rapports','settings':'Paramètres','help':'Aide & Guide',
    'nav-track':'SUIVRE','nav-plan':'PLANIFIER','nav-analyze':'ANALYSER',
    'add-transaction':'Ajouter Transaction','add-budget':'Ajouter Budget','add-goal':'Ajouter Objectif','add-debt':'Ajouter Dette','add-asset':'Ajouter Actif',
    'total-balance':'Solde Total','monthly-income':'Revenu Mensuel','monthly-expenses':'Dépenses Mensuelles','savings-rate':'Taux d\'Épargne','of-income-saved':'des revenus épargnés','this-month':'Ce mois',
    'net-worth':'Patrimoine Net','total-assets':'Actifs Totaux','total-liabilities':'Passifs Totaux','total-debt':'Dette Totale','debt-to-income':'Dette/Revenu','assets':'Actifs','liabilities':'Passifs',
    'day':'Jour','week':'Semaine','month':'Mois','quarter':'Trimestre','year':'Année','monthly':'Mensuel',
    'profile':'Profil','language':'Langue','base-currency':'Devise de Base','appearance':'Apparence','help-title':'Aide & Guide','help-sub':'Tout pour maîtriser FinFlow',
    'export-csv':'Exporter CSV','clear-data':'Effacer Données',
  }},
  hi: { name:'हिन्दी', strings: {
    'dashboard':'डैशबोर्ड','transactions':'लेनदेन','budgets':'बजट','goals':'लक्ष्य','debts':'ऋण','networth':'कुल संपत्ति','reports':'रिपोर्ट','settings':'सेटिंग्स','help':'सहायता और गाइड',
    'nav-track':'ट्रैक','nav-plan':'योजना','nav-analyze':'विश्लेषण',
    'add-transaction':'लेनदेन जोड़ें','add-budget':'बजट जोड़ें','add-goal':'लक्ष्य जोड़ें','add-debt':'ऋण जोड़ें','add-asset':'संपत्ति जोड़ें',
    'total-balance':'कुल बैलेंस','monthly-income':'मासिक आय','monthly-expenses':'मासिक खर्च','savings-rate':'बचत दर','this-month':'इस महीने',
    'net-worth':'कुल संपत्ति','total-assets':'कुल संपत्ति','total-liabilities':'कुल देनदारी','assets':'संपत्ति','liabilities':'देनदारी',
    'day':'दिन','week':'सप्ताह','month':'महीना','quarter':'तिमाही','year':'वर्ष','monthly':'मासिक',
    'profile':'प्रोफ़ाइल','language':'भाषा','appearance':'दिखावट','help-title':'सहायता','export-csv':'CSV निर्यात','clear-data':'डेटा साफ़ करें',
  }},
  de: { name:'Deutsch', strings: {
    'dashboard':'Übersicht','transactions':'Transaktionen','budgets':'Budgets','goals':'Ziele','debts':'Schulden','networth':'Vermögen','reports':'Berichte','settings':'Einstellungen','help':'Hilfe & Anleitung',
    'nav-track':'VERFOLGEN','nav-plan':'PLANEN','nav-analyze':'ANALYSIEREN',
    'add-transaction':'Transaktion hinzufügen','total-balance':'Gesamtsaldo','monthly-income':'Monatliches Einkommen','monthly-expenses':'Monatliche Ausgaben','savings-rate':'Sparquote','this-month':'Diesen Monat',
    'net-worth':'Reinvermögen','total-assets':'Gesamtvermögen','total-liabilities':'Gesamtverbindlichkeiten','assets':'Vermögen','liabilities':'Verbindlichkeiten',
    'day':'Tag','week':'Woche','month':'Monat','quarter':'Quartal','year':'Jahr','monthly':'Monatlich',
    'profile':'Profil','language':'Sprache','appearance':'Erscheinungsbild','help-title':'Hilfe','export-csv':'CSV Export','clear-data':'Daten löschen',
  }},
  ja: { name:'日本語', strings: {
    'dashboard':'ダッシュボード','transactions':'取引','budgets':'予算','goals':'目標','debts':'負債','networth':'純資産','reports':'レポート','settings':'設定','help':'ヘルプ',
    'nav-track':'追跡','nav-plan':'計画','nav-analyze':'分析',
    'add-transaction':'取引を追加','total-balance':'総残高','monthly-income':'月収','monthly-expenses':'月額支出','savings-rate':'貯蓄率','this-month':'今月',
    'net-worth':'純資産','total-assets':'総資産','total-liabilities':'総負債','assets':'資産','liabilities':'負債',
    'day':'日','week':'週','month':'月','quarter':'四半期','year':'年','monthly':'月次',
    'profile':'プロフィール','language':'言語','appearance':'外観','help-title':'ヘルプ','export-csv':'CSVエクスポート','clear-data':'データを消去',
  }},
};

// ── PAYMENT METHODS (v5) ─────────────────────────────────────
// Banks · Cards · Wallets — rendered as branded chips on transactions
// Each entry: { name, color, abbr (1-2 chars), kind }
const PAYMENT_METHODS = {
  // Cash & generic
  cash:        { name: 'Cash',           color: '#85A88A', abbr: '$',  kind: 'cash'    },
  bank_xfer:   { name: 'Bank Transfer',  color: '#4A6FA5', abbr: '🏦', kind: 'transfer'},
  check:       { name: 'Check',          color: '#6B635C', abbr: '✓',  kind: 'check'   },
  // Card networks
  visa:        { name: 'Visa',           color: '#1A1F71', abbr: 'V',  kind: 'card'    },
  mastercard:  { name: 'Mastercard',     color: '#EB001B', abbr: 'M',  kind: 'card'    },
  amex:        { name: 'American Express',color:'#2E77BB', abbr: 'AX', kind: 'card'    },
  discover:    { name: 'Discover',       color: '#FF6F00', abbr: 'D',  kind: 'card'    },
  rupay:       { name: 'RuPay',          color: '#1B4F92', abbr: 'R',  kind: 'card'    },
  // US banks
  chase:       { name: 'Chase',          color: '#117ACA', abbr: 'CH', kind: 'bank'    },
  bofa:        { name: 'Bank of America',color: '#012169', abbr: 'BA', kind: 'bank'    },
  wells:       { name: 'Wells Fargo',    color: '#D71E28', abbr: 'WF', kind: 'bank'    },
  citi:        { name: 'Citi',           color: '#003B70', abbr: 'CI', kind: 'bank'    },
  capone:      { name: 'Capital One',    color: '#D03027', abbr: 'C1', kind: 'bank'    },
  ally:        { name: 'Ally Bank',      color: '#6A11CB', abbr: 'AL', kind: 'bank'    },
  marcus:      { name: 'Marcus',         color: '#1A1A1A', abbr: 'MG', kind: 'bank'    },
  // US wallets
  paypal:      { name: 'PayPal',         color: '#003087', abbr: 'PP', kind: 'wallet'  },
  venmo:       { name: 'Venmo',          color: '#3D95CE', abbr: 'V',  kind: 'wallet'  },
  cashapp:     { name: 'Cash App',       color: '#00D632', abbr: '$',  kind: 'wallet'  },
  zelle:       { name: 'Zelle',          color: '#6D1ED4', abbr: 'Z',  kind: 'wallet'  },
  applepay:    { name: 'Apple Pay',      color: '#000000', abbr: '',  kind: 'wallet'  },
  googlepay:   { name: 'Google Pay',     color: '#4285F4', abbr: 'G',  kind: 'wallet'  },
  // International
  hdfc:        { name: 'HDFC Bank',      color: '#004C8F', abbr: 'HD', kind: 'bank'    },
  icici:       { name: 'ICICI Bank',     color: '#F58220', abbr: 'IC', kind: 'bank'    },
  sbi:         { name: 'State Bank',     color: '#22409A', abbr: 'SB', kind: 'bank'    },
  axis:        { name: 'Axis Bank',      color: '#97144D', abbr: 'AX', kind: 'bank'    },
  paytm:       { name: 'Paytm',          color: '#00B9F5', abbr: 'PT', kind: 'wallet'  },
  phonepe:     { name: 'PhonePe',        color: '#5F259F', abbr: 'PP', kind: 'wallet'  },
  upi:         { name: 'UPI',            color: '#097969', abbr: '⟐',  kind: 'wallet'  },
  revolut:     { name: 'Revolut',        color: '#0075EB', abbr: 'RV', kind: 'wallet'  },
  wise:        { name: 'Wise',           color: '#163300', abbr: 'WS', kind: 'wallet'  },
  monzo:       { name: 'Monzo',          color: '#FF3B30', abbr: 'MZ', kind: 'bank'    },
  starling:    { name: 'Starling',       color: '#7433FF', abbr: 'SL', kind: 'bank'    },
  n26:         { name: 'N26',            color: '#36A18B', abbr: 'N',  kind: 'bank'    },
  // Crypto
  coinbase:    { name: 'Coinbase',       color: '#0052FF', abbr: 'CB', kind: 'crypto'  },
  binance:     { name: 'Binance',        color: '#F0B90B', abbr: 'BN', kind: 'crypto'  },
  // Other
  other_pm:    { name: 'Other',          color: '#6B635C', abbr: '?',  kind: 'other'   },
};
const PM_KIND_LABELS = { cash:'Cash', card:'Card', bank:'Bank', wallet:'Wallet', crypto:'Crypto', transfer:'Transfer', check:'Check', other:'Other' };
const getPM = id => PAYMENT_METHODS[id] || null;

// ── PROFILE TYPES (v5 multi-profile) ─────────────────────────
const PROFILE_TYPES = {
  personal:   { icon: '👤', label: 'Personal',         desc: 'Just me' },
  family:     { icon: '👨‍👩‍👧‍👦', label: 'Family',           desc: 'Household with members' },
  business:   { icon: '🏢', label: 'Single Business',  desc: 'One company / venture' },
  multi_biz:  { icon: '🏛️', label: 'Multiple Businesses', desc: 'Holding co · several entities' },
  shared:     { icon: '🤝', label: 'Shared',            desc: 'Roommates · partner pool' },
};

// ── KEYWORD AUTO-CATEGORIZE ──────────────────────────────────
const KEYWORD_MAP = {
  transport:    ['uber','lyft','taxi','bus','train','subway','metro','gas','fuel','parking','toll','ola','rapido','petrol'],
  entertainment:['netflix','spotify','hulu','disney','youtube','concert','movie','cinema','game','steam','prime','apple tv'],
  food:         ['grocery','grocer','whole foods','trader joe','safeway','kroger','aldi','restaurant','cafe','coffee','starbucks','doordash','ubereats','swiggy','zomato','pizza','sushi','burger'],
  health:       ['gym','doctor','pharmacy','hospital','dental','medical','cvs','walgreens','clinic','therapy','vitamin'],
  utilities:    ['electric','water','gas bill','internet','phone','comcast','verizon','airtel','jio','broadband'],
  shopping:     ['amazon','target','walmart','costco','ikea','h&m','zara','flipkart','myntra','nykaa','uniqlo'],
  rent:         ['rent','mortgage','lease','hoa','housing'],
  education:    ['school','tuition','course','udemy','coursera','textbook','book','library'],
  childcare:    ['daycare','babysitter','nanny','preschool','kindergarten'],
  travel:       ['hotel','airbnb','flight','airline','booking.com','expedia','makemytrip'],
  debt_payment: ['credit card payment','loan payment','mortgage payment','emi','installment'],
};

// ── ICONS (Feather-style 24x24) ──────────────────────────────
const ICONS = {
  dashboard:    '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  transactions: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  budgets:      '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
  goals:        '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  splits:       '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M14 14h4a4 4 0 0 1 4 4v3"/>',
  debts:        '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/>',
  networth:     '<line x1="12" y1="3" x2="12" y2="21"/><path d="M5 8 L12 5 L19 8"/><path d="M3 14a3 3 0 0 0 4 0 M3 14L5 8 L7 14"/><path d="M17 14a3 3 0 0 0 4 0 M17 14L19 8 L21 14"/>',
  reports:      '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  settings:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  help:         '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.5.7-2 1-2 2.5"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
};

// ── STATE ─────────────────────────────────────────────────────
let transactions = [];
let budgets      = [];
let goals        = [];
let members      = [];
let debts        = [];
let assets       = [];
let exchangeRates= { ...DEFAULT_RATES };
let profile = {
  name: '', email: '',
  baseCurrency: 'USD',
  language: 'en',
  household: 'family',
  dateFormat: 'us',
  payoffStrategy: 'avalanche',
  extraPayment: 0,
};
let currentPage  = 'dashboard';
let currentPeriod= 'month';
let debtStrategy = 'avalanche';

// ── DATA ADAPTER ─────────────────────────────────────────────
// All persistence flows through this. Today: LocalStorageAdapter.
// Tomorrow: HybridAdapter(supabase) — single line change in init().
let adapter             = null;
let currentHouseholdId  = 'local';      // anonymous mode default

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
const today    = () => new Date().toISOString().split('T')[0];
const uid      = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const getCat   = id => ALL_CATEGORIES.find(c => c.id === id) || { label: id, icon: '📦', color: '#6B635C' };
const getMember= id => members.find(m => m.id === id) || null;
const getMonthKey = d => d.slice(0, 7);
const nowMonthKey = () => today().slice(0, 7);
const escHtml  = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const clamp    = (v, min, max) => Math.max(min, Math.min(max, v));

function t(key) { return LOCALES[profile.language]?.strings?.[key] || LOCALES.en.strings[key] || key; }

function applyLanguage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    const v = t(k);
    if (v) el.textContent = v;
  });
  document.documentElement.lang = profile.language;
}

// Currency conversion
function convert(amount, from, to) {
  if (!amount || from === to) return amount;
  const rFrom = exchangeRates[from] || 1;
  const rTo   = exchangeRates[to]   || 1;
  return (amount / rFrom) * rTo;
}
function toBase(amount, fromCurrency) {
  return convert(amount, fromCurrency || profile.baseCurrency, profile.baseCurrency);
}

// Locale-aware currency format
function fmt(amount, currency) {
  const cur = currency || profile.baseCurrency;
  const c   = CURRENCIES[cur] || CURRENCIES.USD;
  const n   = Math.abs(amount || 0);
  try {
    return new Intl.NumberFormat(c.locale, {
      style: 'currency', currency: cur,
      minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals,
    }).format(n);
  } catch {
    return c.symbol + n.toLocaleString('en-US', { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
  }
}
function fmtShort(amount, currency) {
  const cur = currency || profile.baseCurrency;
  const c   = CURRENCIES[cur] || CURRENCIES.USD;
  const n   = Math.abs(amount || 0);
  if (n >= 1000000) return c.symbol + (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000)   return c.symbol + (n / 1000).toFixed(1) + 'K';
  return c.symbol + n.toLocaleString(c.locale, { maximumFractionDigits: 0 });
}
const fmtSigned = (n, cur) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n), cur);

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (profile.dateFormat === 'iso') return dateStr;
  if (profile.dateFormat === 'eu')  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function monthName(key) {
  const [y, m] = key.split('-');
  return new Date(y, m-1, 1).toLocaleString(undefined, { month:'short', year:'numeric' });
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
function smartCategory(desc, type) {
  if (type === 'income') return 'salary';
  const low = desc.toLowerCase();
  for (const [cat, kws] of Object.entries(KEYWORD_MAP)) {
    if (kws.some(k => low.includes(k))) return cat;
  }
  return 'other_exp';
}

// ══════════════════════════════════════════════════════════════
// STORAGE — routed through adapter
// ══════════════════════════════════════════════════════════════
async function load() {
  // Pull every collection from adapter into in-memory arrays
  // (in-memory caching keeps render functions synchronous & fast)
  transactions = await adapter.list('transactions', currentHouseholdId);
  budgets      = await adapter.list('budgets',      currentHouseholdId);
  goals        = await adapter.list('goals',        currentHouseholdId);
  members      = await adapter.listMemberships(currentHouseholdId);
  debts        = await adapter.list('debts',        currentHouseholdId);
  assets       = await adapter.list('assets',       currentHouseholdId);
  const p      = await adapter.getProfile();
  if (p) profile = { ...profile, ...p };
  const rates  = await adapter.getRates(currentHouseholdId);
  exchangeRates= { ...DEFAULT_RATES, ...(rates || {}) };
  debtStrategy = profile.payoffStrategy || 'avalanche';
}

// Pre-adapter-era no-op kept for backward compat call-sites.
// Remove once we're confident every CRUD path goes through adapter.
function save() { /* adapter persists per-call */ }

// ══════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  document.querySelectorAll('[data-theme-set]').forEach(el => el.classList.toggle('active', el.dataset.themeSet === theme));
  document.querySelectorAll('[data-theme-card]').forEach(el => el.classList.toggle('active', el.dataset.themeCard === theme));
  // Refresh charts/pulse colors
  if (currentPage) renderPage(currentPage);
}
function loadTheme() {
  const t = localStorage.getItem(STORAGE_KEYS.theme) || 'warm';
  setTheme(t);
}

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

// ══════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  currentPage = page;
  renderPage(page);
  // Close mobile sidebar after nav
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('show');
  window.scrollTo({ top: 0 });
}

function renderPage(page) {
  if      (page === 'dashboard')    renderDashboard();
  else if (page === 'transactions') renderTransactions();
  else if (page === 'budgets')      renderBudgets();
  else if (page === 'goals')        renderGoals();
  else if (page === 'splits')       renderSplits();
  else if (page === 'debts')        renderDebts();
  else if (page === 'networth')     renderNetWorth();
  else if (page === 'reports')      renderReports();
  else if (page === 'settings')     renderSettings();
  else if (page === 'help')         renderHelp();
}

// ══════════════════════════════════════════════════════════════
// CALCULATIONS
// ══════════════════════════════════════════════════════════════
function txnAmountInBase(t) { return toBase(t.amount, t.currency || profile.baseCurrency); }

// v5: a transaction's effective amount for reports = your share if split, else amount
// Excluded transactions and non-cash-flow types (investment, transfer) are filtered upstream.
function effectiveAmount(t) {
  if (t.split && t.split.isSplit && typeof t.split.yourShare === 'number') {
    return toBase(t.split.yourShare, t.currency || profile.baseCurrency);
  }
  return txnAmountInBase(t);
}

// Filters out: excluded transactions, investments, transfers
// Returns only true income/expense for aggregation
function reportableTxns(txns) {
  return (txns || transactions).filter(t =>
    !t.excluded && (t.type === 'income' || t.type === 'expense')
  );
}

function monthlyData(monthKey) {
  const txns = reportableTxns().filter(t => getMonthKey(t.date) === monthKey);
  const income  = txns.filter(t => t.type === 'income').reduce((s,t) => s + effectiveAmount(t), 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s,t) => s + effectiveAmount(t), 0);
  return { income, expense, net: income - expense };
}
function totalBalance() {
  return reportableTxns().reduce((s,t) => t.type === 'income' ? s + effectiveAmount(t) : s - effectiveAmount(t), 0);
}
function spendByCategory(monthKey) {
  return reportableTxns()
    .filter(t => t.type === 'expense' && getMonthKey(t.date) === monthKey)
    .reduce((acc,t) => { acc[t.category] = (acc[t.category] || 0) + effectiveAmount(t); return acc; }, {});
}

// Investment totals (for the dashboard investment card)
function investmentInflowThisMonth(monthKey) {
  return transactions.filter(t =>
    t.type === 'investment' && !t.excluded && getMonthKey(t.date) === monthKey
  ).reduce((s,t) => s + txnAmountInBase(t), 0);
}

// Splits — money owed to you / by you
function splitsOutstanding() {
  let owedToYou = 0;
  let youOwe = 0;
  const owedDetails = [];
  const youOweDetails = [];
  transactions.forEach(t => {
    if (!t.split || !t.split.isSplit) return;
    const cur = t.currency || profile.baseCurrency;
    (t.split.participants || []).forEach(p => {
      if (p.paid) return;
      const shareInBase = toBase(p.share, cur);
      if (t.split.paidBy === 'me') {
        owedToYou += shareInBase;
        owedDetails.push({ txn: t, participant: p });
      } else {
        // You participated in someone else's payment — you owe your share
        if (p.name === 'me' || p.isYou) {
          youOwe += shareInBase;
          youOweDetails.push({ txn: t, participant: p });
        }
      }
    });
  });
  return { owedToYou, youOwe, owedDetails, youOweDetails };
}
function totalAssets() {
  return assets.reduce((s,a) => s + toBase(a.value, a.currency), 0);
}
function totalLiabilities() {
  return debts.reduce((s,d) => s + toBase(d.currentBalance, d.currency), 0);
}
function netWorth() { return totalAssets() - totalLiabilities(); }
function liquidAssets() {
  return assets.filter(a => a.liquidity === 'liquid')
               .reduce((s,a) => s + toBase(a.value, a.currency), 0);
}
function totalMonthlyDebtPayment() {
  return debts.reduce((s,d) => s + toBase(d.minimumPayment, d.currency), 0);
}
function debtToIncome() {
  const inc = monthlyData(nowMonthKey()).income;
  if (!inc) return 0;
  return (totalMonthlyDebtPayment() / inc) * 100;
}
function avgMonthlyExpense() {
  const months = [...new Set(transactions.map(t => getMonthKey(t.date)))];
  if (!months.length) return 0;
  return months.reduce((s,mk) => s + monthlyData(mk).expense, 0) / months.length;
}

// ══════════════════════════════════════════════════════════════
// PULSE SCORE — 5 components
//   Budget 25% · Savings 25% · Goals 15% · Trend 15% · Debt 20%
// ══════════════════════════════════════════════════════════════
function computePulseScore() {
  const mk = nowMonthKey();
  const { income, expense } = monthlyData(mk);

  // 1. Budget compliance
  let budgetScore = 60;
  if (budgets.length) {
    const spend = spendByCategory(mk);
    const compliance = budgets.map(b => {
      const limitBase = toBase(b.limit, b.currency);
      const pct = limitBase > 0 ? (spend[b.category] || 0) / limitBase * 100 : 0;
      return clamp(100 - pct, 0, 100);
    });
    budgetScore = compliance.reduce((s,v) => s+v, 0) / compliance.length;
  }

  // 2. Savings rate (target 20% = 100)
  const rate = income > 0 ? (income - expense) / income * 100 : 0;
  const savingsScore = clamp(rate * 5, 0, 100);

  // 3. Goal progress
  let goalScore = 60;
  const activeGoals = goals.filter(g => !g.completed);
  if (activeGoals.length) {
    const progresses = activeGoals.map(g => {
      const tgt = toBase(g.target, g.currency);
      const cur = toBase(g.current, g.currency);
      return tgt > 0 ? clamp(cur / tgt * 100, 0, 100) : 0;
    });
    goalScore = progresses.reduce((s,v) => s+v, 0) / progresses.length;
  }

  // 4. Expense trend
  const [y, m] = mk.split('-').map(Number);
  const prevMk = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
  const prevExp = monthlyData(prevMk).expense;
  let trendScore = 70;
  if (prevExp > 0) {
    const change = (expense - prevExp) / prevExp * 100;
    if      (change <= 0)   trendScore = 100;
    else if (change <= 10)  trendScore = 80;
    else if (change <= 20)  trendScore = 60;
    else if (change <= 40)  trendScore = 40;
    else                    trendScore = 20;
  }

  // 5. Debt health (DTI: 0% = 100, 36% = 50, >50% = 0)
  let debtScore = 100;
  if (debts.length === 0) {
    debtScore = 100;
  } else if (income === 0) {
    debtScore = 40;
  } else {
    const dti = debtToIncome();
    if      (dti <= 15) debtScore = 100;
    else if (dti <= 25) debtScore = 85;
    else if (dti <= 36) debtScore = 65;
    else if (dti <= 50) debtScore = 35;
    else                debtScore = 10;
  }

  const total = Math.round(
    budgetScore * 0.25 + savingsScore * 0.25 + goalScore * 0.15 + trendScore * 0.15 + debtScore * 0.20
  );
  return {
    total: clamp(total, 0, 100),
    components: {
      budget:  Math.round(budgetScore),
      savings: Math.round(savingsScore),
      goals:   Math.round(goalScore),
      trend:   Math.round(trendScore),
      debt:    Math.round(debtScore),
    }
  };
}
function pulseStatus(score) {
  if (score >= 80) return { label: 'Excellent',   color: 'var(--sage)' };
  if (score >= 65) return { label: 'Good',        color: 'var(--coral)' };
  if (score >= 45) return { label: 'Fair',        color: 'var(--honey)' };
  return                  { label: 'Needs Work',  color: 'var(--terra)' };
}

// ══════════════════════════════════════════════════════════════
// AI INSIGHTS
// ══════════════════════════════════════════════════════════════
function getInsights() {
  const chips = [];
  const mk = nowMonthKey();
  const { income, expense } = monthlyData(mk);
  const spend = spendByCategory(mk);
  const rate  = income > 0 ? Math.round((income - expense) / income * 100) : 0;

  if (income > 0) {
    if (rate >= 20) chips.push({ icon:'💚', text:`Savings rate ${rate}% — great work!`, cls:'chip-good' });
    else if (rate >= 10) chips.push({ icon:'📊', text:`Savings rate ${rate}% — target is 20%+`, cls:'chip-warn' });
    else chips.push({ icon:'⚠️', text:`Low savings rate (${rate}%). Review expenses.`, cls:'chip-alert' });
  }
  const over = budgets.filter(b => (spend[b.category] || 0) > toBase(b.limit, b.currency));
  if (over.length === 1) {
    const cat = getCat(over[0].category);
    chips.push({ icon:'🚨', text:`${cat.icon} ${cat.label} is over budget`, cls:'chip-alert' });
  } else if (over.length > 1) {
    chips.push({ icon:'🚨', text:`${over.length} budget categories exceeded`, cls:'chip-alert' });
  }
  // Debt insight
  if (debts.length) {
    const dti = debtToIncome();
    if (dti > 36) chips.push({ icon:'📉', text:`DTI ${dti.toFixed(0)}% — above healthy 36% threshold`, cls:'chip-alert' });
    else if (dti > 0 && dti <= 25) chips.push({ icon:'📈', text:`DTI ${dti.toFixed(0)}% — healthy debt level`, cls:'chip-good' });
  }
  // Net worth
  const nw = netWorth();
  if (assets.length || debts.length) {
    if (nw > 0) chips.push({ icon:'🏆', text:`Net worth: ${fmtShort(nw)} — building wealth`, cls:'chip-good' });
    else        chips.push({ icon:'⬇️', text:`Net worth: ${fmtShort(nw)} — focus on debt payoff`, cls:'chip-warn' });
  }
  return chips.slice(0, 4);
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD RENDER
// ══════════════════════════════════════════════════════════════
function renderDashboard() {
  const mk = nowMonthKey();
  const { income, expense } = monthlyData(mk);
  const balance = totalBalance();
  const rate    = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  document.getElementById('dashMonth').textContent = monthName(mk);

  const balEl = document.getElementById('totalBalance');
  balEl.textContent = fmt(balance);
  balEl.className = 'card-value ' + (balance >= 0 ? 'text-sage' : 'text-terra');
  document.getElementById('monthlyIncome').textContent   = fmt(income);
  document.getElementById('monthlyExpenses').textContent = fmt(expense);
  const srEl = document.getElementById('savingsRate');
  srEl.textContent = rate + '%';
  srEl.className   = 'card-value ' + (rate >= 20 ? 'text-sage' : rate >= 0 ? 'text-honey' : 'text-terra');

  // Pulse score
  const ps = computePulseScore();
  const st = pulseStatus(ps.total);
  const deg = Math.round(ps.total / 100 * 360);
  const ring = document.getElementById('pulseRing');
  ring.style.background = `conic-gradient(${st.color} ${deg}deg, var(--bg3) ${deg}deg)`;
  document.getElementById('pulseScore').textContent  = ps.total;
  document.getElementById('pulseScore').style.color  = st.color;
  document.getElementById('pulseStatus').textContent = st.label;
  document.getElementById('pulseBreakdown').innerHTML = [
    ['Budgets',  ps.components.budget],
    ['Savings',  ps.components.savings],
    ['Goals',    ps.components.goals],
    ['Trend',    ps.components.trend],
    ['Debt',     ps.components.debt],
  ].map(([label, val]) => `
    <div class="pulse-row">
      <span class="pulse-row-label">${label}</span>
      <span class="pulse-row-val" style="color:${val>=70?'var(--sage)':val>=45?'var(--honey)':'var(--terra)'}">${val}</span>
    </div>`).join('');

  // Balance trend
  const [y, m] = mk.split('-').map(Number);
  const prevMk  = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
  const prevBal = transactions
    .filter(t => getMonthKey(t.date) <= prevMk)
    .reduce((s,t) => t.type==='income' ? s+txnAmountInBase(t) : s-txnAmountInBase(t), 0);
  const balDelta = balance - prevBal;
  const trendEl = document.getElementById('balanceTrend');
  trendEl.textContent = balDelta !== 0 ? `${balDelta >= 0 ? '▲' : '▼'} ${fmtShort(Math.abs(balDelta))} vs last month` : 'Same as last month';
  trendEl.className = 'card-sub ' + (balDelta >= 0 ? 'text-sage' : 'text-terra');

  renderInsightsBar();
  renderDashboardBudgets(mk);
  renderRecentTransactions();
  renderDashboardGoals();
  renderCategoryChart(mk);
  renderDashboardNetWorth();
  renderDashboardDebts();
}

function renderInsightsBar() {
  const chips = getInsights();
  const el = document.getElementById('insightsBar');
  if (!chips.length) { el.innerHTML = ''; return; }
  el.innerHTML = chips.map(c =>
    `<div class="insight-chip ${c.cls}"><span class="chip-icon">${c.icon}</span><span>${escHtml(c.text)}</span></div>`
  ).join('');
}

function renderDashboardBudgets(mk) {
  const spend = spendByCategory(mk);
  const el = document.getElementById('dashboardBudgets');
  if (!budgets.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">◎</div><p>No budgets yet</p></div>';
    return;
  }
  el.innerHTML = budgets.slice(0,5).map(b => {
    const cat = getCat(b.category);
    const spent = spend[b.category] || 0;
    const limitBase = toBase(b.limit, b.currency);
    const pct = limitBase > 0 ? Math.min(100, Math.round(spent / limitBase * 100)) : 0;
    const color = pct >= 100 ? 'var(--terra)' : pct >= 80 ? 'var(--honey)' : (b.color || 'var(--coral)');
    return `
      <div class="budget-item">
        <div class="budget-top">
          <span class="budget-name">${cat.icon} ${cat.label}</span>
          <span class="budget-amounts">${fmtShort(spent)} / ${fmtShort(limitBase)}</span>
        </div>
        <div class="budget-bar"><div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="budget-pct">${pct}% used</div>
      </div>`;
  }).join('');
}

function renderRecentTransactions() {
  const el = document.getElementById('recentTransactions');
  const recent = [...transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  if (!recent.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⟺</div><p>No transactions yet</p></div>';
    return;
  }
  el.innerHTML = recent.map(t => txnHTML(t, false)).join('');
}

function renderDashboardGoals() {
  const el = document.getElementById('dashboardGoals');
  const active = goals.filter(g => !g.completed).slice(0,3);
  if (!active.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">◇</div><p>No active goals</p></div>';
    return;
  }
  el.innerHTML = active.map(g => {
    const targetBase = toBase(g.target, g.currency);
    const currentBase = toBase(g.current, g.currency);
    const pct = targetBase > 0 ? Math.min(100, Math.round(currentBase/targetBase*100)) : 0;
    const color = GOAL_COLORS[g.type] || 'var(--coral)';
    return `
      <div class="budget-item">
        <div class="budget-top">
          <span class="budget-name">${GOAL_ICONS[g.type]||'✨'} ${escHtml(g.name)}</span>
          <span class="budget-amounts">${fmtShort(currentBase)} / ${fmtShort(targetBase)}</span>
        </div>
        <div class="budget-bar"><div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="budget-pct">${pct}% complete</div>
      </div>`;
  }).join('');
}

function renderCategoryChart(mk) {
  const spend = spendByCategory(mk);
  const el = document.getElementById('categoryChart');
  const sorted = Object.entries(spend).sort((a,b) => b[1]-a[1]);
  if (!sorted.length) {
    el.innerHTML = '<div class="empty"><p>No expenses this month</p></div>';
    return;
  }
  const max = sorted[0][1];
  el.innerHTML = sorted.map(([catId, amt]) => {
    const cat = getCat(catId);
    const w = Math.round(amt/max*100);
    return `
      <div class="chart-row">
        <div class="chart-label">${cat.icon} ${cat.label}</div>
        <div class="chart-bar-wrap"><div class="chart-bar-fill" style="width:${w}%;background:${cat.color}"></div></div>
        <div class="chart-val">${fmtShort(amt)}</div>
      </div>`;
  }).join('');
}

function renderDashboardNetWorth() {
  const el = document.getElementById('dashboardNetWorth');
  const ta = totalAssets();
  const tl = totalLiabilities();
  const nw = ta - tl;
  if (ta === 0 && tl === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⚖️</div><p>No assets or debts tracked yet</p></div>';
    return;
  }
  const ratio = ta > 0 ? Math.round(tl/ta*100) : 0;
  el.innerHTML = `
    <div class="budget-item">
      <div class="budget-top">
        <span class="budget-name">Assets</span>
        <span class="budget-amounts text-sage">${fmt(ta)}</span>
      </div>
      <div class="budget-bar" style="background:var(--bg3)"><div class="budget-bar-fill" style="width:100%;background:var(--sage)"></div></div>
    </div>
    <div class="budget-item">
      <div class="budget-top">
        <span class="budget-name">Liabilities</span>
        <span class="budget-amounts text-terra">${fmt(tl)}</span>
      </div>
      <div class="budget-bar"><div class="budget-bar-fill" style="width:${Math.min(100, ratio)}%;background:var(--terra)"></div></div>
      <div class="budget-pct">${ratio}% of assets · ${assets.length} assets · ${debts.length} debts</div>
    </div>
    <div class="budget-item" style="background:var(--bg3)">
      <div class="budget-top">
        <span class="budget-name" style="font-family:var(--font-display);font-style:italic;font-size:1rem;">Net Worth</span>
        <span class="budget-amounts" style="font-family:var(--font-display);font-size:1.1rem;color:${nw>=0?'var(--sage)':'var(--terra)'}">${fmtSigned(nw)}</span>
      </div>
    </div>`;
}

function renderDashboardDebts() {
  const el = document.getElementById('dashboardDebts');
  if (!debts.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">💳</div><p>No debts tracked</p></div>';
    return;
  }
  const total = totalLiabilities();
  const monthly = totalMonthlyDebtPayment();
  const dti = debtToIncome();
  const dtiColor = dti <= 25 ? 'var(--sage)' : dti <= 36 ? 'var(--honey)' : 'var(--terra)';
  const top3 = sortedDebts(debtStrategy).slice(0, 3);
  el.innerHTML = `
    <div class="budget-item" style="background:var(--bg3)">
      <div class="budget-top">
        <span class="budget-name">Total Debt · Min Payment</span>
        <span class="budget-amounts"><strong>${fmtShort(total)}</strong> / ${fmtShort(monthly)}/mo</span>
      </div>
      <div class="budget-pct">DTI ratio: <strong style="color:${dtiColor}">${dti.toFixed(0)}%</strong> · ${debtStrategy} strategy</div>
    </div>` +
    top3.map((d, i) => {
      const meta = DEBT_TYPES[d.type] || DEBT_TYPES.other;
      const balBase = toBase(d.currentBalance, d.currency);
      const principalBase = toBase(d.principal || d.currentBalance, d.currency);
      const paid = principalBase > 0 ? Math.max(0, Math.min(100, Math.round((principalBase - balBase) / principalBase * 100))) : 0;
      return `
        <div class="budget-item">
          <div class="budget-top">
            <span class="budget-name">${i===0?'★ ':''}${meta.icon} ${escHtml(d.name)}</span>
            <span class="budget-amounts">${fmtShort(balBase)} @ ${d.interestRate}%</span>
          </div>
          <div class="budget-bar"><div class="budget-bar-fill" style="width:${paid}%;background:var(--sage)"></div></div>
          <div class="budget-pct">${paid}% paid down</div>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS PAGE
// ══════════════════════════════════════════════════════════════
function txnHTML(t, actions = false) {
  const cat = getCat(t.category);
  const bg = cat.color + '22';
  const dateStr = formatDate(t.date);
  const member  = getMember(t.memberId);
  const cur     = t.currency || profile.baseCurrency;
  const showCur = cur !== profile.baseCurrency;
  const pm      = getPM(t.paymentMethod);
  const isInv   = t.type === 'investment';
  const isXfer  = t.type === 'transfer';
  const isSplit = t.split && t.split.isSplit;

  // Payment method chip (branded)
  const pmChip = pm
    ? `<span class="pm-chip" style="background:${pm.color};color:#fff" title="${escHtml(pm.name)}">${escHtml(pm.abbr)}</span>`
    : '';

  // Type-specific sign and color
  let sign = '−', amtCls = 'expense';
  if (t.type === 'income')         { sign = '+'; amtCls = 'income'; }
  else if (isInv)                  { sign = '↗'; amtCls = 'investment'; }
  else if (isXfer)                 { sign = '⇄'; amtCls = 'transfer'; }

  // Display amount: for splits, show your share + total tooltip
  const amtDisplay = isSplit
    ? `<span title="Your share of ${fmt(t.split.totalAmount, cur)} total">${sign}${fmt(t.split.yourShare, cur)} <span class="split-of">/ ${fmtShort(t.split.totalAmount, cur)}</span></span>`
    : `${sign}${fmt(t.amount, cur)}`;

  const badges = [
    t.excluded  ? `<span class="txn-badge excluded">🔒 Private</span>` : '',
    isInv       ? `<span class="txn-badge invest">📈 Investment</span>` : '',
    isXfer      ? `<span class="txn-badge xfer">⇄ Transfer</span>` : '',
    isSplit     ? `<span class="txn-badge split">👥 Split ${(t.split.participants||[]).length}</span>` : '',
    t.recurring ? `<span class="txn-badge recurring">↻ ${t.recurring}</span>` : '',
    member      ? `<span class="txn-badge member">${escHtml(member.name)}</span>` : '',
    showCur     ? `<span class="txn-badge currency">${cur}</span>` : '',
  ].filter(Boolean).join('');

  const cls = ['txn-item'];
  if (t.excluded) cls.push('txn-excluded');
  if (isInv)      cls.push('txn-invest');
  if (isXfer)     cls.push('txn-xfer');

  return `
    <div class="${cls.join(' ')}" data-id="${t.id}">
      ${pmChip}
      <div class="txn-icon" style="background:${bg}">${cat.icon}</div>
      <div class="txn-info">
        <div class="txn-desc">${escHtml(t.description)}</div>
        <div class="txn-meta">${cat.label} · ${dateStr}${t.note?' · '+escHtml(t.note):''}${pm?' · '+escHtml(pm.name):''}</div>
      </div>
      <div class="txn-amount ${amtCls}">${amtDisplay}</div>
      ${badges ? `<div class="txn-badges">${badges}</div>` : ''}
      ${actions ? `<div class="txn-actions">
        <button class="txn-act-btn edit" onclick="editTxn('${t.id}')">Edit</button>
        <button class="txn-act-btn delete" onclick="deleteTxn('${t.id}')">Del</button>
      </div>` : ''}
    </div>`;
}

function renderTransactions() { populateTxnFilters(); filterAndRender(); }

function populateTxnFilters() {
  const catSel = document.getElementById('filterCategory');
  const monthSel = document.getElementById('filterMonth');
  const memSel = document.getElementById('filterMember');
  const prevCat = catSel.value;
  catSel.innerHTML = `<option value="all">${t('all-categories')}</option>` +
    ALL_CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
  catSel.value = prevCat || 'all';
  const months = [...new Set(transactions.map(tt => getMonthKey(tt.date)))].sort().reverse();
  const prevMonth = monthSel.value;
  monthSel.innerHTML = `<option value="all">${t('all-months')}</option>` +
    months.map(mk => `<option value="${mk}">${monthName(mk)}</option>`).join('');
  monthSel.value = prevMonth || 'all';
  const prevMem = memSel.value;
  memSel.innerHTML = `<option value="all">${t('all-members')}</option>` +
    members.map(m => `<option value="${m.id}">${escHtml(m.name)}</option>`).join('');
  memSel.value = prevMem || 'all';
}

function filterAndRender() {
  const search = document.getElementById('searchTxn').value.toLowerCase();
  const type = document.getElementById('filterType').value;
  const cat = document.getElementById('filterCategory').value;
  const month = document.getElementById('filterMonth').value;
  const member = document.getElementById('filterMember').value;

  let filtered = [...transactions];
  if (type !== 'all')   filtered = filtered.filter(tt => tt.type === type);
  if (cat !== 'all')    filtered = filtered.filter(tt => tt.category === cat);
  if (month !== 'all')  filtered = filtered.filter(tt => getMonthKey(tt.date) === month);
  if (member !== 'all') filtered = filtered.filter(tt => tt.memberId === member);
  if (search) filtered = filtered.filter(tt =>
    tt.description.toLowerCase().includes(search) ||
    (tt.note || '').toLowerCase().includes(search) ||
    getCat(tt.category).label.toLowerCase().includes(search)
  );
  filtered.sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const el = document.getElementById('transactionsList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><p>No transactions found</p></div>';
    return;
  }
  el.innerHTML = filtered.map(tt => txnHTML(tt, true)).join('');
}

// ══════════════════════════════════════════════════════════════
// BUDGETS PAGE
// ══════════════════════════════════════════════════════════════
function renderBudgets() {
  const mk = nowMonthKey();
  const spend = spendByCategory(mk);
  const el = document.getElementById('budgetsList');
  if (!budgets.length) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">◎</div><p>No budgets yet — add one to track spending</p></div>`;
    return;
  }
  el.innerHTML = budgets.map(b => {
    const cat = getCat(b.category);
    const limitBase = toBase(b.limit, b.currency);
    const spent = spend[b.category] || 0;
    const pct = limitBase > 0 ? Math.min(100, Math.round(spent/limitBase*100)) : 0;
    const barColor = pct >= 100 ? 'var(--terra)' : pct >= 80 ? 'var(--honey)' : (b.color || 'var(--coral)');
    const remaining = limitBase - spent;
    const status = pct >= 100 ? 'pill-alert' : pct >= 80 ? 'pill-warn' : 'pill-good';
    const statusText = pct >= 100 ? 'OVER' : pct >= 80 ? 'NEAR' : 'ON TRACK';
    return `
      <div class="budget-card">
        <div class="budget-card-top">
          <div class="budget-card-name">
            <div class="budget-card-dot" style="background:${b.color}"></div>
            ${cat.icon} ${cat.label}
          </div>
          <span class="status-pill ${status}">${statusText}</span>
        </div>
        <div class="budget-stat" style="color:${barColor}">${fmt(spent)}</div>
        <div class="budget-limit-txt">of ${fmt(limitBase)} monthly · ${b.currency || profile.baseCurrency}</div>
        <div class="budget-bar"><div class="budget-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
        <div class="budget-remaining ${remaining>=0?'text-sage':'text-terra'}" style="margin-bottom:10px">
          ${remaining>=0 ? fmt(remaining)+' remaining' : fmt(Math.abs(remaining))+' over budget'}
        </div>
        <div class="budget-card-actions" style="display:flex;gap:6px">
          <button class="txn-act-btn edit" onclick="editBudget('${b.id}')">Edit</button>
          <button class="txn-act-btn delete" onclick="deleteBudget('${b.id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// GOALS PAGE
// ══════════════════════════════════════════════════════════════
function renderGoals() {
  const el = document.getElementById('goalsList');
  if (!goals.length) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">◇</div><p>No goals yet — set your first milestone</p></div>`;
    return;
  }
  const sorted = [...goals].sort((a,b) => (a.completed?1:0) - (b.completed?1:0));
  el.innerHTML = sorted.map(g => goalCardHTML(g)).join('');
}

function goalCardHTML(g) {
  const targetBase = toBase(g.target, g.currency);
  const currentBase = toBase(g.current, g.currency);
  const pct = targetBase > 0 ? Math.min(100, Math.round(currentBase/targetBase*100)) : 0;
  const color = GOAL_COLORS[g.type] || 'var(--coral)';
  const icon = GOAL_ICONS[g.type] || '✨';
  const typeLabel = g.type.charAt(0).toUpperCase() + g.type.slice(1);
  const deadline = g.deadline ? (() => {
    const d = daysUntil(g.deadline);
    if (d === null) return '';
    if (d < 0)  return `<span style="color:var(--terra)">${Math.abs(d)}d overdue</span>`;
    if (d === 0) return `<span style="color:var(--honey)">Due today</span>`;
    return `<span class="goal-deadline">${d}d left</span>`;
  })() : '';
  const footer = g.completed
    ? `<div class="goal-footer"><span class="goal-pct" style="color:${color}">${pct}%</span><span class="goal-complete-badge">✓ Complete</span></div>`
    : `<div class="goal-footer"><span class="goal-pct" style="color:${color}">${pct}%</span>${deadline}</div>
       <div class="goal-update-form">
         <input type="number" class="input" placeholder="Add ${g.currency || profile.baseCurrency}…" id="upd-${g.id}" min="0" step="0.01">
         <button class="btn-primary" onclick="addGoalProgress('${g.id}')">+ Add</button>
       </div>`;
  return `
    <div class="goal-card type-${g.type}${g.completed?' completed':''}">
      <div class="goal-top">
        <div class="goal-icon-name">
          <div class="goal-icon">${icon}</div>
          <div>
            <div class="goal-name">${escHtml(g.name)}</div>
            <div class="goal-type-tag">${typeLabel}${g.currency && g.currency !== profile.baseCurrency ? ' · ' + g.currency : ''}</div>
          </div>
        </div>
        <div class="goal-actions">
          ${!g.completed ? `<button class="txn-act-btn edit" onclick="editGoal('${g.id}')">Edit</button>` : ''}
          <button class="txn-act-btn delete" onclick="deleteGoal('${g.id}')">Del</button>
        </div>
      </div>
      <div class="goal-amounts">
        <span class="goal-current">${fmt(currentBase)}</span>
        <span class="goal-of">of ${fmt(targetBase)} target</span>
      </div>
      <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      ${footer}
    </div>`;
}

async function addGoalProgress(id) {
  const input = document.getElementById(`upd-${id}`);
  const val = parseFloat(input.value);
  if (!val || val <= 0) { showToast('Enter a valid amount', 'error'); return; }
  const g = goals.find(x => x.id === id);
  if (!g) return;
  g.current = Math.min(g.target, g.current + val);
  const justCompleted = g.current >= g.target && !g.completed;
  if (justCompleted) g.completed = true;
  await adapter.upsert('goals', currentHouseholdId, g);
  if (justCompleted) showToast(`🎉 Goal "${g.name}" complete!`, 'success');
  else showToast(`Progress updated — ${Math.round(g.current/g.target*100)}% complete`, 'success');
  renderPage(currentPage);
}

// ══════════════════════════════════════════════════════════════
// DEBTS PAGE — Avalanche / Snowball strategies
// ══════════════════════════════════════════════════════════════
function sortedDebts(strategy) {
  const arr = [...debts];
  if (strategy === 'snowball') {
    return arr.sort((a,b) => toBase(a.currentBalance, a.currency) - toBase(b.currentBalance, b.currency));
  }
  return arr.sort((a,b) => b.interestRate - a.interestRate);
}

function payoffMonths(currentBalance, interestRate, monthlyPayment) {
  if (monthlyPayment <= 0 || currentBalance <= 0) return Infinity;
  const r = interestRate / 100 / 12;
  if (r === 0) return Math.ceil(currentBalance / monthlyPayment);
  if (monthlyPayment <= currentBalance * r) return Infinity;
  const n = -Math.log(1 - (r * currentBalance) / monthlyPayment) / Math.log(1 + r);
  return isFinite(n) && n > 0 ? Math.ceil(n) : Infinity;
}
function totalInterestPaid(currentBalance, interestRate, monthlyPayment) {
  const m = payoffMonths(currentBalance, interestRate, monthlyPayment);
  if (!isFinite(m)) return Infinity;
  return Math.max(0, monthlyPayment * m - currentBalance);
}

function renderDebts() {
  // Sync strategy selector buttons
  document.querySelectorAll('#debtStrategy [data-strategy]').forEach(b => b.classList.toggle('active', b.dataset.strategy === debtStrategy));

  // Strategy explainer
  const exp = document.getElementById('strategyExplainer');
  if (debtStrategy === 'avalanche') {
    exp.innerHTML = `<strong>Avalanche method:</strong> Pay minimums on every debt, then funnel any extra payment toward the debt with the <strong>highest interest rate</strong>. Saves the most money mathematically — best when you want to minimize total interest paid.`;
  } else {
    exp.innerHTML = `<strong>Snowball method:</strong> Pay minimums on every debt, then funnel any extra payment toward the debt with the <strong>smallest balance</strong>. Generates quick wins — best when you need motivation from visible progress.`;
  }

  // Summary cards
  const totalBal = totalLiabilities();
  const monthly = totalMonthlyDebtPayment();
  const dti = debtToIncome();
  const dtiColor = dti <= 25 ? 'text-sage' : dti <= 36 ? 'text-honey' : 'text-terra';
  const dtiStatus = dti <= 25 ? 'Healthy' : dti <= 36 ? 'Watch' : 'High risk';
  document.getElementById('debt-total').textContent = fmt(totalBal);
  document.getElementById('debt-count').textContent = `${debts.length} ${debts.length === 1 ? 'account' : 'accounts'}`;
  document.getElementById('debt-monthly').textContent = fmt(monthly);
  document.getElementById('debt-dti').textContent = dti.toFixed(0) + '%';
  document.getElementById('debt-dti').className = 'card-value ' + dtiColor;
  document.getElementById('debt-dti-status').textContent = dtiStatus;
  document.getElementById('debt-strategy-display').textContent = debtStrategy.charAt(0).toUpperCase() + debtStrategy.slice(1);

  // ETA — months until all debts paid using strategy + extra payment
  const etaMonths = computeOverallPayoff();
  const etaEl = document.getElementById('debt-payoff');
  if (!isFinite(etaMonths) || etaMonths === 0) {
    etaEl.textContent = debts.length ? '—' : '✓ Free';
  } else {
    const yrs = Math.floor(etaMonths / 12);
    const mos = etaMonths % 12;
    etaEl.textContent = (yrs > 0 ? yrs + 'y ' : '') + mos + 'mo';
  }

  // Debt list
  const ordered = sortedDebts(debtStrategy);
  const listEl = document.getElementById('debtsList');
  if (!debts.length) {
    listEl.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">💳</div><p>No debts tracked — you're debt-free, or add one to see payoff strategy</p></div>`;
  } else {
    listEl.innerHTML = ordered.map((d, i) => debtCardHTML(d, i)).join('');
  }

  renderPayoffSchedule(ordered);
}

function computeOverallPayoff() {
  if (!debts.length) return 0;
  // Simulate cascading: pay minimums + extra to priority debt; when paid off, roll into next
  let snapshot = debts.map(d => ({
    id: d.id, balance: toBase(d.currentBalance, d.currency),
    rate: d.interestRate, min: toBase(d.minimumPayment, d.currency),
  }));
  let extra = profile.extraPayment || 0;
  let months = 0;
  const order = sortedDebts(debtStrategy).map(d => d.id);
  while (snapshot.some(s => s.balance > 0.01) && months < 600) {
    months++;
    let extraAvail = extra;
    // Find priority — first in order that still has balance
    const priorityId = order.find(id => snapshot.find(s => s.id === id)?.balance > 0.01);
    snapshot.forEach(s => {
      if (s.balance <= 0.01) return;
      const interest = s.balance * (s.rate / 100 / 12);
      let pay = s.min;
      if (s.id === priorityId) pay += extraAvail;
      // Don't overpay
      pay = Math.min(pay, s.balance + interest);
      const principal = Math.max(0, pay - interest);
      s.balance = Math.max(0, s.balance - principal);
    });
  }
  return months;
}

function debtCardHTML(d, rank) {
  const meta = DEBT_TYPES[d.type] || DEBT_TYPES.other;
  const balBase = toBase(d.currentBalance, d.currency);
  const minBase = toBase(d.minimumPayment, d.currency);
  const principalBase = toBase(d.principal || d.currentBalance, d.currency);
  const paid = principalBase > 0 ? Math.max(0, Math.min(100, Math.round((principalBase - balBase) / principalBase * 100))) : 0;
  const isPriority = rank === 0 && debts.length > 1;
  const months = payoffMonths(balBase, d.interestRate, minBase + (isPriority ? (profile.extraPayment || 0) : 0));
  const interest = totalInterestPaid(balBase, d.interestRate, minBase + (isPriority ? (profile.extraPayment || 0) : 0));
  const monthsStr = isFinite(months) ? `${Math.floor(months/12)}y ${months%12}mo` : 'never (raise pmt!)';
  const interestStr = isFinite(interest) ? fmtShort(interest) : '∞';
  return `
    <div class="debt-card${isPriority ? ' priority' : ''}">
      ${isPriority ? '<span class="debt-priority-tag">⚡ Priority</span>' : ''}
      <div class="debt-top">
        <div class="debt-icon-name">
          <div class="debt-icon">${meta.icon}</div>
          <div style="min-width:0">
            <div class="debt-name">${escHtml(d.name)}</div>
            <div class="debt-lender">${meta.label}${d.lender ? ' · ' + escHtml(d.lender) : ''}${d.account ? ' ••••' + escHtml(d.account) : ''}</div>
          </div>
        </div>
        <div class="debt-actions">
          <button class="txn-act-btn edit" onclick="editDebt('${d.id}')">Edit</button>
          <button class="txn-act-btn delete" onclick="deleteDebt('${d.id}')">Del</button>
        </div>
      </div>
      <div class="debt-balance-row">
        <span class="debt-balance">${fmt(balBase)}</span>
        <span class="debt-balance-of">${d.principal ? `of ${fmt(toBase(d.principal, d.currency))} original` : 'current balance'}${d.currency && d.currency !== profile.baseCurrency ? ' · stored in ' + d.currency : ''}</span>
      </div>
      <div class="debt-stats">
        <div class="debt-stat-cell">
          <div class="debt-stat-lbl">APR</div>
          <div class="debt-stat-val">${d.interestRate}%</div>
        </div>
        <div class="debt-stat-cell">
          <div class="debt-stat-lbl">Min/mo</div>
          <div class="debt-stat-val">${fmtShort(minBase)}</div>
        </div>
        <div class="debt-stat-cell">
          <div class="debt-stat-lbl">Due</div>
          <div class="debt-stat-val">${d.dueDate ? formatDate(d.dueDate) : '—'}</div>
        </div>
      </div>
      <div class="debt-progress">
        <div class="debt-progress-top">
          <span class="debt-progress-lbl">Paid Down</span>
          <span class="debt-progress-pct">${paid}%</span>
        </div>
        <div class="debt-progress-bar"><div class="debt-progress-fill" style="width:${paid}%"></div></div>
      </div>
      <div class="debt-payoff">
        <strong>${monthsStr}</strong> to payoff${isPriority && profile.extraPayment > 0 ? ` <em>(with +${fmt(profile.extraPayment)}/mo extra)</em>` : ''} · ~${interestStr} total interest
      </div>
      <div class="debt-pay-btn-wrap">
        <button class="btn-primary" onclick="openDebtPayModal('${d.id}')">Record Payment</button>
        <button class="btn-ghost" onclick="editDebt('${d.id}')">Edit</button>
      </div>
    </div>`;
}

function renderPayoffSchedule(orderedDebts) {
  const el = document.getElementById('payoffSchedule');
  if (!orderedDebts.length) {
    el.innerHTML = '<div class="empty"><p>Add debts to see your payoff schedule</p></div>';
    return;
  }
  const extra = profile.extraPayment || 0;
  el.innerHTML = `
    <div class="schedule-row header">
      <div>#</div><div>Debt</div><div>Balance</div><div>APR</div><div>Payoff</div>
    </div>` +
    orderedDebts.map((d, i) => {
      const meta = DEBT_TYPES[d.type] || DEBT_TYPES.other;
      const balBase = toBase(d.currentBalance, d.currency);
      const minBase = toBase(d.minimumPayment, d.currency);
      const isPriority = i === 0;
      const months = payoffMonths(balBase, d.interestRate, minBase + (isPriority ? extra : 0));
      const monthsStr = isFinite(months) ? `${Math.floor(months/12)}y ${months%12}mo` : '∞';
      return `
        <div class="schedule-row">
          <div class="schedule-rank">${i+1}</div>
          <div>
            <div class="schedule-name">${meta.icon} ${escHtml(d.name)}${isPriority ? ' <span class="status-pill pill-alert" style="margin-left:6px">PRIORITY</span>' : ''}</div>
            <div class="schedule-meta">${escHtml(d.lender || meta.label)}</div>
          </div>
          <div class="schedule-val">${fmtShort(balBase)}</div>
          <div class="schedule-val">${d.interestRate}%</div>
          <div class="schedule-val">${monthsStr}</div>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════
// NET WORTH / BALANCE SHEET
// ══════════════════════════════════════════════════════════════
function renderNetWorth() {
  const ta = totalAssets();
  const tl = totalLiabilities();
  const nw = ta - tl;

  document.getElementById('networth-value').textContent = fmt(nw);
  document.getElementById('networth-value').style.color = nw >= 0 ? 'var(--ink)' : 'var(--terra)';
  document.getElementById('nw-assets').textContent = fmt(ta);
  document.getElementById('nw-liabilities').textContent = fmt(tl);

  // Trend (vs hypothetical baseline)
  const trEl = document.getElementById('networth-trend');
  if (assets.length || debts.length) {
    const ratio = ta > 0 ? Math.round(tl/ta*100) : 0;
    trEl.innerHTML = `${assets.length} assets · ${debts.length} debts · ${ratio}% leverage`;
  } else {
    trEl.innerHTML = 'Add assets and debts to see your full picture';
  }

  // Ratios
  const liquid = liquidAssets();
  const monthlyExp = avgMonthlyExpense();
  const monthlyInc = monthlyData(nowMonthKey()).income;
  const monthlyNet = monthlyData(nowMonthKey()).net;

  // Liquidity ratio: liquid / monthly expenses (in months)
  const liquidityRatio = monthlyExp > 0 ? liquid / monthlyExp : 0;
  document.getElementById('ratio-liquidity').textContent = liquidityRatio.toFixed(1) + ' mo';
  const liqStatus = liquidityRatio >= 6 ? 'Excellent' : liquidityRatio >= 3 ? 'Healthy' : liquidityRatio >= 1 ? 'Building' : 'Low';
  document.getElementById('ratio-liquidity-status').textContent = liqStatus;
  document.getElementById('ratio-liquidity').className = 'card-value ' + (liquidityRatio >= 3 ? 'text-sage' : liquidityRatio >= 1 ? 'text-honey' : 'text-terra');

  // Debt-to-asset
  const dar = ta > 0 ? Math.round(tl/ta*100) : (tl > 0 ? 100 : 0);
  document.getElementById('ratio-debt-asset').textContent = dar + '%';
  const darStatus = dar <= 30 ? 'Strong' : dar <= 50 ? 'Watch' : dar <= 80 ? 'Heavy' : 'Critical';
  document.getElementById('ratio-debt-asset-status').textContent = darStatus;
  document.getElementById('ratio-debt-asset').className = 'card-value ' + (dar <= 30 ? 'text-sage' : dar <= 50 ? 'text-honey' : 'text-terra');

  // Emergency coverage (= liquidity ratio for now)
  document.getElementById('ratio-emergency').textContent = liquidityRatio.toFixed(1);
  document.getElementById('ratio-emergency').className = 'card-value ' + (liquidityRatio >= 6 ? 'text-sage' : liquidityRatio >= 3 ? 'text-honey' : 'text-terra');

  // Savings ratio
  const sr = monthlyInc > 0 ? Math.round(monthlyNet/monthlyInc*100) : 0;
  document.getElementById('ratio-savings').textContent = sr + '%';
  document.getElementById('ratio-savings').className = 'card-value ' + (sr >= 20 ? 'text-sage' : sr >= 10 ? 'text-honey' : 'text-terra');

  // Assets list
  const assetsEl = document.getElementById('assetsList');
  if (!assets.length) {
    assetsEl.innerHTML = '<div class="empty"><div class="empty-icon">💎</div><p>No assets tracked yet</p></div>';
  } else {
    // Group by liquidity
    const byLiq = { liquid: [], short: [], long: [] };
    assets.forEach(a => byLiq[a.liquidity || 'short']?.push(a));
    const liqLabels = { liquid: 'Liquid (cash-equivalent)', short: 'Short-term', long: 'Long-term' };
    let html = '';
    for (const [liq, items] of Object.entries(byLiq)) {
      if (!items.length) continue;
      const sub = items.reduce((s,a) => s + toBase(a.value, a.currency), 0);
      html += `<div class="bs-section-header">${liqLabels[liq]}</div>` +
        items.map(a => bsRowHTML(a, 'asset')).join('') +
        `<div class="bs-subtotal"><span class="bs-subtotal-lbl">Subtotal</span><span class="bs-subtotal-val text-sage">${fmt(sub)}</span></div>`;
    }
    assetsEl.innerHTML = html;
  }
  document.getElementById('assetsTotal').textContent = fmt(ta);

  // Liabilities list
  const liabEl = document.getElementById('liabilitiesList');
  if (!debts.length) {
    liabEl.innerHTML = '<div class="empty"><div class="empty-icon">✓</div><p>No debts — debt free!</p></div>';
  } else {
    const byLiq = { short: [], long: [] };
    debts.forEach(d => {
      const meta = DEBT_TYPES[d.type] || DEBT_TYPES.other;
      byLiq[meta.liquidity || 'short']?.push(d);
    });
    const liqLabels = { short: 'Current Liabilities (under 1 year focus)', long: 'Long-term Liabilities' };
    let html = '';
    for (const [liq, items] of Object.entries(byLiq)) {
      if (!items.length) continue;
      const sub = items.reduce((s,d) => s + toBase(d.currentBalance, d.currency), 0);
      html += `<div class="bs-section-header">${liqLabels[liq]}</div>` +
        items.map(d => bsRowHTML(d, 'debt')).join('') +
        `<div class="bs-subtotal"><span class="bs-subtotal-lbl">Subtotal</span><span class="bs-subtotal-val text-terra">${fmt(sub)}</span></div>`;
    }
    liabEl.innerHTML = html;
  }
  document.getElementById('liabilitiesTotal').textContent = fmt(tl);
}

function bsRowHTML(item, kind) {
  if (kind === 'asset') {
    const meta = ASSET_TYPES[item.type] || ASSET_TYPES.other;
    const valBase = toBase(item.value, item.currency);
    return `
      <div class="bs-row" onclick="editAsset('${item.id}')">
        <div class="bs-icon">${meta.icon}</div>
        <div>
          <div class="bs-name">${escHtml(item.name)}</div>
          <div class="bs-meta">${meta.label}${item.currency && item.currency !== profile.baseCurrency ? ' · ' + item.currency : ''}</div>
        </div>
        <div class="bs-value text-sage">${fmt(valBase)}</div>
        <div class="bs-actions">
          <button class="txn-act-btn edit" onclick="event.stopPropagation();editAsset('${item.id}')">Edit</button>
          <button class="txn-act-btn delete" onclick="event.stopPropagation();deleteAsset('${item.id}')">Del</button>
        </div>
      </div>`;
  } else {
    const meta = DEBT_TYPES[item.type] || DEBT_TYPES.other;
    const balBase = toBase(item.currentBalance, item.currency);
    return `
      <div class="bs-row" onclick="editDebt('${item.id}')">
        <div class="bs-icon">${meta.icon}</div>
        <div>
          <div class="bs-name">${escHtml(item.name)}</div>
          <div class="bs-meta">${item.interestRate}% APR · ${fmtShort(toBase(item.minimumPayment, item.currency))}/mo</div>
        </div>
        <div class="bs-value text-terra">${fmt(balBase)}</div>
        <div class="bs-actions">
          <button class="txn-act-btn edit" onclick="event.stopPropagation();editDebt('${item.id}')">Edit</button>
          <button class="txn-act-btn delete" onclick="event.stopPropagation();deleteDebt('${item.id}')">Del</button>
        </div>
      </div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// REPORTS — Period charts (day/week/month/quarter/year)
// ══════════════════════════════════════════════════════════════
function getPeriodData(period) {
  const now = new Date();
  const data = [];
  const buckets = { day: 30, week: 12, month: 12, quarter: 8, year: 5 };
  const count = buckets[period] || 12;

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    let label, start, end;
    if (period === 'day') {
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      start = ds; end = ds;
      label = d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
    } else if (period === 'week') {
      d.setDate(d.getDate() - i*7);
      const wkStart = new Date(d);
      wkStart.setDate(wkStart.getDate() - wkStart.getDay());
      const wkEnd = new Date(wkStart);
      wkEnd.setDate(wkEnd.getDate() + 6);
      start = wkStart.toISOString().split('T')[0];
      end = wkEnd.toISOString().split('T')[0];
      label = wkStart.toLocaleDateString(undefined, { month:'short', day:'numeric' });
    } else if (period === 'month') {
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      start = `${y}-${String(m+1).padStart(2,'0')}-01`;
      end = `${y}-${String(m+1).padStart(2,'0')}-31`;
      label = d.toLocaleDateString(undefined, { month:'short', year:'2-digit' });
    } else if (period === 'quarter') {
      d.setMonth(d.getMonth() - i*3);
      const y = d.getFullYear();
      const q = Math.floor(d.getMonth() / 3);
      const startM = q*3, endM = startM + 2;
      start = `${y}-${String(startM+1).padStart(2,'0')}-01`;
      end = `${y}-${String(endM+1).padStart(2,'0')}-31`;
      label = `Q${q+1} '${String(y).slice(2)}`;
    } else { // year
      d.setFullYear(d.getFullYear() - i);
      const y = d.getFullYear();
      start = `${y}-01-01`;
      end = `${y}-12-31`;
      label = String(y);
    }
    const txns = transactions.filter(t => t.date >= start && t.date <= end);
    const income = txns.filter(t => t.type === 'income').reduce((s,t) => s + txnAmountInBase(t), 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s,t) => s + txnAmountInBase(t), 0);
    data.push({ label, start, end, income, expense, net: income - expense });
  }
  return data;
}

function renderReports() {
  // Period buttons
  document.querySelectorAll('#periodSelector [data-period]').forEach(b =>
    b.classList.toggle('active', b.dataset.period === currentPeriod));
  const labelMap = { day:'Daily', week:'Weekly', month:'Monthly', quarter:'Quarterly', year:'Annual' };
  document.getElementById('lineChartSub').textContent = labelMap[currentPeriod];
  document.getElementById('rpt-avgPeriodLabel').textContent = labelMap[currentPeriod];

  // All-time stats
  const allInc = transactions.filter(t => t.type === 'income').reduce((s,t) => s + txnAmountInBase(t), 0);
  const allExp = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + txnAmountInBase(t), 0);
  document.getElementById('rpt-totalIncome').textContent = fmt(allInc);
  document.getElementById('rpt-totalExpense').textContent = fmt(allExp);
  const netEl = document.getElementById('rpt-netWorth');
  netEl.textContent = fmt(allInc - allExp);
  netEl.className = 'card-value ' + (allInc >= allExp ? 'text-sage' : 'text-terra');

  const data = getPeriodData(currentPeriod);
  const avgNet = data.length ? data.reduce((s,d) => s + d.net, 0) / data.length : 0;
  const avgEl = document.getElementById('rpt-avgSavings');
  avgEl.textContent = fmt(avgNet);
  avgEl.className = 'card-value ' + (avgNet >= 0 ? 'text-sage' : 'text-terra');

  renderLineChart(data);
  renderNetBarChart(data);
  renderDonutChart(data);
  renderPeriodReport(data);
  renderTopCategories();
}

function renderLineChart(data) {
  const el = document.getElementById('lineChart');
  if (!data.length || data.every(d => d.income === 0 && d.expense === 0)) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>No data for this period</p></div>';
    return;
  }
  const W = 720, H = 220, padL = 50, padR = 16, padT = 16, padB = 32;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxV = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
  const xOf = i => padL + (data.length === 1 ? innerW/2 : (i / (data.length - 1)) * innerW);
  const yOf = v => padT + innerH - (v / maxV) * innerH;

  const line = key => data.map((d,i) => `${i===0?'M':'L'}${xOf(i).toFixed(1)},${yOf(d[key]).toFixed(1)}`).join(' ');
  const area = key => `M${xOf(0).toFixed(1)},${yOf(0).toFixed(1)} ` +
    data.map((d,i) => `L${xOf(i).toFixed(1)},${yOf(d[key]).toFixed(1)}`).join(' ') +
    ` L${xOf(data.length-1).toFixed(1)},${yOf(0).toFixed(1)} Z`;

  // Gridlines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => {
    const y = padT + innerH * (1-p);
    const v = maxV * p;
    return `<line class="grid-line" x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}"/>` +
           `<text class="axis-text" x="${padL-8}" y="${y+3}" text-anchor="end">${fmtShort(v)}</text>`;
  }).join('');

  // X labels
  const showEvery = Math.max(1, Math.ceil(data.length / 8));
  const xLabels = data.map((d,i) => i % showEvery === 0 || i === data.length - 1
    ? `<text class="axis-text" x="${xOf(i)}" y="${H-padB+16}" text-anchor="middle">${escHtml(d.label)}</text>` : '').join('');

  el.innerHTML = `
    <div class="svg-chart-wrap">
      <svg class="svg-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${gridLines}
        <path class="area-income"  d="${area('income')}"/>
        <path class="area-expense" d="${area('expense')}"/>
        <path class="line-income"  d="${line('income')}"/>
        <path class="line-expense" d="${line('expense')}"/>
        ${data.map((d,i) => `<circle class="dot-income"  cx="${xOf(i)}" cy="${yOf(d.income)}" r="3"><title>${escHtml(d.label)}: Income ${fmt(d.income)}</title></circle>`).join('')}
        ${data.map((d,i) => `<circle class="dot-expense" cx="${xOf(i)}" cy="${yOf(d.expense)}" r="3"><title>${escHtml(d.label)}: Expense ${fmt(d.expense)}</title></circle>`).join('')}
        <line class="axis-line" x1="${padL}" y1="${padT+innerH}" x2="${W-padR}" y2="${padT+innerH}"/>
        ${xLabels}
      </svg>
    </div>
    <div class="chart-legend">
      <span><span class="legend-dot income"></span>Income</span>
      <span><span class="legend-dot expense"></span>Expense</span>
    </div>`;
}

function renderNetBarChart(data) {
  const el = document.getElementById('netBarChart');
  if (!data.length) { el.innerHTML = '<div class="empty"><p>No data</p></div>'; return; }
  const W = 360, H = 220, padL = 36, padR = 12, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxAbs = Math.max(...data.map(d => Math.abs(d.net)), 1);
  const zeroY = padT + innerH/2;
  const barW = innerW / data.length * 0.7;
  const gap  = innerW / data.length * 0.3;

  el.innerHTML = `
    <div class="svg-chart-wrap">
      <svg class="svg-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        <line class="axis-line" x1="${padL}" y1="${zeroY}" x2="${W-padR}" y2="${zeroY}"/>
        ${data.map((d, i) => {
          const x = padL + i * (barW + gap) + gap/2;
          const h = Math.abs(d.net) / maxAbs * (innerH/2 - 4);
          const y = d.net >= 0 ? zeroY - h : zeroY;
          const cls = d.net >= 0 ? 'bar-pos' : 'bar-neg';
          return `<rect class="${cls}" x="${x}" y="${y}" width="${barW}" height="${h}" rx="2"><title>${escHtml(d.label)}: ${fmtSigned(d.net)}</title></rect>`;
        }).join('')}
        ${data.map((d, i) => {
          if (i % Math.max(1, Math.ceil(data.length/6)) !== 0 && i !== data.length-1) return '';
          const x = padL + i * (barW + gap) + barW/2 + gap/2;
          return `<text class="axis-text" x="${x}" y="${H-padB+14}" text-anchor="middle">${escHtml(d.label)}</text>`;
        }).join('')}
        <text class="axis-text" x="${padL-6}" y="${zeroY+3}" text-anchor="end">0</text>
        <text class="axis-text" x="${padL-6}" y="${padT+12}" text-anchor="end">+${fmtShort(maxAbs)}</text>
        <text class="axis-text" x="${padL-6}" y="${H-padB-2}" text-anchor="end">-${fmtShort(maxAbs)}</text>
      </svg>
    </div>`;
}

function renderDonutChart(data) {
  const el = document.getElementById('donutChart');
  // Aggregate spending by category for the period
  const start = data[0]?.start || '0000-00-00';
  const end = data[data.length-1]?.end || '9999-12-31';
  const spend = transactions
    .filter(t => t.type === 'expense' && t.date >= start && t.date <= end)
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + txnAmountInBase(t); return acc; }, {});
  const sorted = Object.entries(spend).sort((a,b) => b[1]-a[1]);
  if (!sorted.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🥯</div><p>No expenses in this period</p></div>';
    return;
  }
  const total = sorted.reduce((s,[,v]) => s+v, 0);
  // SVG donut
  const cx = 80, cy = 80, r = 60, sw = 22;
  let cumAngle = -Math.PI / 2;
  const arcs = sorted.map(([catId, amt], i) => {
    const cat = getCat(catId);
    const angle = (amt / total) * Math.PI * 2;
    const x1 = cx + Math.cos(cumAngle) * r;
    const y1 = cy + Math.sin(cumAngle) * r;
    cumAngle += angle;
    const x2 = cx + Math.cos(cumAngle) * r;
    const y2 = cy + Math.sin(cumAngle) * r;
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
    return `<path d="${path}" stroke="${cat.color}" stroke-width="${sw}" fill="none" stroke-linecap="butt"><title>${cat.label}: ${fmt(amt)}</title></path>`;
  }).join('');

  const legend = sorted.slice(0, 8).map(([catId, amt]) => {
    const cat = getCat(catId);
    const pct = Math.round(amt/total*100);
    return `
      <div class="donut-legend-row">
        <div class="donut-legend-dot" style="background:${cat.color}"></div>
        <div class="donut-legend-name">${cat.icon} ${cat.label}</div>
        <div class="donut-legend-amt">${fmtShort(amt)}</div>
        <div class="donut-legend-pct">${pct}%</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="donut-wrap">
      <svg class="donut-svg" viewBox="0 0 160 160" preserveAspectRatio="xMidYMid meet">
        ${arcs}
        <text class="donut-center" x="80" y="78">${fmtShort(total)}</text>
        <text class="donut-center-sub" x="80" y="92">Total</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>`;
}

function renderPeriodReport(data) {
  const el = document.getElementById('periodReport');
  if (!data.length) { el.innerHTML = '<div class="empty"><p>No data</p></div>'; return; }
  el.innerHTML = `
    <div class="period-row header">
      <div>Period</div><div>Income</div><div>Expense</div><div>Net</div>
    </div>` +
    [...data].reverse().map(d => `
      <div class="period-row">
        <div>${escHtml(d.label)}</div>
        <div class="text-sage">${fmt(d.income)}</div>
        <div class="text-terra">${fmt(d.expense)}</div>
        <div class="${d.net>=0?'text-sage':'text-terra'}">${fmtSigned(d.net)}</div>
      </div>`).join('');
}

function renderTopCategories() {
  const el = document.getElementById('topCategories');
  const totals = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + txnAmountInBase(t); return acc; }, {});
  const sorted = Object.entries(totals).sort((a,b) => b[1]-a[1]).slice(0, 8);
  if (!sorted.length) { el.innerHTML = '<div class="empty"><p>No expense data yet</p></div>'; return; }
  const max = sorted[0][1];
  el.innerHTML = sorted.map(([catId, amt]) => {
    const cat = getCat(catId);
    const w = Math.round(amt/max*100);
    return `
      <div class="top-cat-row">
        <div class="top-cat-name">${cat.icon} ${cat.label}</div>
        <div class="top-cat-bar"><div class="top-cat-fill" style="width:${w}%;background:${cat.color}"></div></div>
        <div class="top-cat-amt">${fmtShort(amt)}</div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ══════════════════════════════════════════════════════════════
function renderSettings() {
  // Profile
  document.getElementById('profileName').value = profile.name || '';
  document.getElementById('profileEmail').value = profile.email || '';
  document.getElementById('profileHousehold').value = profile.household || 'family';
  document.getElementById('profileDateFormat').value = profile.dateFormat || 'us';
  document.getElementById('profileStrategy').value = profile.payoffStrategy || 'avalanche';
  document.getElementById('profileExtraPayment').value = profile.extraPayment || 0;

  // Avatar
  const avatar = document.getElementById('profileAvatar');
  if (profile.name) {
    const initials = profile.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    avatar.textContent = initials;
    document.getElementById('profileNameDisplay').textContent = profile.name;
  } else {
    avatar.textContent = '👤';
    document.getElementById('profileNameDisplay').textContent = 'Set your name';
  }
  document.getElementById('profileEmailDisplay').textContent = profile.email || '—';

  // Language
  const langSel = document.getElementById('profileLanguage');
  langSel.innerHTML = Object.entries(LOCALES).map(([code, l]) =>
    `<option value="${code}" ${code === profile.language ? 'selected' : ''}>${l.name} (${code.toUpperCase()})</option>`
  ).join('');

  // Currency
  const curSel = document.getElementById('profileCurrency');
  curSel.innerHTML = Object.entries(CURRENCIES).map(([code, c]) =>
    `<option value="${code}" ${code === profile.baseCurrency ? 'selected' : ''}>${c.symbol} ${code} — ${c.name}</option>`
  ).join('');

  // Theme cards
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'warm';
  document.querySelectorAll('[data-theme-card]').forEach(c => c.classList.toggle('active', c.dataset.themeCard === currentTheme));

  // Rates
  document.getElementById('ratesBaseLabel').textContent = profile.baseCurrency;
  const ratesEl = document.getElementById('ratesGrid');
  ratesEl.innerHTML = Object.entries(CURRENCIES)
    .filter(([code]) => code !== profile.baseCurrency)
    .map(([code]) => {
      const rate = (exchangeRates[code] / exchangeRates[profile.baseCurrency]).toFixed(4);
      return `
        <div class="rate-row">
          <span class="rate-code">${code}</span>
          <input type="number" class="input rate-input" step="0.0001" min="0" value="${rate}" data-rate="${code}" onchange="updateRate('${code}', this.value)">
        </div>`;
    }).join('');

  // Last backup
  const lb = localStorage.getItem(STORAGE_KEYS.lastBackup);
  document.getElementById('lastBackupTime').textContent = lb ? new Date(lb).toLocaleString() : 'Never';

  // Stats
  const statsEl = document.getElementById('accountStats');
  statsEl.innerHTML = [
    { n: transactions.length, l: 'Transactions' },
    { n: budgets.length, l: 'Budgets' },
    { n: goals.length, l: 'Goals' },
    { n: members.length, l: 'Members' },
    { n: debts.length, l: 'Debts' },
    { n: assets.length, l: 'Assets' },
    { n: [...new Set(transactions.map(t => getMonthKey(t.date)))].length, l: 'Months Tracked' },
    { n: Object.keys(LOCALES).length, l: 'Languages' },
  ].map(s => `<div class="stat-cell"><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>`).join('');
}

async function saveProfile() {
  const patch = {
    name:       document.getElementById('profileName').value.trim(),
    email:      document.getElementById('profileEmail').value.trim(),
    household:  document.getElementById('profileHousehold').value,
    dateFormat: document.getElementById('profileDateFormat').value,
  };
  Object.assign(profile, patch);
  await adapter.updateProfile(patch);
  renderSettings();
  showToast('Profile saved', 'success');
}

async function saveDebtPrefs() {
  const patch = {
    payoffStrategy: document.getElementById('profileStrategy').value,
    extraPayment:   parseFloat(document.getElementById('profileExtraPayment').value) || 0,
  };
  Object.assign(profile, patch);
  debtStrategy = patch.payoffStrategy;
  await adapter.updateProfile(patch);
  showToast('Debt preferences saved', 'success');
}

async function setLanguage(code) {
  profile.language = code;
  await adapter.updateProfile({ language: code });
  applyLanguage();
  renderPage(currentPage);
  showToast('Language: ' + LOCALES[code].name, 'success');
}

async function setBaseCurrency(code) {
  profile.baseCurrency = code;
  await adapter.updateProfile({ baseCurrency: code });
  renderPage(currentPage);
  if (currentPage === 'settings') renderSettings();
  showToast('Base currency: ' + code, 'success');
}

async function updateRate(code, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) return;
  // value entered is "1 BASE = X CODE" — store as USD-base
  const newUsdRate = exchangeRates[profile.baseCurrency] * v;
  exchangeRates[code] = newUsdRate;
  await adapter.upsertRate(currentHouseholdId, code, newUsdRate);
  showToast(`${code} rate updated`, 'info');
}

async function resetRates() {
  exchangeRates = { ...DEFAULT_RATES };
  // Push every default rate through the adapter
  for (const [code, rate] of Object.entries(DEFAULT_RATES)) {
    await adapter.upsertRate(currentHouseholdId, code, rate);
  }
  renderSettings();
  showToast('Rates reset to defaults', 'info');
}

// ══════════════════════════════════════════════════════════════
// HELP PAGE
// ══════════════════════════════════════════════════════════════
const HELP_CONTENT = [
  {
    icon: '🆕',
    title: "What's New in v5",
    summary: 'Splits, profiles, loans & privacy',
    body: `
      <p>v5 is the biggest feature drop yet. Six new capabilities, all designed to stay low-learning-curve.</p>
      <ul>
        <li><strong>🔒 Private transactions</strong> — toggle <code>Exclude from reports</code> on any transaction. Stays in your history but doesn't skew totals, charts, the Pulse Score, or Net Worth.</li>
        <li><strong>💳 Payment method library</strong> — pick from 30+ banks, cards, and wallets (Visa, Mastercard, Amex, Chase, BofA, Wells Fargo, PayPal, Venmo, Cash App, HDFC, ICICI, SBI, Paytm, Revolut, Wise, Coinbase, more). Renders as a branded chip on the row.</li>
        <li><strong>📈 Investment &amp; Transfer types</strong> — money flowing into a brokerage isn't an expense; cash moved between accounts isn't either. Both stay <em>out</em> of expense/income totals so reports stay accurate.</li>
        <li><strong>👥 Multi-profile</strong> — keep Personal, Family, and Business contexts separate on the same device. Switcher lives in the sidebar header.</li>
        <li><strong>🤝 Split payments</strong> — log a $400 dinner you paid for; only your $100 share counts as expense. The rest tracks as outstanding IOUs in the new <strong>Splits</strong> page.</li>
        <li><strong>🏦 Loan tracker / EMI</strong> — debt payments now split automatically into interest (true expense) and principal (transfer). Your spending reports finally reflect the <em>real</em> cost of debt.</li>
      </ul>
      <p>Open <strong>VERSIONS.md</strong> in the project for the full changelog across releases.</p>
    `,
  },
  {
    icon: '🔒',
    title: 'Private Transactions',
    summary: 'Keep some flows out of reports',
    body: `
      <p>Some transactions are sensitive — a one-off purchase, a gift, a settlement — and would skew your monthly trends. Private transactions solve this.</p>
      <p><strong>How:</strong> In the transaction modal, check <code>🔒 Private — exclude from reports &amp; charts</code>.</p>
      <p><strong>Effect:</strong></p>
      <ul>
        <li>Hidden from <strong>monthly income/expense totals</strong></li>
        <li>Excluded from <strong>category charts</strong> and the spending donut</li>
        <li>Doesn't affect the <strong>Family Pulse Score</strong></li>
        <li>Doesn't appear in <strong>Reports period charts</strong></li>
        <li>Still visible in your <strong>Transactions list</strong> with a dashed-stripe pattern + 🔒 Private badge</li>
        <li>Still counted in your <strong>Total Balance</strong> (it's still a real cash event)</li>
      </ul>
    `,
  },
  {
    icon: '💳',
    title: 'Payment Methods',
    summary: 'Banks, cards, wallets',
    body: `
      <p>Tag every transaction with how it was paid. The chip on each row makes it instantly clear at a glance whether something hit your Chase card, Venmo, or cash.</p>
      <p>Built-in: <strong>Visa, Mastercard, Amex, Discover, RuPay</strong> · <strong>Chase, BofA, Wells Fargo, Citi, Capital One, Ally, Marcus</strong> · <strong>HDFC, ICICI, SBI, Axis</strong> · <strong>Monzo, Starling, N26, Revolut, Wise</strong> · <strong>PayPal, Venmo, Cash App, Zelle, Apple Pay, Google Pay, Paytm, PhonePe, UPI</strong> · <strong>Coinbase, Binance</strong> · plus Cash, Check, Bank Transfer, Other.</p>
      <p>To extend: drop a new entry into the <code>PAYMENT_METHODS</code> object in <code>app.js</code>. Each entry needs <code>{name, color, abbr, kind}</code>.</p>
    `,
  },
  {
    icon: '📈',
    title: 'Investment & Transfer Types',
    summary: 'Beyond income and expense',
    body: `
      <p>Money behaves differently depending on what's happening. v5 introduces two new types alongside Income and Expense:</p>
      <ul>
        <li><strong>Investment</strong> — Money put into a brokerage, retirement account, or other long-term asset. <em>Not an expense</em> — value didn't disappear, it just moved. Optionally link to an existing Asset and FinFlow auto-bumps that asset's value.</li>
        <li><strong>Transfer</strong> — Cash moved between accounts (savings ⇄ checking, paying down loan principal). <em>Not income, not expense</em> — pure shuffling.</li>
      </ul>
      <p>Both types are <strong>excluded</strong> from monthly income/expense totals, the Pulse Score, and category charts — your reports show only true cash flow.</p>
      <p>Investment buys appear in the <strong>Net Worth</strong> page automatically (via the linked Asset). Transfers don't impact net worth either way.</p>
    `,
  },
  {
    icon: '👤',
    title: 'Multi-Profile Workspaces',
    summary: 'Personal, Family, Business — switch instantly',
    body: `
      <p>Many people have multiple financial contexts: personal money, family money, side-business money. v5 lets you keep them isolated.</p>
      <p><strong>Profile types:</strong></p>
      <ul>
        <li>👤 <strong>Personal</strong> — Just you</li>
        <li>👨‍👩‍👧‍👦 <strong>Family</strong> — Household with members</li>
        <li>🏢 <strong>Single Business</strong> — One company / venture</li>
        <li>🏛️ <strong>Multiple Businesses</strong> — Holding co · several entities</li>
        <li>🤝 <strong>Shared</strong> — Roommates · partner pool</li>
      </ul>
      <p><strong>Each profile has its own:</strong> transactions, budgets, goals, debts, assets, members, currency, exchange rates. Nothing leaks between them.</p>
      <p><strong>Switching:</strong> click the profile chip at the top of the sidebar. <strong>Creating:</strong> click "+ Create new profile" in the dropdown. <strong>Managing:</strong> rename or delete via "⚙ Manage profiles".</p>
      <p><em>Note:</em> profiles are <strong>device-local</strong> in v5. To sync across devices, export a backup from one and restore on the other. Cloud sync arrives post-Supabase integration (see <code>ARCHITECTURE.md</code>).</p>
    `,
  },
  {
    icon: '🤝',
    title: 'Split Payments',
    summary: 'Group bills without skewing reports',
    body: `
      <p>Classic problem: you cover a $400 dinner for 4 friends. Your reports shouldn't show $400 in expenses (you're getting $300 back) and they shouldn't show $300 in income when friends repay (it's not income — it's recoupment).</p>
      <p><strong>How splits work:</strong></p>
      <ol>
        <li>Add the transaction at the <em>full amount</em> ($400)</li>
        <li>Toggle <code>👥 Split this with others</code> in the modal</li>
        <li>Add participants (auto-includes "You")</li>
        <li>Set each share — click "+ Add Participant" to add more, shares auto-equalize when you change the total</li>
        <li>Choose who paid: <strong>I paid</strong> (others owe you) or <strong>Someone else paid</strong> (you owe them)</li>
      </ol>
      <p><strong>What FinFlow does:</strong></p>
      <ul>
        <li>Reports use <strong>only your share</strong> as expense ($100 in the example)</li>
        <li>The remaining $300 shows as outstanding IOUs in the <strong>Splits</strong> page</li>
        <li>When a friend pays you back, click <strong>Settle</strong> on their row — no fake "income" entry needed</li>
      </ul>
      <p>The <strong>Splits</strong> page (in the sidebar) shows your full IOU picture: <em>Owed to You</em> by person, plus <em>You Owe</em> across all your unpaid shares.</p>
    `,
  },
  {
    icon: '🏦',
    title: 'Loan Tracker & EMI Breakdown',
    summary: "Track loans like an accountant",
    body: `
      <p>When you make a $1,200 mortgage payment, only ~$300 might be actual interest expense — the other $900 is paying down principal (a transfer of cash to debt-reduction, not a real cost).</p>
      <p>Pre-v5 FinFlow logged the full payment as expense, inflating your spending reports. <strong>v5 fixes this.</strong></p>
      <p><strong>Setting up a loan:</strong> in the Debt modal, fill in:</p>
      <ul>
        <li><strong>Bank / Lender</strong></li>
        <li><strong>Interest Rate (% APR)</strong></li>
        <li><strong>Tenure (months)</strong> — e.g. 360 for a 30-year mortgage <em>(optional but enables EMI calc)</em></li>
        <li><strong>Min / EMI Monthly Payment</strong></li>
      </ul>
      <p>The modal shows a <strong>live EMI preview</strong>: calculated EMI for the tenure, total interest over the life of the loan, and a breakdown of next month's payment into interest and principal portions.</p>
      <p><strong>Recording a payment:</strong> click "Record Payment" on the debt card. FinFlow now creates <strong>two linked transactions</strong>:</p>
      <ul>
        <li><strong>Interest portion</strong> — logged as <code>expense</code>, category <code>debt_interest</code> — counts in reports as your true cost of debt</li>
        <li><strong>Principal portion</strong> — logged as <code>transfer</code>, category <code>debt_principal</code> — excluded from expense reports because it's just shifting cash to equity</li>
      </ul>
      <p>Both transactions reference the debt via <code>linkedDebtId</code> for traceability. Your monthly expenses now reflect the <em>real</em> cost of carrying debt.</p>
    `,
  },
  {
    icon: '🚀',
    title: 'Getting Started',
    summary: 'Your first 5 minutes',
    body: `
      <p>Welcome! FinFlow is designed to give your household a complete financial picture in one place.</p>
      <ol>
        <li><strong>Add household members</strong> in the sidebar — Primary, Partner, Child, or Elder roles.</li>
        <li><strong>Create budgets</strong> for the categories you want to track.</li>
        <li><strong>Log transactions</strong> as they happen — press <code>N</code> from anywhere.</li>
        <li><strong>Set financial goals</strong> — emergency fund, savings, debt payoff.</li>
        <li><strong>Add debts and assets</strong> to see your full balance sheet and net worth.</li>
      </ol>
      <p>The <strong>Family Pulse Score™</strong> on your dashboard summarizes your household's financial health in a single number from 0–100.</p>
    `,
  },
  {
    icon: '🧬',
    title: 'Family Pulse Score™',
    summary: 'How the score is calculated',
    body: `
      <p>Your Pulse Score is a composite of <strong>5 components</strong>, each weighted:</p>
      <ul>
        <li><strong>Budget Compliance (25%)</strong> — How close you are to your spending limits.</li>
        <li><strong>Savings Rate (25%)</strong> — % of income saved. 20%+ scores 100.</li>
        <li><strong>Goal Progress (15%)</strong> — Average % complete across active goals.</li>
        <li><strong>Expense Trend (15%)</strong> — Whether expenses are rising or falling vs last month.</li>
        <li><strong>Debt Health (20%)</strong> — Your debt-to-income ratio. Under 25% scores 85+.</li>
      </ul>
      <p><strong>Thresholds:</strong> 80+ Excellent · 65–79 Good · 45–64 Fair · &lt;45 Needs Work.</p>
    `,
  },
  {
    icon: '⬇️',
    title: 'Debt Management',
    summary: 'Avalanche vs. Snowball strategies',
    body: `
      <p>FinFlow supports two well-known debt payoff strategies:</p>
      <ul>
        <li><strong>Avalanche</strong> — Pay minimums on every debt, then funnel any extra payment to the debt with the <em>highest interest rate</em>. <strong>Saves the most money</strong> mathematically.</li>
        <li><strong>Snowball</strong> — Pay minimums on every debt, then funnel any extra payment to the debt with the <em>smallest balance</em>. <strong>Generates quick wins</strong> for motivation.</li>
      </ul>
      <p>Set your <strong>Extra Monthly Payment Capacity</strong> in Settings → Debt Preferences. This amount cascades through your debts in priority order — once a debt is paid off, the entire payment rolls into the next one.</p>
      <p><strong>Debt-to-Income (DTI) ratio</strong> = sum of minimum payments ÷ monthly income. Healthy: ≤25% · Watch: 25–36% · High risk: &gt;36%.</p>
      <p>To record a payment, click <code>Record Payment</code> on a debt card. This automatically creates a corresponding "Debt Payment" transaction and reduces the debt balance.</p>
    `,
  },
  {
    icon: '⚖️',
    title: 'Net Worth & Balance Sheet',
    summary: 'Reading your financial position',
    body: `
      <p>Your <strong>Net Worth = Total Assets − Total Liabilities</strong>.</p>
      <p>Assets are organized by liquidity:</p>
      <ul>
        <li><strong>Liquid</strong> — Cash, checking, savings. Available immediately.</li>
        <li><strong>Short-term</strong> — Investments, receivables. Convertible within 1 year.</li>
        <li><strong>Long-term</strong> — Real estate, retirement, vehicles, business equity.</li>
      </ul>
      <p><strong>Key ratios on the Net Worth page:</strong></p>
      <ul>
        <li><strong>Liquidity Ratio</strong> = Liquid Assets ÷ Monthly Expenses (in months). Aim for 3–6 months minimum.</li>
        <li><strong>Debt-to-Asset</strong> = Total Debt ÷ Total Assets. Strong: ≤30% · Watch: 30–50% · Heavy: &gt;50%.</li>
        <li><strong>Emergency Coverage</strong> = months of liquid runway. 6+ months = excellent.</li>
        <li><strong>Savings Ratio</strong> = Monthly Net ÷ Monthly Income. Target 20%+.</li>
      </ul>
    `,
  },
  {
    icon: '🌍',
    title: 'Currency & Localization',
    summary: 'Multi-currency for global households',
    body: `
      <p>FinFlow supports <strong>12 currencies</strong> and <strong>6 languages</strong>. Each transaction, budget, debt, and asset stores its <em>original</em> currency. Reports convert everything to your base currency using the rates you control.</p>
      <ul>
        <li><strong>Base Currency</strong> — set in Settings. All summary totals use this.</li>
        <li><strong>Exchange Rates</strong> — editable in Settings. Update them as rates change in the real world.</li>
        <li><strong>Multi-currency transactions</strong> — useful for travelers, expats, freelancers paid in foreign currencies, or businesses operating cross-border.</li>
      </ul>
      <p>Languages supported: English, Español, Français, हिन्दी, Deutsch, 日本語. Switch in Settings → Localization.</p>
    `,
  },
  {
    icon: '📊',
    title: 'Reports & Charts',
    summary: 'Day, Week, Month, Quarter, Year',
    body: `
      <p>The Reports page lets you switch between <strong>5 time periods</strong>:</p>
      <ul>
        <li><strong>Day</strong> — Last 30 days, daily breakdown.</li>
        <li><strong>Week</strong> — Last 12 weeks.</li>
        <li><strong>Month</strong> — Last 12 months.</li>
        <li><strong>Quarter</strong> — Last 8 quarters.</li>
        <li><strong>Year</strong> — Last 5 years.</li>
      </ul>
      <p>Three chart types update with your selection: a <strong>line chart</strong> for income vs expense trend, a <strong>bar chart</strong> for net by period, and a <strong>donut</strong> for category breakdown.</p>
      <p>Hover over any data point or bar segment for exact values.</p>
    `,
  },
  {
    icon: '☁️',
    title: 'Sync & Backup',
    summary: 'Move between devices',
    body: `
      <p>All your data lives in your browser's local storage by default — nothing is sent to any server.</p>
      <p>To <strong>sync between devices</strong>, share with your accountant, or migrate:</p>
      <ol>
        <li>On Device A: Settings → <strong>Download Full Backup</strong> (.json file).</li>
        <li>On Device B: Settings → <strong>Restore from Backup</strong> → choose the file.</li>
      </ol>
      <p>Backups include everything: transactions, budgets, goals, debts, assets, members, profile, and exchange rates.</p>
      <p>Export options:</p>
      <ul>
        <li><strong>JSON backup</strong> — Full restore-able snapshot.</li>
        <li><strong>CSV transactions</strong> — For Excel, Google Sheets, accountants.</li>
        <li><strong>Balance Sheet CSV</strong> — Assets and liabilities snapshot for printing or your CPA.</li>
      </ul>
    `,
  },
  {
    icon: '⌨️',
    title: 'Keyboard Shortcuts',
    summary: 'Power-user moves',
    body: `
      <p>FinFlow is keyboard-friendly. From any page (when not typing in an input):</p>
      <div class="help-kbd-grid">
        <div class="help-kbd">N</div><div class="help-kbd-desc">Add Transaction</div>
        <div class="help-kbd">G</div><div class="help-kbd-desc">Add Goal</div>
        <div class="help-kbd">D</div><div class="help-kbd-desc">Add Debt</div>
        <div class="help-kbd">A</div><div class="help-kbd-desc">Add Asset</div>
        <div class="help-kbd">Esc</div><div class="help-kbd-desc">Close any modal</div>
        <div class="help-kbd">/</div><div class="help-kbd-desc">Focus search (on Transactions)</div>
      </div>
    `,
  },
  {
    icon: '🎨',
    title: 'Themes & Appearance',
    summary: 'Paper Warm · Dark · System',
    body: `
      <p>Three themes:</p>
      <ul>
        <li><strong>Paper Warm</strong> (default) — Coral &amp; Cream. Designed to feel like a kitchen-table conversation, not a quarterly statement. Optimized for daily, low-anxiety use.</li>
        <li><strong>Dark Mode</strong> — Same warm palette, deep ink background. Best in low light or for power users.</li>
        <li><strong>System</strong> — Follows your OS preference automatically.</li>
      </ul>
      <p>Switch in Settings → Appearance, or use the icons in the sidebar footer.</p>
    `,
  },
  {
    icon: '🔒',
    title: 'Privacy & Security',
    summary: 'Where your data lives',
    body: `
      <p>FinFlow is a <strong>fully client-side</strong> application. Your financial data never leaves your device:</p>
      <ul>
        <li>All data stored in browser <code>localStorage</code></li>
        <li>No backend, no analytics, no tracking</li>
        <li>No login, no account creation</li>
      </ul>
      <p><strong>Caveats:</strong></p>
      <ul>
        <li>Clearing browser storage will delete your data — keep regular JSON backups</li>
        <li>Anyone with access to your browser can see your data — lock your device</li>
        <li>Backups are unencrypted — store .json files in a secure location</li>
      </ul>
    `,
  },
];

function renderHelp() {
  const el = document.getElementById('helpGrid');
  el.innerHTML = HELP_CONTENT.map((h, i) => `
    <div class="help-card" data-help-idx="${i}" data-search="${escHtml((h.title + ' ' + h.summary + ' ' + h.body).toLowerCase().replace(/<[^>]+>/g,' '))}">
      <div class="help-card-head" onclick="toggleHelp(${i})">
        <div class="help-card-head-l">
          <div class="help-icon">${h.icon}</div>
          <div>
            <div class="help-title">${escHtml(h.title)}</div>
            <div class="help-summary">${escHtml(h.summary)}</div>
          </div>
        </div>
        <svg class="help-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="help-card-body">${h.body}</div>
    </div>`).join('');
}

function toggleHelp(idx) {
  document.querySelectorAll('.help-card').forEach(c => {
    if (parseInt(c.dataset.helpIdx) === idx) c.classList.toggle('expanded');
    else c.classList.remove('expanded');
  });
}

function filterHelp() {
  const q = document.getElementById('helpSearch').value.toLowerCase().trim();
  document.querySelectorAll('.help-card').forEach(c => {
    const match = !q || (c.dataset.search || '').includes(q);
    c.style.display = match ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════
function populateCurrencySelects() {
  const opts = Object.entries(CURRENCIES).map(([code, c]) =>
    `<option value="${code}">${c.symbol} ${code}</option>`).join('');
  ['txnCurrency','budgetCurrency','goalCurrency','debtCurrency','assetCurrency'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

// ── Transaction Modal ────────────────────────────────────────
let editingTxnId = null;
function openTxnModal(prefill = null) {
  editingTxnId = prefill?.id || null;
  document.getElementById('txnModalTitle').textContent = editingTxnId ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('txnId').value = editingTxnId || '';
  document.getElementById('txnAmount').value = prefill?.amount || '';
  document.getElementById('txnDate').value = prefill?.date || today();
  document.getElementById('txnDesc').value = prefill?.description || '';
  document.getElementById('txnNote').value = prefill?.note || '';
  document.getElementById('txnRecurring').value = prefill?.recurring || '';
  document.getElementById('txnCurrency').value = prefill?.currency || profile.baseCurrency;
  document.getElementById('txnExcluded').checked = !!prefill?.excluded;

  const type = prefill?.type || 'expense';
  document.getElementById('txnType').value = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  populateCatSelect('txnCat', type, prefill?.category);
  populateMemberSelect('txnMember', prefill?.memberId);
  populatePaymentMethodSelect('txnPaymentMethod', prefill?.paymentMethod);
  populateAssetSelect('txnLinkedAsset', prefill?.linkedAssetId);

  // Show/hide investment-specific row
  document.getElementById('txnAssetRow').style.display = type === 'investment' ? '' : 'none';

  // Split state
  const isSplit = !!(prefill?.split && prefill.split.isSplit);
  document.getElementById('txnIsSplit').checked = isSplit;
  document.getElementById('txnSplitToggle').style.display = (type === 'expense' || type === 'income') ? '' : 'none';
  document.getElementById('txnSplitPanel').style.display = isSplit ? '' : 'none';
  if (isSplit) {
    document.getElementById('txnSplitTotal').value = prefill.split.totalAmount || prefill.amount || '';
    document.getElementById('txnSplitPaidBy').value = prefill.split.paidBy || 'me';
    renderParticipants(prefill.split.participants || []);
  } else {
    document.getElementById('txnSplitTotal').value = '';
    renderParticipants([]);
  }
  updateSplitSummary();

  document.getElementById('txnModal').classList.add('open');
  document.getElementById('txnAmount').focus();
}
function setTxnType(type) {
  document.getElementById('txnType').value = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  populateCatSelect('txnCat', type, null);
  // Investment-only asset link
  document.getElementById('txnAssetRow').style.display = type === 'investment' ? '' : 'none';
  // Splits only for income/expense
  const splitToggle = document.getElementById('txnSplitToggle');
  splitToggle.style.display = (type === 'expense' || type === 'income') ? '' : 'none';
  if (type !== 'expense' && type !== 'income') {
    document.getElementById('txnIsSplit').checked = false;
    document.getElementById('txnSplitPanel').style.display = 'none';
  }
}

// Payment method dropdown
function populatePaymentMethodSelect(selId, selected) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  // Group by kind
  const groups = {};
  Object.entries(PAYMENT_METHODS).forEach(([id, pm]) => {
    (groups[pm.kind] ||= []).push([id, pm]);
  });
  const groupOrder = ['cash','card','bank','wallet','crypto','transfer','check','other'];
  let html = '<option value="">— None —</option>';
  for (const kind of groupOrder) {
    if (!groups[kind]) continue;
    html += `<optgroup label="${PM_KIND_LABELS[kind]}">`;
    for (const [id, pm] of groups[kind]) {
      html += `<option value="${id}" ${id === selected ? 'selected' : ''}>${pm.name}</option>`;
    }
    html += '</optgroup>';
  }
  sel.innerHTML = html;
}

// Asset dropdown for investment txns
function populateAssetSelect(selId, selected) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— Don\'t auto-link —</option>' +
    assets.map(a => {
      const meta = ASSET_TYPES[a.type] || {};
      return `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${meta.icon || '💎'} ${escHtml(a.name)}</option>`;
    }).join('');
}

// Split UI helpers
function onSplitToggle() {
  const checked = document.getElementById('txnIsSplit').checked;
  document.getElementById('txnSplitPanel').style.display = checked ? '' : 'none';
  if (checked) {
    // Pre-fill total with current amount if blank
    const total = document.getElementById('txnSplitTotal');
    if (!total.value) total.value = document.getElementById('txnAmount').value || '';
    // Seed with you + 1 participant if empty
    if (!document.getElementById('participantsList').children.length) {
      renderParticipants([
        { name: 'me', isYou: true, share: 0, paid: true },
        { name: '', isYou: false, share: 0, paid: false },
      ]);
    }
    updateSplitSummary();
  }
}

function renderParticipants(list) {
  const el = document.getElementById('participantsList');
  el.innerHTML = list.map((p, i) => `
    <div class="participant-row" data-idx="${i}">
      <input type="text" class="input" placeholder="${p.isYou ? 'You' : 'Name'}" value="${escHtml(p.name === 'me' ? 'You' : (p.name || ''))}" ${p.isYou ? 'disabled' : ''}>
      <input type="number" class="input share-input" step="0.01" min="0" placeholder="0.00" value="${p.share || ''}" oninput="updateSplitSummary()">
      <label class="paid-toggle"><input type="checkbox" ${p.paid ? 'checked' : ''} ${p.isYou ? 'disabled' : ''}> Paid</label>
      ${p.isYou ? '<span class="participant-you">YOU</span>' : `<button type="button" class="participant-remove" onclick="removeParticipantRow(${i})">×</button>`}
    </div>`).join('');
}

function addParticipantRow() {
  const list = collectParticipants();
  list.push({ name: '', isYou: false, share: 0, paid: false });
  renderParticipants(list);
  // Equalize splits
  equalizeSplits();
}

function removeParticipantRow(idx) {
  const list = collectParticipants().filter((_, i) => i !== idx);
  renderParticipants(list);
  equalizeSplits();
}

function collectParticipants() {
  const rows = document.querySelectorAll('#participantsList .participant-row');
  return Array.from(rows).map(r => {
    const inputs = r.querySelectorAll('input');
    const isYou = !!r.querySelector('.participant-you');
    return {
      name: isYou ? 'me' : inputs[0].value.trim(),
      isYou,
      share: parseFloat(inputs[1].value) || 0,
      paid: isYou ? true : inputs[2].checked,
    };
  });
}

function equalizeSplits() {
  const total = parseFloat(document.getElementById('txnSplitTotal').value) || 0;
  const list = collectParticipants();
  if (!list.length || !total) { updateSplitSummary(); return; }
  const each = total / list.length;
  list.forEach(p => p.share = +each.toFixed(2));
  renderParticipants(list);
  updateSplitSummary();
}

function updateSplitSummary() {
  const list = collectParticipants();
  const total = parseFloat(document.getElementById('txnSplitTotal')?.value) || 0;
  const summed = list.reduce((s,p) => s + p.share, 0);
  const yours = list.find(p => p.isYou)?.share || 0;
  const owedToYou = list.filter(p => !p.isYou && !p.paid).reduce((s,p) => s + p.share, 0);
  const el = document.getElementById('splitSummary');
  if (!el) return;
  const diff = total - summed;
  const balanced = Math.abs(diff) < 0.01;
  el.innerHTML = `
    <div class="split-summary-row"><span>Total:</span> <strong>${fmt(total)}</strong></div>
    <div class="split-summary-row"><span>Sum of shares:</span> <strong style="color:${balanced?'var(--sage)':'var(--terra)'}">${fmt(summed)} ${balanced?'✓':'· off by '+fmt(Math.abs(diff))}</strong></div>
    <div class="split-summary-row"><span>Your share (counts as expense):</span> <strong style="color:var(--coral)">${fmt(yours)}</strong></div>
    <div class="split-summary-row"><span>Outstanding IOUs:</span> <strong>${fmt(owedToYou)}</strong></div>`;
}
function closeTxnModal() {
  document.getElementById('txnModal').classList.remove('open');
  document.getElementById('txnForm').reset();
  editingTxnId = null;
}
function populateCatSelect(selId, type, selected) {
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const sel = document.getElementById(selId);
  sel.innerHTML = cats.map(c =>
    `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('');
  if (!selected && selId === 'txnCat') {
    const desc = document.getElementById('txnDesc').value;
    if (desc) sel.value = smartCategory(desc, type);
  }
}
function populateMemberSelect(selId, selected) {
  const sel = document.getElementById(selId);
  sel.innerHTML = '<option value="">No member</option>' +
    members.map(m =>
      `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${escHtml(m.name)} (${ROLE_LABELS[m.role] || m.role})</option>`).join('');
}
async function saveTxn(e) {
  e.preventDefault();
  const type = document.getElementById('txnType').value;
  const desc = document.getElementById('txnDesc').value.trim();
  const t = {
    id: editingTxnId || undefined,
    type, amount: parseFloat(document.getElementById('txnAmount').value),
    date: document.getElementById('txnDate').value,
    description: desc,
    category: document.getElementById('txnCat').value || smartCategory(desc, type),
    note: document.getElementById('txnNote').value.trim(),
    memberId: document.getElementById('txnMember').value || '',
    recurring: document.getElementById('txnRecurring').value || '',
    currency: document.getElementById('txnCurrency').value || profile.baseCurrency,
    paymentMethod: document.getElementById('txnPaymentMethod').value || '',
    excluded: document.getElementById('txnExcluded').checked,
  };
  // Investment-specific
  if (type === 'investment') {
    const linkedAssetId = document.getElementById('txnLinkedAsset').value;
    if (linkedAssetId) t.linkedAssetId = linkedAssetId;
  }
  // Split-specific
  const isSplit = document.getElementById('txnIsSplit').checked && (type === 'expense' || type === 'income');
  if (isSplit) {
    const participants = collectParticipants();
    const totalAmount = parseFloat(document.getElementById('txnSplitTotal').value) || t.amount;
    const yourShare = participants.find(p => p.isYou)?.share || 0;
    t.split = {
      isSplit: true,
      totalAmount,
      yourShare,
      paidBy: document.getElementById('txnSplitPaidBy').value,
      participants: participants.map(p => ({ name: p.name, isYou: p.isYou, share: p.share, paid: p.paid, paidOn: p.paid ? today() : null })),
    };
    // Use total as the transaction amount; aggregation uses yourShare via effectiveAmount()
    t.amount = totalAmount;
  }

  const saved = await adapter.upsert('transactions', currentHouseholdId, t);
  if (editingTxnId) transactions = transactions.map(x => x.id === editingTxnId ? saved : x);
  else transactions.push(saved);

  // Investment → optionally bump linked asset value
  if (type === 'investment' && saved.linkedAssetId) {
    const asset = assets.find(a => a.id === saved.linkedAssetId);
    if (asset) {
      asset.value = (asset.value || 0) + toBase(saved.amount, saved.currency) * (asset.currency === saved.currency ? 1 : 1);
      // Note: we keep amount math simple — full FX in cloud version
      await adapter.upsert('assets', currentHouseholdId, asset);
      assets = assets.map(a => a.id === asset.id ? asset : a);
    }
  }

  closeTxnModal();
  renderPage(currentPage);
  showToast(editingTxnId ? 'Transaction updated' : 'Transaction added', 'success');
}
function editTxn(id) { const t = transactions.find(x => x.id === id); if (t) openTxnModal(t); }
async function deleteTxn(id) {
  if (!confirm('Delete this transaction?')) return;
  await adapter.remove('transactions', currentHouseholdId, id);
  transactions = transactions.filter(x => x.id !== id);
  renderPage(currentPage);
  showToast('Transaction deleted', 'info');
}

// ── Budget Modal ──────────────────────────────────────────────
let editingBudgetId = null;
function openBudgetModal(prefill = null) {
  editingBudgetId = prefill?.id || null;
  document.getElementById('budgetModalTitle').textContent = editingBudgetId ? 'Edit Budget' : 'Add Budget';
  document.getElementById('budgetId').value = editingBudgetId || '';
  document.getElementById('budgetLimit').value = prefill?.limit || '';
  document.getElementById('budgetCurrency').value = prefill?.currency || profile.baseCurrency;
  const existingCats = budgets.filter(b => b.id !== editingBudgetId).map(b => b.category);
  const availCats = EXPENSE_CATEGORIES.filter(c => !existingCats.includes(c.id));
  document.getElementById('budgetCat').innerHTML = availCats.map(c =>
    `<option value="${c.id}" ${c.id === prefill?.category ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('');
  const sel = prefill?.color || BUDGET_COLORS[0];
  document.getElementById('budgetColor').value = sel;
  renderColorPicker(sel);
  document.getElementById('budgetModal').classList.add('open');
}
function renderColorPicker(selected) {
  const el = document.getElementById('budgetColorPicker');
  el.innerHTML = BUDGET_COLORS.map(c =>
    `<div class="color-dot ${c===selected?'selected':''}" style="background:${c}" data-color="${c}"></div>`).join('');
  el.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.getElementById('budgetColor').value = dot.dataset.color;
      el.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
    });
  });
}
function closeBudgetModal() { document.getElementById('budgetModal').classList.remove('open'); document.getElementById('budgetForm').reset(); editingBudgetId = null; }
async function saveBudget(e) {
  e.preventDefault();
  const b = {
    id: editingBudgetId || undefined,
    category: document.getElementById('budgetCat').value,
    limit: parseFloat(document.getElementById('budgetLimit').value),
    color: document.getElementById('budgetColor').value || BUDGET_COLORS[0],
    currency: document.getElementById('budgetCurrency').value || profile.baseCurrency,
  };
  const saved = await adapter.upsert('budgets', currentHouseholdId, b);
  if (editingBudgetId) budgets = budgets.map(x => x.id === editingBudgetId ? saved : x);
  else budgets.push(saved);
  closeBudgetModal(); renderPage(currentPage);
  showToast(editingBudgetId ? 'Budget updated' : 'Budget added', 'success');
}
function editBudget(id) { const b = budgets.find(x => x.id === id); if (b) openBudgetModal(b); }
async function deleteBudget(id) {
  if (!confirm('Delete this budget?')) return;
  await adapter.remove('budgets', currentHouseholdId, id);
  budgets = budgets.filter(x => x.id !== id);
  renderPage(currentPage); showToast('Budget deleted', 'info');
}

// ── Goal Modal ────────────────────────────────────────────────
let editingGoalId = null;
function openGoalModal(prefill = null) {
  editingGoalId = prefill?.id || null;
  document.getElementById('goalModalTitle').textContent = editingGoalId ? 'Edit Goal' : 'Add Goal';
  document.getElementById('goalId').value = editingGoalId || '';
  document.getElementById('goalType').value = prefill?.type || 'savings';
  document.getElementById('goalName').value = prefill?.name || '';
  document.getElementById('goalTarget').value = prefill?.target || '';
  document.getElementById('goalCurrent').value = prefill?.current || '0';
  document.getElementById('goalDeadline').value = prefill?.deadline || '';
  document.getElementById('goalCurrency').value = prefill?.currency || profile.baseCurrency;
  document.getElementById('goalModal').classList.add('open');
  document.getElementById('goalName').focus();
}
function closeGoalModal() { document.getElementById('goalModal').classList.remove('open'); document.getElementById('goalForm').reset(); editingGoalId = null; }
async function saveGoal(e) {
  e.preventDefault();
  const g = {
    id: editingGoalId || undefined,
    type: document.getElementById('goalType').value,
    name: document.getElementById('goalName').value.trim(),
    target: parseFloat(document.getElementById('goalTarget').value),
    current: parseFloat(document.getElementById('goalCurrent').value) || 0,
    deadline: document.getElementById('goalDeadline').value || '',
    currency: document.getElementById('goalCurrency').value || profile.baseCurrency,
    completed: false,
  };
  if (g.current >= g.target) g.completed = true;
  const saved = await adapter.upsert('goals', currentHouseholdId, g);
  if (editingGoalId) goals = goals.map(x => x.id === editingGoalId ? saved : x);
  else goals.push(saved);
  closeGoalModal(); renderPage(currentPage);
  showToast(editingGoalId ? 'Goal updated' : 'Goal added', 'success');
}
function editGoal(id) { const g = goals.find(x => x.id === id); if (g) openGoalModal(g); }
async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  await adapter.remove('goals', currentHouseholdId, id);
  goals = goals.filter(x => x.id !== id);
  renderPage(currentPage); showToast('Goal deleted', 'info');
}
function onGoalTypeChange() {
  const type = document.getElementById('goalType').value;
  const nameEl = document.getElementById('goalName');
  if (!nameEl.value) {
    const defaults = { emergency:'6-Month Emergency Fund', savings:'Savings Goal', debt:'Pay Off Debt', investment:'Investment Target', purchase:'Major Purchase', custom:'Custom Goal' };
    nameEl.value = defaults[type] || '';
  }
}

// ── Member Modal ──────────────────────────────────────────────
let editingMemberId = null;
function openMemberModal(prefill = null) {
  editingMemberId = prefill?.id || null;
  document.getElementById('memberModalTitle').textContent = editingMemberId ? 'Edit Member' : 'Add Member';
  document.getElementById('memberId').value = editingMemberId || '';
  document.getElementById('memberName').value = prefill?.name || '';
  document.getElementById('memberRole').value = prefill?.role || 'primary';
  document.getElementById('memberModal').classList.add('open');
  document.getElementById('memberName').focus();
}
function closeMemberModal() { document.getElementById('memberModal').classList.remove('open'); document.getElementById('memberForm').reset(); editingMemberId = null; }
async function saveMember(e) {
  e.preventDefault();
  const name = document.getElementById('memberName').value.trim();
  const role = document.getElementById('memberRole').value;
  let saved;
  if (editingMemberId) {
    saved = await adapter.updateMember(editingMemberId, { name, role });
    members = members.map(x => x.id === editingMemberId ? saved : x);
  } else {
    saved = await adapter.addMember(currentHouseholdId, { name, role });
    members.push(saved);
  }
  closeMemberModal();
  renderSidebarMembers();
  // Re-render any page that surfaces members
  if (['transactions','dashboard'].includes(currentPage)) renderPage(currentPage);
  showToast(editingMemberId ? 'Member updated' : `${saved.name} added!`, 'success');
}

// ── REMOVE MEMBER (new — was missing from v4) ─────────────────
// Confirms with linked-transaction count and orphans the txn memberId
// instead of deleting transactions. (In Supabase this becomes RLS-checked
// on the memberships table — only owners/admins can remove non-owners.)
async function removeMember(memberId) {
  const m = members.find(x => x.id === memberId);
  if (!m) return;
  const linkedTxns = transactions.filter(t => t.memberId === memberId).length;
  const msg = linkedTxns > 0
    ? `Remove ${m.name}?\n\nThey have ${linkedTxns} linked transaction(s). Those records stay, but lose member attribution.`
    : `Remove ${m.name}?`;
  if (!confirm(msg)) return;
  // Orphan their transaction memberIds
  if (linkedTxns > 0) {
    const orphaned = transactions.filter(t => t.memberId === memberId);
    for (const t of orphaned) {
      t.memberId = '';
      await adapter.upsert('transactions', currentHouseholdId, t);
    }
  }
  await adapter.removeMember(memberId);
  members = members.filter(x => x.id !== memberId);
  renderSidebarMembers();
  renderPage(currentPage);
  showToast(`${m.name} removed`, 'info');
}

function renderSidebarMembers() {
  const el = document.getElementById('sidebarMembers');
  el.innerHTML = `
    <div class="sm-header">
      <span>Household</span>
      <span class="sm-add" onclick="openMemberModal()">+ Add</span>
    </div>` +
    members.map((m, i) => {
      const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
      const initials = m.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      const json = JSON.stringify(m).replace(/"/g,'&quot;');
      return `
        <div class="sm-member">
          <div class="sm-avatar" style="background:${color}22;color:${color};border:1px solid ${color}66" onclick="openMemberModal(${json})">${initials}</div>
          <div class="sm-info" onclick="openMemberModal(${json})">
            <div class="sm-name">${escHtml(m.name)}</div>
            <div class="sm-role">${ROLE_LABELS[m.role] || m.role}</div>
          </div>
          <button class="sm-remove" onclick="event.stopPropagation();removeMember('${m.id}')" aria-label="Remove ${escHtml(m.name)}" title="Remove">×</button>
        </div>`;
    }).join('');
  if (!members.length) el.innerHTML += `<div style="font-family:var(--font-mono);font-size:.6rem;color:var(--text-dim);padding:4px 0;letter-spacing:.06em">No members yet</div>`;
}

// ── Debt Modal ────────────────────────────────────────────────
let editingDebtId = null;
function openDebtModal(prefill = null) {
  editingDebtId = prefill?.id || null;
  document.getElementById('debtModalTitle').textContent = editingDebtId ? 'Edit Debt' : 'Add Debt';
  document.getElementById('debtId').value = editingDebtId || '';
  document.getElementById('debtType').value = prefill?.type || 'credit_card';
  document.getElementById('debtName').value = prefill?.name || '';
  document.getElementById('debtLender').value = prefill?.lender || '';
  document.getElementById('debtAccount').value = prefill?.account || '';
  document.getElementById('debtPrincipal').value = prefill?.principal || '';
  document.getElementById('debtBalance').value = prefill?.currentBalance || '';
  document.getElementById('debtRate').value = prefill?.interestRate || '';
  document.getElementById('debtMinPayment').value = prefill?.minimumPayment || '';
  document.getElementById('debtTenure').value = prefill?.tenureMonths || '';
  document.getElementById('debtDueDate').value = prefill?.dueDate || '';
  document.getElementById('debtCurrency').value = prefill?.currency || profile.baseCurrency;
  updateEmiPreview();
  document.getElementById('debtModal').classList.add('open');
  document.getElementById('debtName').focus();
}
function closeDebtModal() { document.getElementById('debtModal').classList.remove('open'); document.getElementById('debtForm').reset(); editingDebtId = null; }
async function saveDebt(e) {
  e.preventDefault();
  const d = {
    id: editingDebtId || undefined,
    type: document.getElementById('debtType').value,
    name: document.getElementById('debtName').value.trim(),
    lender: document.getElementById('debtLender').value.trim(),
    account: document.getElementById('debtAccount').value.trim(),
    principal: parseFloat(document.getElementById('debtPrincipal').value) || 0,
    currentBalance: parseFloat(document.getElementById('debtBalance').value),
    interestRate: parseFloat(document.getElementById('debtRate').value),
    minimumPayment: parseFloat(document.getElementById('debtMinPayment').value),
    tenureMonths: parseInt(document.getElementById('debtTenure').value) || 0,
    dueDate: document.getElementById('debtDueDate').value || '',
    currency: document.getElementById('debtCurrency').value || profile.baseCurrency,
  };
  if (!d.principal) d.principal = d.currentBalance;
  const saved = await adapter.upsert('debts', currentHouseholdId, d);
  if (editingDebtId) debts = debts.map(x => x.id === editingDebtId ? saved : x);
  else debts.push(saved);
  closeDebtModal(); renderPage(currentPage);
  showToast(editingDebtId ? 'Debt updated' : 'Debt added — payoff strategy active', 'success');
}
function editDebt(id) { const d = debts.find(x => x.id === id); if (d) openDebtModal(d); }
async function deleteDebt(id) {
  if (!confirm('Delete this debt?')) return;
  await adapter.remove('debts', currentHouseholdId, id);
  debts = debts.filter(x => x.id !== id);
  renderPage(currentPage); showToast('Debt deleted', 'info');
}

// ── Debt Payment Modal ────────────────────────────────────────
let payingDebtId = null;
function openDebtPayModal(id) {
  const d = debts.find(x => x.id === id);
  if (!d) return;
  payingDebtId = id;
  document.getElementById('payDebtId').value = id;
  document.getElementById('payAmount').value = d.minimumPayment;
  document.getElementById('payDate').value = today();
  document.getElementById('payNote').value = '';
  const meta = DEBT_TYPES[d.type];
  document.getElementById('payDebtInfo').innerHTML = `
    <div class="pdi-name">${meta.icon} ${escHtml(d.name)}</div>
    <div class="pdi-stats">
      <span>Balance: <strong>${fmt(d.currentBalance, d.currency)}</strong></span>
      <span>APR: <strong>${d.interestRate}%</strong></span>
      <span>Min: <strong>${fmt(d.minimumPayment, d.currency)}</strong></span>
    </div>`;
  document.getElementById('debtPayModal').classList.add('open');
  document.getElementById('payAmount').focus();
}
function closeDebtPayModal() { document.getElementById('debtPayModal').classList.remove('open'); document.getElementById('debtPayForm').reset(); payingDebtId = null; }
async function saveDebtPayment(e) {
  e.preventDefault();
  const d = debts.find(x => x.id === payingDebtId);
  if (!d) return;
  const amount = parseFloat(document.getElementById('payAmount').value);
  const date = document.getElementById('payDate').value;
  const note = document.getElementById('payNote').value.trim();

  // v5: split into interest (true expense) + principal (transfer/non-expense)
  const { interest, principal } = splitEmiPortions(d.currentBalance, d.interestRate, amount);
  d.currentBalance = Math.max(0, d.currentBalance - principal);
  await adapter.upsert('debts', currentHouseholdId, d);

  const linkId = uid(); // group both legs together

  // Leg 1: Interest portion — expense (counts in reports)
  if (interest > 0.005) {
    const interestTxn = {
      type: 'expense', amount: +interest.toFixed(2), date,
      description: `${d.name} — interest`,
      category: 'debt_interest',
      note: note ? `${note} · interest portion` : 'Interest portion of EMI',
      memberId: '', recurring: '',
      currency: d.currency,
      linkedDebtId: d.id,
      linkedTxnId: linkId,
    };
    const savedI = await adapter.upsert('transactions', currentHouseholdId, interestTxn);
    transactions.push(savedI);
  }

  // Leg 2: Principal portion — transfer (excluded from expense reports)
  if (principal > 0.005) {
    const principalTxn = {
      type: 'transfer', amount: +principal.toFixed(2), date,
      description: `${d.name} — principal`,
      category: 'debt_principal',
      note: note ? `${note} · principal portion` : 'Principal pay-down',
      memberId: '', recurring: '',
      currency: d.currency,
      linkedDebtId: d.id,
      linkedTxnId: linkId,
    };
    const savedP = await adapter.upsert('transactions', currentHouseholdId, principalTxn);
    transactions.push(savedP);
  }

  closeDebtPayModal(); renderPage(currentPage);
  if (d.currentBalance < 0.01) showToast(`🎉 ${d.name} fully paid off!`, 'success');
  else showToast(`Payment recorded · ${fmt(interest, d.currency)} interest + ${fmt(principal, d.currency)} principal`, 'success');
}

// ── Asset Modal ───────────────────────────────────────────────
let editingAssetId = null;
function openAssetModal(prefill = null) {
  editingAssetId = prefill?.id || null;
  document.getElementById('assetModalTitle').textContent = editingAssetId ? 'Edit Asset' : 'Add Asset';
  document.getElementById('assetId').value = editingAssetId || '';
  document.getElementById('assetType').value = prefill?.type || 'savings';
  document.getElementById('assetName').value = prefill?.name || '';
  document.getElementById('assetValue').value = prefill?.value || '';
  document.getElementById('assetLiquidity').value = prefill?.liquidity || ASSET_TYPES[prefill?.type || 'savings']?.liquidity || 'liquid';
  document.getElementById('assetNote').value = prefill?.note || '';
  document.getElementById('assetCurrency').value = prefill?.currency || profile.baseCurrency;
  document.getElementById('assetModal').classList.add('open');
  document.getElementById('assetName').focus();
}
function closeAssetModal() { document.getElementById('assetModal').classList.remove('open'); document.getElementById('assetForm').reset(); editingAssetId = null; }
async function saveAsset(e) {
  e.preventDefault();
  const a = {
    id: editingAssetId || undefined,
    type: document.getElementById('assetType').value,
    name: document.getElementById('assetName').value.trim(),
    value: parseFloat(document.getElementById('assetValue').value),
    liquidity: document.getElementById('assetLiquidity').value,
    note: document.getElementById('assetNote').value.trim(),
    currency: document.getElementById('assetCurrency').value || profile.baseCurrency,
    lastUpdated: today(),
  };
  const saved = await adapter.upsert('assets', currentHouseholdId, a);
  if (editingAssetId) assets = assets.map(x => x.id === editingAssetId ? saved : x);
  else assets.push(saved);
  closeAssetModal(); renderPage(currentPage);
  showToast(editingAssetId ? 'Asset updated' : 'Asset added', 'success');
}
function editAsset(id) { const a = assets.find(x => x.id === id); if (a) openAssetModal(a); }
async function deleteAsset(id) {
  if (!confirm('Delete this asset?')) return;
  await adapter.remove('assets', currentHouseholdId, id);
  assets = assets.filter(x => x.id !== id);
  renderPage(currentPage); showToast('Asset deleted', 'info');
}

// ══════════════════════════════════════════════════════════════
// EXPORT / SYNC
// ══════════════════════════════════════════════════════════════
function exportCSV() {
  if (!transactions.length) { showToast('No transactions to export', 'info'); return; }
  const header = ['Date','Type','Description','Category','Amount','Currency','Member','Note','Recurring'];
  const rows = [...transactions].sort((a,b) => b.date.localeCompare(a.date)).map(t => {
    const cat = getCat(t.category).label;
    const mem = getMember(t.memberId)?.name || '';
    return [t.date, t.type, `"${(t.description||'').replace(/"/g,'""')}"`, cat, t.amount.toFixed(2), t.currency || profile.baseCurrency, mem, `"${(t.note||'').replace(/"/g,'""')}"`, t.recurring || ''].join(',');
  });
  downloadFile([header.join(','), ...rows].join('\n'), `finflow-transactions-${today()}.csv`, 'text/csv');
  showToast('CSV exported', 'success');
}

function exportBalanceSheet() {
  const rows = ['Type,Category,Name,Value,Currency,Currency in Base,Liquidity'];
  assets.forEach(a => {
    const meta = ASSET_TYPES[a.type];
    rows.push(`Asset,${meta.label},"${a.name}",${a.value.toFixed(2)},${a.currency},${toBase(a.value, a.currency).toFixed(2)},${a.liquidity}`);
  });
  debts.forEach(d => {
    const meta = DEBT_TYPES[d.type];
    rows.push(`Liability,${meta.label},"${d.name}",${d.currentBalance.toFixed(2)},${d.currency},${toBase(d.currentBalance, d.currency).toFixed(2)},${meta.liquidity}`);
  });
  rows.push('');
  rows.push(`Total Assets,,,${totalAssets().toFixed(2)},${profile.baseCurrency}`);
  rows.push(`Total Liabilities,,,${totalLiabilities().toFixed(2)},${profile.baseCurrency}`);
  rows.push(`Net Worth,,,${netWorth().toFixed(2)},${profile.baseCurrency}`);
  downloadFile(rows.join('\n'), `finflow-balance-sheet-${today()}.csv`, 'text/csv');
  showToast('Balance sheet exported', 'success');
}

function downloadBackup() {
  const backup = {
    version: '4.0',
    exported: new Date().toISOString(),
    profile, transactions, budgets, goals, members, debts, assets,
    exchangeRates,
  };
  downloadFile(JSON.stringify(backup, null, 2), `finflow-backup-${today()}.json`, 'application/json');
  localStorage.setItem(STORAGE_KEYS.lastBackup, new Date().toISOString());
  showToast('Backup downloaded', 'success');
  if (currentPage === 'settings') renderSettings();
}

function restoreBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('This will REPLACE all current data with the backup. Continue?')) {
    e.target.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      // Bulk-replace through adapter (same key-space, future-cloud-ready)
      if (data.transactions) await adapter.replaceAll('transactions', currentHouseholdId, data.transactions);
      if (data.budgets)      await adapter.replaceAll('budgets',      currentHouseholdId, data.budgets);
      if (data.goals)        await adapter.replaceAll('goals',        currentHouseholdId, data.goals);
      if (data.debts)        await adapter.replaceAll('debts',        currentHouseholdId, data.debts);
      if (data.assets)       await adapter.replaceAll('assets',       currentHouseholdId, data.assets);
      if (data.members)      await adapter.replaceAll('members',      currentHouseholdId, data.members);
      if (data.profile)      await adapter.updateProfile(data.profile);
      if (data.exchangeRates) {
        for (const [code, rate] of Object.entries(data.exchangeRates)) {
          await adapter.upsertRate(currentHouseholdId, code, rate);
        }
      }
      // Reload everything from adapter into in-memory state
      await load();
      renderSidebarMembers();
      applyLanguage();
      renderPage(currentPage);
      showToast('Backup restored successfully', 'success');
    } catch (err) {
      showToast('Invalid backup file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function copyToClipboard() {
  const text = JSON.stringify({ profile, transactions, budgets, goals, members, debts, assets, exchangeRates }, null, 2);
  navigator.clipboard?.writeText(text).then(
    () => showToast('Backup copied to clipboard', 'success'),
    () => showToast('Clipboard not available', 'error')
  );
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════
// SEED DATA
// ══════════════════════════════════════════════════════════════
async function seedDemo() {
  const mk = nowMonthKey();
  const [y, m] = mk.split('-').map(Number);
  const prev1 = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
  const prev2m = m <= 2 ? (m===1 ? 11 : 12) : m-2;
  const prev2y = m <= 2 ? y-1 : y;
  const prev2 = `${prev2y}-${String(prev2m).padStart(2,'0')}`;

  const alexId = uid(), samId = uid(), miaId = uid();
  members = [
    { id: alexId, name: 'Alex',  role: 'primary' },
    { id: samId,  name: 'Sam',   role: 'partner' },
    { id: miaId,  name: 'Mia',   role: 'child'   },
  ];

  goals = [
    { id: uid(), type:'emergency',  name:'6-Month Emergency Fund', target:18000, current:9200, deadline:`${y+1}-06-30`, completed:false, currency:'USD' },
    { id: uid(), type:'savings',    name:'Family Vacation — Japan', target:6000,  current:2400, deadline:`${y}-12-01`,   completed:false, currency:'USD' },
    { id: uid(), type:'investment', name:'Index Fund Target',       target:25000, current:8400, deadline:'',             completed:false, currency:'USD' },
    { id: uid(), type:'debt',       name:'Pay off Credit Card',     target:6500,  current:1200, deadline:`${y+1}-09-01`, completed:false, currency:'USD' },
  ];

  // DEBTS — realistic family debt mix
  debts = [
    { id: uid(), type:'mortgage',     name:'Home Mortgage',     lender:'Wells Fargo', account:'7821', principal:380000, currentBalance:312500, interestRate:6.25, minimumPayment:2340, dueDate:`${y}-${String(m+1).padStart(2,'0')}-01`, currency:'USD' },
    { id: uid(), type:'auto_loan',    name:'Honda Civic Loan',  lender:'Honda Financial', account:'4412', principal:24000, currentBalance:11200, interestRate:4.95, minimumPayment:485, dueDate:`${y}-${String(m+1).padStart(2,'0')}-15`, currency:'USD' },
    { id: uid(), type:'credit_card',  name:'Chase Sapphire',     lender:'Chase Bank', account:'9907', principal:5000, currentBalance:5300, interestRate:22.74, minimumPayment:140, dueDate:`${y}-${String(m+1).padStart(2,'0')}-22`, currency:'USD' },
    { id: uid(), type:'student_loan', name:'Federal Student Loan', lender:'Nelnet', account:'2204', principal:42000, currentBalance:18750, interestRate:5.05, minimumPayment:280, dueDate:`${y}-${String(m+1).padStart(2,'0')}-08`, currency:'USD' },
  ];

  // ASSETS — realistic family balance sheet
  assets = [
    { id: uid(), type:'checking',    name:'Chase Checking',     value:6800, currency:'USD', liquidity:'liquid', note:'Primary' },
    { id: uid(), type:'savings',     name:'Marcus High-Yield',  value:9200, currency:'USD', liquidity:'liquid', note:'Emergency fund' },
    { id: uid(), type:'cash',        name:'Cash on Hand',       value:450,  currency:'USD', liquidity:'liquid' },
    { id: uid(), type:'investment',  name:'Vanguard Brokerage', value:48200, currency:'USD', liquidity:'short' },
    { id: uid(), type:'retirement',  name:'401(k) — Alex',      value:124500, currency:'USD', liquidity:'long' },
    { id: uid(), type:'retirement',  name:'Roth IRA — Sam',     value:62300, currency:'USD', liquidity:'long' },
    { id: uid(), type:'real_estate', name:'Primary Home',       value:485000, currency:'USD', liquidity:'long', note:'Market estimate' },
    { id: uid(), type:'vehicle',     name:'2020 Honda Civic',   value:18500, currency:'USD', liquidity:'long' },
  ];

  transactions = [
    // Current month
    { id:uid(), type:'income',  amount:5200, category:'salary',        description:'Monthly Salary',     date:`${mk}-01`, note:'',           memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'income',  amount:4800, category:'salary',        description:"Sam's Salary",       date:`${mk}-01`, note:'',           memberId:samId,  recurring:'monthly', currency:'USD' },
    { id:uid(), type:'income',  amount:950,  category:'freelance',     description:'Design Consulting',  date:`${mk}-08`, note:'UI project', memberId:alexId, recurring:'',         currency:'USD' },
    { id:uid(), type:'expense', amount:2340, category:'rent',          description:'Mortgage Payment',   date:`${mk}-01`, note:'',           memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:485,  category:'debt_payment',  description:'Auto Loan Payment',  date:`${mk}-15`, note:'Honda Civic', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:280,  category:'debt_payment',  description:'Student Loan Pmt',   date:`${mk}-08`, note:'Nelnet',     memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:140,  category:'debt_payment',  description:'Chase Card Min Pmt', date:`${mk}-22`, note:'',           memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:280,  category:'food',          description:'Weekly Groceries',   date:`${mk}-05`, note:'Whole Foods', memberId:samId, recurring:'weekly',   currency:'USD' },
    { id:uid(), type:'expense', amount:95,   category:'transport',     description:'Bus Pass',           date:`${mk}-02`, note:'',           memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:44,   category:'entertainment', description:'Netflix & Spotify',  date:`${mk}-03`, note:'Streaming',  memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:130,  category:'health',        description:'Gym Membership',     date:`${mk}-04`, note:'Two members', memberId:samId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:185,  category:'shopping',      description:'Clothing',           date:`${mk}-10`, note:'',           memberId:samId,  recurring:'',         currency:'USD' },
    { id:uid(), type:'expense', amount:88,   category:'utilities',     description:'Electricity Bill',   date:`${mk}-07`, note:'',           memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:62,   category:'utilities',     description:'Internet Bill',      date:`${mk}-07`, note:'Comcast',    memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:120,  category:'childcare',     description:"Mia's School Fees",  date:`${mk}-06`, note:'',           memberId:miaId,  recurring:'',         currency:'USD' },
    { id:uid(), type:'expense', amount:320,  category:'food',          description:'Restaurants',        date:`${mk}-14`, note:'Family',     memberId:alexId, recurring:'',         currency:'USD' },
    { id:uid(), type:'expense', amount:18500, category:'travel',        description:'Trip to Mumbai',     date:`${mk}-12`, note:'Foreign currency demo · stored in INR', memberId:alexId, recurring:'', currency:'INR' },

    // Last month
    { id:uid(), type:'income',  amount:5200, category:'salary',        description:'Monthly Salary',     date:`${prev1}-01`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'income',  amount:4800, category:'salary',        description:"Sam's Salary",       date:`${prev1}-01`, note:'', memberId:samId,  recurring:'monthly', currency:'USD' },
    { id:uid(), type:'income',  amount:320,  category:'investment',    description:'Dividend Income',    date:`${prev1}-20`, note:'', memberId:alexId, recurring:'',        currency:'USD' },
    { id:uid(), type:'expense', amount:2340, category:'rent',          description:'Mortgage',           date:`${prev1}-01`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:485,  category:'debt_payment',  description:'Auto Loan Pmt',      date:`${prev1}-15`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:280,  category:'debt_payment',  description:'Student Loan',       date:`${prev1}-08`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:200,  category:'debt_payment',  description:'Chase Card Pmt',     date:`${prev1}-22`, note:'Extra', memberId:alexId, recurring:'', currency:'USD' },
    { id:uid(), type:'expense', amount:310,  category:'food',          description:'Groceries',          date:`${prev1}-05`, note:'', memberId:samId,  recurring:'',        currency:'USD' },
    { id:uid(), type:'expense', amount:95,   category:'transport',     description:'Bus Pass',           date:`${prev1}-02`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:44,   category:'entertainment', description:'Streaming',          date:`${prev1}-03`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:130,  category:'health',        description:'Gym',                date:`${prev1}-04`, note:'', memberId:samId,  recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:88,   category:'utilities',     description:'Electricity',        date:`${prev1}-07`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:240,  category:'shopping',      description:'Amazon',             date:`${prev1}-11`, note:'', memberId:samId,  recurring:'',        currency:'USD' },
    { id:uid(), type:'expense', amount:380,  category:'travel',        description:'Weekend Getaway',    date:`${prev1}-16`, note:'', memberId:alexId, recurring:'',        currency:'USD' },

    // 2 months ago
    { id:uid(), type:'income',  amount:5200, category:'salary',        description:'Monthly Salary',     date:`${prev2}-01`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'income',  amount:4800, category:'salary',        description:"Sam's Salary",       date:`${prev2}-01`, note:'', memberId:samId,  recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:2340, category:'rent',          description:'Mortgage',           date:`${prev2}-01`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:485,  category:'debt_payment',  description:'Auto Loan',          date:`${prev2}-15`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:280,  category:'debt_payment',  description:'Student Loan',       date:`${prev2}-08`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:140,  category:'debt_payment',  description:'Chase Card',        date:`${prev2}-22`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:295,  category:'food',          description:'Groceries',          date:`${prev2}-06`, note:'', memberId:samId,  recurring:'',        currency:'USD' },
    { id:uid(), type:'expense', amount:95,   category:'transport',     description:'Bus Pass',           date:`${prev2}-02`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:44,   category:'entertainment', description:'Streaming',          date:`${prev2}-03`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:130,  category:'health',        description:'Gym',                date:`${prev2}-04`, note:'', memberId:samId,  recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:88,   category:'utilities',     description:'Electricity',        date:`${prev2}-07`, note:'', memberId:alexId, recurring:'monthly', currency:'USD' },
    { id:uid(), type:'expense', amount:650,  category:'education',     description:'Online Courses',     date:`${prev2}-10`, note:'Udemy', memberId:alexId, recurring:'', currency:'USD' },
    { id:uid(), type:'income',  amount:600,  category:'freelance',     description:'Freelance Project',  date:`${prev2}-18`, note:'Logo design', memberId:alexId, recurring:'', currency:'USD' },
  ];

  budgets = [
    { id:uid(), category:'food',          limit:850,  color:'#E8A87C', currency:'USD' },
    { id:uid(), category:'transport',     limit:200,  color:'#4A6FA5', currency:'USD' },
    { id:uid(), category:'entertainment', limit:80,   color:'#6E4555', currency:'USD' },
    { id:uid(), category:'shopping',      limit:300,  color:'#E26D5C', currency:'USD' },
    { id:uid(), category:'health',        limit:200,  color:'#85A88A', currency:'USD' },
    { id:uid(), category:'utilities',     limit:200,  color:'#F4D27A', currency:'USD' },
    { id:uid(), category:'childcare',     limit:300,  color:'#F4B6A8', currency:'USD' },
  ];

  profile = {
    name: 'Alex Morgan',
    email: 'alex@example.com',
    baseCurrency: 'USD',
    language: 'en',
    household: 'family',
    dateFormat: 'us',
    payoffStrategy: 'avalanche',
    extraPayment: 200,
  };
  exchangeRates = { ...DEFAULT_RATES };

  // Bulk-push everything through the adapter so future cloud sync works the same
  await adapter.replaceAll('transactions', currentHouseholdId, transactions);
  await adapter.replaceAll('budgets',      currentHouseholdId, budgets);
  await adapter.replaceAll('goals',        currentHouseholdId, goals);
  await adapter.replaceAll('debts',        currentHouseholdId, debts);
  await adapter.replaceAll('assets',       currentHouseholdId, assets);
  await adapter.replaceAll('members',      currentHouseholdId, members);
  await adapter.updateProfile(profile);
  for (const [code, rate] of Object.entries(exchangeRates)) {
    await adapter.upsertRate(currentHouseholdId, code, rate);
  }
}

// ══════════════════════════════════════════════════════════════
// v5 · MULTI-PROFILE
// ══════════════════════════════════════════════════════════════
async function renderProfileSwitcher() {
  const list = await adapter.listHouseholds();
  const active = list.find(h => h.id === currentHouseholdId) || list[0];
  if (active) {
    const meta = PROFILE_TYPES[active.type] || PROFILE_TYPES.personal;
    document.getElementById('profileSwitcherIcon').textContent = meta.icon;
    document.getElementById('profileSwitcherName').textContent = active.name;
  }
  // Build menu
  const menuList = document.getElementById('profileMenuList');
  menuList.innerHTML = list.map(h => {
    const meta = PROFILE_TYPES[h.type] || PROFILE_TYPES.personal;
    const isActive = h.id === currentHouseholdId;
    return `
      <div class="profile-menu-item ${isActive ? 'active' : ''}" onclick="switchProfile('${h.id}')">
        <span class="profile-menu-icon">${meta.icon}</span>
        <div class="profile-menu-info">
          <div class="profile-menu-name">${escHtml(h.name)}</div>
          <div class="profile-menu-meta">${meta.label} · ${h.baseCurrency}</div>
        </div>
        ${isActive ? '<span class="profile-menu-check">✓</span>' : ''}
      </div>`;
  }).join('');
}
function toggleProfileMenu() {
  const menu = document.getElementById('profileMenu');
  menu.style.display = menu.style.display === 'none' ? '' : 'none';
}
function closeProfileMenu() { document.getElementById('profileMenu').style.display = 'none'; }
async function switchProfile(id) {
  if (id === currentHouseholdId) { closeProfileMenu(); return; }
  currentHouseholdId = id;
  await adapter.setActiveHousehold(id);
  closeProfileMenu();
  await load();
  // Seed new empty profile if blank
  if (!transactions.length && !budgets.length && !members.length && !debts.length && !assets.length) {
    // Don't re-seed by default — let it stay empty for new profiles
  }
  await renderProfileSwitcher();
  applyLanguage();
  renderSidebarMembers();
  populateCurrencySelects();
  renderPage('dashboard');
  navigate('dashboard');
  showToast(`Switched to profile`, 'success');
}

// Create profile modal
function openCreateProfileModal() {
  closeProfileMenu();
  document.getElementById('newProfileName').value = '';
  document.getElementById('newProfileType').value = 'personal';
  // Profile type cards
  const grid = document.getElementById('profileTypeGrid');
  grid.innerHTML = Object.entries(PROFILE_TYPES).map(([id, meta]) => `
    <div class="profile-type-card${id === 'personal' ? ' active' : ''}" data-type="${id}" onclick="pickProfileType('${id}')">
      <div class="ptc-icon">${meta.icon}</div>
      <div class="ptc-name">${meta.label}</div>
      <div class="ptc-desc">${meta.desc}</div>
    </div>`).join('');
  // Currency options
  const sel = document.getElementById('newProfileCurrency');
  sel.innerHTML = Object.entries(CURRENCIES).map(([code, c]) =>
    `<option value="${code}" ${code === profile.baseCurrency ? 'selected' : ''}>${c.symbol} ${code} — ${c.name}</option>`
  ).join('');
  document.getElementById('createProfileModal').classList.add('open');
  document.getElementById('newProfileName').focus();
}
function pickProfileType(id) {
  document.getElementById('newProfileType').value = id;
  document.querySelectorAll('.profile-type-card').forEach(c => c.classList.toggle('active', c.dataset.type === id));
}
function closeCreateProfileModal() { document.getElementById('createProfileModal').classList.remove('open'); }

async function saveNewProfile(e) {
  e.preventDefault();
  const name = document.getElementById('newProfileName').value.trim();
  const type = document.getElementById('newProfileType').value;
  const baseCur = document.getElementById('newProfileCurrency').value;
  const created = await adapter.createHousehold(name, type, baseCur);
  // Initialize this profile's profile-record with chosen currency
  const oldHH = currentHouseholdId;
  currentHouseholdId = created.id;
  await adapter.updateProfile({ baseCurrency: baseCur, language: profile.language, name: profile.name, dateFormat: profile.dateFormat, household: type, payoffStrategy: 'avalanche', extraPayment: 0 });
  // Reset rates for the new household
  for (const [code, rate] of Object.entries(DEFAULT_RATES)) {
    await adapter.upsertRate(currentHouseholdId, code, rate);
  }
  await adapter.setActiveHousehold(created.id);
  await load();
  await renderProfileSwitcher();
  closeCreateProfileModal();
  applyLanguage();
  renderSidebarMembers();
  populateCurrencySelects();
  navigate('dashboard');
  showToast(`Profile "${name}" created`, 'success');
}

// Manage profiles modal
async function openManageProfilesModal() {
  closeProfileMenu();
  const list = await adapter.listHouseholds();
  document.getElementById('manageProfilesList').innerHTML = list.map(h => {
    const meta = PROFILE_TYPES[h.type] || PROFILE_TYPES.personal;
    const isActive = h.id === currentHouseholdId;
    const isDefault = h.id === 'local';
    return `
      <div class="manage-profile-row">
        <div class="manage-profile-icon">${meta.icon}</div>
        <div class="manage-profile-info">
          <div class="manage-profile-name">${escHtml(h.name)}${isActive ? ' <span class="status-pill pill-good">ACTIVE</span>' : ''}</div>
          <div class="manage-profile-meta">${meta.label} · ${h.baseCurrency}${isDefault ? ' · default' : ''}</div>
        </div>
        <div class="manage-profile-actions">
          ${!isActive ? `<button class="txn-act-btn edit" onclick="switchProfile('${h.id}');closeManageProfilesModal()">Switch</button>` : ''}
          <button class="txn-act-btn edit" onclick="renameProfile('${h.id}')">Rename</button>
          ${!isDefault ? `<button class="txn-act-btn delete" onclick="confirmDeleteProfile('${h.id}', '${escHtml(h.name)}')">Delete</button>` : ''}
        </div>
      </div>`;
  }).join('');
  document.getElementById('manageProfilesModal').classList.add('open');
}
function closeManageProfilesModal() { document.getElementById('manageProfilesModal').classList.remove('open'); }

async function renameProfile(id) {
  const list = await adapter.listHouseholds();
  const h = list.find(x => x.id === id);
  if (!h) return;
  const newName = prompt('Rename profile:', h.name);
  if (!newName || newName === h.name) return;
  await adapter.updateHousehold(id, { name: newName });
  await renderProfileSwitcher();
  await openManageProfilesModal();
  showToast('Profile renamed', 'success');
}

async function confirmDeleteProfile(id, name) {
  if (!confirm(`Permanently delete "${name}" and ALL its data on this device?\n\nThis cannot be undone. Export a backup first if you might need it.`)) return;
  if (id === currentHouseholdId) {
    // Switch to default before deleting active
    await switchProfile('local');
  }
  await adapter.deleteHousehold(id);
  await renderProfileSwitcher();
  await openManageProfilesModal();
  showToast(`Profile "${name}" deleted`, 'warning');
}

// ══════════════════════════════════════════════════════════════
// v5 · SPLITS PAGE
// ══════════════════════════════════════════════════════════════
function renderSplits() {
  const sp = splitsOutstanding();
  document.getElementById('splits-owedToYou').textContent = fmt(sp.owedToYou);
  document.getElementById('splits-youOwe').textContent = fmt(sp.youOwe);
  const ownerSet = new Set(sp.owedDetails.map(d => d.participant.name));
  const oweSet   = new Set(sp.youOweDetails.map(d => d.txn.description));
  document.getElementById('splits-owedToYou-count').textContent = `From ${ownerSet.size} ${ownerSet.size === 1 ? 'person' : 'people'}`;
  document.getElementById('splits-youOwe-count').textContent = `Across ${sp.youOweDetails.length} payment${sp.youOweDetails.length === 1 ? '' : 's'}`;

  // Owed-to-you list
  const owedEl = document.getElementById('splits-owedList');
  if (!sp.owedDetails.length) {
    owedEl.innerHTML = '<div class="empty"><div class="empty-icon">✓</div><p>Nothing outstanding</p></div>';
  } else {
    // Group by participant
    const byPerson = {};
    sp.owedDetails.forEach(d => {
      const k = d.participant.name;
      (byPerson[k] ||= { name: k, total: 0, items: [] });
      byPerson[k].total += toBase(d.participant.share, d.txn.currency || profile.baseCurrency);
      byPerson[k].items.push(d);
    });
    owedEl.innerHTML = Object.values(byPerson).map(g => `
      <div class="split-group">
        <div class="split-group-head">
          <strong>${escHtml(g.name)}</strong>
          <span class="text-sage">${fmt(g.total)}</span>
        </div>
        ${g.items.map(it => {
          const cat = getCat(it.txn.category);
          return `
            <div class="split-row">
              <span class="split-row-icon">${cat.icon}</span>
              <span class="split-row-desc">${escHtml(it.txn.description)} <span class="split-row-date">${formatDate(it.txn.date)}</span></span>
              <span class="split-row-amt">${fmt(it.participant.share, it.txn.currency)}</span>
              <button class="txn-act-btn edit" onclick="settleParticipant('${it.txn.id}','${escHtml(it.participant.name)}')">Settle</button>
            </div>`;
        }).join('')}
      </div>`).join('');
  }

  // You-owe list
  const oweEl = document.getElementById('splits-youOweList');
  if (!sp.youOweDetails.length) {
    oweEl.innerHTML = '<div class="empty"><div class="empty-icon">✓</div><p>Nothing outstanding</p></div>';
  } else {
    oweEl.innerHTML = sp.youOweDetails.map(d => {
      const cat = getCat(d.txn.category);
      return `
        <div class="split-row">
          <span class="split-row-icon">${cat.icon}</span>
          <span class="split-row-desc">${escHtml(d.txn.description)} <span class="split-row-date">${formatDate(d.txn.date)}</span></span>
          <span class="split-row-amt text-terra">${fmt(d.participant.share, d.txn.currency)}</span>
          <button class="txn-act-btn edit" onclick="settleParticipant('${d.txn.id}','me')">Mark Paid</button>
        </div>`;
    }).join('');
  }

  // All splits history
  const allEl = document.getElementById('splits-all');
  const allSplits = transactions.filter(t => t.split && t.split.isSplit).sort((a,b) => b.date.localeCompare(a.date));
  if (!allSplits.length) {
    allEl.innerHTML = '<div class="empty"><p>No split payments yet</p></div>';
  } else {
    allEl.innerHTML = allSplits.map(t => txnHTML(t, true)).join('');
  }
}

function openSplitTxnFromPage() {
  openTxnModal();
  // Pre-check the split toggle
  setTimeout(() => {
    document.getElementById('txnIsSplit').checked = true;
    onSplitToggle();
  }, 80);
}

function closeSettleSplitModal() {
  document.getElementById('settleSplitModal').classList.remove('open');
}

async function settleParticipant(txnId, participantName) {
  const t = transactions.find(x => x.id === txnId);
  if (!t || !t.split) return;
  const p = t.split.participants.find(x => x.name === participantName);
  if (!p) return;
  if (!confirm(`Mark ${participantName === 'me' ? 'your share' : participantName} as paid?`)) return;
  p.paid = true;
  p.paidOn = today();
  await adapter.upsert('transactions', currentHouseholdId, t);
  transactions = transactions.map(x => x.id === t.id ? t : x);
  renderPage(currentPage);
  showToast(`Settled · ${participantName === 'me' ? 'you paid your share' : participantName + ' paid'}`, 'success');
}

// ══════════════════════════════════════════════════════════════
// v5 · LOAN / EMI HELPERS
// ══════════════════════════════════════════════════════════════
// EMI standard formula: P × r × (1+r)^n / ((1+r)^n - 1)
function computeEmi(principal, annualRate, tenureMonths) {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate) return principal / tenureMonths;
  const r = annualRate / 100 / 12;
  const x = Math.pow(1 + r, tenureMonths);
  return (principal * r * x) / (x - 1);
}

// For a given month, split a payment into interest + principal portions
function splitEmiPortions(currentBalance, annualRate, payment) {
  const r = annualRate / 100 / 12;
  const interest = currentBalance * r;
  const principal = Math.max(0, payment - interest);
  return { interest, principal };
}

// Update EMI preview in the debt modal as user types
function updateEmiPreview() {
  const balance = parseFloat(document.getElementById('debtBalance').value) || 0;
  const rate = parseFloat(document.getElementById('debtRate').value) || 0;
  const tenure = parseFloat(document.getElementById('debtTenure').value) || 0;
  const payment = parseFloat(document.getElementById('debtMinPayment').value) || 0;
  const el = document.getElementById('emiPreview');
  if (!el) return;
  if (!balance || !rate) { el.style.display = 'none'; return; }

  let html = '';
  if (tenure > 0) {
    const computedEmi = computeEmi(balance, rate, tenure);
    const totalInterest = computedEmi * tenure - balance;
    html += `<div class="emi-row"><span>Calculated EMI for ${tenure} months:</span> <strong>${fmt(computedEmi)}</strong></div>`;
    html += `<div class="emi-row"><span>Total interest over tenure:</span> <strong>${fmt(totalInterest)}</strong></div>`;
  }
  if (payment > 0) {
    const { interest, principal } = splitEmiPortions(balance, rate, payment);
    html += `<div class="emi-row"><span>This month's payment of ${fmt(payment)} splits as:</span></div>`;
    html += `<div class="emi-row" style="padding-left:14px"><span>· Interest (expense):</span> <strong style="color:var(--terra)">${fmt(interest)}</strong></div>`;
    html += `<div class="emi-row" style="padding-left:14px"><span>· Principal (debt reduction):</span> <strong style="color:var(--sage)">${fmt(principal)}</strong></div>`;
  }
  el.innerHTML = html;
  el.style.display = '';
}

// ══════════════════════════════════════════════════════════════
// KEYBOARD & MOBILE
// ══════════════════════════════════════════════════════════════
function handleKeydown(e) {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (e.key === 'Escape') document.activeElement.blur();
    return;
  }
  if (e.key === 'Escape') { closeTxnModal(); closeBudgetModal(); closeGoalModal(); closeMemberModal(); closeDebtModal(); closeDebtPayModal(); closeAssetModal(); }
  if (e.key === 'n' || e.key === 'N') openTxnModal();
  if (e.key === 'g' || e.key === 'G') openGoalModal();
  if (e.key === 'd' || e.key === 'D') openDebtModal();
  if (e.key === 'a' || e.key === 'A') openAssetModal();
  if (e.key === '/') { e.preventDefault(); document.getElementById('searchTxn')?.focus(); }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('show');
}

// ══════════════════════════════════════════════════════════════
// ICON RENDERING
// ══════════════════════════════════════════════════════════════
function renderIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.getAttribute('data-icon');
    const path = ICONS[name];
    if (path) {
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    }
  });
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
async function init() {
  // Bring up the data layer first
  adapter = (window.FinFlowAdapters && window.FinFlowAdapters.createAdapter)
    ? window.FinFlowAdapters.createAdapter()
    : null;
  if (!adapter) {
    console.error('FinFlow: dataAdapter.js failed to load');
    return;
  }

  // v5: load the active profile from adapter (persists across sessions)
  currentHouseholdId = await adapter.getActiveHousehold();

  await load();

  // First-run seeding (anonymous mode)
  if (!transactions.length && !budgets.length && !members.length) {
    await seedDemo();
    await load();
  }

  loadTheme();
  applyLanguage();
  renderIcons();
  populateCurrencySelects();
  renderSidebarMembers();
  await renderProfileSwitcher();

  // Close profile menu on outside click
  document.addEventListener('click', e => {
    const menu = document.getElementById('profileMenu');
    const switcher = document.getElementById('profileSwitcher');
    if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && !switcher?.contains(e.target)) {
      closeProfileMenu();
    }
  });

  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
  });
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-nav]');
    if (el) { e.preventDefault(); navigate(el.dataset.nav); }
  });

  // Mobile menu
  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebarClose')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebarBackdrop')?.addEventListener('click', toggleSidebar);

  // Theme toggles
  document.querySelectorAll('[data-theme-set]').forEach(b => {
    b.addEventListener('click', () => setTheme(b.dataset.themeSet));
  });
  document.getElementById('themeToggleMini')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'warm';
    const next = cur === 'warm' ? 'dark' : cur === 'dark' ? 'system' : 'warm';
    setTheme(next);
  });

  // Theme cards (settings)
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-theme-card]');
    if (card) setTheme(card.dataset.themeCard);
  });

  // Period selector (reports)
  document.querySelectorAll('#periodSelector [data-period]').forEach(b => {
    b.addEventListener('click', () => {
      currentPeriod = b.dataset.period;
      renderReports();
    });
  });
  // Strategy selector (debts)
  document.querySelectorAll('#debtStrategy [data-strategy]').forEach(b => {
    b.addEventListener('click', async () => {
      debtStrategy = b.dataset.strategy;
      profile.payoffStrategy = debtStrategy;
      await adapter.updateProfile({ payoffStrategy: debtStrategy });
      renderDebts();
    });
  });

  // Action buttons
  document.getElementById('addTxnBtn')?.addEventListener('click', () => openTxnModal());
  document.getElementById('exportBtn')?.addEventListener('click', exportCSV);
  document.getElementById('clearDataBtn')?.addEventListener('click', async () => {
    if (confirm('Clear ALL data? This cannot be undone. Make sure to download a backup first.')) {
      transactions = []; budgets = []; goals = []; members = []; debts = []; assets = [];
      await Promise.all([
        adapter.replaceAll('transactions', currentHouseholdId, []),
        adapter.replaceAll('budgets',      currentHouseholdId, []),
        adapter.replaceAll('goals',        currentHouseholdId, []),
        adapter.replaceAll('members',      currentHouseholdId, []),
        adapter.replaceAll('debts',        currentHouseholdId, []),
        adapter.replaceAll('assets',       currentHouseholdId, []),
      ]);
      renderSidebarMembers();
      renderPage(currentPage);
      showToast('All data cleared', 'warning');
    }
  });

  // Modal overlay clicks
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === o) {
        closeTxnModal(); closeBudgetModal(); closeGoalModal(); closeMemberModal();
        closeDebtModal(); closeDebtPayModal(); closeAssetModal();
      }
    });
  });

  // Auto-suggest category
  document.getElementById('txnDesc')?.addEventListener('input', () => {
    const type = document.getElementById('txnType').value;
    const desc = document.getElementById('txnDesc').value;
    if (!editingTxnId && desc.length >= 3) {
      const suggested = smartCategory(desc, type);
      const sel = document.getElementById('txnCat');
      if (sel) sel.value = suggested;
    }
  });

  // Asset type → liquidity defaults
  document.getElementById('assetType')?.addEventListener('change', e => {
    const meta = ASSET_TYPES[e.target.value];
    if (meta) document.getElementById('assetLiquidity').value = meta.liquidity;
  });

  document.addEventListener('keydown', handleKeydown);

  navigate('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
