/**
 * The File Room — Central Application State & Mock Database
 * Pivot Aide Tax
 */

window.FileRoomData = {
  user: {
    name: "Michael Whitfield",
    email: "m.whitfield@example.com",
    phoneLast4: "4417",
    verified: false,
    spouse: "Elena Whitfield",
    role: "client"
  },

  file: {
    year: 2026,
    filingStatus: "Married filing jointly",
    jurisdictions: "MD resident · VA and PA non-resident",
    stageName: "In preparation",
    progressPct: 68,
    assignedPreparer: "Denise R.",
    steps: [
      { id: 1, title: "Engagement letter signed", meta: "14 January", status: "done" },
      { id: 2, title: "Documents received — 11 of 13", meta: "Last upload 2 September", status: "done" },
      { id: 3, title: "Two documents still needed", meta: "Rental 1099-MISC and the Q4 mileage log", status: "now" },
      { id: 4, title: "Return prepared and reviewed", meta: "Estimated 9–11 September", status: "todo" },
      { id: 5, title: "You approve and sign Form 8879", meta: "Takes about four minutes", status: "todo" },
      { id: 6, title: "Filed and accepted", meta: "We watch for the acceptance and tell you", status: "todo" }
    ],
    upcomingDeadlines: [
      { label: "Q3 estimated payment", date: "15 Sep 2026" },
      { label: "Extended individual return deadline", date: "15 Oct 2026" },
      { label: "Year-end planning call", date: "Book in November" }
    ],
    activeScopes: [
      {
        id: "scope-current-1040",
        serviceKey: "individual",
        title: "2026 Individual Return (Form 1040)",
        status: "active",
        statusLabel: "Active Scope",
        details: "Federal + MD (resident), VA & PA (non-resident) · Schedules C & E",
        fee: "$1,240.00",
        date: "Engagement signed 14 Jan 2026"
      }
    ],
    pendingScopes: []
  },

  documents: [
    { id: "doc-1", name: "1099-MISC — Keystone Property Group", category: "needed", meta: "Rental income · requested 24 August", type: "1099-MISC", icon: "⚠" },
    { id: "doc-2", name: "Q4 mileage log", category: "needed", meta: "Schedule C · any format, a spreadsheet is fine", type: "Log", icon: "⚠" },
    { id: "doc-3", name: "Closing disclosure — 214 Halcyon Row", category: "review", meta: "Uploaded 2 September · Denise is reading it", type: "Settlement", icon: "◯" },
    { id: "doc-4", name: "W-2 — Halstead Medical Group", category: "received", meta: "Uploaded 28 August · Verified", type: "W-2", icon: "✓" },
    { id: "doc-5", name: "1099-NEC — Whitfield Design Co.", category: "received", meta: "Uploaded 28 August · Verified", type: "1099-NEC", icon: "✓" },
    { id: "doc-6", name: "1098 — mortgage interest", category: "received", meta: "Uploaded 26 August · Verified", type: "1098", icon: "✓" },
    { id: "doc-7", name: "Brokerage 1099 composite", category: "received", meta: "Uploaded 26 August · Verified", type: "1099-B", icon: "✓" },
    { id: "doc-8", name: "Prior year return — TY2025", category: "received", meta: "Carried over from your file", type: "1040", icon: "✓" },
    { id: "doc-9", name: "Property tax receipt — 214 Halcyon Row", category: "received", meta: "Uploaded 20 August · Verified", type: "Tax Receipt", icon: "✓" },
    { id: "doc-10", name: "1099-INT — Cardinal Trust Bank", category: "received", meta: "Uploaded 19 August · Verified", type: "1099-INT", icon: "✓" },
    { id: "doc-11", name: "HSA Form 1099-SA distribution", category: "received", meta: "Uploaded 18 August · Verified", type: "1099-SA", icon: "✓" },
    { id: "doc-12", name: "Estimated tax voucher copy (MD)", category: "received", meta: "Uploaded 15 August · Verified", type: "State Voucher", icon: "✓" },
    { id: "doc-13", name: "Charity gift receipts composite", category: "received", meta: "Uploaded 12 August · Verified", type: "Receipts", icon: "✓" }
  ],

  kbaQuiz: {
    currentStep: 1,
    attemptsLeft: 3,
    questions: [
      {
        question: "Which of these lenders held a mortgage in your name?",
        options: [
          "Cardinal Trust Bank",
          "Meridian Home Lending",
          "Fairwater Savings",
          "None of these"
        ],
        correctIndex: 1
      },
      {
        question: "In which of the following years was your vehicle registered in Maryland purchased?",
        options: [
          "2018",
          "2021",
          "2023",
          "None of these"
        ],
        correctIndex: 1
      },
      {
        question: "Which of the following addresses have you previously resided at?",
        options: [
          "742 Evergreen Terrace, Rockville MD",
          "814 North Calvert St, Baltimore MD",
          "1200 Grand Ave, Annapolis MD",
          "None of these"
        ],
        correctIndex: 1
      }
    ]
  },

  signatureRecord: {
    signed: false,
    method: null,
    timestamp: null,
    ip: "172.56.21.84",
    hash: null
  },

  taxReturn: {
    federalRefund: 3418.00,
    stateBalanceDue: 612.00,
    metrics: [
      { label: "Total income", value: "$214,806", change: "▲ 8%", good: true },
      { label: "Taxable income", value: "$168,240", change: null, good: null },
      { label: "Effective federal rate", value: "14.2%", change: null, good: null },
      { label: "Total tax", value: "$30,491", change: "▲ 3%", good: false }
    ],
    changes: [
      {
        title: "The rental went from a loss to a profit",
        desc: "Halcyon Row was let for the full year. Schedule E swings $9,100."
      },
      {
        title: "You bought equipment in November",
        desc: "Expensed in full this year rather than depreciated. Worth $2,780 to you."
      },
      {
        title: "Pennsylvania is new",
        desc: "Two months of on-site work created a non-resident filing there."
      }
    ],
    pages: [
      { title: "Form 1040 and schedules", pages: "14 pages", status: "Read" },
      { title: "Schedule C — Whitfield Design Co.", pages: "3 pages", status: "Read" },
      { title: "Schedule E — 214 Halcyon Row", pages: "2 pages", status: "Read" },
      { title: "Maryland 502 · Virginia 763 · Pennsylvania 40NR", pages: "19 pages", status: "Read" }
    ]
  },

  messages: [
    {
      id: "m-1",
      sender: "Denise · 2 Sep, 9:14",
      role: "preparer",
      avatar: "DR",
      text: "I have the closing disclosure — thank you. One question: was the Halcyon Row property let for the whole year, or was there a vacant stretch after the tenants left in March?"
    },
    {
      id: "m-2",
      sender: "You · 2 Sep, 9:31",
      role: "me",
      avatar: "MW",
      text: "Vacant for six weeks, then relet from mid-May. I can dig out the new lease if that helps."
    },
    {
      id: "m-3",
      sender: "Denise · 2 Sep, 9:38",
      role: "preparer",
      avatar: "DR",
      text: "The lease would help — upload it whenever. Six weeks vacant while it was available to let does not cost you the deduction, so this is good news rather than bad."
    },
    {
      id: "m-4",
      sender: "Uncle Pat · automatic",
      role: "pat",
      avatar: "PAT",
      text: "Reminder: your Q3 estimated payment is due 15 September. The voucher is in your documents, and you can pay it from the Billing tab."
    }
  ],

  services: [
    {
      id: "svc-1",
      key: "individual",
      title: "Individual return",
      desc: "Federal and every state you need. Upfront price, no mystery invoice.",
      price: "from $200",
      actionText: "Add",
      basePrice: 200,
      activeOnCurrentFile: true
    },
    {
      id: "svc-2",
      key: "business",
      title: "Business return",
      desc: "S-corp, partnership, C-corp. Books reviewed before the return is built.",
      price: "quoted on scope",
      actionText: "Add",
      basePrice: 850
    },
    {
      id: "svc-3",
      key: "bookkeeping",
      title: "Bookkeeping",
      desc: "Monthly reconciliation and statements you can actually use.",
      price: "monthly",
      actionText: "Add",
      basePrice: 195
    },
    {
      id: "svc-4",
      key: "cleanup",
      title: "Accounting cleanup",
      desc: "Catch-up and reconstruction, so the return stands on numbers that are right.",
      price: "quoted on scope",
      actionText: "Add",
      basePrice: 650
    },
    {
      id: "svc-5",
      key: "audit",
      title: "Audit & resolution",
      desc: "Notices, examinations, back taxes, unfiled years.",
      price: "by tier",
      actionText: "Add",
      basePrice: 150
    },
    {
      id: "svc-6",
      key: "flagship",
      title: "The Standing File",
      desc: "Year-long strategy, a dedicated advisor, premium support. For high-income individuals and for businesses.",
      price: "contact for pricing",
      actionText: "Talk to us",
      flagship: true
    }
  ],

  billing: {
    invoiceNumber: "2026-0418",
    amountDue: 1240.00,
    dueDate: "15 September",
    isPaid: false,
    autoPayEnabled: false,
    lineItems: [
      { desc: "Individual return — federal", amount: 400.00 },
      { desc: "Maryland, Virginia, Pennsylvania", amount: 285.00 },
      { desc: "Schedule C — Whitfield Design Co.", amount: 310.00 },
      { desc: "Schedule E — one property", amount: 245.00 }
    ],
    savedAccount: {
      bank: "Cardinal Trust",
      last4: "8842",
      type: "Checking",
      savedDate: "March 2026"
    },
    savedCard: {
      brand: "Visa",
      last4: "4012",
      exp: "08/28",
      holder: "Michael Whitfield"
    },
    history: [
      {
        id: "inv-prev-1",
        number: "Invoice 2026-0207",
        desc: "Q1 planning session · paid 3 April",
        amount: 350.00,
        date: "3 April 2026",
        method: "Bank transfer (ACH · Cardinal Trust •••• 8842)",
        txnHash: "ACH-982104-CARDINAL",
        items: [
          { desc: "Q1 tax projection & estimated tax strategy", amount: 350.00 }
        ]
      },
      {
        id: "inv-prev-2",
        number: "Invoice 2025-1140",
        desc: "TY2025 return · paid 12 Feb 2026",
        amount: 1105.00,
        date: "12 February 2026",
        method: "Bank transfer (ACH · Cardinal Trust •••• 8842)",
        txnHash: "ACH-774190-CARDINAL",
        items: [
          { desc: "Individual return — TY2025 Form 1040 federal", amount: 375.00 },
          { desc: "Maryland 502 & Virginia 763 returns", amount: 190.00 },
          { desc: "Schedule C — Whitfield Design Co.", amount: 295.00 },
          { desc: "Schedule E — Halcyon Row rental property", amount: 245.00 }
        ]
      }
    ]
  },

  updates: [
    {
      id: "u-1",
      title: "Your Form 8879 is ready to sign",
      meta: "Once both signatures are in we transmit, usually the next business day.",
      time: "Today, 8:02",
      isNew: true,
      category: "action",
      actionScreen: "sign",
      actionText: "Sign Form 8879"
    },
    {
      id: "u-2",
      title: "Denise replied about the Halcyon Row vacancy",
      meta: "Six weeks vacant while available to let does not cost you the deduction.",
      time: "2 Sep, 9:38",
      isNew: true,
      category: "messages",
      actionScreen: "msgs",
      actionText: "Open Message Thread"
    },
    {
      id: "u-3",
      title: "Pennsylvania added to your file",
      meta: "Two months of on-site work created a non-resident filing obligation.",
      time: "29 Aug",
      isNew: false,
      category: "file",
      actionScreen: "svcs",
      actionText: "Review Scope"
    },
    {
      id: "u-4",
      title: "Q3 estimated payment due 15 September",
      meta: "The voucher is in your documents. You can pay it from Billing.",
      time: "25 Aug",
      isNew: false,
      category: "billing",
      actionScreen: "pay",
      actionText: "Pay Voucher"
    },
    {
      id: "u-5",
      title: "Rule change that affects your rental",
      meta: "Uncle Pat's read on what changed and whether it moves your number. Two minutes.",
      time: "18 Aug",
      isNew: false,
      category: "rules",
      actionScreen: "rule-modal",
      actionText: "Read Uncle Pat's 2-min breakdown",
      ruleArticle: {
        title: "Treasury Reg. §1.469 Vacancy Deduction Clarification",
        summary: "The IRS issued revised guidance on residential rental properties that experience short periods of vacancy between tenants during the tax year.",
        keyTakeaway: "Good news for 214 Halcyon Row: As long as the property was actively marketed and held out for rent after the March vacancy, you retain 100% of your Schedule E depreciation, mortgage interest, and property tax deductions for the entire 12-month period.",
        impact: "$0 loss of rental deductions. Your projected Schedule E profit swing of $9,100 stands."
      }
    }
  ],

  notificationSettings: {
    needsYou: "push-email",
    stageMove: "push-email",
    deadlines: "push-email",
    ruleChanges: "email",
    firmNews: "off"
  },

  firmTriage: {
    stats: {
      waitingOnClient: 17,
      readyToReview: 6,
      needsActionToday: 4
    },
    actionQueue: [
      { id: "t-1", name: "Okonjo, A.", issue: "8879 unsigned 6 days", sub: "Two reminders sent · escalate to a call", chip: "Chase", chipClass: "warn", action: "chase" },
      { id: "t-2", name: "Brennan Holdings LLC", issue: "KBA failed 3×", sub: "Switch to wet signature", chip: "Act", chipClass: "warn", action: "wet-signature" },
      { id: "t-3", name: "Whitfield, M. & E.", issue: "2 docs outstanding", sub: "Auto-reminder goes out tomorrow", chip: "Waiting", chipClass: "", action: "view" },
      { id: "t-4", name: "Ferrante, L.", issue: "IRS notice uploaded", sub: "Free read promised within 2 business days", chip: "Due Thu", chipClass: "", action: "notice-review" }
    ],
    auditLogs: [
      { time: "Today, 14:02", user: "Denise R.", action: "Viewed 214 Halcyon Row closing disclosure" },
      { time: "Today, 08:02", user: "System", action: "Generated Form 8879 package for Whitfield, M." },
      { time: "2 Sep, 09:38", user: "Denise R.", action: "Sent message regarding Halcyon Row vacancy" },
      { time: "28 Aug, 16:40", user: "Security", action: "Completed upload malware scan: 0 threats found" }
    ]
  }
};
