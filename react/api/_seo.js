// Vyact — search-shaped titles and quick answers for Learn lessons (v10.51.0, marketing #21).
//
// The 30 lessons that already answer a live search (docs: vyact-marketing/research/keyword-sheet.csv)
// get, on their PUBLIC page only: a question-shaped <title>/H1 that matches how people search, and a
// 40–60-word "Quick answer" placed first — the passage search snippets, People Also Ask and AI
// answers quote. Kept in code, not in content_items: the in-app card keeps its editorial title, and
// this is reviewable and reversible in a PR. Keyed by the lesson number (ev-NNN), so a slug tweak in
// the CMS never silently drops an entry. Every answer must stay true to the lesson body beneath it.

export const LESSON_SEO = {
  'ev-002': {
    title: "What does \"pay yourself first\" mean?",
    answer: "\"Pay yourself first\" means moving money to savings the day your income arrives, before you spend anything else. Because the money leaves before it can be spent, you adapt to what's left without feeling the sacrifice. A common target is 20% of take-home pay, but starting at 5% still builds the habit.",
  },
  'ev-003': {
    title: "What is the 50/30/20 rule? A simple budget starting point",
    answer: "The 50/30/20 rule splits your take-home pay into three parts: about 50% for needs like rent, food and bills, 30% for wants, and 20% for saving or paying off debt. It isn't a strict law — it's a quick way to see where your money goes and which part is out of balance.",
  },
  'ev-009': {
    title: "How do you set a savings goal you'll actually reach?",
    answer: "Give the goal an amount and a date, then divide: the amount over the number of months left is what you save each month. \"Save more\" has no checkpoint; \"this amount by December\" becomes a line item. If the monthly figure is too high, move the date rather than give up.",
  },
  'ev-011': {
    title: "What is a sinking fund? (With examples)",
    answer: "A sinking fund is money you set aside a little each month for a big cost you know is coming — insurance, school fees, a holiday, car servicing. Divide the yearly cost by twelve and save that monthly, so the bill arrives already paid for instead of feeling like an emergency.",
  },
  'ev-013': {
    title: "Should you save a fixed amount or a percentage of income?",
    answer: "Save a percentage, not a fixed amount. A percentage grows automatically with every raise, so your savings keep pace with your income without new decisions — while a fixed amount quietly shrinks in importance. Start with whatever percentage feels sustainable, then raise it a few points each year.",
  },
  'ev-017': {
    title: "What is a good savings rate?",
    answer: "A savings rate of around 20% of take-home pay is considered strong and sustainable for most households. It's the share of income going to saving, investing or paying down debt each month — and the percentage matters more than the amount, because it shows whether your habits scale as income grows.",
  },
  'ev-019': {
    title: "What is an emergency fund (and what isn't it for)?",
    answer: "An emergency fund is money set aside only for genuine surprises — a job loss, a medical bill, an urgent repair. It isn't for holidays or planned purchases. Its value is that it's there immediately, so a shock doesn't turn into credit card debt or selling investments at a bad time.",
  },
  'ev-020': {
    title: "Where should you keep your emergency fund?",
    answer: "Keep your emergency fund somewhere safe and instantly reachable — a separate savings account or a deposit you can withdraw from without penalty. Not stocks or market-linked funds: the job of this money is to be available the moment you need it, at full value, not to earn the highest return.",
  },
  'ev-021': {
    title: "How much should an emergency fund be?",
    answer: "An emergency fund should cover three to six months of essential expenses — rent, food, bills and loan payments — not your full income or lifestyle spending. Aim for three months if your income is steady, and closer to six (or more) if you're self-employed or the only earner in your household.",
  },
  'ev-026': {
    title: "How many months could you live on your savings?",
    answer: "Your runway is your accessible savings divided by your monthly essential expenses. It tells you how many months your household could cover the basics if income stopped. It's more useful than a total savings figure, because the same balance means very different things to households with different costs.",
  },
  'ev-027': {
    title: "Debt avalanche vs snowball: which method is better?",
    answer: "The avalanche method pays off the highest-interest debt first and saves the most money. The snowball method pays off the smallest balance first and gives faster wins that keep you motivated. Avalanche is cheaper on paper; snowball works better for people who need visible progress. The best one is the one you'll finish.",
  },
  'ev-029': {
    title: "What happens if you only pay the minimum on a credit card?",
    answer: "Paying only the minimum keeps your account in good standing but barely reduces the balance, so interest keeps compounding — a card balance can take years to clear and cost far more than you borrowed. Paying even a little extra each month, on your highest-rate card first, shortens the payoff dramatically.",
  },
  'ev-030': {
    title: "How much of my loan payment goes to interest?",
    answer: "Every loan instalment (EMI) is part interest, part principal — and early in the loan most of it is interest. The share going to principal grows over time. That's why extra payments early in a loan save the most: each one removes the interest that would have been charged on it for years.",
  },
  'ev-032': {
    title: "Does paying one extra EMI a year really help?",
    answer: "Yes. One extra loan instalment a year, paid toward principal, can shorten a long home loan by several years and save a large share of the total interest — because it reduces the balance that future interest is charged on. A bonus or tax refund is an easy way to fund it.",
  },
  'ev-033': {
    title: "What is a good debt-to-income ratio?",
    answer: "Your debt-to-income ratio is your total monthly debt payments divided by your monthly income. Under about 36% is generally considered comfortable; above that, most households start to feel the strain even when every payment is made on time. It's a warning light, not a verdict.",
  },
  'ev-037': {
    title: "How do you improve your credit score?",
    answer: "Pay every bill on time, keep card balances well below your limit (under about 30% is often cited), avoid applying for lots of new credit at once, and check your credit report for errors once a year. Payment history and how much of your limit you use matter most.",
  },
  'ev-041': {
    title: "How do you make a budget you'll actually stick to?",
    answer: "Treat the budget as a plan for spending, not a list of restrictions. Decide in advance what each category is for — including fun — and spending within it becomes following the plan, not breaking a rule. Budgets that plan for enjoyment tend to survive; budgets built only on cutting tend to be abandoned.",
  },
  'ev-042': {
    title: "Where does my money go? Track before you cut",
    answer: "Before cutting anything, track every expense for two to four weeks without changing your habits. Real numbers show which category is actually driving the problem — often one big one, not many small ones — so you cut the right thing instead of the most obvious one.",
  },
  'ev-043': {
    title: "Needs vs wants: how do you tell the difference?",
    answer: "Needs are what you must pay to live and work — housing, food, utilities, transport, minimum loan payments. Wants are everything that makes life better but could pause. Labelling your spending this way shows your real split, so you can decide deliberately whether it feels right.",
  },
  'ev-046': {
    title: "What is zero-based budgeting? A simple explanation",
    answer: "Zero-based budgeting gives every unit of your income a job before the month starts — bills, food, savings, debt, fun — until income minus everything assigned equals zero. Nothing is left to \"misc\". It takes a little more planning up front and removes the end-of-month question of where the money went.",
  },
  'ev-047': {
    title: "How do you split a budget into categories?",
    answer: "Divide your monthly total into a few main categories — housing, food, transport, savings, everything else — and give each a limit. Then check each category as the month goes, not just the total: you can be within budget overall while one category has already run out by mid-month.",
  },
  'ev-049': {
    title: "What is the 24-hour rule for spending?",
    answer: "The 24-hour rule means waiting a day before any unplanned purchase above a threshold you choose. If you still want it tomorrow, buy it without guilt; if the urge has faded, you've avoided an impulse buy. It separates purchases you'll be glad of from ones you'd regret, without banning spending.",
  },
  'ev-053': {
    title: "How to budget for festivals and wedding season",
    answer: "Add up last year's festival, wedding and celebration costs, divide by twelve, and set that aside every month. Big seasonal spending is predictable, not an emergency — funded in advance, it's enjoyed as planned; left unplanned, the same amount lands on a credit card and feels like a crisis.",
  },
  'ev-071': {
    title: "How do you calculate your net worth?",
    answer: "Net worth is everything you own minus everything you owe: add up cash, bank balances, investments and property, then subtract loans and card balances. The result can be negative early on — what matters is the direction it moves month to month, not the number on its own.",
  },
  'ev-073': {
    title: "Cash flow vs net worth: what's the difference?",
    answer: "Cash flow is whether more money came in than went out this month. Net worth is whether your overall position — what you own minus what you owe — is improving over time. They can move in opposite directions, so a household needs both to know if it's really doing well.",
  },
  'ev-078': {
    title: "What does liquidity mean in personal finance?",
    answer: "Liquidity is how quickly you can turn what you own into cash without losing value. Two households with the same net worth can be in very different positions if one's wealth is tied up in property and the other's is partly in accessible savings. Liquid money is what handles emergencies calmly.",
  },
  'ev-093': {
    title: "Old vs new tax regime: which is better for you?",
    answer: "It depends on your deductions. The old regime usually wins if you claim several — 80C investments, HRA, home-loan interest, 80D. The new regime has lower rates but allows almost no deductions, so it tends to win when you have few to claim. Compare your tax both ways before choosing.",
  },
  'ev-103': {
    title: "Should families budget together or separately?",
    answer: "Budget together. Rent, school fees, groceries and savings goals affect everyone in the home, so when each person tracks only their own slice, nobody sees the full picture. A shared view of household income, spending and goals makes decisions easier and fairer.",
  },
  'ev-105': {
    title: "How should couples split finances? The \"yours, mine and ours\" approach",
    answer: "Many couples do best with a blend: a shared account for joint costs and goals, funded by both — often in proportion to income — plus a personal account each for spending without justification. It avoids both the friction of fully merged money and the distance of fully separate money.",
  },
  'ev-106': {
    title: "How do couples talk about money without fighting?",
    answer: "Hold a short, regular money check-in before anything goes wrong — fifteen minutes on payday or a Sunday. Cover what's coming up this month, how last month went, and one goal. Regular, calm check-ins prevent most money arguments, because nothing builds up into a surprise.",
  },
};

/** The SEO entry for a lesson slug ("ev-003-the-50-30-20-starting-point" → LESSON_SEO['ev-003']), or null. */
export function seoFor(slug) {
  const m = /^(ev-\d{3})/.exec(String(slug || ''));
  return (m && LESSON_SEO[m[1]]) || null;
}
