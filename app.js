/* =========================================================
   BIZPILOT
   Main application JavaScript
   Complete JS Build
   ========================================================= */


/* =========================================================
   DATA
   ========================================================= */

const STORAGE_KEY = "bizpilot_v2";


/* =========================================================
   SUPABASE CONNECTION
   ========================================================= */

const SUPABASE_URL =
    "https://ajuhlllhaavvvynjxhpd.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_4b51ZkgetJ799euG8Wbicw_D9MV-XYt";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

let currentUser = null;
let cloudDataLoaded = false;
let isLoadingCloudData = false;


/* =========================================================
   APP DATA
   ========================================================= */

let appData = JSON.parse(
    localStorage.getItem(STORAGE_KEY)
) || {

    business: {
        name: "My Business",
        currency: "KSh"
    },

    sales: [],

    expenses: [],

    customers: [],

    inventory: []

};


/* =========================================================
   DATA SAFETY
   ========================================================= */

appData.business = appData.business || {
    name: "My Business",
    currency: "KSh"
};

appData.sales = Array.isArray(appData.sales)
    ? appData.sales
    : [];

appData.expenses = Array.isArray(appData.expenses)
    ? appData.expenses
    : [];

appData.customers = Array.isArray(appData.customers)
    ? appData.customers
    : [];

appData.inventory = Array.isArray(appData.inventory)
    ? appData.inventory
    : [];


/* =========================================================
   SAVE DATA
   LOCAL + CLOUD
   ========================================================= */

function saveData() {

    /* Always keep local backup */

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(appData)
    );
        /* Tell the AI Advisor that business data changed */

    document.dispatchEvent(
        new Event("bizpilot:data-updated")
    );


    /*
       If a user is logged in, also save to Supabase.
       Do not wait here because the rest of the app
       already uses saveData() synchronously.
    */

    if (
        currentUser &&
        !isLoadingCloudData
    ) {

        saveCloudData();

    }

}


/* =========================================================
   SAVE DATA TO SUPABASE
   ========================================================= */

async function saveCloudData() {

    if (!currentUser) return;


    try {

        const cloudPayload = {

            business: appData.business,

            sales: appData.sales,

            expenses: appData.expenses,

            customers: appData.customers,

            inventory: appData.inventory

        };


        /*
           First check whether this user already has
           a cloud record.
        */

        const {
            data: existingRows,
            error: findError
        } =
            await supabaseClient
                .from("business_data")
                .select("id")
                .eq(
                    "user_id",
                    currentUser.id
                )
                .limit(1);


        if (findError) {

            console.error(
                "Could not find cloud business data:",
                findError
            );

            return;

        }


        /*
           Existing record:
           UPDATE it.
        */

        if (
            existingRows &&
            existingRows.length > 0
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from("business_data")
                    .update({

                        data:
                            cloudPayload,

                        updated_at:
                            new Date().toISOString()

                    })
                    .eq(
                        "id",
                        existingRows[0].id
                    );


            if (error) {

                console.error(
                    "Could not update cloud data:",
                    error
                );

            }

            return;

        }


        /*
           No record yet:
           CREATE the user's first cloud record.
        */

        const {
            error
        } =
            await supabaseClient
                .from("business_data")
                .insert({

                    user_id:
                        currentUser.id,

                    data:
                        cloudPayload,

                    updated_at:
                        new Date().toISOString()

                });


        if (error) {

            console.error(
                "Could not create cloud data:",
                error
            );

        }

    } catch (error) {

        console.error(
            "Cloud save error:",
            error
        );

    }

}


/* =========================================================
   LOAD DATA FROM SUPABASE
   ========================================================= */

async function loadCloudData() {

    if (!currentUser) return;


    isLoadingCloudData = true;


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("business_data")
                .select("id,data,updated_at")
                .eq(
                    "user_id",
                    currentUser.id
                )
                .limit(1);


        if (error) {

            console.error(
                "Could not load cloud data:",
                error
            );

            isLoadingCloudData = false;

            return;

        }


        /*
           Existing cloud data found.
        */

        if (
            data &&
            data.length > 0 &&
            data[0].data
        ) {

            const cloudData =
                data[0].data;


            appData = {

                business:
                    cloudData.business || {
                        name: "My Business",
                        currency: "KSh"
                    },

                sales:
                    Array.isArray(
                        cloudData.sales
                    )
                        ? cloudData.sales
                        : [],

                expenses:
                    Array.isArray(
                        cloudData.expenses
                    )
                        ? cloudData.expenses
                        : [],

                customers:
                    Array.isArray(
                        cloudData.customers
                    )
                        ? cloudData.customers
                        : [],

                inventory:
                    Array.isArray(
                        cloudData.inventory
                    )
                        ? cloudData.inventory
                        : []

            };


            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(appData)
            );


            cloudDataLoaded = true;


            isLoadingCloudData = false;


            refreshApp();


            console.log(
                "BizPilot cloud data loaded successfully."
            );


            return;

        }


        /*
           No cloud record exists yet.

           Upload the user's existing local data
           as their first cloud copy.
        */

        console.log(
            "No cloud data found. Creating first cloud copy..."
        );


        isLoadingCloudData = false;

        await saveCloudData();

        cloudDataLoaded = true;

        refreshApp();


    } catch (error) {

        console.error(
            "Cloud data loading error:",
            error
        );

        isLoadingCloudData = false;

    }

}


/* =========================================================
   CLEAR USER DATA FROM MEMORY AFTER LOGOUT
   ========================================================= */

function resetAppDataForLogout() {

    appData = {

        business: {
            name: "My Business",
            currency: "KSh"
        },

        sales: [],

        expenses: [],

        customers: [],

        inventory: []

    };


    cloudDataLoaded = false;


    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(appData)
    );


    refreshApp();

}


/* =========================================================
   HELPERS
   ========================================================= */

function money(amount) {

    return `${appData.business.currency} ${Number(amount || 0).toLocaleString()}`;

}


function today() {

    return new Date().toISOString().split("T")[0];

}


function formatDate(date) {

    if (!date) return "-";

    const d = new Date(date);

    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString(
        "en-KE",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function showToast(message) {

    const toast =
        document.getElementById("toast");

    const messageElement =
        document.getElementById("toastMessage");

    if (!toast || !messageElement) return;

    messageElement.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);

}


/* =========================================================
   DATE HELPERS
   ========================================================= */

function getDaysAgo(days) {

    const date = new Date();

    date.setHours(0, 0, 0, 0);

    date.setDate(
        date.getDate() - days
    );

    return date;

}


function daysSince(dateString) {

    if (!dateString) return Infinity;

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        return Infinity;
    }

    const now = new Date();

    date.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    return Math.floor(
        (now - date) /
        (1000 * 60 * 60 * 24)
    );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

const navItems =
    document.querySelectorAll(".nav-item");

const pages =
    document.querySelectorAll(".page");


function openPage(pageId) {

    pages.forEach(page => {

        page.classList.remove("active");

    });


    const target =
        document.getElementById(pageId);

    if (target) {

        target.classList.add("active");

    }


    navItems.forEach(item => {

        item.classList.remove("active");

        if (
            item.dataset.page === pageId
        ) {

            item.classList.add("active");

        }

    });


    updatePageHeader(pageId);


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    const sidebar =
        document.getElementById("sidebar");

    if (sidebar) {

        sidebar.classList.remove(
            "mobile-open"
        );

    }

}
/* =========================================================
   BIZPILOT — LIVE GREETING + DATE
   ========================================================= */

function getLiveGreeting() {

    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
        return "Good morning 👋";
    }

    if (hour >= 12 && hour < 17) {
        return "Good afternoon 👋";
    }

    if (hour >= 17 && hour < 21) {
        return "Good evening 👋";
    }

    return "Good night 🌙";
}


function getLiveDashboardDate() {

    return new Date().toLocaleDateString("en-KE", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

}
function updatePageHeader(pageId) {

    const title =
        document.getElementById("pageTitle");

    const subtitle =
        document.getElementById("pageSubtitle");


    const headers = {

dashboard: [
    getLiveGreeting(),
    getLiveDashboardDate()
],
        sales: [
            "Sales",
            "Track your revenue and understand your performance."
        ],

        expenses: [
            "Expenses",
            "Keep your business spending under control."
        ],

        inventory: [
            "Inventory",
            "Know what you have and what needs attention."
        ],

        customers: [
            "Customers",
            "Build relationships that keep customers coming back."
        ],

        insights: [
            "AI Business Insights",
            "Simple answers to help you make better business decisions."
        ],

        invoices: [
            "Invoices",
            "Create professional invoices for your customers."
        ],

        reports: [
            "Reports",
            "See the bigger picture behind your numbers."
        ],

        settings: [
            "Settings",
            "Manage your business workspace."
        ]

    };


    if (headers[pageId]) {

        if (title) {

            title.textContent =
                headers[pageId][0];

        }

        if (subtitle) {

            subtitle.textContent =
                headers[pageId][1];

        }

    }

}


navItems.forEach(item => {

    item.addEventListener(
        "click",
        () => {

            openPage(
                item.dataset.page
            );

        }
    );

});


document
    .querySelectorAll("[data-page]")
    .forEach(item => {

        if (
            !item.classList.contains("nav-item")
        ) {

            item.addEventListener(
                "click",
                () => {

                    openPage(
                        item.dataset.page
                    );

                }
            );

        }

    });


/* =========================================================
   MOBILE MENU
   ========================================================= */

const mobileMenu =
    document.getElementById("mobileMenu");

if (mobileMenu) {

    mobileMenu.addEventListener(
        "click",
        () => {

            const sidebar =
                document.getElementById("sidebar");

            if (sidebar) {

                sidebar.classList.toggle(
                    "mobile-open"
                );

            }

        }
    );

}


/* =========================================================
   CALCULATIONS
   ========================================================= */

function getTodaySales() {

    const current = today();

    return appData.sales

        .filter(
            sale => sale.date === current
        )

        .reduce(
            (total, sale) =>
                total +
                Number(sale.amount || 0),
            0
        );

}


function getTodayExpenses() {

    const current = today();

    return appData.expenses

        .filter(
            expense =>
                expense.date === current
        )

        .reduce(
            (total, expense) =>
                total +
                Number(expense.amount || 0),
            0
        );

}


function getTotalSales() {

    return appData.sales.reduce(

        (total, sale) =>
            total +
            Number(sale.amount || 0),

        0

    );

}


function getTotalExpenses() {

    return appData.expenses.reduce(

        (total, expense) =>
            total +
            Number(expense.amount || 0),

        0

    );

}


/* =========================================================
   CUSTOMER INTELLIGENCE
   ========================================================= */

function normalizeCustomerName(name) {

    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

}


function getCustomerSales(customerName) {

    const normalized =
        normalizeCustomerName(
            customerName
        );

    return appData.sales.filter(
        sale =>
            normalizeCustomerName(
                sale.customer
            ) === normalized
    );

}


function getCustomerStats(customer) {

    const sales =
        getCustomerSales(
            customer.name
        );


    const totalSpent =
        sales.reduce(
            (total, sale) =>
                total +
                Number(
                    sale.amount || 0
                ),
            0
        );


    const purchaseCount =
        sales.length;


    const sortedSales =
        sales
            .slice()
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            );


    const lastPurchase =
        sortedSales.length
            ? sortedSales[0].date
            : null;


    const averagePurchase =
        purchaseCount > 0
            ? totalSpent /
              purchaseCount
            : 0;


    const daysSincePurchase =
        lastPurchase
            ? daysSince(
                lastPurchase
            )
            : Infinity;


    let status =
        "New";

    let statusColor =
        "#0396FF";

    let statusBackground =
        "#eef7ff";


    if (purchaseCount === 0) {

        status =
            "No purchases";

        statusColor =
            "#8b95a1";

        statusBackground =
            "#f3f5f7";

    }

    else if (
        daysSincePurchase <= 7
    ) {

        status =
            "Active";

        statusColor =
            "#16a36a";

        statusBackground =
            "#eaf8f1";

    }

    else if (
        daysSincePurchase <= 30
    ) {

        status =
            "Recent";

        statusColor =
            "#0396FF";

        statusBackground =
            "#eef7ff";

    }

    else {

        status =
            "Follow up";

        statusColor =
            "#e5484d";

        statusBackground =
            "#fff0f0";

    }


    return {

        totalSpent,

        purchaseCount,

        lastPurchase,

        averagePurchase,

        daysSincePurchase,

        status,

        statusColor,

        statusBackground

    };

}


/* =========================================================
   CUSTOMER SUMMARY
   ========================================================= */

function getCustomerSummary() {

    const stats =
        appData.customers.map(
            customer => ({

                customer,

                stats:
                    getCustomerStats(
                        customer
                    )

            })
        );


    const totalCustomers =
        appData.customers.length;


    const customersWithPurchases =
        stats.filter(
            item =>
                item.stats.purchaseCount > 0
        );


    const totalCustomerRevenue =
        customersWithPurchases.reduce(
            (total, item) =>
                total +
                item.stats.totalSpent,
            0
        );


    const averageCustomerValue =
        customersWithPurchases.length
            ? totalCustomerRevenue /
              customersWithPurchases.length
            : 0;


    const topCustomer =
        stats

            .filter(
                item =>
                    item.stats.purchaseCount > 0
            )

            .sort(
                (a, b) =>
                    b.stats.totalSpent -
                    a.stats.totalSpent
            )[0] || null;


    const followUpCustomers =
        stats.filter(
            item =>
                item.stats.purchaseCount > 0 &&
                item.stats.daysSincePurchase > 30
        );


    return {

        stats,

        totalCustomers,

        customersWithPurchases,

        totalCustomerRevenue,

        averageCustomerValue,

        topCustomer,

        followUpCustomers

    };

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function updateDashboard() {

    const sales =
        getTodaySales();

    const expenses =
        getTodayExpenses();

    const profit =
        sales - expenses;


    const todaySalesElement =
        document.getElementById("todaySales");

    if (todaySalesElement) {

        todaySalesElement.textContent =
            money(sales);

    }


    const todayExpensesElement =
        document.getElementById("todayExpenses");

    if (todayExpensesElement) {

        todayExpensesElement.textContent =
            money(expenses);

    }


    const todayProfitElement =
        document.getElementById("todayProfit");

    if (todayProfitElement) {

        todayProfitElement.textContent =
            money(profit);

    }


    const customerCount =
        document.getElementById("customerCount");

    if (customerCount) {

        customerCount.textContent =
            appData.customers.length;

    }


    updateInsight();

    renderRecentTransactions();

    updateReports();

}


/* =========================================================
   AI BUSINESS INSIGHT
   ========================================================= */

function updateInsight() {

    const title =
        document.getElementById(
            "aiInsightTitle"
        );

    const text =
        document.getElementById(
            "aiInsightText"
        );

    const health =
        document.getElementById(
            "businessHealth"
        );

    const healthText =
        document.getElementById(
            "businessHealthText"
        );


    const sales =
        getTotalSales();

    const expenses =
        getTotalExpenses();

    const profit =
        sales - expenses;


    if (
        appData.sales.length === 0 &&
        appData.expenses.length === 0 &&
        appData.inventory.length === 0 &&
        appData.customers.length === 0
    ) {

        if (title) {

            title.textContent =
                "Your business is ready for its first insight.";

        }

        if (text) {

            text.textContent =
                "Add your first sale, expense, product or customer and BizPilot will start analyzing your business.";

        }

        if (health) {

            health.textContent =
                "Getting started";

        }

        if (healthText) {

            healthText.textContent =
                "Once you record some business activity, BizPilot will begin turning your numbers into useful decisions.";

        }

        return;

    }


    const todaySales =
        getTodaySales();

    const todayExpenses =
        getTodayExpenses();

    const todayProfit =
        todaySales - todayExpenses;


    let profitMargin = 0;

    if (sales > 0) {

        profitMargin =
            (profit / sales) * 100;

    }


    const lowStockProducts =
        appData.inventory.filter(
            product => {

                const stock =
                    Number(
                        product.stock || 0
                    );

                const minimum =
                    Number(
                        product.minimum ?? 5
                    );

                return stock <= minimum;

            }
        );


    const expenseCategories = {};


    appData.expenses.forEach(
        expense => {

            const category =
                expense.category ||
                "Other";

            expenseCategories[category] =
                (
                    expenseCategories[category] ||
                    0
                ) +
                Number(
                    expense.amount || 0
                );

        }
    );


    let biggestExpenseCategory =
        null;

    let biggestExpenseAmount =
        0;


    Object.entries(
        expenseCategories
    ).forEach(
        ([category, amount]) => {

            if (
                amount >
                biggestExpenseAmount
            ) {

                biggestExpenseCategory =
                    category;

                biggestExpenseAmount =
                    amount;

            }

        }
    );


    const customerSales = {};


    appData.sales.forEach(
        sale => {

            const customer =
                (sale.customer || "")
                    .trim();

            if (!customer) return;

            const key =
                normalizeCustomerName(
                    customer
                );


            customerSales[key] =
                (
                    customerSales[key] ||
                    {
                        name: customer,
                        amount: 0
                    }
                );


            customerSales[key].amount +=
                Number(
                    sale.amount || 0
                );

        }
    );


    let topCustomer =
        null;

    let topCustomerAmount =
        0;


    Object.values(
        customerSales
    ).forEach(
        customer => {

            if (
                customer.amount >
                topCustomerAmount
            ) {

                topCustomer =
                    customer.name;

                topCustomerAmount =
                    customer.amount;

            }

        }
    );


    const customerSummary =
        getCustomerSummary();


    const currentDate =
        new Date();

    let last7DaysSales = 0;

    let previous7DaysSales = 0;


    appData.sales.forEach(
        sale => {

            const saleDate =
                new Date(sale.date);

            if (
                isNaN(
                    saleDate.getTime()
                )
            ) {

                return;

            }


            const difference =
                Math.floor(
                    (
                        currentDate -
                        saleDate
                    ) /
                    (
                        1000 *
                        60 *
                        60 *
                        24
                    )
                );


            if (
                difference >= 0 &&
                difference < 7
            ) {

                last7DaysSales +=
                    Number(
                        sale.amount || 0
                    );

            }


            if (
                difference >= 7 &&
                difference < 14
            ) {

                previous7DaysSales +=
                    Number(
                        sale.amount || 0
                    );

            }

        }
    );


    let insightTitle =
        "BizPilot has analyzed your business.";

    let insightText =
        "Keep recording your business activity and BizPilot will become more useful as your data grows.";

    let healthLabel =
        "Business active";

    let healthDescription =
        "BizPilot is monitoring your sales, expenses, customers and inventory.";


    if (
        sales > 0 &&
        expenses > sales
    ) {

        insightTitle =
            "Your expenses are currently higher than your sales.";

        insightText =
            `You've recorded ${money(sales)} in sales against ${money(expenses)} in expenses. Focus on increasing revenue or reducing unnecessary costs.`;

        healthLabel =
            "Needs attention";

        healthDescription =
            "Your current recorded expenses are putting pressure on profitability.";

    }


    else if (
        sales > 0 &&
        profit > 0 &&
        profitMargin >= 30
    ) {

        insightTitle =
            "Your business is showing a healthy profit margin.";

        insightText =
            `You've recorded ${money(sales)} in sales and ${money(profit)} in estimated profit. Your current margin is ${profitMargin.toFixed(1)}%. Look for ways to grow sales without allowing costs to rise at the same rate.`;

        healthLabel =
            "Looking healthy";

        healthDescription =
            "Revenue is currently comfortably above recorded expenses.";

    }


    else if (
        sales > 0 &&
        profit > 0
    ) {

        insightTitle =
            "You're profitable, but there is room to improve.";

        insightText =
            `Your recorded sales are ${money(sales)} and your estimated profit is ${money(profit)}. Review your biggest costs and identify opportunities to increase your margins.`;

        healthLabel =
            "Profitable";

        healthDescription =
            "The business is currently making more from recorded sales than it spends.";

    }


    else if (
        sales === 0 &&
        expenses > 0
    ) {

        insightTitle =
            "You have expenses but no recorded sales yet.";

        insightText =
            `You've recorded ${money(expenses)} in expenses. Start recording sales so BizPilot can calculate your real performance and profit.`;

        healthLabel =
            "Needs sales";

        healthDescription =
            "The app has recorded spending but no revenue yet.";

    }


    else if (
        todaySales === 0 &&
        sales > 0
    ) {

        insightTitle =
            "No sale has been recorded today.";

        insightText =
            "Consider following up with previous customers, promoting a product or creating a simple offer to generate today's revenue.";

        healthLabel =
            "Opportunity";

        healthDescription =
            "Your business has recorded revenue before, so today is an opportunity to create another sale.";

    }


    if (
        last7DaysSales > 0 &&
        previous7DaysSales > 0 &&
        last7DaysSales >
        previous7DaysSales * 1.2
    ) {

        insightTitle =
            "Your recent sales are trending upward.";

        insightText =
            `You recorded ${money(last7DaysSales)} in the last 7 days compared with ${money(previous7DaysSales)} in the previous 7 days. Identify what is driving this increase and repeat it.`;

        healthLabel =
            "Growing";

        healthDescription =
            "Your recent sales performance is stronger than the previous period.";

    }


    if (
        customerSummary.followUpCustomers.length > 0
    ) {

        const followUpCount =
            customerSummary
                .followUpCustomers
                .length;


        insightTitle =
            `${followUpCount} customer${followUpCount > 1 ? "s" : ""} may need a follow-up.`;

        insightText =
            `Some customers haven't purchased in more than 30 days. Reaching out with a useful offer could help bring previous customers back.`;

        healthLabel =
            "Customer opportunity";

        healthDescription =
            "BizPilot found customers who may be worth reconnecting with.";

    }


    if (
        lowStockProducts.length > 0
    ) {

        const productNames =
            lowStockProducts
                .slice(0, 3)
                .map(
                    product =>
                        product.name
                )
                .join(", ");


        insightTitle =
            `${lowStockProducts.length} product${lowStockProducts.length > 1 ? "s" : ""} need stock attention.`;

        insightText =
            `Low stock detected for ${productNames}${lowStockProducts.length > 3 ? " and more" : ""}. Restocking early can help prevent missed sales.`;

        healthLabel =
            "Stock alert";

        healthDescription =
            "Your inventory contains products that have reached their low-stock threshold.";

    }


    if (title) {

        title.textContent =
            insightTitle;

    }

    if (text) {

        text.textContent =
            insightText;

    }

    if (health) {

        health.textContent =
            healthLabel;

    }

    if (healthText) {

        healthText.textContent =
            healthDescription;

    }


    console.log(
        "BizPilot AI Analysis:",
        {
            sales,
            expenses,
            profit,
            profitMargin,
            todaySales,
            todayExpenses,
            todayProfit,
            lowStockProducts,
            biggestExpenseCategory,
            biggestExpenseAmount,
            topCustomer,
            topCustomerAmount,
            last7DaysSales,
            previous7DaysSales,
            followUpCustomers:
                customerSummary.followUpCustomers
        }
    );

}


/* =========================================================
   RECENT TRANSACTIONS
   ========================================================= */

function renderRecentTransactions() {

    const container =
        document.getElementById(
            "recentTransactions"
        );


    if (!container) return;


    const transactions = [

        ...appData.sales.map(
            sale => ({

                ...sale,

                type: "sale"

            })
        ),

        ...appData.expenses.map(
            expense => ({

                ...expense,

                type: "expense"

            })
        )

    ]

    .sort(
        (a, b) =>
            new Date(b.date) -
            new Date(a.date)
    )

    .slice(0, 5);


    if (!transactions.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div>◎</div>

                <p>No transactions yet.</p>

                <small>
                    Your recent activity will appear here.
                </small>

            </div>

        `;

        return;

    }


    container.innerHTML =
        transactions.map(
            item => `

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    padding:10px 0;
                    border-bottom:1px solid #f0f0f0;
                ">

                    <div>

                        <strong style="
                            display:block;
                            font-size:9px;
                        ">

                            ${escapeHTML(
                                item.description ||
                                item.customer ||
                                item.category ||
                                "Transaction"
                            )}

                        </strong>

                        <small style="
                            color:#999;
                            font-size:7px;
                        ">

                            ${formatDate(item.date)}

                        </small>

                    </div>

                    <strong style="
                        font-size:9px;
                        color:${item.type === "sale" ? "#16a36a" : "#e5484d"};
                    ">

                        ${item.type === "sale" ? "+" : "-"}

                        ${money(item.amount)}

                    </strong>

                </div>

            `
        )

        .join("");

}


/* =========================================================
   SALES TABLE
   ========================================================= */

function renderSales() {

    const body =
        document.getElementById(
            "salesTableBody"
        );


    if (!body) return;


    if (!appData.sales.length) {

        body.innerHTML = `

            <tr>

                <td colspan="5" style="
                    text-align:center;
                    padding:45px;
                    color:#999;
                ">

                    No sales recorded yet.

                </td>

            </tr>

        `;

        return;

    }


    body.innerHTML =
        appData.sales

        .slice()

        .reverse()

        .map(

            sale => `

                <tr>

                    <td>
                        ${formatDate(sale.date)}
                    </td>

                    <td>
                        ${escapeHTML(
                            sale.customer ||
                            "Walk-in"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            sale.description ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            sale.payment ||
                            "Cash"
                        )}
                    </td>

                    <td class="amount">
                        ${money(sale.amount)}
                    </td>

                </tr>

            `

        )

        .join("");

}


/* =========================================================
   EXPENSE TABLE
   ========================================================= */

function renderExpenses() {

    const body =
        document.getElementById(
            "expensesTableBody"
        );


    if (!body) return;


    if (!appData.expenses.length) {

        body.innerHTML = `

            <tr>

                <td colspan="4" style="
                    text-align:center;
                    padding:45px;
                    color:#999;
                ">

                    No expenses recorded yet.

                </td>

            </tr>

        `;

        return;

    }


    body.innerHTML =
        appData.expenses

        .slice()

        .reverse()

        .map(

            expense => `

                <tr>

                    <td>
                        ${formatDate(
                            expense.date
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            expense.category ||
                            "Other"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            expense.description ||
                            "-"
                        )}
                    </td>

                    <td class="amount">
                        ${money(
                            expense.amount
                        )}
                    </td>

                </tr>

            `

        )

        .join("");

}


/* =========================================================
   SMART INVENTORY
   ========================================================= */

function renderInventory() {

    const container =
        document.getElementById(
            "inventoryGrid"
        );

    if (!container) return;


    if (!appData.inventory.length) {

        container.innerHTML = `

            <div class="empty-large">

                <div>▦</div>

                <h3>No products yet</h3>

                <p>
                    Add your first product to start tracking
                    inventory and receive smart stock alerts.
                </p>

                <button
                    class="primary-btn"
                    id="emptyInventoryBtn"
                >
                    Add Product
                </button>

            </div>

        `;


        const button =
            document.getElementById(
                "emptyInventoryBtn"
            );

        if (button) {

            button.addEventListener(
                "click",
                openProductModal
            );

        }

        return;

    }


    const totalProducts =
        appData.inventory.length;


    const totalUnits =
        appData.inventory.reduce(
            (total, product) =>
                total +
                Number(product.stock || 0),
            0
        );


    const stockValue =
        appData.inventory.reduce(
            (total, product) =>
                total +
                Number(product.price || 0) *
                Number(product.stock || 0),
            0
        );


    const lowStockCount =
        appData.inventory.filter(
            product =>
                Number(product.stock || 0) <=
                Number(product.minimum ?? 5)
        ).length;


    container.innerHTML = `

        <div style="
            grid-column:1 / -1;
            display:grid;
            grid-template-columns:
                repeat(4, minmax(0, 1fr));
            gap:16px;
            margin-bottom:8px;
        ">

            <div style="
                background:#fff;
                border:1px solid #e9edf2;
                border-radius:16px;
                padding:18px;
            ">

                <small style="
                    color:#8b95a1;
                    display:block;
                    margin-bottom:6px;
                ">
                    PRODUCTS
                </small>

                <strong style="
                    font-size:24px;
                    color:#111;
                ">
                    ${totalProducts}
                </strong>

            </div>


            <div style="
                background:#fff;
                border:1px solid #e9edf2;
                border-radius:16px;
                padding:18px;
            ">

                <small style="
                    color:#8b95a1;
                    display:block;
                    margin-bottom:6px;
                ">
                    TOTAL UNITS
                </small>

                <strong style="
                    font-size:24px;
                    color:#111;
                ">
                    ${totalUnits.toLocaleString()}
                </strong>

            </div>


            <div style="
                background:#fff;
                border:1px solid #e9edf2;
                border-radius:16px;
                padding:18px;
            ">

                <small style="
                    color:#8b95a1;
                    display:block;
                    margin-bottom:6px;
                ">
                    STOCK VALUE
                </small>

                <strong style="
                    font-size:24px;
                    color:#0396FF;
                ">
                    ${money(stockValue)}
                </strong>

            </div>


            <div style="
                background:#fff;
                border:1px solid #e9edf2;
                border-radius:16px;
                padding:18px;
            ">

                <small style="
                    color:#8b95a1;
                    display:block;
                    margin-bottom:6px;
                ">
                    LOW STOCK
                </small>

                <strong style="
                    font-size:24px;
                    color:${lowStockCount > 0 ? "#e5484d" : "#16a36a"};
                ">
                    ${lowStockCount}
                </strong>

            </div>

        </div>


        ${appData.inventory.map(product => {

            const stock =
                Number(
                    product.stock || 0
                );

            const minimum =
                Number(
                    product.minimum ?? 5
                );

            const price =
                Number(
                    product.price || 0
                );

            const value =
                stock * price;

            const isLow =
                stock <= minimum;

            const isOut =
                stock === 0;


            let statusText =
                "IN STOCK";

            let statusColor =
                "#16a36a";

            let statusBackground =
                "#eaf8f1";


            if (isOut) {

                statusText =
                    "OUT OF STOCK";

                statusColor =
                    "#e5484d";

                statusBackground =
                    "#fff0f0";

            }

            else if (isLow) {

                statusText =
                    "LOW STOCK";

                statusColor =
                    "#e5484d";

                statusBackground =
                    "#fff0f0";

            }


            const stockPercentage =
                Math.min(
                    stock /
                    Math.max(
                        minimum * 3,
                        1
                    ) *
                    100,
                    100
                );


            return `

                <div
                    class="inventory-card"
                    style="
                        position:relative;
                        overflow:hidden;
                    "
                >

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-bottom:14px;
                    ">

                        <div class="product-icon">
                            ▦
                        </div>


                        <span style="
                            background:${statusBackground};
                            color:${statusColor};
                            padding:6px 9px;
                            border-radius:20px;
                            font-size:10px;
                            font-weight:700;
                            letter-spacing:.4px;
                        ">

                            ${statusText}

                        </span>

                    </div>


                    <h3 style="
                        margin-bottom:6px;
                    ">

                        ${escapeHTML(
                            product.name
                        )}

                    </h3>


                    <div class="product-price">
                        ${money(price)}
                    </div>


                    <div style="
                        margin-top:18px;
                    ">

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            margin-bottom:7px;
                            font-size:12px;
                        ">

                            <span style="
                                color:#777;
                            ">
                                Current stock
                            </span>

                            <strong style="
                                color:${isLow ? "#e5484d" : "#111"};
                            ">
                                ${stock} units
                            </strong>

                        </div>


                        <div style="
                            height:7px;
                            width:100%;
                            background:#eef1f4;
                            border-radius:20px;
                            overflow:hidden;
                        ">

                            <div style="
                                height:100%;
                                width:${stockPercentage}%;
                                background:${isLow ? "#e5484d" : "#0396FF"};
                                border-radius:20px;
                            "></div>

                        </div>


                        <div style="
                            margin-top:7px;
                            font-size:11px;
                            color:#999;
                        ">

                            Alert level:
                            ${minimum} units

                        </div>

                    </div>


                    <div style="
                        margin-top:18px;
                        padding-top:14px;
                        border-top:1px solid #f0f2f4;
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                    ">

                        <span style="
                            color:#888;
                            font-size:11px;
                        ">
                            Stock value
                        </span>

                        <strong style="
                            color:#111;
                            font-size:13px;
                        ">
                            ${money(value)}
                        </strong>

                    </div>


                    ${isLow ? `

                        <div style="
                            margin-top:12px;
                            padding:10px;
                            border-radius:10px;
                            background:#fff7f7;
                            color:#d9363e;
                            font-size:11px;
                            line-height:1.5;
                        ">

                            ⚠️ This product is running low.
                            Consider restocking before you run out.

                        </div>

                    ` : ""}


                </div>

            `;

        }).join("")}

    `;

}


/* =========================================================
   SMART CUSTOMERS
   ========================================================= */

function renderCustomers() {

    const container =
        document.getElementById(
            "customerGrid"
        );


    if (!container) return;


    if (!appData.customers.length) {

        container.innerHTML = `

            <div class="empty-large">

                <div>♙</div>

                <h3>No customers yet</h3>

                <p>
                    Add customers and BizPilot will help
                    you understand who buys from your business.
                </p>

                <button
                    class="primary-btn"
                    id="emptyCustomerBtn"
                >

                    Add Customer

                </button>

            </div>

        `;


        const button =
            document.getElementById(
                "emptyCustomerBtn"
            );

        if (button) {

            button.addEventListener(
                "click",
                openCustomerModal
            );

        }

        return;

    }


    const summary =
        getCustomerSummary();


    const sortedCustomers =
        summary.stats
            .slice()
            .sort(
                (a, b) => {

                    if (
                        b.stats.totalSpent !==
                        a.stats.totalSpent
                    ) {

                        return (
                            b.stats.totalSpent -
                            a.stats.totalSpent
                        );

                    }

                    return (
                        a.customer.name
                            .localeCompare(
                                b.customer.name
                            )
                    );

                }
            );


    const summaryHTML = `

        <div style="
            grid-column:1 / -1;
            display:grid;
            grid-template-columns:
                repeat(4, minmax(0, 1fr));
            gap:16px;
            margin-bottom:8px;
        ">

            <div style="
                background:#fff;
                border:1px solid #e9edf2;
                border-radius:16px;
                padding:18px;
            ">

                <small style="
                    color:#8b95a1;
                    display:block;
                    margin-bottom:6px;
                ">
                    CUSTOMERS
                </small>

                <strong style="
                    font-size:24px;
                    color:#111;
                ">
                    ${summary.totalCustomers}
                </strong>

            </div>


            <div style="
                background:#fff;
                border:1px solid #e9edf2;
                border-radius:16px;
                padding:18px;
            ">

                <small style="
                    color:#8b95a1;
                    display:block;
                    margin-bottom:6px;
                ">
                    CUSTOMER REVENUE
                </small>

                <strong style="
                    font-size:24px;
                    color:#0396FF;
                ">
                    ${money(
                        summary.totalCustomerRevenue
                    )}
                </strong>

            </div>


            <div style="
                background:#fff;
                border:1px solid #e9edf2;
                border-radius:16px;
                padding:18px;
            ">

                <small style="
                    color:#8b95a1;
                    display:block;
                    margin-bottom:6px;
                ">
                    AVG. CUSTOMER VALUE
                </small>

                <strong style="
                    font-size:24px;
                    color:#111;
                ">
                    ${money(
                        summary.averageCustomerValue
                    )}
                </strong>

            </div>


            <div style="
                background:#fff;
                border:1px solid #e9edf2;
                border-radius:16px;
                padding:18px;
            ">

                <small style="
                    color:#8b95a1;
                    display:block;
                    margin-bottom:6px;
                ">
                    FOLLOW-UPS
                </small>

                <strong style="
                    font-size:24px;
                    color:${summary.followUpCustomers.length > 0 ? "#e5484d" : "#16a36a"};
                ">
                    ${summary.followUpCustomers.length}
                </strong>

            </div>

        </div>

    `;


    const customerCards =
        sortedCustomers
            .map(
                item => {

                    const customer =
                        item.customer;

                    const stats =
                        item.stats;


                    const firstLetter =
                        String(
                            customer.name || "?"
                        )
                        .charAt(0)
                        .toUpperCase();


                    return `

                        <div
                            class="customer-card"
                            style="
                                position:relative;
                                overflow:hidden;
                            "
                        >

                            <div style="
                                display:flex;
                                justify-content:space-between;
                                align-items:flex-start;
                                gap:12px;
                                margin-bottom:16px;
                            ">

                                <div style="
                                    display:flex;
                                    align-items:center;
                                    gap:12px;
                                ">

                                    <div class="customer-avatar">
                                        ${escapeHTML(
                                            firstLetter
                                        )}
                                    </div>


                                    <div>

                                        <strong style="
                                            display:block;
                                            font-size:15px;
                                            color:#111;
                                        ">

                                            ${escapeHTML(
                                                customer.name
                                            )}

                                        </strong>

                                        <p style="
                                            margin:4px 0 0;
                                            color:#8b95a1;
                                            font-size:11px;
                                        ">

                                            ${escapeHTML(
                                                customer.phone ||
                                                "No phone added"
                                            )}

                                        </p>

                                    </div>

                                </div>


                                <span style="
                                    background:${stats.statusBackground};
                                    color:${stats.statusColor};
                                    padding:6px 9px;
                                    border-radius:20px;
                                    font-size:9px;
                                    font-weight:700;
                                    white-space:nowrap;
                                ">

                                    ${stats.status}

                                </span>

                            </div>


                            <div style="
                                display:grid;
                                grid-template-columns:
                                    repeat(2, 1fr);
                                gap:10px;
                            ">

                                <div style="
                                    background:#f7f9fb;
                                    border-radius:10px;
                                    padding:11px;
                                ">

                                    <small style="
                                        display:block;
                                        color:#8b95a1;
                                        font-size:9px;
                                        margin-bottom:5px;
                                    ">
                                        SPENT
                                    </small>

                                    <strong style="
                                        font-size:13px;
                                        color:#111;
                                    ">

                                        ${money(
                                            stats.totalSpent
                                        )}

                                    </strong>

                                </div>


                                <div style="
                                    background:#f7f9fb;
                                    border-radius:10px;
                                    padding:11px;
                                ">

                                    <small style="
                                        display:block;
                                        color:#8b95a1;
                                        font-size:9px;
                                        margin-bottom:5px;
                                    ">
                                        PURCHASES
                                    </small>

                                    <strong style="
                                        font-size:13px;
                                        color:#111;
                                    ">

                                        ${stats.purchaseCount}

                                    </strong>

                                </div>

                            </div>


                            <div style="
                                margin-top:12px;
                                padding-top:12px;
                                border-top:1px solid #f0f2f4;
                                display:flex;
                                justify-content:space-between;
                                gap:10px;
                                font-size:10px;
                            ">

                                <span style="
                                    color:#8b95a1;
                                ">

                                    Last purchase

                                </span>

                                <strong style="
                                    color:#333;
                                ">

                                    ${
                                        stats.lastPurchase
                                            ? formatDate(
                                                stats.lastPurchase
                                            )
                                            : "No purchases"
                                    }

                                </strong>

                            </div>


                            ${
                                stats.purchaseCount > 0
                                ? `

                                    <div style="
                                        margin-top:8px;
                                        display:flex;
                                        justify-content:space-between;
                                        gap:10px;
                                        font-size:10px;
                                    ">

                                        <span style="
                                            color:#8b95a1;
                                        ">

                                            Average purchase

                                        </span>

                                        <strong style="
                                            color:#0396FF;
                                        ">

                                            ${money(
                                                stats.averagePurchase
                                            )}

                                        </strong>

                                    </div>

                                `
                                : ""
                            }


                            ${
                                stats.status === "Follow up"
                                ? `

                                    <div style="
                                        margin-top:12px;
                                        padding:10px;
                                        border-radius:10px;
                                        background:#fff7f7;
                                        color:#d9363e;
                                        font-size:10px;
                                        line-height:1.5;
                                    ">

                                        ↗ This customer may be worth
                                        reconnecting with.

                                    </div>

                                `
                                : ""
                            }

                        </div>

                    `;

                }
            )
            .join("");


    container.innerHTML =
        summaryHTML +
        customerCards;

}


/* =========================================================
   REPORTS
   ========================================================= */

function updateReports() {

    const revenue =
        getTotalSales();

    const expenses =
        getTotalExpenses();

    const profit =
        revenue - expenses;


    const reportRevenue =
        document.getElementById(
            "reportRevenue"
        );

    if (reportRevenue) {

        reportRevenue.textContent =
            money(revenue);

    }


    const reportExpenses =
        document.getElementById(
            "reportExpenses"
        );

    if (reportExpenses) {

        reportExpenses.textContent =
            money(expenses);

    }


    const reportProfit =
        document.getElementById(
            "reportProfit"
        );

    if (reportProfit) {

        reportProfit.textContent =
            money(profit);

    }

}


/* =========================================================
   MODAL
   ========================================================= */

const modalOverlay =
    document.getElementById(
        "modalOverlay"
    );

const modalContent =
    document.getElementById(
        "modalContent"
    );


function openModal(content) {

    if (!modalContent || !modalOverlay) return;

    modalContent.innerHTML =
        content;

    modalOverlay.classList.add(
        "show"
    );

}


function closeModal() {

    if (!modalOverlay) return;

    modalOverlay.classList.remove(
        "show"
    );

}


const closeModalButton =
    document.getElementById(
        "closeModal"
    );

if (closeModalButton) {

    closeModalButton.addEventListener(
        "click",
        closeModal
    );

}


if (modalOverlay) {

    modalOverlay.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                modalOverlay
            ) {

                closeModal();

            }

        }
    );

}


/* =========================================================
   SALE MODAL
   ========================================================= */

function openSaleModal() {

    openModal(`

        <h2>Add a Sale</h2>

        <p class="modal-subtitle">
            Record a sale and keep your revenue up to date.
        </p>

        <form id="saleForm">

            <div class="form-group">

                <label>
                    Amount
                </label>

                <input
                    type="number"
                    id="saleAmount"
                    placeholder="e.g. 2500"
                    required
                    min="0"
                    step="0.01"
                >

            </div>


            <div class="form-group">

                <label>
                    Customer
                </label>

                <input
                    type="text"
                    id="saleCustomer"
                    placeholder="Customer name"
                >

            </div>


            <div class="form-group">

                <label>
                    Description
                </label>

                <input
                    type="text"
                    id="saleDescription"
                    placeholder="What was sold?"
                >

            </div>


            <div class="form-group">

                <label>
                    Payment method
                </label>

                <select id="salePayment">

                    <option>
                        M-Pesa
                    </option>

                    <option>
                        Cash
                    </option>

                    <option>
                        Card
                    </option>

                    <option>
                        Other
                    </option>

                </select>

            </div>


            <button
                type="submit"
                class="form-submit"
            >

                Save Sale

            </button>

        </form>

    `);


    const form =
        document.getElementById(
            "saleForm"
        );


    if (!form) return;


    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const amount =
                Number(
                    document
                        .getElementById(
                            "saleAmount"
                        )
                        .value
                );


            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                showToast(
                    "Please enter a valid sale amount."
                );

                return;

            }


            const sale = {

                id: Date.now(),

                date: today(),

                amount,

                customer:
                    document
                        .getElementById(
                            "saleCustomer"
                        )
                        .value
                        .trim(),

                description:
                    document
                        .getElementById(
                            "saleDescription"
                        )
                        .value
                        .trim(),

                payment:
                    document
                        .getElementById(
                            "salePayment"
                        )
                        .value

            };


            appData.sales.push(
                sale
            );


            saveData();

            closeModal();

            refreshApp();

            showToast(
                "Sale added successfully."
            );

        }
    );

}


/* =========================================================
   EXPENSE MODAL
   ========================================================= */

function openExpenseModal() {

    openModal(`

        <h2>Add an Expense</h2>

        <p class="modal-subtitle">
            Record business spending to keep your profit accurate.
        </p>

        <form id="expenseForm">

            <div class="form-group">

                <label>
                    Amount
                </label>

                <input
                    type="number"
                    id="expenseAmount"
                    placeholder="e.g. 1200"
                    required
                    min="0"
                    step="0.01"
                >

            </div>


            <div class="form-group">

                <label>
                    Category
                </label>

                <select id="expenseCategory">

                    <option>
                        Stock
                    </option>

                    <option>
                        Transport
                    </option>

                    <option>
                        Rent
                    </option>

                    <option>
                        Marketing
                    </option>

                    <option>
                        Utilities
                    </option>

                    <option>
                        Salaries
                    </option>

                    <option>
                        Other
                    </option>

                </select>

            </div>


            <div class="form-group">

                <label>
                    Description
                </label>

                <input
                    type="text"
                    id="expenseDescription"
                    placeholder="What did you spend on?"
                >

            </div>


            <button
                type="submit"
                class="form-submit"
            >

                Save Expense

            </button>

        </form>

    `);


    const form =
        document.getElementById(
            "expenseForm"
        );


    if (!form) return;


    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const amount =
                Number(
                    document
                        .getElementById(
                            "expenseAmount"
                        )
                        .value
                );


            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {

                showToast(
                    "Please enter a valid expense amount."
                );

                return;

            }


            const expense = {

                id: Date.now(),

                date: today(),

                amount,

                category:
                    document
                        .getElementById(
                            "expenseCategory"
                        )
                        .value,

                description:
                    document
                        .getElementById(
                            "expenseDescription"
                        )
                        .value
                        .trim()

            };


            appData.expenses.push(
                expense
            );


            saveData();

            closeModal();

            refreshApp();

            showToast(
                "Expense added successfully."
            );

        }
    );

}


/* =========================================================
   PRODUCT MODAL
   ========================================================= */

function openProductModal() {

    openModal(`

        <h2>Add a Product</h2>

        <p class="modal-subtitle">
            Start building your smart inventory.
        </p>

        <form id="productForm">

            <div class="form-group">

                <label>
                    Product name
                </label>

                <input
                    type="text"
                    id="productName"
                    placeholder="e.g. Black T-Shirt"
                    required
                >

            </div>


            <div class="form-group">

                <label>
                    Selling price
                </label>

                <input
                    type="number"
                    id="productPrice"
                    placeholder="e.g. 1500"
                    required
                    min="0"
                    step="0.01"
                >

            </div>


            <div class="form-group">

                <label>
                    Current stock
                </label>

                <input
                    type="number"
                    id="productStock"
                    placeholder="e.g. 20"
                    required
                    min="0"
                    step="1"
                >

            </div>


            <div class="form-group">

                <label>
                    Low stock alert at
                </label>

                <input
                    type="number"
                    id="productMinimum"
                    value="5"
                    min="0"
                    step="1"
                >

            </div>


            <button
                type="submit"
                class="form-submit"
            >

                Add Product

            </button>

        </form>

    `);


    const form =
        document.getElementById(
            "productForm"
        );


    if (!form) return;


    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const name =
                document
                    .getElementById(
                        "productName"
                    )
                    .value
                    .trim();


            const price =
                Number(
                    document
                        .getElementById(
                            "productPrice"
                        )
                        .value
                );


            const stock =
                Number(
                    document
                        .getElementById(
                            "productStock"
                        )
                        .value
                );


            const minimum =
                Number(
                    document
                        .getElementById(
                            "productMinimum"
                        )
                        .value
                );


            if (!name) {

                showToast(
                    "Please enter a product name."
                );

                return;

            }


            if (
                !Number.isFinite(price) ||
                price < 0
            ) {

                showToast(
                    "Please enter a valid price."
                );

                return;

            }


            if (
                !Number.isFinite(stock) ||
                stock < 0
            ) {

                showToast(
                    "Please enter valid stock."
                );

                return;

            }


            appData.inventory.push({

                id: Date.now(),

                name,

                price,

                stock,

                minimum:
                    Number.isFinite(
                        minimum
                    )
                        ? minimum
                        : 5

            });


            saveData();

            closeModal();

            refreshApp();

            showToast(
                "Product added successfully."
            );

        }
    );

}


/* =========================================================
   CUSTOMER MODAL
   ========================================================= */

function openCustomerModal() {

    openModal(`

        <h2>Add a Customer</h2>

        <p class="modal-subtitle">
            Add a customer so BizPilot can track their relationship with your business.
        </p>

        <form id="customerForm">

            <div class="form-group">

                <label>
                    Customer name
                </label>

                <input
                    type="text"
                    id="customerName"
                    placeholder="e.g. Brian Mwangi"
                    required
                >

            </div>


            <div class="form-group">

                <label>
                    Phone number
                </label>

                <input
                    type="tel"
                    id="customerPhone"
                    placeholder="e.g. 0712345678"
                >

            </div>


            <div class="form-group">

                <label>
                    Email
                </label>

                <input
                    type="email"
                    id="customerEmail"
                    placeholder="customer@email.com"
                >

            </div>


            <button
                type="submit"
                class="form-submit"
            >

                Add Customer

            </button>

        </form>

    `);


    const form =
        document.getElementById(
            "customerForm"
        );


    if (!form) return;


    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const name =
                document
                    .getElementById(
                        "customerName"
                    )
                    .value
                    .trim();


            if (!name) {

                showToast(
                    "Please enter the customer name."
                );

                return;

            }


            const phone =
                document
                    .getElementById(
                        "customerPhone"
                    )
                    .value
                    .trim();


            const email =
                document
                    .getElementById(
                        "customerEmail"
                    )
                    .value
                    .trim();


            appData.customers.push({

                id: Date.now(),

                name,

                phone,

                email

            });


            saveData();

            closeModal();

            refreshApp();

            showToast(
                "Customer added successfully."
            );

        }
    );

}


/* =========================================================
   BUTTONS
   ========================================================= */

const quickSaleBtn =
    document.getElementById(
        "quickSaleBtn"
    );

if (quickSaleBtn) {

    quickSaleBtn.addEventListener(
        "click",
        openSaleModal
    );

}


const dashboardSale =
    document.getElementById(
        "dashboardSale"
    );

if (dashboardSale) {

    dashboardSale.addEventListener(
        "click",
        openSaleModal
    );

}


const salesAddBtn =
    document.getElementById(
        "salesAddBtn"
    );

if (salesAddBtn) {

    salesAddBtn.addEventListener(
        "click",
        openSaleModal
    );

}


const dashboardExpense =
    document.getElementById(
        "dashboardExpense"
    );

if (dashboardExpense) {

    dashboardExpense.addEventListener(
        "click",
        openExpenseModal
    );

}


const expenseAddBtn =
    document.getElementById(
        "expenseAddBtn"
    );

if (expenseAddBtn) {

    expenseAddBtn.addEventListener(
        "click",
        openExpenseModal
    );

}


const inventoryAddBtn =
    document.getElementById(
        "inventoryAddBtn"
    );

if (inventoryAddBtn) {

    inventoryAddBtn.addEventListener(
        "click",
        openProductModal
    );

}


const customerAddBtn =
    document.getElementById(
        "customerAddBtn"
    );

if (customerAddBtn) {

    customerAddBtn.addEventListener(
        "click",
        openCustomerModal
    );

}


/* =========================================================
   SETTINGS
   ========================================================= */

const businessNameInput =
    document.getElementById(
        "businessName"
    );

if (businessNameInput) {

    businessNameInput.value =
        appData.business.name;

}


const currencyInput =
    document.getElementById(
        "currency"
    );

if (currencyInput) {

    currencyInput.value =
        appData.business.currency;

}


const saveSettingsButton =
    document.getElementById(
        "saveSettings"
    );

if (saveSettingsButton) {

    saveSettingsButton.addEventListener(
        "click",
        () => {

            const nameInput =
                document.getElementById(
                    "businessName"
                );

            const currencySelect =
                document.getElementById(
                    "currency"
                );


            appData.business.name =
                nameInput
                    ? nameInput.value.trim() ||
                      "My Business"
                    : "My Business";


            appData.business.currency =
                currencySelect
                    ? currencySelect.value ||
                      "KSh"
                    : "KSh";


            saveData();

            refreshApp();

            showToast(
                "Business settings saved."
            );

        }
    );

}


/* =========================================================
   REFRESH APP
   ========================================================= */

function refreshApp() {

    updateDashboard();

    renderSales();

    renderExpenses();

    renderInventory();

    renderCustomers();

    updateReports();

}


/* =========================================================
   START APPLICATION
   ========================================================= */

refreshApp();


/* =========================================================
   BIZPILOT JS READY
   ========================================================= */

console.log(
    "BizPilot JavaScript loaded successfully."
);

console.log(
    "Customers:",
    appData.customers.length
);

console.log(
    "Sales:",
    appData.sales.length
);

console.log(
    "Expenses:",
    appData.expenses.length
);

console.log(
    "Inventory:",
    appData.inventory.length
);


/* =========================================================
   SUPABASE ACCOUNT + PRO MENU
   ========================================================= */


/* =========================================================
   UPDATE ACCOUNT DISPLAY
   ========================================================= */

function updateProfileUI() {

    const nameElement =
        document.querySelector(
            ".user-profile strong"
        );

    const planElement =
        document.querySelector(
            ".user-profile span"
        );

    const avatarElement =
        document.querySelector(
            ".user-profile .avatar"
        );


    if (!currentUser) {

        if (nameElement) {

            nameElement.textContent =
                "My Business";

        }

        if (planElement) {

            planElement.textContent =
                "Free Plan";

        }

        if (avatarElement) {

            avatarElement.textContent =
                "A";

        }

        return;

    }


    const metadata =
        currentUser.user_metadata || {};


    const displayName =
        metadata.name ||
        metadata.business_name ||
        appData.business.name ||
        currentUser.email ||
        "My Business";


    if (nameElement) {

        nameElement.textContent =
            displayName;

    }


    if (planElement) {

        planElement.textContent =
            "Free Plan";

    }


    if (avatarElement) {

        avatarElement.textContent =
            displayName
                .charAt(0)
                .toUpperCase();

    }

}


/* =========================================================
   ACCOUNT WINDOW
   ========================================================= */

function openAccountModal() {

    if (currentUser) {

        openLoggedInAccount();

        return;

    }


    openLoginForm();

}


/* =========================================================
   LOGIN FORM
   ========================================================= */

function openLoginForm() {

    openModal(`

        <div class="account-modal">

            <span class="small-label">
                BIZPILOT ACCOUNT
            </span>


            <h2>
                Welcome back
            </h2>


            <p class="modal-subtitle">

                Log in to your BizPilot account
                and continue managing your business.

            </p>


            <label for="loginEmail">
                Email address
            </label>


            <input
                id="loginEmail"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
            >


            <label for="loginPassword">
                Password
            </label>


            <input
                id="loginPassword"
                type="password"
                placeholder="Your password"
                autocomplete="current-password"
            >


            <button
                class="primary-btn account-submit"
                id="loginBtn"
            >

                Log In

            </button>


            <p
                style="
                    text-align:center;
                    margin:14px 0 0;
                    font-size:9px;
                    color:#888;
                "
            >

                Don't have an account?

                <button
                    type="button"
                    id="showSignupBtn"
                    style="
                        border:0;
                        background:none;
                        color:#0396FF;
                        font:inherit;
                        font-weight:700;
                        cursor:pointer;
                        padding:0;
                    "
                >
                    Create one
                </button>

            </p>

        </div>

    `);


    const loginBtn =
        document.getElementById(
            "loginBtn"
        );


    if (loginBtn) {

        loginBtn.addEventListener(
            "click",
            loginUser
        );

    }


    const showSignupBtn =
        document.getElementById(
            "showSignupBtn"
        );


    if (showSignupBtn) {

        showSignupBtn.addEventListener(
            "click",
            openSignupForm
        );

    }

}


/* =========================================================
   CREATE ACCOUNT FORM
   ========================================================= */

function openSignupForm() {

    openModal(`

        <div class="account-modal">

            <span class="small-label">
                BIZPILOT ACCOUNT
            </span>


            <h2>
                Create your account
            </h2>


            <p class="modal-subtitle">

                Create your free BizPilot account
                and start building your business workspace.

            </p>


            <label for="signupName">
                Your name
            </label>


            <input
                id="signupName"
                type="text"
                placeholder="Your name"
                autocomplete="name"
            >


            <label for="signupBusiness">
                Business name
            </label>


            <input
                id="signupBusiness"
                type="text"
                placeholder="Your business name"
                autocomplete="organization"
            >


            <label for="signupEmail">
                Email address
            </label>


            <input
                id="signupEmail"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
            >


            <label for="signupPassword">
                Password
            </label>


            <input
                id="signupPassword"
                type="password"
                placeholder="At least 6 characters"
                autocomplete="new-password"
            >


            <button
                class="primary-btn account-submit"
                id="createAccountBtn"
            >

                Create Account

            </button>


            <p
                style="
                    text-align:center;
                    margin:14px 0 0;
                    font-size:9px;
                    color:#888;
                "
            >

                Already have an account?

                <button
                    type="button"
                    id="showLoginBtn"
                    style="
                        border:0;
                        background:none;
                        color:#0396FF;
                        font:inherit;
                        font-weight:700;
                        cursor:pointer;
                        padding:0;
                    "
                >
                    Log in
                </button>

            </p>

        </div>

    `);


    const createAccountBtn =
        document.getElementById(
            "createAccountBtn"
        );


    if (createAccountBtn) {

        createAccountBtn.addEventListener(
            "click",
            createAccount
        );

    }


    const showLoginBtn =
        document.getElementById(
            "showLoginBtn"
        );


    if (showLoginBtn) {

        showLoginBtn.addEventListener(
            "click",
            openLoginForm
        );

    }

}


/* =========================================================
   CREATE ACCOUNT
   ========================================================= */

async function createAccount() {

    const nameInput =
        document.getElementById(
            "signupName"
        );

    const businessInput =
        document.getElementById(
            "signupBusiness"
        );

    const emailInput =
        document.getElementById(
            "signupEmail"
        );

    const passwordInput =
        document.getElementById(
            "signupPassword"
        );


    const name =
        nameInput
            ? nameInput.value.trim()
            : "";


    const businessName =
        businessInput
            ? businessInput.value.trim()
            : "";


    const email =
        emailInput
            ? emailInput.value.trim()
            : "";


    const password =
        passwordInput
            ? passwordInput.value
            : "";


    if (!name) {

        showToast(
            "Please enter your name."
        );

        return;

    }


    if (!businessName) {

        showToast(
            "Please enter your business name."
        );

        return;

    }


    if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            email
        )
    ) {

        showToast(
            "Please enter a valid email address."
        );

        return;

    }


    if (password.length < 6) {

        showToast(
            "Password must be at least 6 characters."
        );

        return;

    }


    const button =
        document.getElementById(
            "createAccountBtn"
        );


    if (button) {

        button.disabled = true;

        button.textContent =
            "Creating account...";

    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.signUp({

                email,

                password,

                options: {

                    data: {

                        name,

                        business_name:
                            businessName

                    }

                }

            });


        if (error) {

            console.error(
                "Supabase signup error:",
                error
            );

            showToast(
                error.message ||
                "Could not create your account."
            );

            return;

        }


        if (data.session) {

            currentUser =
                data.user;

            appData.business.name =
                businessName;

            saveData();

            updateProfileUI();

            closeModal();

            showToast(
                "Account created successfully."
            );


            await loadCloudData();

        }

        else {

            closeModal();

            showToast(
                "Account created successfully. Please log in."
            );

        }


    } catch (error) {

        console.error(
            "Account creation error:",
            error
        );

        showToast(
            "Something went wrong. Please try again."
        );


    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Create Account";

        }

    }

}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser() {

    const emailInput =
        document.getElementById(
            "loginEmail"
        );

    const passwordInput =
        document.getElementById(
            "loginPassword"
        );


    const email =
        emailInput
            ? emailInput.value.trim()
            : "";


    const password =
        passwordInput
            ? passwordInput.value
            : "";


    if (!email) {

        showToast(
            "Please enter your email address."
        );

        return;

    }


    if (!password) {

        showToast(
            "Please enter your password."
        );

        return;

    }


    const button =
        document.getElementById(
            "loginBtn"
        );


    if (button) {

        button.disabled = true;

        button.textContent =
            "Logging in...";

    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.signInWithPassword({

                email,

                password

            });


        if (error) {

            console.error(
                "Supabase login error:",
                error
            );

            showToast(
                error.message ||
                "Could not log in."
            );

            return;

        }


        currentUser =
            data.user;


        await loadCloudData();


        const metadata =
            currentUser.user_metadata ||
            {};


        if (
            metadata.business_name &&
            !cloudDataLoaded
        ) {

            appData.business.name =
                metadata.business_name;

            saveData();

        }


        updateProfileUI();

        closeModal();

        showToast(
            "Welcome back to BizPilot."
        );


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        showToast(
            "Something went wrong. Please try again."
        );


    } finally {

        if (button) {

            button.disabled = false;

            button.textContent =
                "Log In";

        }

    }

}


/* =========================================================
   LOGGED-IN ACCOUNT
   ========================================================= */

function openLoggedInAccount() {

    const metadata =
        currentUser?.user_metadata ||
        {};


    const name =
        metadata.name ||
        "BizPilot User";


    const businessName =
        metadata.business_name ||
        appData.business.name ||
        "My Business";


    const email =
        currentUser?.email ||
        "";


    openModal(`

        <div class="account-modal">

            <span class="small-label">
                YOUR ACCOUNT
            </span>


            <h2>
                ${escapeHTML(name)}
            </h2>


            <p class="modal-subtitle">

                Your BizPilot account is connected.

            </p>


            <div
                style="
                    background:#f7f9fb;
                    border-radius:12px;
                    padding:13px;
                    margin:14px 0;
                "
            >

                <div
                    style="
                        margin-bottom:10px;
                    "
                >

                    <small
                        style="
                            display:block;
                            color:#8b95a1;
                            font-size:8px;
                            margin-bottom:4px;
                        "
                    >
                        EMAIL
                    </small>

                    <strong
                        style="
                            font-size:10px;
                            color:#111;
                        "
                    >
                        ${escapeHTML(email)}
                    </strong>

                </div>


                <div>

                    <small
                        style="
                            display:block;
                            color:#8b95a1;
                            font-size:8px;
                            margin-bottom:4px;
                        "
                    >
                        BUSINESS
                    </small>

                    <strong
                        style="
                            font-size:10px;
                            color:#111;
                        "
                    >
                        ${escapeHTML(businessName)}
                    </strong>

                </div>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:10px;
                "
            >

                <button
                    class="primary-btn"
                    id="accountCloseBtn"
                >

                    Close

                </button>


                <button
                    class="primary-btn"
                    id="logoutBtn"
                    style="
                        background:#111;
                    "
                >

                    Log Out

                </button>

            </div>

        </div>

    `);


    const accountCloseBtn =
        document.getElementById(
            "accountCloseBtn"
        );


    if (accountCloseBtn) {

        accountCloseBtn.addEventListener(
            "click",
            closeModal
        );

    }


    const logoutBtn =
        document.getElementById(
            "logoutBtn"
        );


    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            logoutUser
        );

    }

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {

    const logoutButton =
        document.getElementById(
            "logoutBtn"
        );


    if (logoutButton) {

        logoutButton.disabled = true;

        logoutButton.textContent =
            "Logging out...";

    }


    try {

        const {
            error
        } =
            await supabaseClient.auth.signOut();


        if (error) {

            console.error(
                "Supabase logout error:",
                error
            );

            showToast(
                error.message ||
                "Could not log out."
            );

            return;

        }


        currentUser = null;

        cloudDataLoaded = false;

        /* IMPORTANT: never reuse the previous user's business. */

        currentBusinessId = null;

        resetAppDataForLogout();

        updateProfileUI();

        closeModal();

        showToast(
            "You have been logged out."
        );


    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        showToast(
            "Something went wrong while logging out."
        );

    }

}


/* =========================================================
   BIZPILOT PRO WINDOW
   ========================================================= */

function openProModal() {

    openModal(`

        <div class="account-modal">

            <span class="small-label">
                BIZPILOT PRO
            </span>


            <h2>
                Unlock BizPilot Pro
            </h2>


            <p class="modal-subtitle">

                Get smarter insights,
                advanced tools and business
                growth features.

            </p>


            <div class="insight-item">

                <span>
                    ✦
                </span>


                <div>

                    <strong>
                        Smarter insights
                    </strong>

                    <p>
                        Clear recommendations
                        based on your business
                        activity.
                    </p>

                </div>

            </div>


            <div class="insight-item">

                <span>
                    02
                </span>


                <div>

                    <strong>
                        Advanced tools
                    </strong>

                    <p>
                        More powerful tools
                        for inventory, customers
                        and reports.
                    </p>

                </div>

            </div>


            <div class="insight-item">

                <span>
                    03
                </span>


                <div>

                    <strong>
                        Growth features
                    </strong>

                    <p>
                        More tools will be added
                        as BizPilot moves toward
                        its full release.
                    </p>

                </div>

            </div>


            <button
                class="primary-btn account-submit"
                id="proCloseBtn"
            >

                Got it

            </button>

        </div>

    `);


    const proCloseBtn =
        document.getElementById(
            "proCloseBtn"
        );


    if (proCloseBtn) {

        proCloseBtn.addEventListener(
            "click",
            closeModal
        );

    }

}


/* =========================================================
   THREE DOTS + PRO BUTTON
   ========================================================= */

const profileMenu =
    document.querySelector(
        ".profile-menu"
    );


const upgradeBtn =
    document.querySelector(
        ".upgrade-btn"
    );


if (profileMenu) {

    profileMenu.addEventListener(
        "click",
        openAccountModal
    );

}


if (upgradeBtn) {

    upgradeBtn.addEventListener(
        "click",
        openProModal
    );

}


/* =========================================================
   LOAD SUPABASE SESSION
   ========================================================= */

async function loadAuthSession() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "Supabase session error:",
                error
            );

            updateProfileUI();

            return;

        }


        currentUser =
            data?.session?.user || null;


        if (currentUser) {

            const metadata =
                currentUser.user_metadata ||
                {};


            await loadCloudData();


            if (
                metadata.business_name &&
                !cloudDataLoaded
            ) {

                appData.business.name =
                    metadata.business_name;

                saveData();

            }

        }


        updateProfileUI();

        refreshApp();


    } catch (error) {

        console.error(
            "Could not load Supabase session:",
            error
        );

        updateProfileUI();

    }

}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        currentUser =
            session?.user || null;


        if (
            currentUser &&
            (
                event === "SIGNED_IN" ||
                event === "INITIAL_SESSION"
            )
        ) {

            await loadCloudData();

        }


        if (
            event === "SIGNED_OUT"
        ) {

            currentUser = null;

            cloudDataLoaded = false;

            /* IMPORTANT: clear the previous business ID. */

            currentBusinessId = null;

            resetAppDataForLogout();

        }


        updateProfileUI();


        console.log(
            "BizPilot auth event:",
            event
        );

    }
);


/* =========================================================
   LOAD ACCOUNT SESSION
   ========================================================= */

loadAuthSession();
/* =========================================================
   BIZPILOT BACKUP & RESTORE
   ========================================================= */

(function () {

    const exportButton = document.getElementById("exportBackup");
    const importButton = document.getElementById("importBackup");
    const importFile = document.getElementById("importBackupFile");


    /* =====================================================
       EXPORT BACKUP
       ===================================================== */

    if (exportButton) {

        exportButton.addEventListener("click", function () {

            try {

                const backupData = {
                    version: "BizPilot Backup 1.0",
                    createdAt: new Date().toISOString(),
                    data: appData
                };


                const json = JSON.stringify(
                    backupData,
                    null,
                    2
                );


                const blob = new Blob(
                    [json],
                    {
                        type: "application/json"
                    }
                );


                const url = URL.createObjectURL(blob);


                const link = document.createElement("a");

                link.href = url;

                link.download =
                    "bizpilot-backup-" +
                    new Date().toISOString().slice(0, 10) +
                    ".json";


                document.body.appendChild(link);

                link.click();

                document.body.removeChild(link);


                URL.revokeObjectURL(url);


                if (typeof showToast === "function") {

                    showToast(
                        "Backup exported successfully."
                    );

                }

            } catch (error) {

                console.error(
                    "Backup export failed:",
                    error
                );


                if (typeof showToast === "function") {

                    showToast(
                        "Could not export backup."
                    );

                }

            }

        });

    }


    /* =====================================================
       OPEN FILE SELECTOR
       ===================================================== */

    if (importButton && importFile) {

        importButton.addEventListener("click", function () {

            importFile.click();

        });

    }


    /* =====================================================
       IMPORT BACKUP
       ===================================================== */

    if (importFile) {

        importFile.addEventListener("change", async function (event) {

            const file =
                event.target.files &&
                event.target.files[0];


            if (!file) {
                return;
            }


            try {

                const text =
                    await file.text();


                const backup =
                    JSON.parse(text);


                if (
                    !backup ||
                    !backup.data ||
                    typeof backup.data !== "object"
                ) {

                    throw new Error(
                        "Invalid BizPilot backup file."
                    );

                }


                const confirmed =
                    confirm(
                        "Restore this BizPilot backup? Your current local data will be replaced."
                    );


                if (!confirmed) {

                    importFile.value = "";

                    return;

                }


                /* Replace local BizPilot data */

                appData =
                    backup.data;


                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(appData)
                );


                /* Refresh the application */

                if (typeof renderAll === "function") {

                    renderAll();

                }


                if (typeof updateDashboard === "function") {

                    updateDashboard();

                }


                if (typeof updateUI === "function") {

                    updateUI();

                }


                if (typeof showToast === "function") {

                    showToast(
                        "Backup restored successfully."
                    );

                } else {

                    alert(
                        "Backup restored successfully."
                    );

                }


                /* Save restored data to cloud */

                if (
                    typeof saveCloudData === "function" &&
                    currentUser
                ) {

                    try {

                        await saveCloudData();

                    } catch (cloudError) {

                        console.error(
                            "Cloud backup sync failed:",
                            cloudError
                        );

                    }

                }


            } catch (error) {

                console.error(
                    "Backup import failed:",
                    error
                );


                alert(
                    "This backup file is invalid or could not be restored."
                );

            }


            /* Allow the same file to be selected again */

            importFile.value = "";

        });

    }

})();
/* =========================================================
   BIZPILOT AI BUSINESS ADVISOR
   ========================================================= */

(function () {

    function updateAIBusinessAdvisor() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const expenses =
                Array.isArray(appData.expenses)
                    ? appData.expenses
                    : [];

            const inventory =
                Array.isArray(appData.inventory)
                    ? appData.inventory
                    : [];

            const customers =
                Array.isArray(appData.customers)
                    ? appData.customers
                    : [];


            /* =====================================================
               BASIC BUSINESS NUMBERS
               ===================================================== */

            const totalSales =
                sales.reduce(
                    (total, sale) =>
                        total + (Number(sale.amount) || 0),
                    0
                );

            const totalExpenses =
                expenses.reduce(
                    (total, expense) =>
                        total + (Number(expense.amount) || 0),
                    0
                );

            const profit =
                totalSales - totalExpenses;


            /* =====================================================
               LOW STOCK
               ===================================================== */

            const lowStockProducts =
                inventory.filter(function (product) {

                    const stock =
                        Number(product.stock) || 0;

                    const minimum =
                        Number(
                            product.minimum ??
                            product.lowStockLevel ??
                            product.low_stock_level ??
                            5
                        );

                    return stock <= minimum;

                });


            /* =====================================================
               BUSINESS HEALTH
               ===================================================== */

            let healthTitle =
                "Getting started";

            let healthText =
                "Add more business activity and BizPilot will generate personalized insights.";


            if (
                sales.length === 0 &&
                expenses.length === 0
            ) {

                healthTitle =
                    "Ready to learn your business";

                healthText =
                    "Start recording sales and expenses. BizPilot will use your activity to understand how your business is performing.";

            } else if (
                totalSales > 0 &&
                profit > 0
            ) {

                healthTitle =
                    "Your business is profitable";

                healthText =
                    "Your recorded sales are currently higher than your recorded expenses.";

            } else if (
                totalSales > 0 &&
                profit === 0
            ) {

                healthTitle =
                    "Watch your margins";

                healthText =
                    "Your recorded sales and expenses are currently equal. Keep an eye on spending.";

            } else if (
                totalExpenses > totalSales
            ) {

                healthTitle =
                    "Expenses need attention";

                healthText =
                    "Your recorded expenses are currently higher than your recorded sales.";

            }


            const healthElement =
                document.getElementById("businessHealth");

            const healthTextElement =
                document.getElementById("businessHealthText");


            if (healthElement) {
                healthElement.textContent =
                    healthTitle;
            }

            if (healthTextElement) {
                healthTextElement.textContent =
                    healthText;
            }


            /* =====================================================
               SALES INSIGHT
               ===================================================== */

            const salesTitle =
                document.getElementById(
                    "salesInsightTitle"
                );

            const salesText =
                document.getElementById(
                    "salesInsightText"
                );


            if (sales.length === 0) {

                if (salesTitle) {
                    salesTitle.textContent =
                        "Start tracking sales";
                }

                if (salesText) {
                    salesText.textContent =
                        "Record your sales so BizPilot can identify revenue patterns and opportunities.";
                }

            } else {

                if (salesTitle) {
                    salesTitle.textContent =
                        "Revenue activity detected";
                }

                if (salesText) {

                    salesText.textContent =
                        "You have recorded " +
                        sales.length +
                        " sale" +
                        (sales.length === 1 ? "" : "s") +
                        " worth Ksh " +
                        totalSales.toLocaleString() +
                        ".";
                }

            }


            /* =====================================================
               INVENTORY INSIGHT
               ===================================================== */

            const inventoryTitle =
                document.getElementById(
                    "inventoryInsightTitle"
                );

            const inventoryText =
                document.getElementById(
                    "inventoryInsightText"
                );


            if (inventory.length === 0) {

                if (inventoryTitle) {
                    inventoryTitle.textContent =
                        "Add your inventory";
                }

                if (inventoryText) {
                    inventoryText.textContent =
                        "Add your products so BizPilot can monitor stock and identify products that need attention.";
                }

            } else if (
                lowStockProducts.length > 0
            ) {

                if (inventoryTitle) {
                    inventoryTitle.textContent =
                        "Low stock warning";
                }

                if (inventoryText) {

                    inventoryText.textContent =
                        lowStockProducts.length +
                        " product" +
                        (lowStockProducts.length === 1 ? "" : "s") +
                        " may need restocking.";
                }

            } else {

                if (inventoryTitle) {
                    inventoryTitle.textContent =
                        "Inventory looks healthy";
                }

                if (inventoryText) {

                    inventoryText.textContent =
                        "Your current recorded stock is above the low-stock levels.";
                }

            }


            /* =====================================================
               CUSTOMER INSIGHT
               ===================================================== */

            const customerTitle =
                document.getElementById(
                    "customerInsightTitle"
                );

            const customerText =
                document.getElementById(
                    "customerInsightText"
                );


            if (customers.length === 0) {

                if (customerTitle) {
                    customerTitle.textContent =
                        "Build your customer list";
                }

                if (customerText) {
                    customerText.textContent =
                        "Add customers so BizPilot can help you understand and grow your customer relationships.";
                }

            } else {

                if (customerTitle) {
                    customerTitle.textContent =
                        "Customer base growing";
                }

                if (customerText) {

                    customerText.textContent =
                        "You currently have " +
                        customers.length +
                        " customer" +
                        (customers.length === 1 ? "" : "s") +
                        " recorded.";
                }

            }


            /* =====================================================
               NEXT ACTION
               ===================================================== */

            const nextAction =
                document.getElementById(
                    "aiNextAction"
                );

            const nextActionText =
                document.getElementById(
                    "aiNextActionText"
                );


            let actionTitle =
                "Keep recording your business activity.";

            let actionText =
                "The more useful business data you record, the better BizPilot can identify what deserves your attention.";


            if (
                sales.length === 0
            ) {

                actionTitle =
                    "Record your first sale.";

                actionText =
                    "Start with your latest sale so BizPilot can begin understanding your revenue.";

            } else if (
                totalExpenses > totalSales
            ) {

                actionTitle =
                    "Review your expenses.";

                actionText =
                    "Your recorded expenses are currently higher than your sales. Check where your spending can be reduced.";

            } else if (
                lowStockProducts.length > 0
            ) {

                actionTitle =
                    "Check your low-stock products.";

                actionText =
                    "Some products are below their recorded stock levels. Review inventory before you run out.";

            } else if (
                customers.length === 0
            ) {

                actionTitle =
                    "Start building your customer list.";

                actionText =
                    "Add your customers so BizPilot can eventually help you identify repeat-business opportunities.";

            } else if (
                profit > 0
            ) {

                actionTitle =
                    "Protect your current profit.";

                actionText =
                    "Your recorded sales are currently above expenses. Keep monitoring spending while looking for ways to increase revenue.";

            }


            if (nextAction) {
                nextAction.textContent =
                    actionTitle;
            }

            if (nextActionText) {
                nextActionText.textContent =
                    actionText;
            }


            /* =====================================================
               REVENUE SIGNAL
               ===================================================== */

            const revenueSignal =
                document.getElementById(
                    "aiRevenueSignal"
                );

            const revenueSignalText =
                document.getElementById(
                    "aiRevenueSignalText"
                );


            if (revenueSignal) {

                revenueSignal.textContent =
                    sales.length > 0
                        ? "Ksh " +
                          totalSales.toLocaleString() +
                          " recorded"
                        : "Waiting for data";

            }

            if (revenueSignalText) {

                revenueSignalText.textContent =
                    sales.length > 0
                        ? "Based on the sales currently recorded in BizPilot."
                        : "Record sales to understand your revenue activity.";

            }


            /* =====================================================
               PROFIT SIGNAL
               ===================================================== */

            const profitSignal =
                document.getElementById(
                    "aiProfitSignal"
                );

            const profitSignalText =
                document.getElementById(
                    "aiProfitSignalText"
                );


            if (profitSignal) {

                profitSignal.textContent =
                    sales.length > 0 ||
                    expenses.length > 0
                        ? "Ksh " +
                          profit.toLocaleString() +
                          " estimated"
                        : "Waiting for data";

            }

            if (profitSignalText) {

                if (
                    sales.length === 0 &&
                    expenses.length === 0
                ) {

                    profitSignalText.textContent =
                        "Record sales and expenses to understand your profit position.";

                } else if (
                    profit > 0
                ) {

                    profitSignalText.textContent =
                        "Recorded sales are currently above recorded expenses.";

                } else {

                    profitSignalText.textContent =
                        "Review your sales and expenses to improve your current position.";

                }

            }

        } catch (error) {

            console.error(
                "BizPilot AI Advisor error:",
                error
            );

        }

    }


    /* =========================================================
       RUN WHEN APP LOADS
       ========================================================= */

    updateAIBusinessAdvisor();


    /* =========================================================
       MAKE FUNCTION AVAILABLE TO BIZPILOT
       ========================================================= */

    window.updateAIBusinessAdvisor =
        updateAIBusinessAdvisor;

})();
/* =========================================================
   BIZPILOT AI — LIVE REFRESH
   ========================================================= */

(function () {

    function refreshBizPilotAI() {

        if (
            typeof window.updateAIBusinessAdvisor === "function"
        ) {
            window.updateAIBusinessAdvisor();
        }

    }


    /* Refresh when app data changes */

    window.refreshBizPilotAI =
        refreshBizPilotAI;


    /* Small delay ensures the main app finishes updating first */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                refreshBizPilotAI,
                100
            );

        }
    );

})();
/* =========================================================
   BIZPILOT AI — SALES TREND INTELLIGENCE
   ========================================================= */

(function () {

    function updateSalesTrendInsight() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const insightTitle =
                document.getElementById("salesInsightTitle");

            const insightText =
                document.getElementById("salesInsightText");

            if (!insightTitle || !insightText) {
                return;
            }


            /* No sales yet */

            if (sales.length === 0) {

                insightTitle.textContent =
                    "Start tracking sales";

                insightText.textContent =
                    "Record your sales so BizPilot can begin detecting revenue patterns.";

                return;
            }


            /* =================================================
               GROUP SALES BY DATE
               ================================================= */

            const salesByDate = {};

            sales.forEach(function (sale) {

                const date =
                    sale.date ||
                    sale.saleDate ||
                    sale.created_at;

                if (!date) {
                    return;
                }

                const amount =
                    Number(sale.amount) || 0;

                if (!salesByDate[date]) {
                    salesByDate[date] = 0;
                }

                salesByDate[date] += amount;

            });


            const dates =
                Object.keys(salesByDate)
                    .sort();


            /* Not enough dated sales */

            if (dates.length < 2) {

                insightTitle.textContent =
                    "Sales activity detected";

                insightText.textContent =
                    "Keep recording sales. BizPilot needs more activity to identify a reliable sales trend.";

                return;
            }


            /* =================================================
               COMPARE RECENT SALES DAYS
               ================================================= */

            const recentDates =
                dates.slice(-7);

            const previousDates =
                dates.slice(
                    Math.max(0, dates.length - 14),
                    Math.max(0, dates.length - 7)
                );


            let recentTotal = 0;
            let previousTotal = 0;


            recentDates.forEach(function (date) {

                recentTotal +=
                    salesByDate[date] || 0;

            });


            previousDates.forEach(function (date) {

                previousTotal +=
                    salesByDate[date] || 0;

            });


            /* =================================================
               DETECT TREND
               ================================================= */

            if (
                previousTotal > 0 &&
                recentTotal > previousTotal
            ) {

                const increase =
                    (
                        (
                            recentTotal -
                            previousTotal
                        ) /
                        previousTotal
                    ) * 100;

                insightTitle.textContent =
                    "Sales are moving up";

                insightText.textContent =
                    "Your recent recorded sales are about " +
                    Math.round(increase) +
                    "% higher than the previous period. Keep identifying what is driving the increase.";

                return;
            }


            if (
                previousTotal > 0 &&
                recentTotal < previousTotal
            ) {

                const decrease =
                    (
                        (
                            previousTotal -
                            recentTotal
                        ) /
                        previousTotal
                    ) * 100;

                insightTitle.textContent =
                    "Sales need attention";

                insightText.textContent =
                    "Your recent recorded sales are about " +
                    Math.round(decrease) +
                    "% lower than the previous period. Review which products or customers may be affecting revenue.";

                return;
            }


            /* =================================================
               STABLE SALES
               ================================================= */

            insightTitle.textContent =
                "Sales are relatively stable";

            insightText.textContent =
                "Your recent recorded sales are not showing a major change yet. Keep tracking activity so BizPilot can identify stronger patterns.";

        } catch (error) {

            console.error(
                "Sales trend AI error:",
                error
            );

        }

    }


    /* Run immediately */

    updateSalesTrendInsight();


    /* Make available globally */

    window.updateSalesTrendInsight =
        updateSalesTrendInsight;


    /* Update whenever BizPilot data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateSalesTrendInsight,
                150
            );

        }
    );

})();
/* =========================================================
   BIZPILOT AI — PRODUCT INTELLIGENCE
   ========================================================= */

(function () {

    function updateProductIntelligence() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const inventory =
                Array.isArray(appData.inventory)
                    ? appData.inventory
                    : [];

            const insightTitle =
                document.getElementById(
                    "inventoryInsightTitle"
                );

            const insightText =
                document.getElementById(
                    "inventoryInsightText"
                );

            if (!insightTitle || !insightText) {
                return;
            }


            /* =================================================
               NO INVENTORY
               ================================================= */

            if (inventory.length === 0) {

                insightTitle.textContent =
                    "Add your products";

                insightText.textContent =
                    "Add your inventory so BizPilot can connect your products with sales activity.";

                return;
            }


            /* =================================================
               NO SALES
               ================================================= */

            if (sales.length === 0) {

                insightTitle.textContent =
                    "Waiting for product activity";

                insightText.textContent =
                    "Record sales so BizPilot can identify which products are getting the most attention.";

                return;
            }


            /* =================================================
               COUNT SALES BY PRODUCT
               ================================================= */

            const productSales = {};

            sales.forEach(function (sale) {

                const productName =
                    (
                        sale.description ||
                        sale.product ||
                        sale.productName ||
                        ""
                    )
                    .toString()
                    .trim()
                    .toLowerCase();

                if (!productName) {
                    return;
                }

                const amount =
                    Number(sale.amount) || 0;

                if (!productSales[productName]) {

                    productSales[productName] = {
                        name: productName,
                        sales: 0,
                        revenue: 0
                    };

                }

                productSales[productName].sales += 1;

                productSales[productName].revenue +=
                    amount;

            });


            /* =================================================
               FIND TOP PRODUCT
               ================================================= */

            const products =
                Object.values(productSales);


            if (products.length === 0) {

                insightTitle.textContent =
                    "Product names needed";

                insightText.textContent =
                    "Add product names to your sales records so BizPilot can compare product performance.";

                return;
            }


            products.sort(function (a, b) {

                return b.revenue - a.revenue;

            });


            const topProduct =
                products[0];


            /* =================================================
               FIND LOW-STOCK PRODUCTS
               ================================================= */

            const lowStockProducts =
                inventory.filter(function (product) {

                    const stock =
                        Number(product.stock) || 0;

                    const minimum =
                        Number(
                            product.minimum ??
                            product.lowStockLevel ??
                            product.low_stock_level ??
                            5
                        );

                    return stock <= minimum;

                });


            /* =================================================
               PRODUCT + STOCK WARNING
               ================================================= */

            const matchingLowStock =
                lowStockProducts.find(function (product) {

                    const inventoryName =
                        (
                            product.name ||
                            product.productName ||
                            ""
                        )
                        .toString()
                        .trim()
                        .toLowerCase();

                    return (
                        inventoryName ===
                        topProduct.name
                    );

                });


            if (matchingLowStock) {

                insightTitle.textContent =
                    "Top product needs attention";

                insightText.textContent =
                    topProduct.name
                        .replace(/\b\w/g, function (letter) {
                            return letter.toUpperCase();
                        }) +
                    " has the highest recorded sales activity, but its stock is currently low. Consider restocking it.";

                return;
            }


            /* =================================================
               TOP PRODUCT
               ================================================= */

            insightTitle.textContent =
                "Top product detected";

            insightText.textContent =
                topProduct.name
                    .replace(/\b\w/g, function (letter) {
                        return letter.toUpperCase();
                    }) +
                " currently has the highest recorded sales revenue at Ksh " +
                topProduct.revenue.toLocaleString() +
                ". Watch its stock and continue monitoring demand.";


        } catch (error) {

            console.error(
                "Product intelligence AI error:",
                error
            );

        }

    }


    /* Run when app loads */

    updateProductIntelligence();


    /* Make available globally */

    window.updateProductIntelligence =
        updateProductIntelligence;


    /* Refresh when BizPilot data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateProductIntelligence,
                200
            );

        }
    );

})();
/* =========================================================
   BIZPILOT AI — CUSTOMER INTELLIGENCE
   ========================================================= */

(function () {

    function updateCustomerIntelligence() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const customers =
                Array.isArray(appData.customers)
                    ? appData.customers
                    : [];

            const insightTitle =
                document.getElementById(
                    "customerInsightTitle"
                );

            const insightText =
                document.getElementById(
                    "customerInsightText"
                );

            if (!insightTitle || !insightText) {
                return;
            }


            /* =================================================
               NO CUSTOMERS
               ================================================= */

            if (customers.length === 0) {

                insightTitle.textContent =
                    "Build your customer base";

                insightText.textContent =
                    "Add your customers so BizPilot can identify customer activity and growth opportunities.";

                return;
            }


            /* =================================================
               NO SALES
               ================================================= */

            if (sales.length === 0) {

                insightTitle.textContent =
                    "Customer activity is waiting";

                insightText.textContent =
                    "You have customers recorded, but no sales have been linked to them yet.";

                return;
            }


            /* =================================================
               COUNT SALES LINKED TO CUSTOMERS
               ================================================= */

            let linkedSales = 0;
            let linkedRevenue = 0;

            const customerActivity = {};


            sales.forEach(function (sale) {

                const saleCustomer =
                    (
                        sale.customer ||
                        sale.customerName ||
                        sale.customer_name ||
                        ""
                    )
                    .toString()
                    .trim()
                    .toLowerCase();

                if (!saleCustomer) {
                    return;
                }


                const amount =
                    Number(sale.amount) || 0;


                linkedSales += 1;

                linkedRevenue += amount;


                if (!customerActivity[saleCustomer]) {

                    customerActivity[saleCustomer] = {
                        sales: 0,
                        revenue: 0
                    };

                }


                customerActivity[saleCustomer].sales += 1;

                customerActivity[saleCustomer].revenue +=
                    amount;

            });


            /* =================================================
               NO CUSTOMER-LINKED SALES
               ================================================= */

            if (linkedSales === 0) {

                insightTitle.textContent =
                    "Connect sales to customers";

                insightText.textContent =
                    "You have " +
                    customers.length +
                    " customer" +
                    (customers.length === 1 ? "" : "s") +
                    " recorded, but your sales do not have customer names attached. Linking sales to customers will make your insights more useful.";

                return;
            }


            /* =================================================
               FIND MOST ACTIVE CUSTOMER
               ================================================= */

            const activeCustomers =
                Object.entries(customerActivity);


            activeCustomers.sort(function (a, b) {

                return (
                    b[1].revenue -
                    a[1].revenue
                );

            });


            const topCustomer =
                activeCustomers[0];


            const topCustomerName =
                topCustomer[0]
                    .replace(/\b\w/g, function (letter) {
                        return letter.toUpperCase();
                    });


            const topCustomerRevenue =
                topCustomer[1].revenue;


            /* =================================================
               CUSTOMER ACTIVITY INSIGHT
               ================================================= */

            insightTitle.textContent =
                "Customer activity detected";

            insightText.textContent =
                topCustomerName +
                " currently has the highest recorded customer-linked revenue at Ksh " +
                topCustomerRevenue.toLocaleString() +
                ". Consider keeping strong relationships with your most active customers.";


        } catch (error) {

            console.error(
                "Customer intelligence AI error:",
                error
            );

        }

    }


    /* Run when app loads */

    updateCustomerIntelligence();


    /* Make available globally */

    window.updateCustomerIntelligence =
        updateCustomerIntelligence;


    /* Refresh when BizPilot data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateCustomerIntelligence,
                250
            );

        }
    );

})();
/* =========================================================
   BIZPILOT AI — UNIFIED BUSINESS HEALTH SCORE
   ========================================================= */

(function () {

    function updateBusinessHealthScore() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const expenses =
                Array.isArray(appData.expenses)
                    ? appData.expenses
                    : [];

            const inventory =
                Array.isArray(appData.inventory)
                    ? appData.inventory
                    : [];

            const customers =
                Array.isArray(appData.customers)
                    ? appData.customers
                    : [];


            /* =================================================
               BUSINESS NUMBERS
               ================================================= */

            const totalSales =
                sales.reduce(function (total, sale) {

                    return total +
                        (Number(sale.amount) || 0);

                }, 0);


            const totalExpenses =
                expenses.reduce(function (total, expense) {

                    return total +
                        (Number(expense.amount) || 0);

                }, 0);


            const profit =
                totalSales - totalExpenses;


            /* =================================================
               SCORE COMPONENTS
               ================================================= */

            let salesScore = 0;
            let profitScore = 0;
            let inventoryScore = 0;
            let customerScore = 0;


            /* SALES */

            if (sales.length >= 10) {

                salesScore = 25;

            } else if (sales.length >= 5) {

                salesScore = 20;

            } else if (sales.length >= 2) {

                salesScore = 15;

            } else if (sales.length === 1) {

                salesScore = 8;

            }


            /* PROFIT */

            if (totalSales > 0) {

                if (profit > 0) {

                    const margin =
                        (profit / totalSales) * 100;

                    if (margin >= 30) {

                        profitScore = 25;

                    } else if (margin >= 15) {

                        profitScore = 20;

                    } else {

                        profitScore = 15;

                    }

                } else if (profit === 0) {

                    profitScore = 8;

                }

            }


            /* INVENTORY */

            if (inventory.length > 0) {

                const lowStockCount =
                    inventory.filter(function (product) {

                        const stock =
                            Number(product.stock) || 0;

                        const minimum =
                            Number(
                                product.minimum ??
                                product.lowStockLevel ??
                                product.low_stock_level ??
                                5
                            );

                        return stock <= minimum;

                    }).length;


                if (lowStockCount === 0) {

                    inventoryScore = 25;

                } else {

                    const healthyPercentage =
                        (
                            (
                                inventory.length -
                                lowStockCount
                            ) /
                            inventory.length
                        ) * 25;

                    inventoryScore =
                        Math.max(
                            0,
                            Math.round(healthyPercentage)
                        );

                }

            }


            /* CUSTOMERS */

            if (customers.length >= 20) {

                customerScore = 25;

            } else if (customers.length >= 10) {

                customerScore = 20;

            } else if (customers.length >= 5) {

                customerScore = 15;

            } else if (customers.length > 0) {

                customerScore = 8;

            }


            /* =================================================
               FINAL SCORE
               ================================================= */

            const score =
                Math.min(
                    100,
                    salesScore +
                    profitScore +
                    inventoryScore +
                    customerScore
                );


            /* =================================================
               DETERMINE STRONGEST AREA
               ================================================= */

            const areas = [

                {
                    name: "Sales",
                    score: salesScore
                },

                {
                    name: "Profit",
                    score: profitScore
                },

                {
                    name: "Inventory",
                    score: inventoryScore
                },

                {
                    name: "Customers",
                    score: customerScore
                }

            ];


            areas.sort(function (a, b) {

                return b.score - a.score;

            });


            const strongestArea =
                areas[0].name;


            /* =================================================
               DETERMINE AREA NEEDING ATTENTION
               ================================================= */

            areas.sort(function (a, b) {

                return a.score - b.score;

            });


            const weakestArea =
                areas[0].name;


            /* =================================================
               BUSINESS HEALTH TEXT
               ================================================= */

            let healthTitle =
                "Business health: " +
                score +
                "/100";

            let healthText =
                "Keep recording your business activity so BizPilot can build a clearer picture of your performance.";


            if (score >= 80) {

                healthText =
                    "Your business is showing strong recorded activity. Protect what is working while improving your weakest area.";

            } else if (score >= 60) {

                healthText =
                    "Your business has a solid foundation, but there are still areas that need attention.";

            } else if (score >= 40) {

                healthText =
                    "Your business is developing. Focus on consistent sales, healthy margins and accurate records.";

            } else {

                healthText =
                    "BizPilot needs more business activity to accurately understand your performance. Keep recording sales, expenses, inventory and customers.";

            }


            /* =================================================
               UPDATE EXISTING BUSINESS HEALTH CARD
               ================================================= */

            const healthElement =
                document.getElementById(
                    "businessHealth"
                );

            const healthTextElement =
                document.getElementById(
                    "businessHealthText"
                );


            if (healthElement) {

                healthElement.textContent =
                    healthTitle;

            }


            if (healthTextElement) {

                healthTextElement.textContent =
                    healthText;

            }


            /* =================================================
               NEXT ACTION
               ================================================= */

            const nextAction =
                document.getElementById(
                    "aiNextAction"
                );

            const nextActionText =
                document.getElementById(
                    "aiNextActionText"
                );


            let actionTitle =
                "Strengthen your " +
                weakestArea.toLowerCase() +
                " activity.";

            let actionText =
                "Your current score shows that " +
                weakestArea.toLowerCase() +
                " is the area that needs the most attention.";


            if (weakestArea === "Sales") {

                actionTitle =
                    "Focus on increasing sales.";

                actionText =
                    "Record more sales and identify which products and customers are generating the most revenue.";

            } else if (weakestArea === "Profit") {

                actionTitle =
                    "Protect your profit.";

                actionText =
                    "Review expenses and look for ways to improve the amount you keep from each sale.";

            } else if (weakestArea === "Inventory") {

                actionTitle =
                    "Review your inventory.";

                actionText =
                    "Check low-stock products and make sure your most important products remain available.";

            } else if (weakestArea === "Customers") {

                actionTitle =
                    "Build stronger customer relationships.";

                actionText =
                    "Record customers and connect sales to them so BizPilot can identify repeat-business opportunities.";

            }


            if (nextAction) {

                nextAction.textContent =
                    actionTitle;

            }


            if (nextActionText) {

                nextActionText.textContent =
                    actionText;

            }


            /* =================================================
               STORE SCORE FOR FUTURE FEATURES
               ================================================= */

            window.bizPilotHealthScore =
                score;

            window.bizPilotStrongestArea =
                strongestArea;

            window.bizPilotWeakestArea =
                weakestArea;


        } catch (error) {

            console.error(
                "Business health score error:",
                error
            );

        }

    }


    /* Run when app loads */

    updateBusinessHealthScore();


    /* Make available globally */

    window.updateBusinessHealthScore =
        updateBusinessHealthScore;


    /* Refresh after business data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateBusinessHealthScore,
                300
            );

        }
    );

})();
/* =========================================================
   BIZPILOT CUSTOMERS — PREMIUM SUMMARY FIX
   Applies directly to the dynamically generated
   customer summary cards.
   ========================================================= */

(function () {

    function styleCustomerSummary() {

        const customerGrid =
            document.getElementById("customerGrid");

        if (!customerGrid) {
            return;
        }


        /* The first child is the summary container */

        const summary =
            customerGrid.firstElementChild;

        if (!summary) {
            return;
        }


        /* Make sure this is the 4-card summary */

        const cards =
            summary.children;

        if (!cards || cards.length !== 4) {
            return;
        }


        /* =====================================================
           SUMMARY CONTAINER
           ===================================================== */

        summary.style.display = "grid";

        summary.style.gridTemplateColumns =
            "repeat(4, minmax(0, 1fr))";

        summary.style.gap = "12px";

        summary.style.width = "100%";

        summary.style.marginBottom = "14px";

        summary.style.boxSizing = "border-box";


        /* =====================================================
           EACH SUMMARY CARD
           ===================================================== */

        Array.from(cards).forEach(function (card, index) {

            card.style.boxSizing = "border-box";

            card.style.width = "100%";

            card.style.minWidth = "0";

            card.style.height = "96px";

            card.style.minHeight = "96px";

            card.style.padding = "16px 18px";

            card.style.background = "#ffffff";

            card.style.border =
                "1px solid #e7ebf0";

            card.style.borderRadius = "15px";

            card.style.display = "flex";

            card.style.flexDirection = "column";

            card.style.justifyContent = "center";

            card.style.overflow = "hidden";

            card.style.boxShadow =
                "0 5px 18px rgba(17,17,17,0.045)";

            card.style.transition =
                "transform 0.2s ease, box-shadow 0.2s ease";


            /* =================================================
               LABEL
               ================================================= */

            const label =
                card.querySelector("small");

            if (label) {

                label.style.display = "block";

                label.style.margin = "0 0 7px 0";

                label.style.padding = "0";

                label.style.color = "#7b8490";

                label.style.fontSize = "9px";

                label.style.fontWeight = "800";

                label.style.lineHeight = "1.2";

                label.style.letterSpacing = "1px";

                label.style.textTransform = "uppercase";

                label.style.whiteSpace = "normal";

            }


            /* =================================================
               VALUE
               ================================================= */

            const value =
                card.querySelector("strong");

            if (value) {

                value.style.display = "block";

                value.style.margin = "0";

                value.style.padding = "0";

                value.style.fontSize = "24px";

                value.style.fontWeight = "800";

                value.style.lineHeight = "1.1";

                value.style.letterSpacing = "-0.6px";

                value.style.whiteSpace = "nowrap";


                /* Customer count */

                if (index === 0) {

                    value.style.color =
                        "#111111";

                }


                /* Customer revenue */

                if (index === 1) {

                    value.style.color =
                        "#0396FF";

                }


                /* Average customer value */

                if (index === 2) {

                    value.style.color =
                        "#111111";

                }


                /* Follow-ups */

                if (index === 3) {

                    value.style.fontSize =
                        "24px";

                }

            }

        });


        /* =====================================================
           RESPONSIVE — TABLET
           ===================================================== */

        if (window.innerWidth <= 850) {

            summary.style.gridTemplateColumns =
                "repeat(2, minmax(0, 1fr))";

            summary.style.gap = "10px";


            Array.from(cards).forEach(function (card) {

                card.style.height = "88px";

                card.style.minHeight = "88px";

                card.style.padding =
                    "14px 15px";

            });

        }


        /* =====================================================
           RESPONSIVE — PHONE
           ===================================================== */

        if (window.innerWidth <= 520) {

            summary.style.gridTemplateColumns =
                "repeat(2, minmax(0, 1fr))";

            summary.style.gap = "8px";


            Array.from(cards).forEach(function (card) {

                card.style.height = "82px";

                card.style.minHeight = "82px";

                card.style.padding =
                    "12px 13px";


                const label =
                    card.querySelector("small");

                if (label) {

                    label.style.fontSize = "8px";

                    label.style.letterSpacing =
                        "0.7px";

                    label.style.marginBottom =
                        "5px";

                }


                const value =
                    card.querySelector("strong");

                if (value) {

                    value.style.fontSize =
                        "19px";

                }

            });

        }

    }


    /* =========================================================
       RUN AFTER CUSTOMER SECTION RENDERS
       ========================================================= */

    function runCustomerPremiumStyle() {

        setTimeout(
            styleCustomerSummary,
            50
        );

    }


    /* Initial run */

    runCustomerPremiumStyle();


    /* =========================================================
       WATCH CUSTOMER GRID
       ========================================================= */

    const observer =
        new MutationObserver(function () {

            runCustomerPremiumStyle();

        });


    function startCustomerObserver() {

        const customerGrid =
            document.getElementById(
                "customerGrid"
            );

        if (!customerGrid) {
            return;
        }


        observer.observe(
            customerGrid,
            {
                childList: true,
                subtree: true
            }
        );


        styleCustomerSummary();

    }


    setTimeout(
        startCustomerObserver,
        300
    );


    /* =========================================================
       HANDLE WINDOW RESIZE
       ========================================================= */

    window.addEventListener(
        "resize",
        function () {

            styleCustomerSummary();

        }
    );


    /* Make function available */

    window.styleCustomerSummary =
        styleCustomerSummary;

})();
/* =========================================================
   BIZPILOT — VISIBLE BUSINESS HEALTH SCORE
   ========================================================= */

(function () {

    function showHealthScoreCard() {

        const healthElement =
            document.getElementById("businessHealth");

        const nextAction =
            document.getElementById("aiNextAction");

        if (!healthElement || !nextAction) {
            return;
        }

        /* Prevent duplicate cards */

        let scoreCard =
            document.getElementById("bizpilotHealthScoreCard");

        if (!scoreCard) {

            scoreCard =
                document.createElement("div");

            scoreCard.id =
                "bizpilotHealthScoreCard";

            scoreCard.style.marginTop =
                "18px";

            scoreCard.style.padding =
                "22px";

            scoreCard.style.background =
                "#ffffff";

            scoreCard.style.border =
                "1px solid #e8edf3";

            scoreCard.style.borderRadius =
                "16px";

            scoreCard.style.boxShadow =
                "0 6px 20px rgba(17,17,17,0.05)";

            scoreCard.innerHTML = `

                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:20px;
                    flex-wrap:wrap;
                ">

                    <div>

                        <div style="
                            font-size:10px;
                            font-weight:800;
                            letter-spacing:1.4px;
                            text-transform:uppercase;
                            color:#7b8490;
                            margin-bottom:7px;
                        ">
                            BUSINESS HEALTH SCORE
                        </div>

                        <div style="
                            font-size:14px;
                            color:#666;
                            line-height:1.5;
                        ">
                            A combined view of your sales,
                            profit, inventory and customers.
                        </div>

                    </div>

                    <div style="
                        text-align:right;
                        min-width:110px;
                    ">

                        <div
                            id="bizpilotHealthScoreNumber"
                            style="
                                font-size:34px;
                                font-weight:850;
                                line-height:1;
                                color:#0396FF;
                                letter-spacing:-1px;
                            "
                        >
                            0/100
                        </div>

                        <div
                            id="bizpilotHealthScoreLabel"
                            style="
                                margin-top:6px;
                                font-size:10px;
                                font-weight:700;
                                color:#7b8490;
                                text-transform:uppercase;
                                letter-spacing:.8px;
                            "
                        >
                            Building data
                        </div>

                    </div>

                </div>

            `;

            /*
             * Put the score directly before
             * the "Your Next Move" section.
             */

            nextAction.parentNode.insertBefore(
                scoreCard,
                nextAction
            );

        }


        /* =====================================================
           UPDATE SCORE
           ===================================================== */

        const score =
            Number(
                window.bizPilotHealthScore
            ) || 0;

        const number =
            document.getElementById(
                "bizpilotHealthScoreNumber"
            );

        const label =
            document.getElementById(
                "bizpilotHealthScoreLabel"
            );


        if (number) {

            number.textContent =
                score + "/100";

        }


        if (label) {

            if (score >= 80) {

                label.textContent =
                    "Strong";

            } else if (score >= 60) {

                label.textContent =
                    "Healthy";

            } else if (score >= 40) {

                label.textContent =
                    "Needs attention";

            } else {

                label.textContent =
                    "Building data";

            }

        }

    }


    /* Initial display */

    setTimeout(
        showHealthScoreCard,
        500
    );


    /* Refresh whenever business data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                showHealthScoreCard,
                500
            );

        }
    );


    window.showHealthScoreCard =
        showHealthScoreCard;

})();
/* =========================================================
   BIZPILOT AI — HEALTH SCORE EXPLANATION
   ========================================================= */

(function () {

    function updateHealthScoreExplanation() {

        try {

            const score =
                Number(window.bizPilotHealthScore) || 0;

            const strongest =
                window.bizPilotStrongestArea ||
                "Business activity";

            const weakest =
                window.bizPilotWeakestArea ||
                "Business activity";


            /* Find the Health Score card */

            const scoreCard =
                document.getElementById(
                    "bizpilotHealthScoreCard"
                );

            if (!scoreCard) {
                return;
            }


            /* Prevent duplicates */

            let explanation =
                document.getElementById(
                    "bizpilotHealthExplanation"
                );


            if (!explanation) {

                explanation =
                    document.createElement("div");

                explanation.id =
                    "bizpilotHealthExplanation";

                explanation.style.marginTop =
                    "16px";

                explanation.style.paddingTop =
                    "16px";

                explanation.style.borderTop =
                    "1px solid #edf0f3";

                scoreCard.appendChild(
                    explanation
                );

            }


            /* =================================================
               DETERMINE SCORE MESSAGE
               ================================================= */

            let scoreMessage = "";

            if (score >= 80) {

                scoreMessage =
                    "Your recorded business activity is strong. Focus on protecting what is working and improving your weakest area.";

            } else if (score >= 60) {

                scoreMessage =
                    "Your business has a healthy foundation, but there are still opportunities to improve.";

            } else if (score >= 40) {

                scoreMessage =
                    "Your business is developing. Consistent activity and better records can improve your score.";

            } else {

                scoreMessage =
                    "BizPilot needs more business activity to build a reliable picture of your business.";

            }


            /* =================================================
               BUILD EXPLANATION
               ================================================= */

            explanation.innerHTML = `

                <div style="
                    display:grid;
                    grid-template-columns:
                        repeat(3, minmax(0, 1fr));
                    gap:12px;
                ">

                    <div style="
                        padding:14px;
                        background:#f8fbff;
                        border-radius:12px;
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:6px;
                        ">
                            What's going well
                        </div>

                        <div style="
                            font-size:13px;
                            font-weight:700;
                            color:#111;
                        ">
                            ${strongest}
                        </div>

                    </div>


                    <div style="
                        padding:14px;
                        background:#fafafa;
                        border-radius:12px;
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#777;
                            margin-bottom:6px;
                        ">
                            Needs attention
                        </div>

                        <div style="
                            font-size:13px;
                            font-weight:700;
                            color:#111;
                        ">
                            ${weakest}
                        </div>

                    </div>


                    <div style="
                        padding:14px;
                        background:#fafafa;
                        border-radius:12px;
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#777;
                            margin-bottom:6px;
                        ">
                            Why this score
                        </div>

                        <div style="
                            font-size:12px;
                            line-height:1.5;
                            color:#666;
                        ">
                            ${scoreMessage}
                        </div>

                    </div>

                </div>

            `;

        } catch (error) {

            console.error(
                "Health score explanation error:",
                error
            );

        }

    }


    /* Run after score card exists */

    setTimeout(
        updateHealthScoreExplanation,
        700
    );


    /* Refresh when business data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateHealthScoreExplanation,
                700
            );

        }
    );


    window.updateHealthScoreExplanation =
        updateHealthScoreExplanation;

})();
/* =========================================================
   BIZPILOT — DYNAMIC HEALTH SCORE METER
   ========================================================= */

(function () {

    function updateHealthScoreMeter() {

        const scoreCard =
            document.getElementById(
                "bizpilotHealthScoreCard"
            );

        if (!scoreCard) {
            return;
        }

        const score =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        window.bizPilotHealthScore
                    ) || 0
                )
            );

        /* Prevent duplicates */

        let meter =
            document.getElementById(
                "bizpilotHealthMeter"
            );

        if (!meter) {

            meter =
                document.createElement("div");

            meter.id =
                "bizpilotHealthMeter";

            meter.innerHTML = `

                <div style="
                    margin-top:18px;
                ">

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-bottom:8px;
                    ">

                        <span style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#7b8490;
                        ">
                            Health level
                        </span>

                        <span
                            id="bizpilotHealthMeterLabel"
                            style="
                                font-size:10px;
                                font-weight:800;
                                color:#0396FF;
                            "
                        >
                            Healthy
                        </span>

                    </div>


                    <div style="
                        width:100%;
                        height:7px;
                        background:#edf1f5;
                        border-radius:999px;
                        overflow:hidden;
                    ">

                        <div
                            id="bizpilotHealthMeterFill"
                            style="
                                width:0%;
                                height:100%;
                                background:#0396FF;
                                border-radius:999px;
                                transition:width 0.8s ease;
                            "
                        ></div>

                    </div>

                </div>

            `;

            /*
             * Place meter directly underneath
             * the score number area.
             */

            const explanation =
                document.getElementById(
                    "bizpilotHealthExplanation"
                );

            if (explanation) {

                scoreCard.insertBefore(
                    meter,
                    explanation
                );

            } else {

                scoreCard.appendChild(
                    meter
                );

            }

        }


        const fill =
            document.getElementById(
                "bizpilotHealthMeterFill"
            );

        const label =
            document.getElementById(
                "bizpilotHealthMeterLabel"
            );


        if (fill) {

            setTimeout(function () {

                fill.style.width =
                    score + "%";

            }, 100);

        }


        if (label) {

            if (score >= 80) {

                label.textContent =
                    "Strong";

            } else if (score >= 60) {

                label.textContent =
                    "Healthy";

            } else if (score >= 40) {

                label.textContent =
                    "Needs attention";

            } else {

                label.textContent =
                    "Building data";

            }

        }

    }


    /* Wait for the Health Score card */

    setTimeout(
        updateHealthScoreMeter,
        900
    );


    /* Update when BizPilot data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateHealthScoreMeter,
                900
            );

        }
    );


    window.updateHealthScoreMeter =
        updateHealthScoreMeter;

})();
/* =========================================================
   BIZPILOT REPORTS — BUSINESS PERFORMANCE INTELLIGENCE
   ========================================================= */

(function () {

    function updateReportsIntelligence() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const expenses =
                Array.isArray(appData.expenses)
                    ? appData.expenses
                    : [];

            const inventory =
                Array.isArray(appData.inventory)
                    ? appData.inventory
                    : [];

            const customers =
                Array.isArray(appData.customers)
                    ? appData.customers
                    : [];


            /* =================================================
               CORE NUMBERS
               ================================================= */

            const totalSales =
                sales.reduce(function (total, sale) {

                    return total +
                        (Number(sale.amount) || 0);

                }, 0);


            const totalExpenses =
                expenses.reduce(function (total, expense) {

                    return total +
                        (Number(expense.amount) || 0);

                }, 0);


            const profit =
                totalSales -
                totalExpenses;


            const profitMargin =
                totalSales > 0
                    ? (profit / totalSales) * 100
                    : 0;


            /* =================================================
               LOW STOCK
               ================================================= */

            const lowStockProducts =
                inventory.filter(function (product) {

                    const stock =
                        Number(product.stock) || 0;

                    const minimum =
                        Number(
                            product.minimum ??
                            product.lowStockLevel ??
                            product.low_stock_level ??
                            5
                        );

                    return stock <= minimum;

                });


            /* =================================================
               CREATE REPORT CARD
               ================================================= */

            let reportCard =
                document.getElementById(
                    "bizpilotReportsIntelligence"
                );


            if (!reportCard) {

                const reportsSection =
                    document.getElementById(
                        "reports"
                    );

                if (!reportsSection) {
                    return;
                }


                reportCard =
                    document.createElement("div");

                reportCard.id =
                    "bizpilotReportsIntelligence";

                reportCard.style.marginTop =
                    "20px";

                reportsSection.appendChild(
                    reportCard
                );

            }


            /* =================================================
               DETERMINE PERFORMANCE
               ================================================= */

            let performanceTitle =
                "Business performance overview";

            let performanceText =
                "Keep recording your business activity so BizPilot can build a clearer performance picture.";


            if (
                totalSales > 0 &&
                profit > 0
            ) {

                performanceTitle =
                    "Your business is currently profitable";

                performanceText =
                    "Recorded sales are higher than recorded expenses, giving you a positive estimated profit.";

            } else if (
                totalSales > 0 &&
                profit === 0
            ) {

                performanceTitle =
                    "Your business is breaking even";

                performanceText =
                    "Recorded sales currently match recorded expenses. Focus on increasing revenue or reducing costs.";

            } else if (
                totalExpenses > totalSales
            ) {

                performanceTitle =
                    "Expenses are ahead of sales";

                performanceText =
                    "Your recorded expenses are currently higher than your recorded sales. Review spending carefully.";

            }


            /* =================================================
               NEXT ACTION
               ================================================= */

            let nextAction =
                "Keep recording accurate business data.";

            if (sales.length === 0) {

                nextAction =
                    "Record your sales.";

            } else if (totalExpenses > totalSales) {

                nextAction =
                    "Review your expenses.";

            } else if (lowStockProducts.length > 0) {

                nextAction =
                    "Review low-stock products.";

            } else if (customers.length === 0) {

                nextAction =
                    "Start building your customer list.";

            } else {

                nextAction =
                    "Continue monitoring your performance.";

            }


            /* =================================================
               RENDER
               ================================================= */

            reportCard.innerHTML = `

                <div style="
                    background:#ffffff;
                    border:1px solid #e7ebf0;
                    border-radius:18px;
                    padding:22px;
                    box-shadow:
                        0 7px 24px rgba(17,17,17,0.045);
                ">

                    <div style="
                        margin-bottom:20px;
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1.4px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:6px;
                        ">
                            BUSINESS PERFORMANCE
                        </div>

                        <h3 style="
                            margin:0 0 7px 0;
                            font-size:19px;
                            font-weight:800;
                            color:#111111;
                        ">
                            ${performanceTitle}
                        </h3>

                        <p style="
                            margin:0;
                            max-width:720px;
                            font-size:13px;
                            line-height:1.65;
                            color:#666b73;
                        ">
                            ${performanceText}
                        </p>

                    </div>


                    <div style="
                        display:grid;
                        grid-template-columns:
                            repeat(4,minmax(0,1fr));
                        gap:12px;
                    ">


                        <div style="
                            padding:16px;
                            background:#f8fbff;
                            border:1px solid #e5f1ff;
                            border-radius:13px;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:7px;
                            ">
                                Revenue
                            </div>

                            <strong style="
                                display:block;
                                font-size:20px;
                                color:#111111;
                            ">
                                Ksh ${totalSales.toLocaleString()}
                            </strong>

                        </div>


                        <div style="
                            padding:16px;
                            background:#fafafa;
                            border:1px solid #edf0f3;
                            border-radius:13px;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:7px;
                            ">
                                Expenses
                            </div>

                            <strong style="
                                display:block;
                                font-size:20px;
                                color:#111111;
                            ">
                                Ksh ${totalExpenses.toLocaleString()}
                            </strong>

                        </div>


                        <div style="
                            padding:16px;
                            background:#f8fbff;
                            border:1px solid #e5f1ff;
                            border-radius:13px;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:7px;
                            ">
                                Estimated Profit
                            </div>

                            <strong style="
                                display:block;
                                font-size:20px;
                                color:#0396FF;
                            ">
                                Ksh ${profit.toLocaleString()}
                            </strong>

                        </div>


                        <div style="
                            padding:16px;
                            background:#fafafa;
                            border:1px solid #edf0f3;
                            border-radius:13px;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:7px;
                            ">
                                Profit Margin
                            </div>

                            <strong style="
                                display:block;
                                font-size:20px;
                                color:#111111;
                            ">
                                ${profitMargin.toFixed(1)}%
                            </strong>

                        </div>

                    </div>


                    <div style="
                        margin-top:16px;
                        padding:15px 16px;
                        background:#111111;
                        border-radius:13px;
                        color:#ffffff;
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#9da5af;
                            margin-bottom:6px;
                        ">
                            RECOMMENDED NEXT MOVE
                        </div>

                        <div style="
                            font-size:14px;
                            font-weight:700;
                        ">
                            ${nextAction}
                        </div>

                    </div>

                </div>

            `;


            /* =================================================
               MOBILE
               ================================================= */

            if (
                window.innerWidth <= 700
            ) {

                const grid =
                    reportCard.querySelector(
                        "div > div:nth-child(2)"
                    );

                if (grid) {

                    grid.style.gridTemplateColumns =
                        "repeat(2,minmax(0,1fr))";

                }

            }

        } catch (error) {

            console.error(
                "Reports intelligence error:",
                error
            );

        }

    }


    updateReportsIntelligence();


    window.updateReportsIntelligence =
        updateReportsIntelligence;


    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateReportsIntelligence,
                350
            );

        }
    );


    window.addEventListener(
        "resize",
        function () {

            updateReportsIntelligence();

        }
    );

})();
/* =========================================================
   BIZPILOT REPORTS — SALES TREND CHART
   ========================================================= */

(function () {

    function updateReportsSalesChart() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const reportsSection =
                document.getElementById("reports");

            if (!reportsSection) {
                return;
            }


            /* =================================================
               CREATE CHART CONTAINER
               ================================================= */

            let chartCard =
                document.getElementById(
                    "bizpilotSalesTrendCard"
                );


            if (!chartCard) {

                chartCard =
                    document.createElement("div");

                chartCard.id =
                    "bizpilotSalesTrendCard";

                chartCard.style.marginTop =
                    "18px";

                reportsSection.appendChild(
                    chartCard
                );

            }


            /* =================================================
               GROUP SALES BY DATE
               ================================================= */

            const salesByDate = {};

            sales.forEach(function (sale) {

                const rawDate =
                    sale.date ||
                    sale.saleDate ||
                    sale.created_at;

                if (!rawDate) {
                    return;
                }

                const date =
                    String(rawDate).slice(0, 10);

                const amount =
                    Number(sale.amount) || 0;

                if (!salesByDate[date]) {
                    salesByDate[date] = 0;
                }

                salesByDate[date] += amount;

            });


            let dates =
                Object.keys(salesByDate)
                    .sort();


            /* Show the most recent 7 recorded dates */

            dates =
                dates.slice(-7);


            /* =================================================
               NO DATA
               ================================================= */

            if (dates.length === 0) {

                chartCard.innerHTML = `

                    <div style="
                        background:#ffffff;
                        border:1px solid #e7ebf0;
                        border-radius:18px;
                        padding:22px;
                        box-shadow:
                            0 7px 24px
                            rgba(17,17,17,0.045);
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1.4px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:6px;
                        ">
                            SALES TREND
                        </div>

                        <h3 style="
                            margin:0 0 7px 0;
                            font-size:19px;
                            font-weight:800;
                            color:#111111;
                        ">
                            Waiting for sales data
                        </h3>

                        <p style="
                            margin:0;
                            font-size:13px;
                            line-height:1.6;
                            color:#666b73;
                        ">
                            Record sales to see how your revenue
                            is changing over time.
                        </p>

                    </div>

                `;

                return;
            }


            /* =================================================
               BUILD CHART DATA
               ================================================= */

            const values =
                dates.map(function (date) {

                    return salesByDate[date] || 0;

                });


            const maximum =
                Math.max.apply(
                    null,
                    values
                );


            const chartHeight = 180;


            /* =================================================
               BUILD SVG POINTS
               ================================================= */

            const points = [];

            dates.forEach(function (date, index) {

                const x =
                    dates.length === 1
                        ? 50
                        : (
                            index /
                            (dates.length - 1)
                        ) * 92 + 4;

                const y =
                    maximum > 0
                        ? 155 -
                          (
                            values[index] /
                            maximum
                          ) * 125
                        : 155;

                points.push({
                    x: x,
                    y: y
                });

            });


            const polylinePoints =
                points.map(function (point) {

                    return (
                        point.x +
                        "," +
                        point.y
                    );

                }).join(" ");


            /* =================================================
               FORMAT DATE
               ================================================= */

            function formatDate(dateString) {

                const parts =
                    dateString.split("-");

                if (parts.length !== 3) {
                    return dateString;
                }

                return (
                    parts[2] +
                    "/" +
                    parts[1]
                );

            }


            /* =================================================
               RENDER
               ================================================= */

            chartCard.innerHTML = `

                <div style="
                    background:#ffffff;
                    border:1px solid #e7ebf0;
                    border-radius:18px;
                    padding:22px;
                    box-shadow:
                        0 7px 24px
                        rgba(17,17,17,0.045);
                ">

                    <div style="
                        display:flex;
                        align-items:flex-start;
                        justify-content:space-between;
                        gap:20px;
                        margin-bottom:18px;
                        flex-wrap:wrap;
                    ">

                        <div>

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1.4px;
                                text-transform:uppercase;
                                color:#0396FF;
                                margin-bottom:6px;
                            ">
                                SALES TREND
                            </div>

                            <h3 style="
                                margin:0 0 6px 0;
                                font-size:19px;
                                font-weight:800;
                                color:#111111;
                            ">
                                Revenue over time
                            </h3>

                            <p style="
                                margin:0;
                                font-size:13px;
                                line-height:1.6;
                                color:#666b73;
                            ">
                                Your most recent recorded sales activity.
                            </p>

                        </div>

                        <div style="
                            padding:9px 12px;
                            background:#f8fbff;
                            border:1px solid #e5f1ff;
                            border-radius:10px;
                            font-size:10px;
                            font-weight:800;
                            color:#0396FF;
                            white-space:nowrap;
                        ">
                            LAST ${dates.length} DAYS
                        </div>

                    </div>


                    <div style="
                        width:100%;
                        overflow:hidden;
                    ">

                        <svg
                            viewBox="0 0 100 180"
                            preserveAspectRatio="none"
                            style="
                                display:block;
                                width:100%;
                                height:180px;
                            "
                        >

                            <!-- Grid lines -->

                            <line
                                x1="4"
                                y1="30"
                                x2="96"
                                y2="30"
                                stroke="#edf0f3"
                                stroke-width="0.5"
                            />

                            <line
                                x1="4"
                                y1="92"
                                x2="96"
                                y2="92"
                                stroke="#edf0f3"
                                stroke-width="0.5"
                            />

                            <line
                                x1="4"
                                y1="155"
                                x2="96"
                                y2="155"
                                stroke="#edf0f3"
                                stroke-width="0.5"
                            />


                            <!-- Sales line -->

                            <polyline
                                points="${polylinePoints}"
                                fill="none"
                                stroke="#0396FF"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                vector-effect="non-scaling-stroke"
                            />


                            <!-- Sales points -->

                            ${points.map(function (point, index) {

                                return `

                                    <circle
                                        cx="${point.x}"
                                        cy="${point.y}"
                                        r="2.2"
                                        fill="#ffffff"
                                        stroke="#0396FF"
                                        stroke-width="1.5"
                                        vector-effect="non-scaling-stroke"
                                    />

                                `;

                            }).join("")}

                        </svg>

                    </div>


                    <div style="
                        display:grid;
                        grid-template-columns:
                            repeat(${dates.length},1fr);
                        gap:4px;
                        margin-top:5px;
                    ">

                        ${dates.map(function (date) {

                            return `

                                <div style="
                                    text-align:center;
                                    font-size:9px;
                                    font-weight:700;
                                    color:#8a929c;
                                ">
                                    ${formatDate(date)}
                                </div>

                            `;

                        }).join("")}

                    </div>


                    <div style="
                        margin-top:18px;
                        padding-top:15px;
                        border-top:1px solid #edf0f3;
                        display:flex;
                        justify-content:space-between;
                        gap:15px;
                        flex-wrap:wrap;
                    ">

                        <div>

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:4px;
                            ">
                                Highest recorded day
                            </div>

                            <strong style="
                                font-size:14px;
                                color:#111111;
                            ">
                                Ksh ${maximum.toLocaleString()}
                            </strong>

                        </div>


                        <div style="
                            text-align:right;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:4px;
                            ">
                                Total shown
                            </div>

                            <strong style="
                                font-size:14px;
                                color:#0396FF;
                            ">
                                Ksh ${values.reduce(function (total, value) {
                                    return total + value;
                                }, 0).toLocaleString()}
                            </strong>

                        </div>

                    </div>

                </div>

            `;

        } catch (error) {

            console.error(
                "Sales trend chart error:",
                error
            );

        }

    }


    /* Initial load */

    setTimeout(
        updateReportsSalesChart,
        500
    );


    /* Refresh when BizPilot data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateReportsSalesChart,
                500
            );

        }
    );


    window.updateReportsSalesChart =
        updateReportsSalesChart;

})();
/* =========================================================
   BIZPILOT REPORTS — SMART REPORT INSIGHT
   ========================================================= */

(function () {

    function updateReportInsight() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const expenses =
                Array.isArray(appData.expenses)
                    ? appData.expenses
                    : [];

            const inventory =
                Array.isArray(appData.inventory)
                    ? appData.inventory
                    : [];

            const customers =
                Array.isArray(appData.customers)
                    ? appData.customers
                    : [];


            /* =================================================
               BUSINESS NUMBERS
               ================================================= */

            const totalSales =
                sales.reduce(function (total, sale) {

                    return total +
                        (Number(sale.amount) || 0);

                }, 0);


            const totalExpenses =
                expenses.reduce(function (total, expense) {

                    return total +
                        (Number(expense.amount) || 0);

                }, 0);


            const profit =
                totalSales -
                totalExpenses;


            const margin =
                totalSales > 0
                    ? (profit / totalSales) * 100
                    : 0;


            /* =================================================
               FIND LOW STOCK
               ================================================= */

            const lowStock =
                inventory.filter(function (product) {

                    const stock =
                        Number(product.stock) || 0;

                    const minimum =
                        Number(
                            product.minimum ??
                            product.lowStockLevel ??
                            product.low_stock_level ??
                            5
                        );

                    return stock <= minimum;

                });


            /* =================================================
               FIND LARGEST EXPENSE
               ================================================= */

            let largestExpense =
                null;

            expenses.forEach(function (expense) {

                const amount =
                    Number(expense.amount) || 0;

                if (
                    !largestExpense ||
                    amount >
                    Number(largestExpense.amount)
                ) {

                    largestExpense =
                        expense;

                }

            });


            /* =================================================
               CREATE INSIGHT CARD
               ================================================= */

            let insightCard =
                document.getElementById(
                    "bizpilotReportInsight"
                );


            if (!insightCard) {

                const reportsSection =
                    document.getElementById(
                        "reports"
                    );

                if (!reportsSection) {
                    return;
                }


                insightCard =
                    document.createElement("div");

                insightCard.id =
                    "bizpilotReportInsight";

                insightCard.style.marginTop =
                    "18px";

                reportsSection.appendChild(
                    insightCard
                );

            }


            /* =================================================
               DETERMINE INSIGHT
               ================================================= */

            let label =
                "REPORT INSIGHT";

            let title =
                "Keep building your business data.";

            let message =
                "The more accurate information you record, the more useful your BizPilot reports become.";

            let action =
                "Continue recording sales, expenses, inventory and customers.";


            if (sales.length === 0) {

                title =
                    "Start with your sales.";

                message =
                    "BizPilot does not have enough sales activity to identify a reliable revenue pattern yet.";

                action =
                    "Record your latest sales.";

            } else if (
                totalExpenses > totalSales
            ) {

                title =
                    "Your expenses need attention.";

                message =
                    "Recorded expenses are currently higher than recorded sales, which is putting pressure on your estimated profit.";

                action =
                    "Review your largest expenses and identify costs you can reduce.";

            } else if (
                margin > 0 &&
                margin < 15
            ) {

                title =
                    "Your profit margin is tight.";

                message =
                    "You are currently profitable, but only a relatively small portion of recorded revenue remains after expenses.";

                action =
                    "Look for ways to increase your selling price, sales volume or reduce unnecessary costs.";

            } else if (
                lowStock.length > 0
            ) {

                title =
                    "Some products need restocking.";

                message =
                    lowStock.length +
                    " product" +
                    (
                        lowStock.length === 1
                            ? ""
                            : "s"
                    ) +
                    " currently " +
                    (
                        lowStock.length === 1
                            ? "is"
                            : "are"
                    ) +
                    " at or below the recorded low-stock level.";

                action =
                    "Review your inventory and prioritize your most important low-stock products.";

            } else if (
                customers.length === 0
            ) {

                title =
                    "Your customer data is still empty.";

                message =
                    "Sales data can tell you what happened, but customer records can help BizPilot understand who is driving your business.";

                action =
                    "Start adding customers and connect them to future sales.";

            } else if (
                margin >= 30
            ) {

                title =
                    "Your recorded profit margin looks strong.";

                message =
                    "A healthy portion of your recorded revenue remains after your recorded expenses.";

                action =
                    "Protect your margin while looking for opportunities to increase sales.";

            } else {

                title =
                    "Your business has a workable foundation.";

                message =
                    "Your recorded sales currently exceed your expenses. Continue tracking activity so BizPilot can identify stronger patterns.";

                action =
                    "Keep monitoring sales, expenses and customer activity.";

            }


            /* =================================================
               LARGEST EXPENSE SUPPORT
               ================================================= */

            let expenseNote = "";

            if (
                largestExpense &&
                Number(largestExpense.amount) > 0
            ) {

                const expenseName =
                    (
                        largestExpense.category ||
                        largestExpense.description ||
                        "One expense"
                    )
                    .toString();

                expenseNote =
                    " Largest recorded expense: " +
                    expenseName +
                    " — Ksh " +
                    Number(
                        largestExpense.amount
                    ).toLocaleString() +
                    ".";

            }


            /* =================================================
               RENDER
               ================================================= */

            insightCard.innerHTML = `

                <div style="
                    background:#111111;
                    border-radius:18px;
                    padding:22px;
                    color:#ffffff;
                    box-shadow:
                        0 8px 25px
                        rgba(17,17,17,0.10);
                ">

                    <div style="
                        display:flex;
                        align-items:flex-start;
                        gap:16px;
                    ">

                        <div style="
                            flex-shrink:0;
                            width:42px;
                            height:42px;
                            border-radius:12px;
                            background:#0396FF;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:19px;
                            font-weight:800;
                        ">
                            ✦
                        </div>


                        <div style="
                            min-width:0;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1.4px;
                                text-transform:uppercase;
                                color:#9da5af;
                                margin-bottom:6px;
                            ">
                                ${label}
                            </div>


                            <h3 style="
                                margin:0 0 7px 0;
                                font-size:18px;
                                line-height:1.35;
                                font-weight:800;
                                color:#ffffff;
                            ">
                                ${title}
                            </h3>


                            <p style="
                                margin:0;
                                max-width:720px;
                                font-size:13px;
                                line-height:1.65;
                                color:#c4c9d0;
                            ">
                                ${message}
                                ${expenseNote}
                            </p>


                            <div style="
                                margin-top:15px;
                                padding-top:14px;
                                border-top:
                                    1px solid
                                    rgba(255,255,255,0.10);
                            ">

                                <div style="
                                    font-size:9px;
                                    font-weight:800;
                                    letter-spacing:1px;
                                    text-transform:uppercase;
                                    color:#7f8994;
                                    margin-bottom:5px;
                                ">
                                    WHAT TO DO NEXT
                                </div>


                                <div style="
                                    font-size:13px;
                                    line-height:1.55;
                                    font-weight:700;
                                    color:#ffffff;
                                ">
                                    ${action}
                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            `;

        } catch (error) {

            console.error(
                "Report insight error:",
                error
            );

        }

    }


    /* Initial load */

    setTimeout(
        updateReportInsight,
        700
    );


    /* Refresh after data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateReportInsight,
                700
            );

        }
    );


    window.updateReportInsight =
        updateReportInsight;

})();
/* =========================================================
   BIZPILOT REPORTS — EXPENSE BREAKDOWN
   ========================================================= */

(function () {

    function updateExpenseBreakdown() {

        try {

            if (!appData) {
                return;
            }

            const expenses =
                Array.isArray(appData.expenses)
                    ? appData.expenses
                    : [];

            const reportsSection =
                document.getElementById("reports");

            if (!reportsSection) {
                return;
            }


            /* =================================================
               CREATE CONTAINER
               ================================================= */

            let expenseCard =
                document.getElementById(
                    "bizpilotExpenseBreakdown"
                );


            if (!expenseCard) {

                expenseCard =
                    document.createElement("div");

                expenseCard.id =
                    "bizpilotExpenseBreakdown";

                expenseCard.style.marginTop =
                    "18px";

                reportsSection.appendChild(
                    expenseCard
                );

            }


            /* =================================================
               GROUP EXPENSES BY CATEGORY
               ================================================= */

            const categories = {};

            expenses.forEach(function (expense) {

                const category =
                    (
                        expense.category ||
                        expense.description ||
                        "Other"
                    )
                    .toString()
                    .trim();

                const amount =
                    Number(expense.amount) || 0;

                if (!categories[category]) {
                    categories[category] = 0;
                }

                categories[category] += amount;

            });


            const categoryList =
                Object.entries(categories)
                    .sort(function (a, b) {
                        return b[1] - a[1];
                    });


            /* =================================================
               NO EXPENSE DATA
               ================================================= */

            if (categoryList.length === 0) {

                expenseCard.innerHTML = `

                    <div style="
                        background:#ffffff;
                        border:1px solid #e7ebf0;
                        border-radius:18px;
                        padding:22px;
                        box-shadow:
                            0 7px 24px
                            rgba(17,17,17,0.045);
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1.4px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:6px;
                        ">
                            EXPENSE BREAKDOWN
                        </div>

                        <h3 style="
                            margin:0 0 7px 0;
                            font-size:19px;
                            font-weight:800;
                            color:#111111;
                        ">
                            Waiting for expense data
                        </h3>

                        <p style="
                            margin:0;
                            font-size:13px;
                            line-height:1.6;
                            color:#666b73;
                        ">
                            Record expenses to see where your
                            business spending is going.
                        </p>

                    </div>

                `;

                return;
            }


            /* =================================================
               TOTAL EXPENSES
               ================================================= */

            const totalExpenses =
                categoryList.reduce(
                    function (total, item) {

                        return total + item[1];

                    },
                    0
                );


            /* =================================================
               TOP 5 CATEGORIES
               ================================================= */

            const visibleCategories =
                categoryList.slice(0, 5);


            /* =================================================
               RENDER
               ================================================= */

            expenseCard.innerHTML = `

                <div style="
                    background:#ffffff;
                    border:1px solid #e7ebf0;
                    border-radius:18px;
                    padding:22px;
                    box-shadow:
                        0 7px 24px
                        rgba(17,17,17,0.045);
                ">

                    <div style="
                        display:flex;
                        align-items:flex-start;
                        justify-content:space-between;
                        gap:20px;
                        margin-bottom:20px;
                        flex-wrap:wrap;
                    ">

                        <div>

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1.4px;
                                text-transform:uppercase;
                                color:#0396FF;
                                margin-bottom:6px;
                            ">
                                EXPENSE BREAKDOWN
                            </div>

                            <h3 style="
                                margin:0 0 6px 0;
                                font-size:19px;
                                font-weight:800;
                                color:#111111;
                            ">
                                Where your money is going
                            </h3>

                            <p style="
                                margin:0;
                                font-size:13px;
                                line-height:1.6;
                                color:#666b73;
                            ">
                                Your largest recorded expense categories.
                            </p>

                        </div>


                        <div style="
                            padding:9px 12px;
                            background:#fafafa;
                            border:1px solid #edf0f3;
                            border-radius:10px;
                            font-size:10px;
                            font-weight:800;
                            color:#111111;
                            white-space:nowrap;
                        ">
                            Ksh ${totalExpenses.toLocaleString()}
                        </div>

                    </div>


                    <div>

                        ${visibleCategories.map(
                            function (item, index) {

                                const category =
                                    item[0];

                                const amount =
                                    item[1];

                                const percentage =
                                    totalExpenses > 0
                                        ? (
                                            amount /
                                            totalExpenses
                                        ) * 100
                                        : 0;

                                return `

                                    <div style="
                                        margin-bottom:
                                            ${
                                                index ===
                                                visibleCategories.length - 1
                                                    ? "0"
                                                    : "16px"
                                            };
                                    ">

                                        <div style="
                                            display:flex;
                                            align-items:center;
                                            justify-content:space-between;
                                            gap:15px;
                                            margin-bottom:7px;
                                        ">

                                            <div style="
                                                min-width:0;
                                                font-size:12px;
                                                font-weight:700;
                                                color:#111111;
                                                overflow:hidden;
                                                text-overflow:ellipsis;
                                                white-space:nowrap;
                                            ">
                                                ${category}
                                            </div>

                                            <div style="
                                                flex-shrink:0;
                                                font-size:12px;
                                                font-weight:800;
                                                color:#111111;
                                            ">
                                                Ksh ${amount.toLocaleString()}
                                            </div>

                                        </div>


                                        <div style="
                                            width:100%;
                                            height:7px;
                                            background:#edf1f5;
                                            border-radius:999px;
                                            overflow:hidden;
                                        ">

                                            <div style="
                                                width:${percentage}%;
                                                height:100%;
                                                background:#0396FF;
                                                border-radius:999px;
                                            "></div>

                                        </div>


                                        <div style="
                                            margin-top:5px;
                                            font-size:9px;
                                            font-weight:700;
                                            color:#8a929c;
                                        ">
                                            ${percentage.toFixed(1)}%
                                            of recorded expenses
                                        </div>

                                    </div>

                                `;

                            }
                        ).join("")}

                    </div>


                    <div style="
                        margin-top:20px;
                        padding-top:15px;
                        border-top:1px solid #edf0f3;
                        font-size:12px;
                        line-height:1.6;
                        color:#666b73;
                    ">

                        <strong style="
                            color:#111111;
                        ">
                            Report note:
                        </strong>

                        Focus on your largest expense categories
                        first when looking for opportunities to
                        control spending.

                    </div>

                </div>

            `;

        } catch (error) {

            console.error(
                "Expense breakdown error:",
                error
            );

        }

    }


    /* Initial load */

    setTimeout(
        updateExpenseBreakdown,
        850
    );


    /* Refresh after data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateExpenseBreakdown,
                850
            );

        }
    );


    window.updateExpenseBreakdown =
        updateExpenseBreakdown;

})();
/* =========================================================
   BIZPILOT REPORTS — CUSTOMER PERFORMANCE
   ========================================================= */

(function () {

    function updateCustomerPerformanceReport() {

        try {

            if (!appData) {
                return;
            }

            const sales =
                Array.isArray(appData.sales)
                    ? appData.sales
                    : [];

            const customers =
                Array.isArray(appData.customers)
                    ? appData.customers
                    : [];

            const reportsSection =
                document.getElementById("reports");

            if (!reportsSection) {
                return;
            }


            /* =================================================
               CUSTOMER ACTIVITY
               ================================================= */

            const customerActivity = {};

            let linkedRevenue = 0;
            let linkedSales = 0;


            sales.forEach(function (sale) {

                const customerName =
                    (
                        sale.customer ||
                        sale.customerName ||
                        sale.customer_name ||
                        ""
                    )
                    .toString()
                    .trim();

                if (!customerName) {
                    return;
                }

                const key =
                    customerName.toLowerCase();

                const amount =
                    Number(sale.amount) || 0;

                if (!customerActivity[key]) {

                    customerActivity[key] = {
                        name: customerName,
                        sales: 0,
                        revenue: 0
                    };

                }

                customerActivity[key].sales += 1;

                customerActivity[key].revenue +=
                    amount;

                linkedSales += 1;

                linkedRevenue += amount;

            });


            const activeCustomers =
                Object.values(customerActivity)
                    .sort(function (a, b) {

                        return (
                            b.revenue -
                            a.revenue
                        );

                    });


            const activeCustomerCount =
                activeCustomers.length;


            const topCustomer =
                activeCustomers[0] || null;


            /* =================================================
               CREATE REPORT CARD
               ================================================= */

            let customerCard =
                document.getElementById(
                    "bizpilotCustomerPerformance"
                );


            if (!customerCard) {

                customerCard =
                    document.createElement("div");

                customerCard.id =
                    "bizpilotCustomerPerformance";

                customerCard.style.marginTop =
                    "18px";

                reportsSection.appendChild(
                    customerCard
                );

            }


            /* =================================================
               CUSTOMER OPPORTUNITY
               ================================================= */

            let opportunity =
                "Start recording customers and connect them to sales so BizPilot can identify customer activity.";

            if (
                customers.length > 0 &&
                linkedSales === 0
            ) {

                opportunity =
                    "You have customers recorded, but no sales are currently linked to them. Connect customers to sales to unlock stronger customer insights.";

            } else if (
                topCustomer &&
                activeCustomerCount === 1
            ) {

                opportunity =
                    "Focus on retaining your active customer while continuing to build a broader customer base.";

            } else if (
                topCustomer &&
                activeCustomerCount > 1
            ) {

                opportunity =
                    "Pay attention to your strongest customers while looking for ways to increase repeat purchases from the rest of your customer base.";

            }


            /* =================================================
               RENDER
               ================================================= */

            customerCard.innerHTML = `

                <div style="
                    background:#ffffff;
                    border:1px solid #e7ebf0;
                    border-radius:18px;
                    padding:22px;
                    box-shadow:
                        0 7px 24px
                        rgba(17,17,17,0.045);
                ">

                    <div style="
                        display:flex;
                        align-items:flex-start;
                        justify-content:space-between;
                        gap:20px;
                        margin-bottom:20px;
                        flex-wrap:wrap;
                    ">

                        <div>

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1.4px;
                                text-transform:uppercase;
                                color:#0396FF;
                                margin-bottom:6px;
                            ">
                                CUSTOMER PERFORMANCE
                            </div>

                            <h3 style="
                                margin:0 0 6px 0;
                                font-size:19px;
                                font-weight:800;
                                color:#111111;
                            ">
                                Who is contributing to your business?
                            </h3>

                            <p style="
                                margin:0;
                                max-width:650px;
                                font-size:13px;
                                line-height:1.6;
                                color:#666b73;
                            ">
                                A summary of the customer activity
                                currently recorded in BizPilot.
                            </p>

                        </div>

                    </div>


                    <!-- SUMMARY -->

                    <div style="
                        display:grid;
                        grid-template-columns:
                            repeat(4,minmax(0,1fr));
                        gap:12px;
                    ">


                        <div style="
                            padding:16px;
                            background:#f8fbff;
                            border:1px solid #e5f1ff;
                            border-radius:13px;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:7px;
                            ">
                                Customers
                            </div>

                            <strong style="
                                font-size:22px;
                                color:#111111;
                            ">
                                ${customers.length}
                            </strong>

                        </div>


                        <div style="
                            padding:16px;
                            background:#fafafa;
                            border:1px solid #edf0f3;
                            border-radius:13px;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:7px;
                            ">
                                Active Customers
                            </div>

                            <strong style="
                                font-size:22px;
                                color:#111111;
                            ">
                                ${activeCustomerCount}
                            </strong>

                        </div>


                        <div style="
                            padding:16px;
                            background:#f8fbff;
                            border:1px solid #e5f1ff;
                            border-radius:13px;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:7px;
                            ">
                                Linked Sales
                            </div>

                            <strong style="
                                font-size:22px;
                                color:#111111;
                            ">
                                ${linkedSales}
                            </strong>

                        </div>


                        <div style="
                            padding:16px;
                            background:#fafafa;
                            border:1px solid #edf0f3;
                            border-radius:13px;
                        ">

                            <div style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:7px;
                            ">
                                Customer Revenue
                            </div>

                            <strong style="
                                font-size:19px;
                                color:#0396FF;
                            ">
                                Ksh ${linkedRevenue.toLocaleString()}
                            </strong>

                        </div>

                    </div>


                    <!-- TOP CUSTOMER -->

                    <div style="
                        margin-top:16px;
                        padding:16px;
                        background:#fafafa;
                        border:1px solid #edf0f3;
                        border-radius:13px;
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#7b8490;
                            margin-bottom:7px;
                        ">
                            TOP CUSTOMER
                        </div>

                        ${
                            topCustomer
                                ? `
                                    <div style="
                                        display:flex;
                                        align-items:center;
                                        justify-content:space-between;
                                        gap:15px;
                                        flex-wrap:wrap;
                                    ">

                                        <strong style="
                                            font-size:15px;
                                            color:#111111;
                                        ">
                                            ${topCustomer.name}
                                        </strong>

                                        <span style="
                                            font-size:13px;
                                            font-weight:800;
                                            color:#0396FF;
                                        ">
                                            Ksh ${topCustomer.revenue.toLocaleString()}
                                        </span>

                                    </div>
                                  `
                                : `
                                    <div style="
                                        font-size:12px;
                                        line-height:1.5;
                                        color:#666b73;
                                    ">
                                        No customer-linked sales yet.
                                    </div>
                                  `
                        }

                    </div>


                    <!-- OPPORTUNITY -->

                    <div style="
                        margin-top:14px;
                        padding:15px 16px;
                        background:#111111;
                        border-radius:13px;
                        color:#ffffff;
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#8f98a3;
                            margin-bottom:6px;
                        ">
                            CUSTOMER OPPORTUNITY
                        </div>

                        <div style="
                            font-size:13px;
                            line-height:1.6;
                            font-weight:600;
                        ">
                            ${opportunity}
                        </div>

                    </div>

                </div>

            `;


            /* =================================================
               MOBILE
               ================================================= */

            if (window.innerWidth <= 700) {

                const summary =
                    customerCard.querySelector(
                        "div > div:nth-child(2)"
                    );

                if (summary) {

                    summary.style.gridTemplateColumns =
                        "repeat(2,minmax(0,1fr))";

                }

            }

        } catch (error) {

            console.error(
                "Customer performance report error:",
                error
            );

        }

    }


    /* Initial load */

    setTimeout(
        updateCustomerPerformanceReport,
        950
    );


    /* Refresh when data changes */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                updateCustomerPerformanceReport,
                950
            );

        }
    );


    window.updateCustomerPerformanceReport =
        updateCustomerPerformanceReport;

})();
/* =========================================================
   BIZPILOT FINAL APP.JS CONSOLIDATION
   FINAL INTELLIGENCE + REPORTS + HEALTH + REFRESH LAYER
   ========================================================= */

(function () {

    "use strict";

    /* =====================================================
       SAFE HELPERS
       ===================================================== */

    function bpData() {
        return window.appData || appData || {};
    }

    function bpSales() {
        const data = bpData();
        return Array.isArray(data.sales) ? data.sales : [];
    }

    function bpExpenses() {
        const data = bpData();
        return Array.isArray(data.expenses) ? data.expenses : [];
    }

    function bpInventory() {
        const data = bpData();
        return Array.isArray(data.inventory) ? data.inventory : [];
    }

    function bpCustomers() {
        const data = bpData();
        return Array.isArray(data.customers) ? data.customers : [];
    }

    function bpAmount(value) {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount : 0;
    }

    function bpDate(item) {
        return (
            item?.date ||
            item?.saleDate ||
            item?.expenseDate ||
            item?.created_at ||
            item?.createdAt ||
            ""
        );
    }

    function bpProductName(item) {
        return (
            item?.description ||
            item?.product ||
            item?.productName ||
            item?.product_name ||
            item?.name ||
            ""
        ).toString().trim();
    }

    function bpCustomerName(item) {
        return (
            item?.customer ||
            item?.customerName ||
            item?.customer_name ||
            ""
        ).toString().trim();
    }

    function bpMoney(value) {
        return "KSh " + bpAmount(value).toLocaleString();
    }

    function bpEscape(value) {
        if (typeof escapeHTML === "function") {
            return escapeHTML(String(value ?? ""));
        }

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       BUSINESS HEALTH SCORE
       ===================================================== */

    function finalHealthScore() {

        try {

            const sales = bpSales();
            const expenses = bpExpenses();
            const inventory = bpInventory();
            const customers = bpCustomers();

            const totalSales =
                sales.reduce(
                    (sum, sale) =>
                        sum + bpAmount(sale.amount),
                    0
                );

            const totalExpenses =
                expenses.reduce(
                    (sum, expense) =>
                        sum + bpAmount(expense.amount),
                    0
                );

            const profit =
                totalSales - totalExpenses;

            const profitMargin =
                totalSales > 0
                    ? (profit / totalSales) * 100
                    : 0;

            const lowStock =
                inventory.filter(function (item) {

                    const stock =
                        Number(item.stock) || 0;

                    const minimum =
                        Number(
                            item.minimum ??
                            item.low_stock_level ??
                            item.lowStockLevel ??
                            5
                        );

                    return stock <= minimum;

                });

            let salesScore = 0;

            if (sales.length >= 20) {
                salesScore = 25;
            } else if (sales.length >= 10) {
                salesScore = 20;
            } else if (sales.length >= 5) {
                salesScore = 15;
            } else if (sales.length >= 1) {
                salesScore = 10;
            }

            let profitScore = 0;

            if (profitMargin >= 30) {
                profitScore = 25;
            } else if (profitMargin >= 20) {
                profitScore = 20;
            } else if (profitMargin >= 10) {
                profitScore = 15;
            } else if (profitMargin > 0) {
                profitScore = 8;
            }

            let inventoryScore = 25;

            if (inventory.length === 0) {
                inventoryScore = 5;
            } else if (lowStock.length === 0) {
                inventoryScore = 25;
            } else if (lowStock.length <= 1) {
                inventoryScore = 20;
            } else if (
                lowStock.length <
                inventory.length / 2
            ) {
                inventoryScore = 15;
            } else {
                inventoryScore = 8;
            }

            let customerScore = 0;

            if (customers.length >= 20) {
                customerScore = 25;
            } else if (customers.length >= 10) {
                customerScore = 20;
            } else if (customers.length >= 5) {
                customerScore = 15;
            } else if (customers.length >= 1) {
                customerScore = 10;
            }

            const score =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            salesScore +
                            profitScore +
                            inventoryScore +
                            customerScore
                        )
                    )
                );

            let strongest = "Business activity";
            let weakest = "Business activity";

            const areas = [
                {
                    name: "Sales activity",
                    score: salesScore
                },
                {
                    name: "Profitability",
                    score: profitScore
                },
                {
                    name: "Inventory health",
                    score: inventoryScore
                },
                {
                    name: "Customer base",
                    score: customerScore
                }
            ];

            areas.sort(function (a, b) {
                return b.score - a.score;
            });

            if (areas.length) {
                strongest = areas[0].name;
                weakest =
                    areas[areas.length - 1].name;
            }

            window.bizPilotHealthScore = score;
            window.bizPilotStrongestArea = strongest;
            window.bizPilotWeakestArea = weakest;

            const health =
                document.getElementById(
                    "businessHealth"
                );

            const healthText =
                document.getElementById(
                    "businessHealthText"
                );

            if (health) {
                health.textContent =
                    score >= 80
                        ? "Strong"
                        : score >= 60
                            ? "Healthy"
                            : score >= 40
                                ? "Needs attention"
                                : "Building data";
            }

            if (healthText) {

                if (score >= 80) {

                    healthText.textContent =
                        "Your recorded business activity is strong. Focus on protecting what is working and improving your weakest area.";

                } else if (score >= 60) {

                    healthText.textContent =
                        "Your business has a healthy foundation, but there are still opportunities to improve.";

                } else if (score >= 40) {

                    healthText.textContent =
                        "Your business is developing. Consistent activity and better records can improve your score.";

                } else {

                    healthText.textContent =
                        "BizPilot needs more business activity to build a reliable picture of your business.";

                }

            }

            updateFinalHealthCard();

            return score;

        } catch (error) {

            console.error(
                "Final health score error:",
                error
            );

            return 0;
        }
    }


    /* =====================================================
       HEALTH SCORE CARD
       ===================================================== */

    function updateFinalHealthCard() {

        const reports =
            document.getElementById("reports");

        const aiSection =
            document.getElementById("ai-insights") ||
            document.getElementById("aiInsights") ||
            document.getElementById("ai-insight");

        const existing =
            document.getElementById(
                "bizpilotFinalHealthCard"
            );

        const score =
            Number(
                window.bizPilotHealthScore
            ) || 0;

        const strongest =
            window.bizPilotStrongestArea ||
            "Business activity";

        const weakest =
            window.bizPilotWeakestArea ||
            "Business activity";

        if (!reports && !aiSection) {
            return;
        }

        const parent =
            aiSection || reports;

        let card = existing;

        if (!card) {

            card =
                document.createElement("div");

            card.id =
                "bizpilotFinalHealthCard";

            card.style.marginTop =
                "18px";

            parent.appendChild(card);
        }

        let label =
            "Building data";

        if (score >= 80) {
            label = "Strong";
        } else if (score >= 60) {
            label = "Healthy";
        } else if (score >= 40) {
            label = "Needs attention";
        }

        let explanation =
            "BizPilot needs more business activity to build a reliable picture of your business.";

        if (score >= 80) {

            explanation =
                "Your recorded business activity is strong. Focus on protecting what is working and improving your weakest area.";

        } else if (score >= 60) {

            explanation =
                "Your business has a healthy foundation, but there are still opportunities to improve.";

        } else if (score >= 40) {

            explanation =
                "Your business is developing. Consistent activity and better records can improve your score.";

        }

        card.innerHTML = `

            <div style="
                background:#ffffff;
                border:1px solid #e7ebf0;
                border-radius:18px;
                padding:22px;
                box-shadow:0 7px 24px rgba(17,17,17,.045);
            ">

                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:20px;
                    flex-wrap:wrap;
                    margin-bottom:18px;
                ">

                    <div>

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1.4px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:6px;
                        ">
                            BUSINESS HEALTH SCORE
                        </div>

                        <h3 style="
                            margin:0 0 6px 0;
                            font-size:20px;
                            font-weight:800;
                            color:#111;
                        ">
                            ${score}/100
                        </h3>

                        <p style="
                            margin:0;
                            font-size:13px;
                            line-height:1.6;
                            color:#666b73;
                        ">
                            ${bpEscape(explanation)}
                        </p>

                    </div>

                    <div style="
                        min-width:90px;
                        padding:10px 13px;
                        border-radius:12px;
                        background:#f7fbff;
                        border:1px solid #e2f0ff;
                        text-align:center;
                    ">

                        <div style="
                            font-size:8px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#7b8490;
                            margin-bottom:4px;
                        ">
                            STATUS
                        </div>

                        <strong style="
                            font-size:13px;
                            color:#0396FF;
                        ">
                            ${label}
                        </strong>

                    </div>

                </div>


                <div style="
                    width:100%;
                    height:8px;
                    background:#edf1f5;
                    border-radius:999px;
                    overflow:hidden;
                    margin-bottom:20px;
                ">

                    <div style="
                        width:${score}%;
                        height:100%;
                        background:#0396FF;
                        border-radius:999px;
                        transition:width .8s ease;
                    "></div>

                </div>


                <div style="
                    display:grid;
                    grid-template-columns:1fr 1fr 1.4fr;
                    gap:12px;
                ">

                    <div style="
                        padding:15px;
                        border-radius:13px;
                        background:#f7fbff;
                        border:1px solid #e2f0ff;
                    ">

                        <div style="
                            font-size:8px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:7px;
                        ">
                            What's going well
                        </div>

                        <strong style="
                            font-size:14px;
                            color:#111;
                        ">
                            ${bpEscape(strongest)}
                        </strong>

                    </div>


                    <div style="
                        padding:15px;
                        border-radius:13px;
                        background:#fafafa;
                        border:1px solid #edf0f3;
                    ">

                        <div style="
                            font-size:8px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#777;
                            margin-bottom:7px;
                        ">
                            Needs attention
                        </div>

                        <strong style="
                            font-size:14px;
                            color:#111;
                        ">
                            ${bpEscape(weakest)}
                        </strong>

                    </div>


                    <div style="
                        padding:15px;
                        border-radius:13px;
                        background:#fafafa;
                        border:1px solid #edf0f3;
                    ">

                        <div style="
                            font-size:8px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#777;
                            margin-bottom:7px;
                        ">
                            Score meaning
                        </div>

                        <span style="
                            font-size:12px;
                            line-height:1.55;
                            color:#666;
                        ">
                            The score is based on recorded sales,
                            profitability, inventory and customers.
                        </span>

                    </div>

                </div>

            </div>
        `;

        const innerGrid =
            card.querySelector(
                "[style*='grid-template-columns:1fr 1fr 1.4fr']"
            );

        if (innerGrid) {

            if (window.innerWidth <= 700) {

                innerGrid.style.gridTemplateColumns =
                    "1fr 1fr";

            }

            if (window.innerWidth <= 480) {

                innerGrid.style.gridTemplateColumns =
                    "1fr";

            }
        }
    }


    /* =====================================================
       AI BUSINESS ADVISOR
       ===================================================== */

    function finalAIAdvisor() {

        try {

            const sales = bpSales();
            const expenses = bpExpenses();
            const inventory = bpInventory();
            const customers = bpCustomers();

            const totalSales =
                sales.reduce(
                    (sum, sale) =>
                        sum + bpAmount(sale.amount),
                    0
                );

            const totalExpenses =
                expenses.reduce(
                    (sum, expense) =>
                        sum + bpAmount(expense.amount),
                    0
                );

            const profit =
                totalSales - totalExpenses;

            const lowStock =
                inventory.filter(function (item) {

                    const stock =
                        Number(item.stock) || 0;

                    const minimum =
                        Number(
                            item.minimum ??
                            item.low_stock_level ??
                            5
                        );

                    return stock <= minimum;
                });

            let nextAction =
                "Keep recording your sales, expenses, inventory and customers so BizPilot can build stronger insights.";

            if (sales.length === 0) {

                nextAction =
                    "Start by recording your first sale. Your sales activity is the foundation for stronger BizPilot insights.";

            } else if (
                lowStock.length > 0
            ) {

                nextAction =
                    "Review your low-stock products and restock the items most likely to affect upcoming sales.";

            } else if (
                totalExpenses > totalSales &&
                totalExpenses > 0
            ) {

                nextAction =
                    "Review your expenses and identify the largest costs that can be reduced without affecting operations.";

            } else if (
                customers.length === 0
            ) {

                nextAction =
                    "Start recording customers and connecting them to sales so BizPilot can identify customer opportunities.";

            } else if (
                profit > 0
            ) {

                nextAction =
                    "Protect your current profit by monitoring your strongest products, expenses and repeat customers.";

            }

            const next =
                document.getElementById(
                    "aiNextActionText"
                );

            if (next) {
                next.textContent =
                    nextAction;
            }

            const revenue =
                document.getElementById(
                    "aiRevenueSignalText"
                );

            if (revenue) {

                revenue.textContent =
                    totalSales > 0
                        ? "Revenue currently recorded: " +
                          bpMoney(totalSales)
                        : "Start recording sales to create a revenue signal.";
            }

            const profitSignal =
                document.getElementById(
                    "aiProfitSignalText"
                );

            if (profitSignal) {

                profitSignal.textContent =
                    totalSales > 0
                        ? "Estimated profit: " +
                          bpMoney(profit)
                        : "Profit will appear once sales and expenses are recorded.";
            }

            const healthText =
                document.getElementById(
                    "businessHealthText"
                );

            if (healthText) {

                const score =
                    Number(
                        window.bizPilotHealthScore
                    ) || 0;

                healthText.textContent =
                    score >= 80
                        ? "Your recorded business activity is strong. Focus on protecting what is working."
                        : score >= 60
                            ? "Your business has a healthy foundation, with opportunities to improve."
                            : score >= 40
                                ? "Your business is developing. Consistent records can improve your visibility."
                                : "Add more business activity so BizPilot can build a clearer picture.";
            }

        } catch (error) {

            console.error(
                "Final AI advisor error:",
                error
            );
        }
    }


    /* =====================================================
       SALES TREND INTELLIGENCE
       ===================================================== */

    function finalSalesTrend() {

        try {

            const sales =
                bpSales();

            const activity = {};

            sales.forEach(function (sale) {

                const rawDate =
                    bpDate(sale);

                if (!rawDate) return;

                const date =
                    new Date(rawDate);

                if (Number.isNaN(date.getTime())) {
                    return;
                }

                const key =
                    date.toISOString().slice(0, 10);

                activity[key] =
                    (activity[key] || 0) +
                    bpAmount(sale.amount);
            });

            const dates =
                Object.keys(activity)
                    .sort()
                    .slice(-7);

            const title =
                document.getElementById(
                    "salesInsightTitle"
                );

            const text =
                document.getElementById(
                    "salesInsightText"
                );

            if (!title || !text) {
                return;
            }

            if (dates.length < 2) {

                title.textContent =
                    "Sales activity";

                text.textContent =
                    "Record more dated sales to unlock a clearer sales trend.";

                return;
            }

            const values =
                dates.map(function (date) {
                    return activity[date];
                });

            const first =
                values[0];

            const last =
                values[values.length - 1];

            if (last > first) {

                title.textContent =
                    "Sales are trending upward";

                text.textContent =
                    "Your most recent recorded sales activity is higher than the beginning of the current trend.";

            } else if (last < first) {

                title.textContent =
                    "Sales need attention";

                text.textContent =
                    "Your recent recorded sales activity is below the beginning of the current trend. Review your strongest products and customers.";

            } else {

                title.textContent =
                    "Sales are relatively stable";

                text.textContent =
                    "Your recent recorded sales activity is holding around a similar level.";

            }

        } catch (error) {

            console.error(
                "Sales trend intelligence error:",
                error
            );
        }
    }


    /* =====================================================
       PRODUCT INTELLIGENCE
       ===================================================== */

    function finalProductIntelligence() {

        try {

            const sales =
                bpSales();

            const inventory =
                bpInventory();

            const products = {};

            sales.forEach(function (sale) {

                const name =
                    bpProductName(sale);

                if (!name) return;

                const key =
                    name.toLowerCase();

                if (!products[key]) {

                    products[key] = {
                        name:name,
                        revenue:0,
                        sales:0
                    };
                }

                products[key].revenue +=
                    bpAmount(sale.amount);

                products[key].sales += 1;
            });

            const sorted =
                Object.values(products)
                    .sort(function (a, b) {
                        return b.revenue - a.revenue;
                    });

            const top =
                sorted[0];

            const lowStock =
                inventory.filter(function (item) {

                    const stock =
                        Number(item.stock) || 0;

                    const minimum =
                        Number(
                            item.minimum ??
                            item.low_stock_level ??
                            5
                        );

                    return stock <= minimum;
                });

            const title =
                document.getElementById(
                    "inventoryInsightTitle"
                );

            const text =
                document.getElementById(
                    "inventoryInsightText"
                );

            if (!title || !text) {
                return;
            }

            if (lowStock.length > 0) {

                title.textContent =
                    "Inventory needs attention";

                text.textContent =
                    lowStock.length +
                    " product" +
                    (
                        lowStock.length === 1
                            ? ""
                            : "s"
                    ) +
                    " " +
                    (
                        lowStock.length === 1
                            ? "is"
                            : "are"
                    ) +
                    " at or below the current low-stock level.";

            } else if (top) {

                title.textContent =
                    "Top product signal";

                text.textContent =
                    bpEscape(top.name) +
                    " currently has the highest recorded sales revenue.";

            } else {

                title.textContent =
                    "Inventory intelligence";

                text.textContent =
                    "Record sales and inventory products to unlock product-level insights.";

            }

        } catch (error) {

            console.error(
                "Product intelligence error:",
                error
            );
        }
    }


    /* =====================================================
       CUSTOMER INTELLIGENCE
       ===================================================== */

    function finalCustomerIntelligence() {

        try {

            const sales =
                bpSales();

            const customers =
                bpCustomers();

            const activity = {};

            let linkedRevenue = 0;
            let linkedSales = 0;

            sales.forEach(function (sale) {

                const name =
                    bpCustomerName(sale);

                if (!name) return;

                const key =
                    name.toLowerCase();

                if (!activity[key]) {

                    activity[key] = {
                        name:name,
                        revenue:0,
                        sales:0
                    };
                }

                activity[key].revenue +=
                    bpAmount(sale.amount);

                activity[key].sales += 1;

                linkedRevenue +=
                    bpAmount(sale.amount);

                linkedSales += 1;
            });

            const top =
                Object.values(activity)
                    .sort(function (a, b) {
                        return b.revenue - a.revenue;
                    })[0];

            const title =
                document.getElementById(
                    "customerInsightTitle"
                );

            const text =
                document.getElementById(
                    "customerInsightText"
                );

            if (!title || !text) {
                return;
            }

            if (customers.length === 0) {

                title.textContent =
                    "Build your customer base";

                text.textContent =
                    "Start recording customers and connecting them to sales.";

            } else if (
                linkedSales === 0
            ) {

                title.textContent =
                    "Connect customers to sales";

                text.textContent =
                    "You have customers recorded, but no sales are currently linked to them.";

            } else if (top) {

                title.textContent =
                    "Strongest customer signal";

                text.textContent =
                    bpEscape(top.name) +
                    " currently has the highest recorded customer revenue.";

            }

        } catch (error) {

            console.error(
                "Customer intelligence error:",
                error
            );
        }
    }


    /* =====================================================
       REPORTS INTELLIGENCE
       ===================================================== */

    function finalReportsIntelligence() {

        try {

            const reports =
                document.getElementById(
                    "reports"
                );

            if (!reports) return;

            const sales =
                bpSales();

            const expenses =
                bpExpenses();

            const inventory =
                bpInventory();

            const customers =
                bpCustomers();

            const totalSales =
                sales.reduce(
                    (sum, sale) =>
                        sum + bpAmount(sale.amount),
                    0
                );

            const totalExpenses =
                expenses.reduce(
                    (sum, expense) =>
                        sum + bpAmount(expense.amount),
                    0
                );

            const profit =
                totalSales - totalExpenses;

            const margin =
                totalSales > 0
                    ? (profit / totalSales) * 100
                    : 0;

            const lowStock =
                inventory.filter(function (item) {

                    const stock =
                        Number(item.stock) || 0;

                    const minimum =
                        Number(
                            item.minimum ??
                            item.low_stock_level ??
                            5
                        );

                    return stock <= minimum;
                });

            let card =
                document.getElementById(
                    "bizpilotFinalReportsSummary"
                );

            if (!card) {

                card =
                    document.createElement("div");

                card.id =
                    "bizpilotFinalReportsSummary";

                card.style.marginTop =
                    "18px";

                reports.appendChild(card);
            }

            let nextMove =
                "Keep recording business activity to strengthen your reports.";

            if (lowStock.length > 0) {

                nextMove =
                    "Review your low-stock products before they affect sales.";

            } else if (
                margin < 10 &&
                totalSales > 0
            ) {

                nextMove =
                    "Review your largest expenses and protect your profit margin.";

            } else if (
                customers.length === 0
            ) {

                nextMove =
                    "Start recording customers so BizPilot can measure customer performance.";

            } else if (
                profit > 0
            ) {

                nextMove =
                    "Continue monitoring the products and customers contributing most to revenue.";

            }

            card.innerHTML = `

                <div style="
                    background:#111111;
                    color:#ffffff;
                    border-radius:18px;
                    padding:22px;
                    box-shadow:0 8px 28px rgba(17,17,17,.10);
                ">

                    <div style="
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1.4px;
                        text-transform:uppercase;
                        color:#0396FF;
                        margin-bottom:7px;
                    ">
                        FINAL BUSINESS SNAPSHOT
                    </div>

                    <h3 style="
                        margin:0 0 18px 0;
                        font-size:19px;
                        font-weight:800;
                    ">
                        Where your business stands
                    </h3>

                    <div style="
                        display:grid;
                        grid-template-columns:
                            repeat(4,minmax(0,1fr));
                        gap:10px;
                    ">

                        <div style="
                            padding:15px;
                            border-radius:13px;
                            background:#1a1a1a;
                        ">

                            <small style="
                                display:block;
                                color:#8f8f8f;
                                font-size:8px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                margin-bottom:6px;
                            ">
                                Revenue
                            </small>

                            <strong style="
                                font-size:17px;
                            ">
                                ${bpMoney(totalSales)}
                            </strong>

                        </div>


                        <div style="
                            padding:15px;
                            border-radius:13px;
                            background:#1a1a1a;
                        ">

                            <small style="
                                display:block;
                                color:#8f8f8f;
                                font-size:8px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                margin-bottom:6px;
                            ">
                                Expenses
                            </small>

                            <strong style="
                                font-size:17px;
                            ">
                                ${bpMoney(totalExpenses)}
                            </strong>

                        </div>


                        <div style="
                            padding:15px;
                            border-radius:13px;
                            background:#1a1a1a;
                        ">

                            <small style="
                                display:block;
                                color:#8f8f8f;
                                font-size:8px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                margin-bottom:6px;
                            ">
                                Profit
                            </small>

                            <strong style="
                                font-size:17px;
                                color:${profit >= 0 ? "#ffffff" : "#ff7777"};
                            ">
                                ${bpMoney(profit)}
                            </strong>

                        </div>


                        <div style="
                            padding:15px;
                            border-radius:13px;
                            background:#1a1a1a;
                        ">

                            <small style="
                                display:block;
                                color:#8f8f8f;
                                font-size:8px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                margin-bottom:6px;
                            ">
                                Margin
                            </small>

                            <strong style="
                                font-size:17px;
                            ">
                                ${margin.toFixed(1)}%
                            </strong>

                        </div>

                    </div>


                    <div style="
                        margin-top:14px;
                        padding:15px;
                        border-radius:13px;
                        background:#ffffff;
                        color:#111111;
                    ">

                        <div style="
                            font-size:8px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:6px;
                        ">
                            RECOMMENDED NEXT MOVE
                        </div>

                        <div style="
                            font-size:13px;
                            line-height:1.6;
                            color:#555;
                        ">
                            ${bpEscape(nextMove)}
                        </div>

                    </div>

                </div>
            `;

            const grid =
                card.querySelector(
                    "[style*='repeat(4,minmax(0,1fr))']"
                );

            if (grid) {

                if (window.innerWidth <= 700) {
                    grid.style.gridTemplateColumns =
                        "repeat(2,minmax(0,1fr))";
                }

                if (window.innerWidth <= 480) {
                    grid.style.gridTemplateColumns =
                        "1fr";
                }
            }

        } catch (error) {

            console.error(
                "Final reports intelligence error:",
                error
            );
        }
    }


    /* =====================================================
       EXPENSE BREAKDOWN
       ===================================================== */

    function finalExpenseBreakdown() {

        try {

            const expenses =
                bpExpenses();

            const reports =
                document.getElementById(
                    "reports"
                );

            if (!reports) return;

            const groups = {};

            expenses.forEach(function (expense) {

                const category =
                    (
                        expense.category ||
                        expense.description ||
                        "Other"
                    )
                    .toString()
                    .trim() ||
                    "Other";

                groups[category] =
                    (groups[category] || 0) +
                    bpAmount(expense.amount);
            });

            const rows =
                Object.entries(groups)
                    .sort(function (a, b) {
                        return b[1] - a[1];
                    })
                    .slice(0, 5);

            let card =
                document.getElementById(
                    "bizpilotFinalExpenseBreakdown"
                );

            if (!card) {

                card =
                    document.createElement("div");

                card.id =
                    "bizpilotFinalExpenseBreakdown";

                card.style.marginTop =
                    "18px";

                reports.appendChild(card);
            }

            const total =
                expenses.reduce(
                    (sum, expense) =>
                        sum + bpAmount(expense.amount),
                    0
                );

            if (!rows.length) {

                card.innerHTML = `
                    <div style="
                        background:#ffffff;
                        border:1px solid #e7ebf0;
                        border-radius:18px;
                        padding:22px;
                    ">

                        <div style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1.3px;
                            color:#0396FF;
                        ">
                            EXPENSE BREAKDOWN
                        </div>

                        <h3 style="
                            margin:7px 0;
                            font-size:18px;
                        ">
                            No expense data yet
                        </h3>

                        <p style="
                            margin:0;
                            color:#666;
                            font-size:13px;
                            line-height:1.6;
                        ">
                            Record expenses to see where your money is going.
                        </p>

                    </div>
                `;

                return;
            }

            card.innerHTML = `

                <div style="
                    background:#ffffff;
                    border:1px solid #e7ebf0;
                    border-radius:18px;
                    padding:22px;
                    box-shadow:0 7px 24px rgba(17,17,17,.045);
                ">

                    <div style="
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1.3px;
                        color:#0396FF;
                        margin-bottom:6px;
                    ">
                        EXPENSE BREAKDOWN
                    </div>

                    <h3 style="
                        margin:0 0 5px;
                        font-size:19px;
                    ">
                        Where your expenses are going
                    </h3>

                    <p style="
                        margin:0 0 18px;
                        font-size:12px;
                        line-height:1.6;
                        color:#666;
                    ">
                        Total recorded expenses:
                        <strong>
                            ${bpMoney(total)}
                        </strong>
                    </p>

                    <div>

                        ${rows.map(function (row) {

                            const percentage =
                                total > 0
                                    ? (row[1] / total) * 100
                                    : 0;

                            return `

                                <div style="
                                    margin-bottom:15px;
                                ">

                                    <div style="
                                        display:flex;
                                        justify-content:space-between;
                                        gap:15px;
                                        margin-bottom:6px;
                                    ">

                                        <strong style="
                                            font-size:12px;
                                            color:#111;
                                        ">
                                            ${bpEscape(row[0])}
                                        </strong>

                                        <span style="
                                            font-size:11px;
                                            color:#777;
                                        ">
                                            ${bpMoney(row[1])}
                                        </span>

                                    </div>

                                    <div style="
                                        width:100%;
                                        height:6px;
                                        background:#edf1f5;
                                        border-radius:999px;
                                        overflow:hidden;
                                    ">

                                        <div style="
                                            width:${percentage}%;
                                            height:100%;
                                            background:#0396FF;
                                            border-radius:999px;
                                        "></div>

                                    </div>

                                </div>
                            `;

                        }).join("")}

                    </div>

                </div>
            `;

        } catch (error) {

            console.error(
                "Final expense breakdown error:",
                error
            );
        }
    }


    /* =====================================================
       CUSTOMER PERFORMANCE
       ===================================================== */

    function finalCustomerPerformance() {

        try {

            const reports =
                document.getElementById(
                    "reports"
                );

            if (!reports) return;

            const sales =
                bpSales();

            const customers =
                bpCustomers();

            const activity = {};

            sales.forEach(function (sale) {

                const name =
                    bpCustomerName(sale);

                if (!name) return;

                const key =
                    name.toLowerCase();

                if (!activity[key]) {

                    activity[key] = {
                        name:name,
                        revenue:0,
                        sales:0
                    };
                }

                activity[key].revenue +=
                    bpAmount(sale.amount);

                activity[key].sales += 1;
            });

            const active =
                Object.values(activity)
                    .sort(function (a, b) {
                        return b.revenue - a.revenue;
                    });

            const top =
                active[0];

            let card =
                document.getElementById(
                    "bizpilotFinalCustomerPerformance"
                );

            if (!card) {

                card =
                    document.createElement("div");

                card.id =
                    "bizpilotFinalCustomerPerformance";

                card.style.marginTop =
                    "18px";

                reports.appendChild(card);
            }

            let opportunity =
                "Start connecting customers to sales to unlock customer performance insights.";

            if (
                customers.length > 0 &&
                active.length === 0
            ) {

                opportunity =
                    "You have customers recorded, but no sales are currently connected to them.";

            } else if (
                top &&
                active.length === 1
            ) {

                opportunity =
                    "Focus on retaining your active customer while continuing to build your customer base.";

            } else if (
                top &&
                active.length > 1
            ) {

                opportunity =
                    "Focus on repeat purchases from your strongest customers while continuing to grow the wider customer base.";

            }

            card.innerHTML = `

                <div style="
                    background:#ffffff;
                    border:1px solid #e7ebf0;
                    border-radius:18px;
                    padding:22px;
                    box-shadow:0 7px 24px rgba(17,17,17,.045);
                ">

                    <div style="
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1.3px;
                        color:#0396FF;
                        margin-bottom:6px;
                    ">
                        CUSTOMER PERFORMANCE
                    </div>

                    <h3 style="
                        margin:0 0 18px;
                        font-size:19px;
                    ">
                        Customer activity
                    </h3>

                    <div style="
                        display:grid;
                        grid-template-columns:
                            repeat(4,minmax(0,1fr));
                        gap:10px;
                    ">

                        <div style="
                            padding:15px;
                            background:#fafafa;
                            border-radius:13px;
                        ">
                            <small style="
                                display:block;
                                font-size:8px;
                                font-weight:800;
                                color:#777;
                                margin-bottom:6px;
                            ">
                                CUSTOMERS
                            </small>
                            <strong style="
                                font-size:22px;
                            ">
                                ${customers.length}
                            </strong>
                        </div>

                        <div style="
                            padding:15px;
                            background:#f7fbff;
                            border-radius:13px;
                        ">
                            <small style="
                                display:block;
                                font-size:8px;
                                font-weight:800;
                                color:#777;
                                margin-bottom:6px;
                            ">
                                ACTIVE
                            </small>
                            <strong style="
                                font-size:22px;
                                color:#0396FF;
                            ">
                                ${active.length}
                            </strong>
                        </div>

                        <div style="
                            padding:15px;
                            background:#fafafa;
                            border-radius:13px;
                        ">
                            <small style="
                                display:block;
                                font-size:8px;
                                font-weight:800;
                                color:#777;
                                margin-bottom:6px;
                            ">
                                LINKED SALES
                            </small>
                            <strong style="
                                font-size:22px;
                            ">
                                ${active.reduce(
                                    (sum, item) =>
                                        sum + item.sales,
                                    0
                                )}
                            </strong>
                        </div>

                        <div style="
                            padding:15px;
                            background:#fafafa;
                            border-radius:13px;
                        ">
                            <small style="
                                display:block;
                                font-size:8px;
                                font-weight:800;
                                color:#777;
                                margin-bottom:6px;
                            ">
                                CUSTOMER REVENUE
                            </small>
                            <strong style="
                                font-size:17px;
                            ">
                                ${bpMoney(
                                    active.reduce(
                                        (sum, item) =>
                                            sum + item.revenue,
                                        0
                                    )
                                )}
                            </strong>
                        </div>

                    </div>


                    <div style="
                        margin-top:14px;
                        padding:16px;
                        border-radius:13px;
                        background:#f7fbff;
                        border:1px solid #e2f0ff;
                    ">

                        <div style="
                            font-size:8px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:6px;
                        ">
                            TOP CUSTOMER
                        </div>

                        <strong style="
                            font-size:15px;
                            color:#111;
                        ">
                            ${
                                top
                                    ? bpEscape(top.name)
                                    : "No customer activity yet"
                            }
                        </strong>

                        ${
                            top
                                ? `
                                    <div style="
                                        margin-top:4px;
                                        font-size:12px;
                                        color:#666;
                                    ">
                                        ${bpMoney(top.revenue)}
                                        across
                                        ${top.sales}
                                        recorded sale${
                                            top.sales === 1
                                                ? ""
                                                : "s"
                                        }.
                                    </div>
                                  `
                                : ""
                        }

                    </div>


                    <div style="
                        margin-top:14px;
                        padding:16px;
                        border-radius:13px;
                        background:#111;
                        color:#fff;
                    ">

                        <div style="
                            font-size:8px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#0396FF;
                            margin-bottom:6px;
                        ">
                            CUSTOMER OPPORTUNITY
                        </div>

                        <div style="
                            font-size:12px;
                            line-height:1.6;
                            color:#d0d0d0;
                        ">
                            ${bpEscape(opportunity)}
                        </div>

                    </div>

                </div>
            `;

            const grid =
                card.querySelector(
                    "[style*='repeat(4,minmax(0,1fr))']"
                );

            if (grid) {

                if (window.innerWidth <= 700) {
                    grid.style.gridTemplateColumns =
                        "repeat(2,minmax(0,1fr))";
                }

                if (window.innerWidth <= 480) {
                    grid.style.gridTemplateColumns =
                        "1fr 1fr";
                }
            }

        } catch (error) {

            console.error(
                "Final customer performance error:",
                error
            );
        }
    }


    /* =====================================================
       FINAL REFRESH ENGINE
       ===================================================== */

    let refreshTimer = null;

    function finalBizPilotRefresh() {

        clearTimeout(refreshTimer);

        refreshTimer =
            setTimeout(function () {

                try {
                    finalHealthScore();
                } catch (error) {
                    console.error(
                        "Health refresh error:",
                        error
                    );
                }

                try {
                    finalAIAdvisor();
                } catch (error) {
                    console.error(
                        "AI refresh error:",
                        error
                    );
                }

                try {
                    finalSalesTrend();
                } catch (error) {
                    console.error(
                        "Sales trend refresh error:",
                        error
                    );
                }

                try {
                    finalProductIntelligence();
                } catch (error) {
                    console.error(
                        "Product refresh error:",
                        error
                    );
                }

                try {
                    finalCustomerIntelligence();
                } catch (error) {
                    console.error(
                        "Customer intelligence refresh error:",
                        error
                    );
                }

                try {
                    finalReportsIntelligence();
                } catch (error) {
                    console.error(
                        "Reports refresh error:",
                        error
                    );
                }

                try {
                    finalExpenseBreakdown();
                } catch (error) {
                    console.error(
                        "Expense breakdown refresh error:",
                        error
                    );
                }

                try {
                    finalCustomerPerformance();
                } catch (error) {
                    console.error(
                        "Customer performance refresh error:",
                        error
                    );
                }

                try {

                    if (
                        typeof updateAIBusinessAdvisor ===
                        "function"
                    ) {
                        updateAIBusinessAdvisor();
                    }

                } catch (error) {
                    console.error(
                        "Existing AI advisor error:",
                        error
                    );
                }

                try {

                    if (
                        typeof updateHealthScoreExplanation ===
                        "function"
                    ) {
                        updateHealthScoreExplanation();
                    }

                } catch (error) {
                    console.error(
                        "Health explanation error:",
                        error
                    );
                }

                try {

                    if (
                        typeof updateHealthScoreMeter ===
                        "function"
                    ) {
                        updateHealthScoreMeter();
                    }

                } catch (error) {
                    console.error(
                        "Health meter error:",
                        error
                    );
                }

            }, 250);
    }


    /* =====================================================
       DATA UPDATE LISTENER
       ===================================================== */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            finalBizPilotRefresh();

        }
    );


    /* =====================================================
       WINDOW RESIZE
       ===================================================== */

    window.addEventListener(
        "resize",
        function () {

            clearTimeout(
                window.bizPilotResizeTimer
            );

            window.bizPilotResizeTimer =
                setTimeout(function () {

                    try {
                        updateFinalHealthCard();
                    } catch (error) {
                        console.error(
                            "Health resize error:",
                            error
                        );
                    }

                    try {
                        finalReportsIntelligence();
                    } catch (error) {
                        console.error(
                            "Reports resize error:",
                            error
                        );
                    }

                    try {
                        finalCustomerPerformance();
                    } catch (error) {
                        console.error(
                            "Customer resize error:",
                            error
                        );
                    }

                }, 200);
        }
    );


    /* =====================================================
       PUBLIC FINAL REFRESH FUNCTION
       ===================================================== */

    window.refreshBizPilotFinal =
        finalBizPilotRefresh;


    /* =====================================================
       INITIAL STARTUP
       ===================================================== */

    function startFinalBizPilotLayer() {

        setTimeout(
            finalBizPilotRefresh,
            1200
        );

        setTimeout(
            finalBizPilotRefresh,
            2500
        );

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            startFinalBizPilotLayer,
            {
                once:true
            }
        );

    } else {

        startFinalBizPilotLayer();

    }


    /* =====================================================
       FINAL SAFETY HANDLER
       Prevents one intelligence module from breaking
       the rest of BizPilot.
       ===================================================== */

    window.addEventListener(
        "error",
        function (event) {

            if (
                event &&
                event.error
            ) {

                console.error(
                    "BizPilot runtime error:",
                    event.error
                );
            }

        }
    );


    console.log(
        "BizPilot final application layer loaded successfully."
    );

})();
/* =========================================================
   BIZPILOT — ADD INVOICE BUTTON FIX
   ========================================================= */

(function () {

    function connectAddInvoiceButton() {

        const buttons = document.querySelectorAll(
            "#addInvoice, #addInvoiceBtn, [data-action='add-invoice']"
        );

        if (!buttons.length) {
            console.warn("BizPilot: Add Invoice button not found.");
            return;
        }

        buttons.forEach(function (button) {

            if (button.dataset.bizpilotInvoiceConnected === "true") {
                return;
            }

            button.dataset.bizpilotInvoiceConnected = "true";

            button.addEventListener("click", function (event) {

                event.preventDefault();
                event.stopPropagation();

                /* Try the existing BizPilot modal system first */
                if (typeof openModal === "function") {
                    try {
                        openModal("invoiceModal");
                        return;
                    } catch (error) {
                        console.warn(
                            "BizPilot invoice modal could not open:",
                            error
                        );
                    }
                }

                /* Try directly finding the invoice modal */
                const modal =
                    document.getElementById("invoiceModal") ||
                    document.querySelector(".invoice-modal");

                if (modal) {

                    modal.style.display = "flex";
                    modal.classList.add("active");

                    return;
                }

                /* If no modal exists, tell us clearly in Console */
                console.error(
                    "BizPilot: Add Invoice was clicked, but no invoice modal was found."
                );

            });

        });

        console.log(
            "BizPilot: Add Invoice button connected successfully."
        );
    }

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            connectAddInvoiceButton,
            { once: true }
        );

    } else {

        connectAddInvoiceButton();

    }

    setTimeout(
        connectAddInvoiceButton,
        1000
    );

})();
/* =========================================================
   BIZPILOT — COMPLETE INVOICE FUNCTION
   Adds a working invoice creator + invoice storage
   ========================================================= */

(function () {

    "use strict";

    /* -----------------------------------------------------
       MAKE SURE INVOICES ARRAY EXISTS
       ----------------------------------------------------- */

    if (!Array.isArray(appData.invoices)) {
        appData.invoices = [];
    }


    /* -----------------------------------------------------
       SAFE MONEY
       ----------------------------------------------------- */

    function invoiceMoney(value) {

        const amount = Number(value) || 0;

        return "KSh " + amount.toLocaleString();

    }


    /* -----------------------------------------------------
       SAFE HTML
       ----------------------------------------------------- */

    function invoiceEscape(value) {

        if (typeof escapeHTML === "function") {
            return escapeHTML(String(value ?? ""));
        }

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* -----------------------------------------------------
       OPEN INVOICE MODAL
       ----------------------------------------------------- */

    function openBizPilotInvoiceModal() {

        if (typeof openModal !== "function") {

            console.error(
                "BizPilot: openModal() is not available."
            );

            return;

        }


        const today =
            new Date()
                .toISOString()
                .slice(0, 10);


        const invoiceNumber =
            "INV-" +
            Date.now()
                .toString()
                .slice(-6);


        openModal(`

            <div style="
                width:100%;
                max-width:620px;
            ">

                <div style="
                    margin-bottom:22px;
                ">

                    <div style="
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1.4px;
                        text-transform:uppercase;
                        color:#0396FF;
                        margin-bottom:7px;
                    ">
                        CREATE INVOICE
                    </div>

                    <h2 style="
                        margin:0 0 6px;
                        font-size:23px;
                        color:#111;
                    ">
                        New Invoice
                    </h2>

                    <p style="
                        margin:0;
                        font-size:12px;
                        line-height:1.6;
                        color:#777;
                    ">
                        Create a simple invoice and save it to BizPilot.
                    </p>

                </div>


                <form id="bizpilotInvoiceForm">


                    <!-- INVOICE NUMBER -->

                    <div class="form-group">

                        <label>
                            Invoice number
                        </label>

                        <input
                            type="text"
                            id="bizpilotInvoiceNumber"
                            value="${invoiceNumber}"
                            required
                        >

                    </div>


                    <!-- DATE -->

                    <div class="form-group">

                        <label>
                            Invoice date
                        </label>

                        <input
                            type="date"
                            id="bizpilotInvoiceDate"
                            value="${today}"
                            required
                        >

                    </div>


                    <!-- CUSTOMER -->

                    <div class="form-group">

                        <label>
                            Customer name
                        </label>

                        <input
                            type="text"
                            id="bizpilotInvoiceCustomer"
                            placeholder="e.g. Brian Mwangi"
                            required
                        >

                    </div>


                    <!-- PHONE -->

                    <div class="form-group">

                        <label>
                            Customer phone
                        </label>

                        <input
                            type="tel"
                            id="bizpilotInvoicePhone"
                            placeholder="e.g. 0712345678"
                        >

                    </div>


                    <!-- ITEM -->

                    <div class="form-group">

                        <label>
                            Item / service
                        </label>

                        <input
                            type="text"
                            id="bizpilotInvoiceItem"
                            placeholder="e.g. Graphic Design Package"
                            required
                        >

                    </div>


                    <!-- QUANTITY -->

                    <div class="form-group">

                        <label>
                            Quantity
                        </label>

                        <input
                            type="number"
                            id="bizpilotInvoiceQuantity"
                            value="1"
                            min="1"
                            step="1"
                            required
                        >

                    </div>


                    <!-- PRICE -->

                    <div class="form-group">

                        <label>
                            Unit price
                        </label>

                        <input
                            type="number"
                            id="bizpilotInvoicePrice"
                            placeholder="e.g. 5000"
                            min="0"
                            step="0.01"
                            required
                        >

                    </div>


                    <!-- NOTES -->

                    <div class="form-group">

                        <label>
                            Notes
                        </label>

                        <textarea
                            id="bizpilotInvoiceNotes"
                            placeholder="Optional notes for the customer..."
                            style="
                                min-height:90px;
                            "
                        ></textarea>

                    </div>


                    <!-- TOTAL PREVIEW -->

                    <div
                        id="bizpilotInvoiceTotalPreview"
                        style="
                            margin:18px 0;
                            padding:18px;
                            border-radius:14px;
                            background:#f7fbff;
                            border:1px solid #e2f0ff;
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:15px;
                        "
                    >

                        <span style="
                            font-size:10px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#7b8490;
                        ">
                            TOTAL
                        </span>

                        <strong
                            id="bizpilotInvoiceTotal"
                            style="
                                font-size:22px;
                                color:#0396FF;
                            "
                        >
                            KSh 0
                        </strong>

                    </div>


                    <!-- ACTIONS -->

                    <div style="
                        display:grid;
                        grid-template-columns:1fr 1fr;
                        gap:10px;
                        margin-top:18px;
                    ">

                        <button
                            type="button"
                            class="secondary-btn"
                            id="bizpilotInvoiceCancel"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            class="primary-btn"
                            id="bizpilotInvoiceSave"
                        >
                            Save Invoice
                        </button>

                    </div>


                </form>

            </div>

        `);


        /* -------------------------------------------------
           FORM ELEMENTS
           ------------------------------------------------- */

        const form =
            document.getElementById(
                "bizpilotInvoiceForm"
            );

        const quantity =
            document.getElementById(
                "bizpilotInvoiceQuantity"
            );

        const price =
            document.getElementById(
                "bizpilotInvoicePrice"
            );

        const total =
            document.getElementById(
                "bizpilotInvoiceTotal"
            );

        const cancel =
            document.getElementById(
                "bizpilotInvoiceCancel"
            );


        /* -------------------------------------------------
           UPDATE TOTAL
           ------------------------------------------------- */

        function updateInvoiceTotal() {

            const qty =
                Number(
                    quantity?.value
                ) || 0;

            const unitPrice =
                Number(
                    price?.value
                ) || 0;

            const amount =
                qty * unitPrice;

            if (total) {

                total.textContent =
                    invoiceMoney(amount);

            }

        }


        if (quantity) {

            quantity.addEventListener(
                "input",
                updateInvoiceTotal
            );

        }


        if (price) {

            price.addEventListener(
                "input",
                updateInvoiceTotal
            );

        }


        /* -------------------------------------------------
           CANCEL
           ------------------------------------------------- */

        if (cancel) {

            cancel.addEventListener(
                "click",
                function () {

                    closeModal();

                }
            );

        }


        /* -------------------------------------------------
           SAVE INVOICE
           ------------------------------------------------- */

        if (form) {

            form.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();


                    const number =
                        document
                            .getElementById(
                                "bizpilotInvoiceNumber"
                            )
                            ?.value
                            .trim();


                    const date =
                        document
                            .getElementById(
                                "bizpilotInvoiceDate"
                            )
                            ?.value;


                    const customer =
                        document
                            .getElementById(
                                "bizpilotInvoiceCustomer"
                            )
                            ?.value
                            .trim();


                    const phone =
                        document
                            .getElementById(
                                "bizpilotInvoicePhone"
                            )
                            ?.value
                            .trim();


                    const item =
                        document
                            .getElementById(
                                "bizpilotInvoiceItem"
                            )
                            ?.value
                            .trim();


                    const qty =
                        Number(
                            document
                                .getElementById(
                                    "bizpilotInvoiceQuantity"
                                )
                                ?.value
                        );


                    const unitPrice =
                        Number(
                            document
                                .getElementById(
                                    "bizpilotInvoicePrice"
                                )
                                ?.value
                        );


                    const notes =
                        document
                            .getElementById(
                                "bizpilotInvoiceNotes"
                            )
                            ?.value
                            .trim();


                    if (!number) {

                        showToast(
                            "Please enter an invoice number."
                        );

                        return;

                    }


                    if (!date) {

                        showToast(
                            "Please select an invoice date."
                        );

                        return;

                    }


                    if (!customer) {

                        showToast(
                            "Please enter the customer name."
                        );

                        return;

                    }


                    if (!item) {

                        showToast(
                            "Please enter the item or service."
                        );

                        return;

                    }


                    if (
                        !Number.isFinite(qty) ||
                        qty <= 0
                    ) {

                        showToast(
                            "Please enter a valid quantity."
                        );

                        return;

                    }


                    if (
                        !Number.isFinite(unitPrice) ||
                        unitPrice < 0
                    ) {

                        showToast(
                            "Please enter a valid price."
                        );

                        return;

                    }


                    const amount =
                        qty * unitPrice;


                    const invoice = {

                        id: Date.now(),

                        invoiceNumber: number,

                        date: date,

                        customer: customer,

                        phone: phone,

                        item: item,

                        quantity: qty,

                        unitPrice: unitPrice,

                        amount: amount,

                        notes: notes,

                        status: "Unpaid",

                        createdAt:
                            new Date().toISOString()

                    };


                    /* -------------------------------------
                       SAVE TO BIZPILOT DATA
                       ------------------------------------- */

                    if (
                        !Array.isArray(
                            appData.invoices
                        )
                    ) {

                        appData.invoices = [];

                    }


                    appData.invoices.push(
                        invoice
                    );


                    /* -------------------------------------
                       SAVE LOCAL DATA
                       ------------------------------------- */

                    if (
                        typeof saveData ===
                        "function"
                    ) {

                        saveData();

                    } else {

                        localStorage.setItem(
                            STORAGE_KEY,
                            JSON.stringify(appData)
                        );

                    }


                    /* -------------------------------------
                       REFRESH APP
                       ------------------------------------- */

                    if (
                        typeof refreshApp ===
                        "function"
                    ) {

                        refreshApp();

                    }


                    /* -------------------------------------
                       CLOSE
                       ------------------------------------- */

                    closeModal();


                    /* -------------------------------------
                       SUCCESS
                       ------------------------------------- */

                    if (
                        typeof showToast ===
                        "function"
                    ) {

                        showToast(
                            "Invoice created successfully."
                        );

                    }


                    /* -------------------------------------
                       UPDATE INVOICE DISPLAY
                       ------------------------------------- */

                    renderBizPilotInvoices();


                    /* -------------------------------------
                       CLOUD EVENT
                       ------------------------------------- */

                    document.dispatchEvent(
                        new Event(
                            "bizpilot:data-updated"
                        )
                    );

                }
            );

        }


        updateInvoiceTotal();

    }


    /* =====================================================
       RENDER INVOICES
       ===================================================== */

    function renderBizPilotInvoices() {

        const invoices =
            Array.isArray(
                appData.invoices
            )
                ? appData.invoices
                : [];


        /*
         * Look for an existing invoice container.
         * If the existing page uses a different ID,
         * we create our own clean container.
         */

        let container =
            document.getElementById(
                "bizpilotInvoiceList"
            );


        if (!container) {

            const invoiceSection =
                document.getElementById(
                    "invoices"
                );


            if (!invoiceSection) {
                return;
            }


            container =
                document.createElement(
                    "div"
                );

            container.id =
                "bizpilotInvoiceList";

            container.style.marginTop =
                "20px";


            invoiceSection.appendChild(
                container
            );

        }


        if (!invoices.length) {

            container.innerHTML = `

                <div style="
                    background:#ffffff;
                    border:1px solid #e7ebf0;
                    border-radius:16px;
                    padding:28px;
                    text-align:center;
                ">

                    <div style="
                        font-size:28px;
                        margin-bottom:10px;
                    ">
                        ▣
                    </div>

                    <strong style="
                        display:block;
                        font-size:15px;
                        color:#111;
                        margin-bottom:6px;
                    ">
                        No invoices yet
                    </strong>

                    <p style="
                        margin:0;
                        color:#777;
                        font-size:12px;
                    ">
                        Create your first invoice to start tracking customer billing.
                    </p>

                </div>

            `;

            return;

        }


        container.innerHTML = `

            <div style="
                display:grid;
                gap:12px;
            ">

                ${
                    invoices
                        .slice()
                        .reverse()
                        .map(function (invoice) {

                            const status =
                                invoice.status ||
                                "Unpaid";


                            const statusColor =
                                status === "Paid"
                                    ? "#16803c"
                                    : "#b7791f";


                            return `

                                <div style="
                                    background:#ffffff;
                                    border:1px solid #e7ebf0;
                                    border-radius:15px;
                                    padding:17px;
                                    box-shadow:0 5px 18px rgba(17,17,17,.035);
                                ">

                                    <div style="
                                        display:flex;
                                        justify-content:space-between;
                                        align-items:flex-start;
                                        gap:15px;
                                        flex-wrap:wrap;
                                    ">

                                        <div>

                                            <div style="
                                                font-size:9px;
                                                font-weight:800;
                                                letter-spacing:1px;
                                                text-transform:uppercase;
                                                color:#0396FF;
                                                margin-bottom:5px;
                                            ">
                                                ${invoiceEscape(
                                                    invoice.invoiceNumber
                                                )}
                                            </div>

                                            <strong style="
                                                display:block;
                                                font-size:15px;
                                                color:#111;
                                                margin-bottom:4px;
                                            ">
                                                ${invoiceEscape(
                                                    invoice.customer
                                                )}
                                            </strong>

                                            <span style="
                                                font-size:11px;
                                                color:#777;
                                            ">
                                                ${invoiceEscape(
                                                    invoice.item
                                                )}
                                            </span>

                                        </div>


                                        <div style="
                                            text-align:right;
                                        ">

                                            <strong style="
                                                display:block;
                                                font-size:17px;
                                                color:#111;
                                                margin-bottom:5px;
                                            ">
                                                ${invoiceMoney(
                                                    invoice.amount
                                                )}
                                            </strong>

                                            <span style="
                                                display:inline-block;
                                                padding:5px 9px;
                                                border-radius:999px;
                                                background:#f7f7f7;
                                                color:${statusColor};
                                                font-size:9px;
                                                font-weight:800;
                                            ">
                                                ${invoiceEscape(
                                                    status
                                                )}
                                            </span>

                                        </div>

                                    </div>


                                    <div style="
                                        margin-top:14px;
                                        padding-top:12px;
                                        border-top:1px solid #f0f2f4;
                                        display:flex;
                                        justify-content:space-between;
                                        gap:10px;
                                        flex-wrap:wrap;
                                        font-size:10px;
                                        color:#888;
                                    ">

                                        <span>
                                            ${invoiceEscape(
                                                invoice.date
                                            )}
                                        </span>

                                        <span>
                                            Qty:
                                            ${invoice.quantity}
                                        </span>

                                    </div>

                                </div>

                            `;

                        })
                        .join("")
                }

            </div>

        `;

    }


    /* =====================================================
       FIND ANY "ADD INVOICE" BUTTON
       ===================================================== */

    function connectInvoiceButtons() {

        const buttons =
            Array.from(
                document.querySelectorAll(
                    "button, a"
                )
            );


        buttons.forEach(
            function (button) {

                const text =
                    (
                        button.textContent ||
                        ""
                    )
                    .trim()
                    .toLowerCase();


                if (
                    !text.includes(
                        "add invoice"
                    )
                ) {
                    return;
                }


                if (
                    button.dataset
                        .bizpilotInvoiceConnected ===
                    "true"
                ) {
                    return;
                }


                button.dataset
                    .bizpilotInvoiceConnected =
                    "true";


                button.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();

                        event.stopPropagation();

                        openBizPilotInvoiceModal();

                    }
                );

            }
        );

    }


    /* =====================================================
       START
       ===================================================== */

    function startInvoiceSystem() {

        connectInvoiceButtons();

        renderBizPilotInvoices();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            startInvoiceSystem,
            {
                once:true
            }
        );

    } else {

        startInvoiceSystem();

    }


    /*
     * Run again because some parts of BizPilot
     * can render dynamically.
     */

    setTimeout(
        connectInvoiceButtons,
        500
    );

    setTimeout(
        connectInvoiceButtons,
        1500
    );


    /* =====================================================
       PUBLIC FUNCTIONS
       ===================================================== */

    window.openBizPilotInvoiceModal =
        openBizPilotInvoiceModal;

    window.renderBizPilotInvoices =
        renderBizPilotInvoices;


    console.log(
        "BizPilot: Invoice system loaded successfully."
    );

})();
/* =========================================================
   BIZPILOT — COMPLETE INVOICE + RECEIPT SYSTEM
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       INITIALIZE INVOICES
       ===================================================== */

    if (!Array.isArray(appData.invoices)) {

        appData.invoices = [];

        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(appData)
            );
        } catch (error) {
            console.error(
                "Could not initialize invoices:",
                error
            );
        }

    }


    /* =====================================================
       HELPERS
       ===================================================== */

    function invoiceMoney(value) {

        const amount =
            Number(value) || 0;

        return new Intl.NumberFormat(
            "en-KE",
            {
                style: "currency",
                currency: "KES",
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        ).format(amount);

    }


    function invoiceDate(date) {

        if (!date) return "-";

        const parsed =
            new Date(date);

        if (isNaN(parsed.getTime())) {
            return String(date);
        }

        return parsed.toLocaleDateString(
            "en-KE",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );

    }


    function generateInvoiceNumber() {

        const year =
            new Date().getFullYear();

        const existing =
            appData.invoices.length + 1;

        return (
            "INV-" +
            year +
            "-" +
            String(existing).padStart(4, "0")
        );

    }


    function getBusinessName() {

        return (
            appData.business?.name ||
            "Your Business"
        );

    }


    function getBusinessEmail() {

        return (
            appData.business?.email ||
            ""
        );

    }


    function getBusinessPhone() {

        return (
            appData.business?.phone ||
            ""
        );

    }


    function safeInvoiceText(value) {

        if (
            typeof escapeHTML ===
            "function"
        ) {

            return escapeHTML(
                value || ""
            );

        }

        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    /* =====================================================
       OPEN INVOICE MODAL
       ===================================================== */

    function openInvoiceModal() {

        const todayDate =
            typeof today === "function"
                ? today()
                : new Date()
                    .toISOString()
                    .slice(0, 10);


        const customers =
            Array.isArray(appData.customers)
                ? appData.customers
                : [];


        const customerOptions =
            customers.length
                ? customers
                    .map(
                        customer => `
                            <option
                                value="${safeInvoiceText(
                                    customer.name
                                )}"
                                data-phone="${safeInvoiceText(
                                    customer.phone || ""
                                )}"
                            >
                                ${safeInvoiceText(
                                    customer.name
                                )}
                            </option>
                        `
                    )
                    .join("")
                : "";


        openModal(`

            <div class="invoice-modal-wrapper">

                <span
                    class="small-label"
                    style="
                        display:block;
                        margin-bottom:7px;
                        color:#0396FF;
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1.4px;
                        text-transform:uppercase;
                    "
                >
                    BIZPILOT INVOICES
                </span>


                <h2
                    style="
                        margin:0 0 7px;
                    "
                >
                    Create Invoice
                </h2>


                <p
                    class="modal-subtitle"
                    style="
                        margin-bottom:22px;
                    "
                >
                    Create a professional invoice
                    for your customer.
                </p>


                <form id="bizpilotInvoiceForm">


                    <!-- INVOICE DETAILS -->

                    <div
                        style="
                            display:grid;
                            grid-template-columns:
                                repeat(2,minmax(0,1fr));
                            gap:12px;
                            margin-bottom:15px;
                        "
                    >

                        <div class="form-group">

                            <label>
                                Invoice number
                            </label>

                            <input
                                type="text"
                                id="invoiceNumber"
                                value="${generateInvoiceNumber()}"
                                readonly
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Invoice date
                            </label>

                            <input
                                type="date"
                                id="invoiceDate"
                                value="${todayDate}"
                                required
                            >

                        </div>

                    </div>


                    <!-- CUSTOMER -->

                    <div
                        class="form-group"
                        style="margin-bottom:15px;"
                    >

                        <label>
                            Customer
                        </label>

                        ${
                            customers.length
                                ? `
                                    <select
                                        id="invoiceCustomer"
                                    >

                                        <option
                                            value=""
                                        >
                                            Select customer
                                        </option>

                                        ${customerOptions}

                                    </select>
                                `
                                : `
                                    <input
                                        type="text"
                                        id="invoiceCustomer"
                                        placeholder="Customer name"
                                        required
                                    >
                                `
                        }

                    </div>


                    <div
                        class="form-group"
                        style="margin-bottom:15px;"
                    >

                        <label>
                            Customer phone
                        </label>

                        <input
                            type="tel"
                            id="invoiceCustomerPhone"
                            placeholder="e.g. 0712345678"
                        >

                    </div>


                    <!-- ITEM -->

                    <div
                        style="
                            padding:16px;
                            border:1px solid #edf0f3;
                            border-radius:14px;
                            background:#fafbfc;
                            margin-bottom:16px;
                        "
                    >

                        <div
                            style="
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1px;
                                text-transform:uppercase;
                                color:#7b8490;
                                margin-bottom:12px;
                            "
                        >
                            Invoice item
                        </div>


                        <div
                            class="form-group"
                            style="margin-bottom:12px;"
                        >

                            <label>
                                Item or service
                            </label>

                            <input
                                type="text"
                                id="invoiceItem"
                                placeholder="e.g. Graphic Design"
                                required
                            >

                        </div>


                        <div
                            style="
                                display:grid;
                                grid-template-columns:
                                    1fr 1fr;
                                gap:12px;
                            "
                        >

                            <div class="form-group">

                                <label>
                                    Quantity
                                </label>

                                <input
                                    type="number"
                                    id="invoiceQuantity"
                                    value="1"
                                    min="1"
                                    step="1"
                                    required
                                >

                            </div>


                            <div class="form-group">

                                <label>
                                    Unit price
                                </label>

                                <input
                                    type="number"
                                    id="invoiceUnitPrice"
                                    placeholder="e.g. 2500"
                                    min="0"
                                    step="0.01"
                                    required
                                >

                            </div>

                        </div>


                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                align-items:center;
                                margin-top:13px;
                                padding-top:13px;
                                border-top:
                                    1px solid #e7ebf0;
                            "
                        >

                            <span
                                style="
                                    font-size:11px;
                                    color:#777;
                                "
                            >
                                Total
                            </span>


                            <strong
                                id="invoiceLiveTotal"
                                style="
                                    font-size:20px;
                                    color:#111;
                                "
                            >
                                KSh 0
                            </strong>

                        </div>

                    </div>


                    <!-- NOTES -->

                    <div
                        class="form-group"
                        style="margin-bottom:15px;"
                    >

                        <label>
                            Notes
                        </label>

                        <textarea
                            id="invoiceNotes"
                            rows="3"
                            placeholder="Optional note for the customer"
                            style="
                                width:100%;
                                resize:vertical;
                            "
                        ></textarea>

                    </div>


                    <!-- STATUS -->

                    <div
                        class="form-group"
                        style="margin-bottom:18px;"
                    >

                        <label>
                            Payment status
                        </label>

                        <select
                            id="invoiceStatus"
                        >

                            <option value="Pending">
                                Pending
                            </option>

                            <option value="Paid">
                                Paid
                            </option>

                        </select>

                    </div>


                    <button
                        type="submit"
                        class="form-submit"
                        id="saveInvoiceBtn"
                    >
                        Create Invoice
                    </button>


                </form>

            </div>

        `);


        /* =================================================
           LIVE TOTAL
           ================================================= */

        const quantityInput =
            document.getElementById(
                "invoiceQuantity"
            );

        const priceInput =
            document.getElementById(
                "invoiceUnitPrice"
            );

        const totalElement =
            document.getElementById(
                "invoiceLiveTotal"
            );


        function updateLiveTotal() {

            const quantity =
                Number(
                    quantityInput?.value
                ) || 0;

            const price =
                Number(
                    priceInput?.value
                ) || 0;

            const total =
                quantity * price;


            if (totalElement) {

                totalElement.textContent =
                    invoiceMoney(total);

            }

        }


        if (quantityInput) {

            quantityInput.addEventListener(
                "input",
                updateLiveTotal
            );

        }


        if (priceInput) {

            priceInput.addEventListener(
                "input",
                updateLiveTotal
            );

        }


        /* =================================================
           CUSTOMER PHONE AUTO-FILL
           ================================================= */

        const customerSelect =
            document.getElementById(
                "invoiceCustomer"
            );

        const phoneInput =
            document.getElementById(
                "invoiceCustomerPhone"
            );


        if (
            customerSelect &&
            customerSelect.tagName === "SELECT"
        ) {

            customerSelect.addEventListener(
                "change",
                function () {

                    const option =
                        customerSelect
                            .options[
                                customerSelect
                                    .selectedIndex
                            ];

                    if (
                        option &&
                        phoneInput
                    ) {

                        phoneInput.value =
                            option.dataset.phone ||
                            "";

                    }

                }
            );

        }


        /* =================================================
           FORM SUBMIT
           ================================================= */

        const form =
            document.getElementById(
                "bizpilotInvoiceForm"
            );


        if (!form) return;


        form.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                const invoiceNumber =
                    document.getElementById(
                        "invoiceNumber"
                    )?.value.trim();


                const date =
                    document.getElementById(
                        "invoiceDate"
                    )?.value;


                const customer =
                    document.getElementById(
                        "invoiceCustomer"
                    )?.value.trim();


                const customerPhone =
                    document.getElementById(
                        "invoiceCustomerPhone"
                    )?.value.trim();


                const item =
                    document.getElementById(
                        "invoiceItem"
                    )?.value.trim();


                const quantity =
                    Number(
                        document.getElementById(
                            "invoiceQuantity"
                        )?.value
                    );


                const unitPrice =
                    Number(
                        document.getElementById(
                            "invoiceUnitPrice"
                        )?.value
                    );


                const notes =
                    document.getElementById(
                        "invoiceNotes"
                    )?.value.trim();


                const status =
                    document.getElementById(
                        "invoiceStatus"
                    )?.value ||
                    "Pending";


                if (!customer) {

                    showToast(
                        "Please enter the customer name."
                    );

                    return;

                }


                if (!item) {

                    showToast(
                        "Please enter an item or service."
                    );

                    return;

                }


                if (
                    !Number.isFinite(quantity) ||
                    quantity <= 0
                ) {

                    showToast(
                        "Please enter a valid quantity."
                    );

                    return;

                }


                if (
                    !Number.isFinite(unitPrice) ||
                    unitPrice < 0
                ) {

                    showToast(
                        "Please enter a valid unit price."
                    );

                    return;

                }


                const total =
                    quantity * unitPrice;


                const invoice = {

                    id:
                        "invoice_" +
                        Date.now() +
                        "_" +
                        Math.random()
                            .toString(36)
                            .slice(2, 8),

                    invoiceNumber,

                    date,

                    customer,

                    customerPhone,

                    item,

                    quantity,

                    unitPrice,

                    total,

                    notes,

                    status,

                    createdAt:
                        new Date().toISOString()

                };


                appData.invoices.push(
                    invoice
                );


                saveData();


                closeModal();


                refreshInvoiceSystem();


                if (
                    typeof refreshApp ===
                    "function"
                ) {

                    refreshApp();

                }


                showToast(
                    "Invoice created successfully."
                );

            }
        );

    }


    /* =====================================================
       RENDER INVOICES
       ===================================================== */

    function renderInvoices() {

        const page =
            document.getElementById(
                "invoices"
            );


        if (!page) return;


        /*
           Find an existing invoice container.
           If the old placeholder is still present,
           replace it safely.
        */

        let container =
            document.getElementById(
                "bizpilotInvoiceSystem"
            );


        if (!container) {

            container =
                document.createElement("div");

            container.id =
                "bizpilotInvoiceSystem";


            /*
               Insert near the top of the
               invoices page.
            */

            const firstContent =
                page.querySelector(
                    ".page-content, .content, .section-content"
                );


            if (firstContent) {

                firstContent.prepend(
                    container
                );

            } else {

                page.appendChild(
                    container
                );

            }

        }


        const invoices =
            Array.isArray(
                appData.invoices
            )
                ? appData.invoices
                : [];


        const totalInvoices =
            invoices.length;


        const paidInvoices =
            invoices.filter(
                invoice =>
                    invoice.status === "Paid"
            );


        const pendingInvoices =
            invoices.filter(
                invoice =>
                    invoice.status !== "Paid"
            );


        const totalValue =
            invoices.reduce(
                (sum, invoice) =>
                    sum +
                    Number(
                        invoice.total || 0
                    ),
                0
            );


        const paidValue =
            paidInvoices.reduce(
                (sum, invoice) =>
                    sum +
                    Number(
                        invoice.total || 0
                    ),
                0
            );


        const pendingValue =
            pendingInvoices.reduce(
                (sum, invoice) =>
                    sum +
                    Number(
                        invoice.total || 0
                    ),
                0
            );


        container.innerHTML = `

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:15px;
                    margin-bottom:18px;
                    flex-wrap:wrap;
                "
            >

                <div>

                    <span
                        style="
                            display:block;
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1.2px;
                            color:#7b8490;
                            text-transform:uppercase;
                            margin-bottom:5px;
                        "
                    >
                        INVOICE CENTER
                    </span>

                    <h3
                        style="
                            margin:0;
                            font-size:20px;
                            color:#111;
                        "
                    >
                        Invoices & Receipts
                    </h3>

                </div>


                <button
                    class="primary-btn"
                    id="bizpilotAddInvoiceBtn"
                    type="button"
                >
                    + Create Invoice
                </button>

            </div>


            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(4,minmax(0,1fr));
                    gap:12px;
                    margin-bottom:18px;
                "
            >

                <div
                    style="
                        padding:16px;
                        background:#fff;
                        border:1px solid #e7ebf0;
                        border-radius:14px;
                    "
                >

                    <small
                        style="
                            display:block;
                            font-size:9px;
                            font-weight:800;
                            color:#7b8490;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            margin-bottom:7px;
                        "
                    >
                        Total invoices
                    </small>

                    <strong
                        style="
                            font-size:22px;
                            color:#111;
                        "
                    >
                        ${totalInvoices}
                    </strong>

                </div>


                <div
                    style="
                        padding:16px;
                        background:#fff;
                        border:1px solid #e7ebf0;
                        border-radius:14px;
                    "
                >

                    <small
                        style="
                            display:block;
                            font-size:9px;
                            font-weight:800;
                            color:#7b8490;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            margin-bottom:7px;
                        "
                    >
                        Total value
                    </small>

                    <strong
                        style="
                            font-size:20px;
                            color:#0396FF;
                        "
                    >
                        ${invoiceMoney(totalValue)}
                    </strong>

                </div>


                <div
                    style="
                        padding:16px;
                        background:#fff;
                        border:1px solid #e7ebf0;
                        border-radius:14px;
                    "
                >

                    <small
                        style="
                            display:block;
                            font-size:9px;
                            font-weight:800;
                            color:#7b8490;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            margin-bottom:7px;
                        "
                    >
                        Paid
                    </small>

                    <strong
                        style="
                            font-size:20px;
                            color:#16803a;
                        "
                    >
                        ${invoiceMoney(paidValue)}
                    </strong>

                </div>


                <div
                    style="
                        padding:16px;
                        background:#fff;
                        border:1px solid #e7ebf0;
                        border-radius:14px;
                    "
                >

                    <small
                        style="
                            display:block;
                            font-size:9px;
                            font-weight:800;
                            color:#7b8490;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            margin-bottom:7px;
                        "
                    >
                        Pending
                    </small>

                    <strong
                        style="
                            font-size:20px;
                            color:#b26a00;
                        "
                    >
                        ${invoiceMoney(pendingValue)}
                    </strong>

                </div>

            </div>


            ${
                !invoices.length
                    ? `

                        <div
                            style="
                                padding:55px 25px;
                                text-align:center;
                                background:#fff;
                                border:1px solid #e7ebf0;
                                border-radius:16px;
                            "
                        >

                            <div
                                style="
                                    font-size:32px;
                                    margin-bottom:12px;
                                "
                            >
                                🧾
                            </div>

                            <h3
                                style="
                                    margin:0 0 7px;
                                    color:#111;
                                "
                            >
                                No invoices yet
                            </h3>

                            <p
                                style="
                                    margin:0 auto 20px;
                                    max-width:420px;
                                    color:#777;
                                    font-size:13px;
                                    line-height:1.6;
                                "
                            >
                                Create your first invoice
                                and start keeping a
                                professional record of
                                customer payments.
                            </p>

                            <button
                                class="primary-btn"
                                id="bizpilotEmptyInvoiceBtn"
                                type="button"
                            >
                                Create Your First Invoice
                            </button>

                        </div>

                    `
                    : `

                        <div
                            style="
                                background:#fff;
                                border:1px solid #e7ebf0;
                                border-radius:16px;
                                overflow:hidden;
                            "
                        >

                            <div
                                style="
                                    padding:18px;
                                    border-bottom:
                                        1px solid #edf0f3;
                                "
                            >

                                <strong
                                    style="
                                        font-size:14px;
                                    "
                                >
                                    Recent invoices
                                </strong>

                            </div>


                            <div
                                style="
                                    overflow-x:auto;
                                "
                            >

                                <table
                                    style="
                                        width:100%;
                                        border-collapse:
                                            collapse;
                                        min-width:760px;
                                    "
                                >

                                    <thead>

                                        <tr>

                                            <th
                                                style="
                                                    text-align:left;
                                                    padding:13px 16px;
                                                    font-size:9px;
                                                    letter-spacing:1px;
                                                    text-transform:uppercase;
                                                    color:#7b8490;
                                                "
                                            >
                                                Invoice
                                            </th>

                                            <th
                                                style="
                                                    text-align:left;
                                                    padding:13px 16px;
                                                    font-size:9px;
                                                    letter-spacing:1px;
                                                    text-transform:uppercase;
                                                    color:#7b8490;
                                                "
                                            >
                                                Customer
                                            </th>

                                            <th
                                                style="
                                                    text-align:left;
                                                    padding:13px 16px;
                                                    font-size:9px;
                                                    letter-spacing:1px;
                                                    text-transform:uppercase;
                                                    color:#7b8490;
                                                "
                                            >
                                                Date
                                            </th>

                                            <th
                                                style="
                                                    text-align:left;
                                                    padding:13px 16px;
                                                    font-size:9px;
                                                    letter-spacing:1px;
                                                    text-transform:uppercase;
                                                    color:#7b8490;
                                                "
                                            >
                                                Amount
                                            </th>

                                            <th
                                                style="
                                                    text-align:left;
                                                    padding:13px 16px;
                                                    font-size:9px;
                                                    letter-spacing:1px;
                                                    text-transform:uppercase;
                                                    color:#7b8490;
                                                "
                                            >
                                                Status
                                            </th>

                                            <th
                                                style="
                                                    text-align:right;
                                                    padding:13px 16px;
                                                    font-size:9px;
                                                    letter-spacing:1px;
                                                    text-transform:uppercase;
                                                    color:#7b8490;
                                                "
                                            >
                                                Actions
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        ${
                                            invoices
                                                .slice()
                                                .reverse()
                                                .map(
                                                    invoice => {

                                                        const statusColor =
                                                            invoice.status ===
                                                            "Paid"
                                                                ? "#16803a"
                                                                : "#b26a00";


                                                        const statusBg =
                                                            invoice.status ===
                                                            "Paid"
                                                                ? "#eefaf2"
                                                                : "#fff7e8";


                                                        return `

                                                            <tr
                                                                style="
                                                                    border-top:
                                                                        1px solid
                                                                        #f0f2f5;
                                                                "
                                                            >

                                                                <td
                                                                    style="
                                                                        padding:
                                                                            15px 16px;
                                                                        font-weight:
                                                                            750;
                                                                        color:
                                                                            #111;
                                                                    "
                                                                >
                                                                    ${safeInvoiceText(
                                                                        invoice.invoiceNumber
                                                                    )}
                                                                </td>


                                                                <td
                                                                    style="
                                                                        padding:
                                                                            15px 16px;
                                                                    "
                                                                >
                                                                    ${safeInvoiceText(
                                                                        invoice.customer
                                                                    )}
                                                                </td>


                                                                <td
                                                                    style="
                                                                        padding:
                                                                            15px 16px;
                                                                        color:
                                                                            #666;
                                                                    "
                                                                >
                                                                    ${invoiceDate(
                                                                        invoice.date
                                                                    )}
                                                                </td>


                                                                <td
                                                                    style="
                                                                        padding:
                                                                            15px 16px;
                                                                        font-weight:
                                                                            750;
                                                                    "
                                                                >
                                                                    ${invoiceMoney(
                                                                        invoice.total
                                                                    )}
                                                                </td>


                                                                <td
                                                                    style="
                                                                        padding:
                                                                            15px 16px;
                                                                    "
                                                                >

                                                                    <span
                                                                        style="
                                                                            display:inline-block;
                                                                            padding:
                                                                                5px 9px;
                                                                            border-radius:
                                                                                999px;
                                                                            background:
                                                                                ${statusBg};
                                                                            color:
                                                                                ${statusColor};
                                                                            font-size:
                                                                                9px;
                                                                            font-weight:
                                                                                800;
                                                                        "
                                                                    >
                                                                        ${safeInvoiceText(
                                                                            invoice.status ||
                                                                            "Pending"
                                                                        )}
                                                                    </span>

                                                                </td>


                                                                <td
                                                                    style="
                                                                        padding:
                                                                            15px 16px;
                                                                            text-align:right;
                                                                        "
                                                                >

                                                                    <div
                                                                        style="
                                                                            display:flex;
                                                                            justify-content:flex-end;
                                                                            gap:6px;
                                                                            flex-wrap:wrap;
                                                                        "
                                                                    >

                                                                        <button
                                                                            type="button"
                                                                            class="secondary-btn"
                                                                            data-invoice-view="${invoice.id}"
                                                                        >
                                                                            View
                                                                        </button>


                                                                        <button
                                                                            type="button"
                                                                            class="secondary-btn"
                                                                            data-invoice-print="${invoice.id}"
                                                                        >
                                                                            Print
                                                                        </button>


                                                                        <button
                                                                            type="button"
                                                                            class="secondary-btn"
                                                                            data-receipt-print="${invoice.id}"
                                                                        >
                                                                            Receipt
                                                                        </button>


                                                                        ${
                                                                            invoice.status !==
                                                                            "Paid"
                                                                                ? `
                                                                                    <button
                                                                                        type="button"
                                                                                        class="secondary-btn"
                                                                                        data-invoice-paid="${invoice.id}"
                                                                                    >
                                                                                        Mark paid
                                                                                    </button>
                                                                                `
                                                                                : ""
                                                                        }


                                                                        <button
                                                                            type="button"
                                                                            class="secondary-btn"
                                                                            data-invoice-delete="${invoice.id}"
                                                                        >
                                                                            Delete
                                                                        </button>

                                                                    </div>

                                                                </td>

                                                            </tr>

                                                        `;

                                                    }
                                                )
                                                .join("")
                                        }

                                    </tbody>

                                </table>

                            </div>

                        </div>

                    `
            }

        `;


        /* =================================================
           BUTTONS
           ================================================= */

        const addButton =
            document.getElementById(
                "bizpilotAddInvoiceBtn"
            );


        const emptyButton =
            document.getElementById(
                "bizpilotEmptyInvoiceBtn"
            );


        if (addButton) {

            addButton.addEventListener(
                "click",
                openInvoiceModal
            );

        }


        if (emptyButton) {

            emptyButton.addEventListener(
                "click",
                openInvoiceModal
            );

        }


        /* =================================================
           VIEW
           ================================================= */

        container
            .querySelectorAll(
                "[data-invoice-view]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            const invoice =
                                appData.invoices.find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            button.dataset
                                                .invoiceView
                                        )
                                );


                            if (invoice) {

                                openInvoicePreview(
                                    invoice,
                                    false
                                );

                            }

                        }
                    );

                }
            );


        /* =================================================
           PRINT INVOICE
           ================================================= */

        container
            .querySelectorAll(
                "[data-invoice-print]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            const invoice =
                                appData.invoices.find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            button.dataset
                                                .invoicePrint
                                        )
                                );


                            if (invoice) {

                                printInvoice(
                                    invoice
                                );

                            }

                        }
                    );

                }
            );


        /* =================================================
           PRINT RECEIPT
           ================================================= */

        container
            .querySelectorAll(
                "[data-receipt-print]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            const invoice =
                                appData.invoices.find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            button.dataset
                                                .receiptPrint
                                        )
                                );


                            if (invoice) {

                                printReceipt(
                                    invoice
                                );

                            }

                        }
                    );

                }
            );


        /* =================================================
           MARK PAID
           ================================================= */

        container
            .querySelectorAll(
                "[data-invoice-paid]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            const invoice =
                                appData.invoices.find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            button.dataset
                                                .invoicePaid
                                        )
                                );


                            if (!invoice) {
                                return;
                            }


                            invoice.status =
                                "Paid";


                            invoice.paidAt =
                                new Date()
                                    .toISOString();


                            saveData();


                            refreshInvoiceSystem();


                            if (
                                typeof refreshApp ===
                                "function"
                            ) {

                                refreshApp();

                            }


                            showToast(
                                "Invoice marked as paid."
                            );

                        }
                    );

                }
            );


        /* =================================================
           DELETE
           ================================================= */

        container
            .querySelectorAll(
                "[data-invoice-delete]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            const invoice =
                                appData.invoices.find(
                                    item =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            button.dataset
                                                .invoiceDelete
                                        )
                                );


                            if (!invoice) {
                                return;
                            }


                            const confirmed =
                                confirm(
                                    "Delete invoice " +
                                    invoice.invoiceNumber +
                                    "? This cannot be undone."
                                );


                            if (!confirmed) {
                                return;
                            }


                            appData.invoices =
                                appData.invoices.filter(
                                    item =>
                                        String(
                                            item.id
                                        ) !==
                                        String(
                                            invoice.id
                                        )
                                );


                            saveData();


                            refreshInvoiceSystem();


                            if (
                                typeof refreshApp ===
                                "function"
                            ) {

                                refreshApp();

                            }


                            showToast(
                                "Invoice deleted."
                            );

                        }
                    );

                }
            );

    }


    /* =====================================================
       INVOICE PREVIEW
       ===================================================== */

    function openInvoicePreview(
        invoice,
        receiptMode
    ) {

        const title =
            receiptMode
                ? "Receipt"
                : "Invoice";


        const status =
            invoice.status ||
            "Pending";


        openModal(`

            <div
                style="
                    background:#fff;
                    max-width:720px;
                    margin:0 auto;
                "
            >

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        gap:20px;
                        align-items:flex-start;
                        margin-bottom:25px;
                        padding-bottom:18px;
                        border-bottom:
                            1px solid #edf0f3;
                    "
                >

                    <div>

                        <div
                            style="
                                font-size:24px;
                                font-weight:850;
                                color:#111;
                                letter-spacing:-.5px;
                            "
                        >
                            ${safeInvoiceText(
                                getBusinessName()
                            )}
                        </div>

                        ${
                            getBusinessPhone()
                                ? `
                                    <div
                                        style="
                                            margin-top:5px;
                                            color:#777;
                                            font-size:11px;
                                        "
                                    >
                                        ${safeInvoiceText(
                                            getBusinessPhone()
                                        )}
                                    </div>
                                `
                                : ""
                        }

                        ${
                            getBusinessEmail()
                                ? `
                                    <div
                                        style="
                                            margin-top:2px;
                                            color:#777;
                                            font-size:11px;
                                        "
                                    >
                                        ${safeInvoiceText(
                                            getBusinessEmail()
                                        )}
                                    </div>
                                `
                                : ""
                        }

                    </div>


                    <div
                        style="
                            text-align:right;
                        "
                    >

                        <div
                            style="
                                font-size:10px;
                                font-weight:800;
                                letter-spacing:1.4px;
                                color:#0396FF;
                                text-transform:uppercase;
                                margin-bottom:6px;
                            "
                        >
                            ${title}
                        </div>

                        <strong
                            style="
                                font-size:18px;
                            "
                        >
                            ${safeInvoiceText(
                                invoice.invoiceNumber
                            )}
                        </strong>

                        <div
                            style="
                                margin-top:5px;
                                color:#777;
                                font-size:11px;
                            "
                        >
                            ${invoiceDate(
                                invoice.date
                            )}
                        </div>

                    </div>

                </div>


                <div
                    style="
                        margin-bottom:22px;
                    "
                >

                    <div
                        style="
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#7b8490;
                            margin-bottom:6px;
                        "
                    >
                        Bill to
                    </div>

                    <strong
                        style="
                            font-size:15px;
                        "
                    >
                        ${safeInvoiceText(
                            invoice.customer
                        )}
                    </strong>

                    ${
                        invoice.customerPhone
                            ? `
                                <div
                                    style="
                                        margin-top:4px;
                                        font-size:11px;
                                        color:#777;
                                    "
                                >
                                    ${safeInvoiceText(
                                        invoice.customerPhone
                                    )}
                                </div>
                            `
                            : ""
                    }

                </div>


                <div
                    style="
                        border:1px solid #e7ebf0;
                        border-radius:14px;
                        overflow:hidden;
                        margin-bottom:18px;
                    "
                >

                    <div
                        style="
                            display:grid;
                            grid-template-columns:
                                2fr .6fr 1fr 1fr;
                            background:#f8fafc;
                            padding:12px 14px;
                            gap:10px;
                        "
                    >

                        <strong
                            style="
                                font-size:9px;
                                text-transform:uppercase;
                                letter-spacing:1px;
                                color:#7b8490;
                            "
                        >
                            Item
                        </strong>

                        <strong
                            style="
                                font-size:9px;
                                text-transform:uppercase;
                                letter-spacing:1px;
                                color:#7b8490;
                            "
                        >
                            Qty
                        </strong>

                        <strong
                            style="
                                font-size:9px;
                                text-transform:uppercase;
                                letter-spacing:1px;
                                color:#7b8490;
                            "
                        >
                            Price
                        </strong>

                        <strong
                            style="
                                font-size:9px;
                                text-transform:uppercase;
                                letter-spacing:1px;
                                color:#7b8490;
                            "
                        >
                            Total
                        </strong>

                    </div>


                    <div
                        style="
                            display:grid;
                            grid-template-columns:
                                2fr .6fr 1fr 1fr;
                            padding:16px 14px;
                            gap:10px;
                        "
                    >

                        <span>
                            ${safeInvoiceText(
                                invoice.item
                            )}
                        </span>

                        <span>
                            ${Number(
                                invoice.quantity
                            ) || 0}
                        </span>

                        <span>
                            ${invoiceMoney(
                                invoice.unitPrice
                            )}
                        </span>

                        <strong>
                            ${invoiceMoney(
                                invoice.total
                            )}
                        </strong>

                    </div>

                </div>


                <div
                    style="
                        display:flex;
                        justify-content:flex-end;
                        margin-bottom:20px;
                    "
                >

                    <div
                        style="
                            min-width:220px;
                            text-align:right;
                        "
                    >

                        <div
                            style="
                                display:flex;
                                justify-content:space-between;
                                gap:30px;
                                padding:12px 0;
                                border-bottom:
                                    1px solid #edf0f3;
                            "
                        >

                            <span
                                style="
                                    color:#777;
                                "
                            >
                                Total
                            </span>

                            <strong
                                style="
                                    font-size:21px;
                                "
                            >
                                ${invoiceMoney(
                                    invoice.total
                                )}
                            </strong>

                        </div>


                        <div
                            style="
                                margin-top:10px;
                            "
                        >

                            <span
                                style="
                                    display:inline-block;
                                    padding:6px 10px;
                                    border-radius:999px;
                                    background:
                                        ${
                                            status ===
                                            "Paid"
                                                ? "#eefaf2"
                                                : "#fff7e8"
                                        };
                                    color:
                                        ${
                                            status ===
                                            "Paid"
                                                ? "#16803a"
                                                : "#b26a00"
                                        };
                                    font-size:9px;
                                    font-weight:800;
                                "
                            >
                                ${safeInvoiceText(
                                    status
                                )}
                            </span>

                        </div>

                    </div>

                </div>


                ${
                    invoice.notes
                        ? `
                            <div
                                style="
                                    padding:14px;
                                    background:#fafbfc;
                                    border-radius:12px;
                                    margin-bottom:20px;
                                "
                            >

                                <div
                                    style="
                                        font-size:9px;
                                        font-weight:800;
                                        letter-spacing:1px;
                                        text-transform:uppercase;
                                        color:#7b8490;
                                        margin-bottom:6px;
                                    "
                                >
                                    Notes
                                </div>

                                <div
                                    style="
                                        font-size:12px;
                                        line-height:1.6;
                                        color:#666;
                                    "
                                >
                                    ${safeInvoiceText(
                                        invoice.notes
                                    )}
                                </div>

                            </div>
                        `
                        : ""
                }


                <div
                    style="
                        display:grid;
                        grid-template-columns:
                            repeat(2,minmax(0,1fr));
                        gap:10px;
                    "
                >

                    <button
                        type="button"
                        class="secondary-btn"
                        id="invoicePreviewClose"
                    >
                        Close
                    </button>


                    <button
                        type="button"
                        class="primary-btn"
                        id="invoicePreviewPrint"
                    >
                        Print ${title}
                    </button>

                </div>

            </div>

        `);


        const closeButton =
            document.getElementById(
                "invoicePreviewClose"
            );


        const printButton =
            document.getElementById(
                "invoicePreviewPrint"
            );


        if (closeButton) {

            closeButton.addEventListener(
                "click",
                closeModal
            );

        }


        if (printButton) {

            printButton.addEventListener(
                "click",
                function () {

                    if (receiptMode) {

                        printReceipt(
                            invoice
                        );

                    } else {

                        printInvoice(
                            invoice
                        );

                    }

                }
            );

        }

    }


    /* =====================================================
       PRINT DOCUMENT
       ===================================================== */

    function createPrintDocument(
        invoice,
        receiptMode
    ) {

        const title =
            receiptMode
                ? "Receipt"
                : "Invoice";


        const businessName =
            getBusinessName();


        return `

            <!DOCTYPE html>

            <html>

            <head>

                <meta
                    charset="UTF-8"
                >

                <title>
                    ${safeInvoiceText(
                        title
                    )}
                    -
                    ${safeInvoiceText(
                        invoice.invoiceNumber
                    )}
                </title>


                <style>

                    * {
                        box-sizing:border-box;
                    }


                    body {
                        margin:0;
                        padding:35px;
                        font-family:
                            Arial,
                            Helvetica,
                            sans-serif;
                        color:#111;
                        background:#fff;
                    }


                    .document {
                        max-width:800px;
                        margin:0 auto;
                    }


                    .top {
                        display:flex;
                        justify-content:
                            space-between;
                        gap:30px;
                        padding-bottom:20px;
                        margin-bottom:25px;
                        border-bottom:
                            2px solid #111;
                    }


                    .business {
                        font-size:26px;
                        font-weight:800;
                    }


                    .business-meta {
                        margin-top:7px;
                        font-size:11px;
                        color:#666;
                        line-height:1.6;
                    }


                    .document-title {
                        text-align:right;
                    }


                    .document-title h1 {
                        margin:0;
                        font-size:28px;
                        letter-spacing:1px;
                    }


                    .document-number {
                        margin-top:7px;
                        font-size:12px;
                        color:#666;
                    }


                    .customer {
                        margin-bottom:25px;
                    }


                    .label {
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1.2px;
                        text-transform:uppercase;
                        color:#777;
                        margin-bottom:7px;
                    }


                    .customer-name {
                        font-size:16px;
                        font-weight:700;
                    }


                    .customer-phone {
                        margin-top:4px;
                        font-size:11px;
                        color:#666;
                    }


                    table {
                        width:100%;
                        border-collapse:
                            collapse;
                        margin-top:15px;
                    }


                    th {
                        text-align:left;
                        padding:12px;
                        background:#f5f6f8;
                        font-size:10px;
                        text-transform:
                            uppercase;
                        letter-spacing:1px;
                    }


                    td {
                        padding:14px 12px;
                        border-bottom:
                            1px solid #e8ebef;
                        font-size:12px;
                    }


                    .right {
                        text-align:right;
                    }


                    .summary {
                        margin-top:25px;
                        margin-left:auto;
                        width:280px;
                    }


                    .summary-row {
                        display:flex;
                        justify-content:
                            space-between;
                        padding:10px 0;
                    }


                    .total {
                        border-top:
                            2px solid #111;
                        font-size:18px;
                        font-weight:800;
                        padding-top:13px;
                    }


                    .status {
                        display:inline-block;
                        margin-top:10px;
                        padding:6px 10px;
                        border-radius:999px;
                        background:#f2f4f6;
                        font-size:10px;
                        font-weight:800;
                    }


                    .notes {
                        margin-top:35px;
                        padding:15px;
                        background:#f7f8fa;
                        border-radius:8px;
                        font-size:11px;
                        line-height:1.6;
                    }


                    .footer {
                        margin-top:45px;
                        padding-top:15px;
                        border-top:
                            1px solid #ddd;
                        font-size:10px;
                        color:#888;
                        text-align:center;
                    }


                    @media print {

                        body {
                            padding:0;
                        }

                    }

                </style>

            </head>


            <body>

                <div class="document">


                    <div class="top">

                        <div>

                            <div class="business">
                                ${safeInvoiceText(
                                    businessName
                                )}
                            </div>

                            ${
                                getBusinessPhone()
                                    ? `
                                        <div
                                            class="business-meta"
                                        >
                                            ${safeInvoiceText(
                                                getBusinessPhone()
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                            ${
                                getBusinessEmail()
                                    ? `
                                        <div
                                            class="business-meta"
                                        >
                                            ${safeInvoiceText(
                                                getBusinessEmail()
                                            )}
                                        </div>
                                    `
                                    : ""
                            }

                        </div>


                        <div
                            class="document-title"
                        >

                            <h1>
                                ${title}
                            </h1>

                            <div
                                class="document-number"
                            >
                                ${safeInvoiceText(
                                    invoice.invoiceNumber
                                )}
                            </div>

                            <div
                                class="document-number"
                            >
                                ${invoiceDate(
                                    invoice.date
                                )}
                            </div>

                        </div>

                    </div>


                    <div class="customer">

                        <div class="label">
                            Bill to
                        </div>

                        <div class="customer-name">
                            ${safeInvoiceText(
                                invoice.customer
                            )}
                        </div>

                        ${
                            invoice.customerPhone
                                ? `
                                    <div
                                        class="customer-phone"
                                    >
                                        ${safeInvoiceText(
                                            invoice.customerPhone
                                        )}
                                    </div>
                                `
                                : ""
                        }

                    </div>


                    <table>

                        <thead>

                            <tr>

                                <th>
                                    Item / Service
                                </th>

                                <th
                                    class="right"
                                >
                                    Qty
                                </th>

                                <th
                                    class="right"
                                >
                                    Unit price
                                </th>

                                <th
                                    class="right"
                                >
                                    Total
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            <tr>

                                <td>
                                    ${safeInvoiceText(
                                        invoice.item
                                    )}
                                </td>

                                <td
                                    class="right"
                                >
                                    ${Number(
                                        invoice.quantity
                                    ) || 0}
                                </td>

                                <td
                                    class="right"
                                >
                                    ${invoiceMoney(
                                        invoice.unitPrice
                                    )}
                                </td>

                                <td
                                    class="right"
                                >
                                    ${invoiceMoney(
                                        invoice.total
                                    )}
                                </td>

                            </tr>

                        </tbody>

                    </table>


                    <div class="summary">

                        <div
                            class="
                                summary-row
                                total
                            "
                        >

                            <span>
                                Total
                            </span>

                            <span>
                                ${invoiceMoney(
                                    invoice.total
                                )}
                            </span>

                        </div>


                        <div
                            style="
                                text-align:right;
                            "
                        >

                            <span class="status">
                                ${safeInvoiceText(
                                    invoice.status ||
                                    "Pending"
                                )}
                            </span>

                        </div>

                    </div>


                    ${
                        invoice.notes
                            ? `
                                <div
                                    class="notes"
                                >

                                    <strong>
                                        Notes
                                    </strong>

                                    <div
                                        style="
                                            margin-top:6px;
                                        "
                                    >
                                        ${safeInvoiceText(
                                            invoice.notes
                                        )}
                                    </div>

                                </div>
                            `
                            : ""
                    }


                    <div class="footer">

                        ${
                            receiptMode
                                ? "Thank you for your payment."
                                : "Thank you for doing business with us."
                        }

                        <br>

                        Generated by BizPilot

                    </div>


                </div>


                <script>

                    window.onload =
                        function () {

                            window.print();

                        };

                <\/script>

            </body>

            </html>

        `;

    }


    /* =====================================================
       PRINT INVOICE
       ===================================================== */

    function printInvoice(invoice) {

        const printWindow =
            window.open(
                "",
                "_blank",
                "width=900,height=750"
            );


        if (!printWindow) {

            showToast(
                "Please allow pop-ups to print the invoice."
            );

            return;

        }


        printWindow.document.open();

        printWindow.document.write(
            createPrintDocument(
                invoice,
                false
            )
        );

        printWindow.document.close();

    }


    /* =====================================================
       PRINT RECEIPT
       ===================================================== */

    function printReceipt(invoice) {

        const printWindow =
            window.open(
                "",
                "_blank",
                "width=900,height=750"
            );


        if (!printWindow) {

            showToast(
                "Please allow pop-ups to print the receipt."
            );

            return;

        }


        printWindow.document.open();

        printWindow.document.write(
            createPrintDocument(
                invoice,
                true
            )
        );

        printWindow.document.close();

    }


    /* =====================================================
       REFRESH
       ===================================================== */

    function refreshInvoiceSystem() {

        renderInvoices();

    }


    window.openInvoiceModal =
        openInvoiceModal;


    window.renderInvoices =
        renderInvoices;


    window.printInvoice =
        printInvoice;


    window.printReceipt =
        printReceipt;


    window.refreshInvoiceSystem =
        refreshInvoiceSystem;


    /* =====================================================
       DATA UPDATE LISTENER
       ===================================================== */

    document.addEventListener(
        "bizpilot:data-updated",
        function () {

            setTimeout(
                refreshInvoiceSystem,
                100
            );

        }
    );


    /* =====================================================
       INITIAL LOAD
       ===================================================== */

    setTimeout(
        refreshInvoiceSystem,
        500
    );


})();
/* =========================================================
   BIZPILOT — INVOICE BUTTON CONNECTION FIX
   Connects the existing Add Invoice button to the
   new Invoice & Receipt system.
   ========================================================= */

(function () {

    function connectInvoiceButton() {

        /*
         * First try common IDs used by the invoice section.
         */
        const possibleButtons = [
            document.getElementById("addInvoiceBtn"),
            document.getElementById("invoiceAddBtn"),
            document.getElementById("createInvoiceBtn"),
            document.getElementById("newInvoiceBtn"),
            document.getElementById("bizpilotAddInvoiceBtn")
        ].filter(Boolean);


        /*
         * Also find a visible button whose text says
         * Add Invoice / Create Invoice.
         */
        document
            .querySelectorAll("button")
            .forEach(function (button) {

                const text =
                    button.textContent
                        .trim()
                        .toLowerCase();

                if (
                    text === "add invoice" ||
                    text === "+ add invoice" ||
                    text === "create invoice" ||
                    text === "+ create invoice"
                ) {

                    possibleButtons.push(button);

                }

            });


        /*
         * Remove duplicates.
         */
        const uniqueButtons =
            [...new Set(possibleButtons)];


        uniqueButtons.forEach(function (button) {

            /*
             * Prevent this fix from attaching
             * multiple times.
             */
            if (
                button.dataset
                    .bizpilotInvoiceConnected === "true"
            ) {
                return;
            }


            button.dataset
                .bizpilotInvoiceConnected = "true";


            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();
                    event.stopPropagation();


                    if (
                        typeof window.openInvoiceModal ===
                        "function"
                    ) {

                        window.openInvoiceModal();

                    } else {

                        console.error(
                            "BizPilot Invoice System: openInvoiceModal is not available."
                        );

                        alert(
                            "Invoice system could not be loaded. Please refresh the page."
                        );

                    }

                }
            );

        });

    }


    /*
     * Connect immediately.
     */
    connectInvoiceButton();


    /*
     * Connect again after the page has rendered.
     */
    setTimeout(
        connectInvoiceButton,
        500
    );


    setTimeout(
        connectInvoiceButton,
        1200
    );


    /*
     * Keep watching because BizPilot dynamically
     * refreshes sections.
     */
    const observer =
        new MutationObserver(
            function () {

                connectInvoiceButton();

            }
        );


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    window.connectBizPilotInvoiceButton =
        connectInvoiceButton;

})();
/* =========================================================
   BIZPILOT — MAKE NEW INVOICE BUTTON WORK
   Add this at the VERY BOTTOM of app.js
   ========================================================= */

(function () {

    function activateInvoiceButton() {

        const button = document.getElementById(
            "bizpilotAddInvoiceBtn"
        );

        if (!button) return;

        if (button.dataset.invoiceReady === "true") {
            return;
        }

        button.dataset.invoiceReady = "true";

        button.onclick = function (event) {

            event.preventDefault();

            if (
                typeof window.openInvoiceModal === "function"
            ) {
                window.openInvoiceModal();
            } else {
                console.error(
                    "BizPilot: openInvoiceModal() is not available."
                );
            }

        };

    }

    activateInvoiceButton();

    setTimeout(activateInvoiceButton, 500);
    setTimeout(activateInvoiceButton, 1500);
    setTimeout(activateInvoiceButton, 3000);

})();
/* =========================================================
   BIZPILOT — FINAL INVOICE OVERRIDE
   ADD THIS AT THE VERY BOTTOM OF app.js
   Does not require changing existing CSS.
   ========================================================= */

(function () {

    "use strict";

    function ensureInvoices() {

        if (!Array.isArray(appData.invoices)) {
            appData.invoices = [];
        }

        return appData.invoices;
    }


    function money(value) {

        return "KSh " +
            (Number(value) || 0).toLocaleString(
                "en-KE"
            );

    }


    function escapeText(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function dateText(value) {

        if (!value) return "-";

        const date = new Date(value);

        if (isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString(
            "en-KE",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );

    }


    function invoiceNumber() {

        const year =
            new Date().getFullYear();

        return (
            "INV-" +
            year +
            "-" +
            String(
                ensureInvoices().length + 1
            ).padStart(4, "0")
        );

    }


    /* =====================================================
       CREATE INVOICE MODAL
       ===================================================== */

    function createInvoiceModal() {

        const existing =
            document.getElementById(
                "bizpilotFinalInvoiceModal"
            );

        if (existing) {
            existing.remove();
        }


        const customers =
            Array.isArray(appData.customers)
                ? appData.customers
                : [];


        const options =
            customers.map(function (customer) {

                return `
                    <option value="${escapeText(
                        customer.name || ""
                    )}">
                        ${escapeText(
                            customer.name || ""
                        )}
                    </option>
                `;

            }).join("");


        const modal =
            document.createElement("div");

        modal.id =
            "bizpilotFinalInvoiceModal";


        modal.style.cssText = `
            position:fixed;
            inset:0;
            z-index:99999;
            background:rgba(0,0,0,.55);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
        `;


        modal.innerHTML = `

            <div
                style="
                    width:100%;
                    max-width:620px;
                    max-height:90vh;
                    overflow:auto;
                    background:#fff;
                    border-radius:18px;
                    padding:26px;
                    box-shadow:0 25px 70px rgba(0,0,0,.2);
                "
            >

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:flex-start;
                        gap:20px;
                        margin-bottom:22px;
                    "
                >

                    <div>

                        <div
                            style="
                                color:#0396FF;
                                font-size:9px;
                                font-weight:800;
                                letter-spacing:1.4px;
                                text-transform:uppercase;
                                margin-bottom:6px;
                            "
                        >
                            BIZPILOT INVOICES
                        </div>

                        <h2
                            style="
                                margin:0;
                                color:#111;
                            "
                        >
                            Create Invoice
                        </h2>

                        <p
                            style="
                                margin:6px 0 0;
                                color:#777;
                                font-size:12px;
                            "
                        >
                            Create and save a professional invoice.
                        </p>

                    </div>


                    <button
                        type="button"
                        id="bizpilotFinalInvoiceClose"
                        style="
                            border:0;
                            background:#f3f4f6;
                            width:36px;
                            height:36px;
                            border-radius:10px;
                            cursor:pointer;
                            font-size:18px;
                        "
                    >
                        ×
                    </button>

                </div>


                <form id="bizpilotFinalInvoiceForm">

                    <div
                        style="
                            display:grid;
                            grid-template-columns:1fr 1fr;
                            gap:12px;
                        "
                    >

                        <div class="form-group">

                            <label>
                                Invoice number
                            </label>

                            <input
                                id="finalInvoiceNumber"
                                type="text"
                                value="${invoiceNumber()}"
                                required
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Invoice date
                            </label>

                            <input
                                id="finalInvoiceDate"
                                type="date"
                                value="${
                                    new Date()
                                        .toISOString()
                                        .slice(0,10)
                                }"
                                required
                            >

                        </div>

                    </div>


                    <div class="form-group">

                        <label>
                            Customer
                        </label>

                        ${
                            customers.length
                                ? `
                                    <select
                                        id="finalInvoiceCustomer"
                                        required
                                    >

                                        <option value="">
                                            Select customer
                                        </option>

                                        ${options}

                                    </select>
                                `
                                : `
                                    <input
                                        id="finalInvoiceCustomer"
                                        type="text"
                                        placeholder="Customer name"
                                        required
                                    >
                                `
                        }

                    </div>


                    <div class="form-group">

                        <label>
                            Customer phone
                        </label>

                        <input
                            id="finalInvoicePhone"
                            type="text"
                            placeholder="Phone number"
                        >

                    </div>


                    <div class="form-group">

                        <label>
                            Item / Service
                        </label>

                        <input
                            id="finalInvoiceItem"
                            type="text"
                            placeholder="What are you billing for?"
                            required
                        >

                    </div>


                    <div
                        style="
                            display:grid;
                            grid-template-columns:1fr 1fr;
                            gap:12px;
                        "
                    >

                        <div class="form-group">

                            <label>
                                Quantity
                            </label>

                            <input
                                id="finalInvoiceQuantity"
                                type="number"
                                min="1"
                                value="1"
                                required
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Unit price
                            </label>

                            <input
                                id="finalInvoicePrice"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                required
                            >

                        </div>

                    </div>


                    <div
                        style="
                            padding:16px;
                            margin:12px 0;
                            background:#f7fbff;
                            border:1px solid #e2f0ff;
                            border-radius:12px;
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                        "
                    >

                        <span
                            style="
                                font-size:11px;
                                color:#777;
                            "
                        >
                            Invoice total
                        </span>

                        <strong
                            id="finalInvoiceTotal"
                            style="
                                font-size:20px;
                                color:#0396FF;
                            "
                        >
                            KSh 0
                        </strong>

                    </div>


                    <div class="form-group">

                        <label>
                            Notes
                        </label>

                        <textarea
                            id="finalInvoiceNotes"
                            rows="3"
                            placeholder="Optional notes..."
                        ></textarea>

                    </div>


                    <div
                        style="
                            display:grid;
                            grid-template-columns:1fr 1fr;
                            gap:10px;
                            margin-top:20px;
                        "
                    >

                        <button
                            type="button"
                            id="bizpilotFinalInvoiceCancel"
                            class="secondary-btn"
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            class="primary-btn"
                        >
                            Save Invoice
                        </button>

                    </div>

                </form>

            </div>

        `;


        document.body.appendChild(modal);


        const quantity =
            document.getElementById(
                "finalInvoiceQuantity"
            );

        const price =
            document.getElementById(
                "finalInvoicePrice"
            );

        const total =
            document.getElementById(
                "finalInvoiceTotal"
            );


        function updateTotal() {

            const qty =
                Number(quantity?.value) || 0;

            const unit =
                Number(price?.value) || 0;

            if (total) {
                total.textContent =
                    money(qty * unit);
            }

        }


        quantity?.addEventListener(
            "input",
            updateTotal
        );

        price?.addEventListener(
            "input",
            updateTotal
        );


        document
            .getElementById(
                "bizpilotFinalInvoiceClose"
            )
            ?.addEventListener(
                "click",
                function () {
                    modal.remove();
                }
            );


        document
            .getElementById(
                "bizpilotFinalInvoiceCancel"
            )
            ?.addEventListener(
                "click",
                function () {
                    modal.remove();
                }
            );


        const customer =
            document.getElementById(
                "finalInvoiceCustomer"
            );


        customer?.addEventListener(
            "change",
            function () {

                const selected =
                    customers.find(
                        function (item) {
                            return item.name ===
                                customer.value;
                        }
                    );

                if (selected) {

                    const phone =
                        document.getElementById(
                            "finalInvoicePhone"
                        );

                    if (phone) {
                        phone.value =
                            selected.phone || "";
                    }

                }

            }
        );


        document
            .getElementById(
                "bizpilotFinalInvoiceForm"
            )
            ?.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();


                    const number =
                        document
                            .getElementById(
                                "finalInvoiceNumber"
                            )
                            ?.value
                            .trim();


                    const date =
                        document
                            .getElementById(
                                "finalInvoiceDate"
                            )
                            ?.value;


                    const customerName =
                        document
                            .getElementById(
                                "finalInvoiceCustomer"
                            )
                            ?.value
                            .trim();


                    const phone =
                        document
                            .getElementById(
                                "finalInvoicePhone"
                            )
                            ?.value
                            .trim();


                    const item =
                        document
                            .getElementById(
                                "finalInvoiceItem"
                            )
                            ?.value
                            .trim();


                    const qty =
                        Number(
                            document
                                .getElementById(
                                    "finalInvoiceQuantity"
                                )
                                ?.value
                        ) || 0;


                    const unitPrice =
                        Number(
                            document
                                .getElementById(
                                    "finalInvoicePrice"
                                )
                                ?.value
                        ) || 0;


                    const notes =
                        document
                            .getElementById(
                                "finalInvoiceNotes"
                            )
                            ?.value
                            .trim();


                    if (
                        !number ||
                        !date ||
                        !customerName ||
                        !item ||
                        qty <= 0 ||
                        unitPrice < 0
                    ) {

                        alert(
                            "Please complete all required invoice fields."
                        );

                        return;

                    }


                    const invoice = {

                        id:
                            Date.now(),

                        invoiceNumber:
                            number,

                        date:
                            date,

                        customer:
                            customerName,

                        customerPhone:
                            phone,

                        item:
                            item,

                        quantity:
                            qty,

                        unitPrice:
                            unitPrice,

                        total:
                            qty * unitPrice,

                        notes:
                            notes,

                        status:
                            "Pending",

                        createdAt:
                            new Date().toISOString()

                    };


                    ensureInvoices().push(
                        invoice
                    );


                    try {

                        if (
                            typeof saveData ===
                            "function"
                        ) {

                            saveData();

                        } else {

                            localStorage.setItem(
                                STORAGE_KEY,
                                JSON.stringify(appData)
                            );

                        }

                    } catch (error) {

                        console.error(
                            "Invoice save error:",
                            error
                        );

                    }


                    modal.remove();


                    renderFinalInvoicePage();


                    if (
                        typeof showToast ===
                        "function"
                    ) {

                        showToast(
                            "Invoice created successfully."
                        );

                    }

                }
            );


        updateTotal();

    }


    /* =====================================================
       RENDER INVOICE PAGE
       ===================================================== */

    function renderFinalInvoicePage() {

        const container =
            document.getElementById(
                "bizpilotInvoiceSystem"
            );

        if (!container) return;


        const invoices =
            ensureInvoices();


        let totalValue = 0;

        let paidValue = 0;

        let pendingValue = 0;


        invoices.forEach(
            function (invoice) {

                const value =
                    Number(invoice.total) || 0;

                totalValue += value;

                if (
                    invoice.status ===
                    "Paid"
                ) {

                    paidValue += value;

                } else {

                    pendingValue += value;

                }

            }
        );


        container.innerHTML = `

            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(4,minmax(0,1fr));
                    gap:12px;
                    margin-top:20px;
                    margin-bottom:18px;
                "
            >

                ${invoiceSummaryCard(
                    "TOTAL INVOICES",
                    invoices.length
                )}

                ${invoiceSummaryCard(
                    "TOTAL VALUE",
                    money(totalValue)
                )}

                ${invoiceSummaryCard(
                    "PAID",
                    money(paidValue)
                )}

                ${invoiceSummaryCard(
                    "PENDING",
                    money(pendingValue)
                )}

            </div>


            <div
                style="
                    background:#fff;
                    border:1px solid #e7ebf0;
                    border-radius:16px;
                    overflow:hidden;
                "
            >

                ${
                    invoices.length
                        ? invoiceTable(invoices)
                        : `
                            <div
                                style="
                                    padding:50px 20px;
                                    text-align:center;
                                "
                            >

                                <div
                                    style="
                                        font-size:30px;
                                        margin-bottom:12px;
                                    "
                                >
                                    ▤
                                </div>

                                <h3
                                    style="
                                        margin:0 0 7px;
                                    "
                                >
                                    No invoices yet
                                </h3>

                                <p
                                    style="
                                        margin:0;
                                        color:#777;
                                        font-size:12px;
                                    "
                                >
                                    Click + New Invoice to create your first invoice.
                                </p>

                            </div>
                        `
                }

            </div>

        `;


        connectFinalInvoiceButtons();

    }


    function invoiceSummaryCard(
        label,
        value
    ) {

        return `

            <div
                style="
                    padding:16px;
                    background:#fff;
                    border:1px solid #e7ebf0;
                    border-radius:14px;
                    min-width:0;
                "
            >

                <small
                    style="
                        display:block;
                        color:#7b8490;
                        font-size:9px;
                        font-weight:800;
                        letter-spacing:1px;
                        margin-bottom:7px;
                    "
                >
                    ${label}
                </small>

                <strong
                    style="
                        font-size:20px;
                        color:#111;
                    "
                >
                    ${value}
                </strong>

            </div>

        `;

    }


    function invoiceTable(
        invoices
    ) {

        return `

            <div style="overflow-x:auto;">

                <table
                    style="
                        width:100%;
                        border-collapse:collapse;
                    "
                >

                    <thead>

                        <tr>

                            <th style="text-align:left;padding:14px;">
                                Invoice
                            </th>

                            <th style="text-align:left;padding:14px;">
                                Customer
                            </th>

                            <th style="text-align:left;padding:14px;">
                                Date
                            </th>

                            <th style="text-align:left;padding:14px;">
                                Total
                            </th>

                            <th style="text-align:left;padding:14px;">
                                Status
                            </th>

                            <th style="text-align:right;padding:14px;">
                                Actions
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${invoices.map(
                            function (invoice) {

                                return `

                                    <tr>

                                        <td style="padding:14px;border-top:1px solid #edf0f3;">
                                            <strong>
                                                ${escapeText(
                                                    invoice.invoiceNumber
                                                )}
                                            </strong>
                                        </td>

                                        <td style="padding:14px;border-top:1px solid #edf0f3;">
                                            ${escapeText(
                                                invoice.customer
                                            )}
                                        </td>

                                        <td style="padding:14px;border-top:1px solid #edf0f3;">
                                            ${dateText(
                                                invoice.date
                                            )}
                                        </td>

                                        <td style="padding:14px;border-top:1px solid #edf0f3;">
                                            <strong>
                                                ${money(
                                                    invoice.total
                                                )}
                                            </strong>
                                        </td>

                                        <td style="padding:14px;border-top:1px solid #edf0f3;">

                                            <span
                                                style="
                                                    display:inline-block;
                                                    padding:5px 9px;
                                                    border-radius:999px;
                                                    background:${
                                                        invoice.status === "Paid"
                                                            ? "#eefaf2"
                                                            : "#fff7e8"
                                                    };
                                                    color:${
                                                        invoice.status === "Paid"
                                                            ? "#16803a"
                                                            : "#b26a00"
                                                    };
                                                    font-size:9px;
                                                    font-weight:800;
                                                "
                                            >
                                                ${escapeText(
                                                    invoice.status ||
                                                    "Pending"
                                                )}
                                            </span>

                                        </td>

                                        <td
                                            style="
                                                padding:14px;
                                                border-top:1px solid #edf0f3;
                                                text-align:right;
                                                white-space:nowrap;
                                            "
                                        >

                                            <button
                                                type="button"
                                                class="secondary-btn"
                                                data-final-view="${invoice.id}"
                                            >
                                                View
                                            </button>

                                            <button
                                                type="button"
                                                class="secondary-btn"
                                                data-final-print="${invoice.id}"
                                            >
                                                Print
                                            </button>

                                            <button
                                                type="button"
                                                class="secondary-btn"
                                                data-final-receipt="${invoice.id}"
                                            >
                                                Receipt
                                            </button>

                                            ${
                                                invoice.status !== "Paid"
                                                    ? `
                                                        <button
                                                            type="button"
                                                            class="secondary-btn"
                                                            data-final-paid="${invoice.id}"
                                                        >
                                                            Mark paid
                                                        </button>
                                                    `
                                                    : ""
                                            }

                                            <button
                                                type="button"
                                                class="secondary-btn"
                                                data-final-delete="${invoice.id}"
                                            >
                                                Delete
                                            </button>

                                        </td>

                                    </tr>

                                `;

                            }
                        ).join("")}

                    </tbody>

                </table>

            </div>

        `;

    }


    /* =====================================================
       BUTTONS
       ===================================================== */

    function connectFinalInvoiceButtons() {

        const page =
            document.getElementById(
                "invoices"
            );

        if (!page) return;


        page.onclick =
            function (event) {

                const button =
                    event.target.closest(
                        "button"
                    );

                if (!button) return;


                if (
                    button.id ===
                    "bizpilotAddInvoiceBtn"
                ) {

                    event.preventDefault();

                    event.stopImmediatePropagation();

                    createInvoiceModal();

                    return;

                }


                const viewId =
                    button.dataset.finalView;

                if (viewId) {

                    event.preventDefault();

                    event.stopImmediatePropagation();

                    const invoice =
                        ensureInvoices().find(
                            function (item) {
                                return String(item.id) ===
                                    String(viewId);
                            }
                        );

                    if (invoice) {
                        showInvoicePreview(
                            invoice,
                            false
                        );
                    }

                    return;

                }


                const printId =
                    button.dataset.finalPrint;

                if (printId) {

                    event.preventDefault();

                    event.stopImmediatePropagation();

                    const invoice =
                        ensureInvoices().find(
                            function (item) {
                                return String(item.id) ===
                                    String(printId);
                            }
                        );

                    if (invoice) {
                        printFinalInvoice(
                            invoice,
                            false
                        );
                    }

                    return;

                }


                const receiptId =
                    button.dataset.finalReceipt;

                if (receiptId) {

                    event.preventDefault();

                    event.stopImmediatePropagation();

                    const invoice =
                        ensureInvoices().find(
                            function (item) {
                                return String(item.id) ===
                                    String(receiptId);
                            }
                        );

                    if (invoice) {
                        printFinalInvoice(
                            invoice,
                            true
                        );
                    }

                    return;

                }


                const paidId =
                    button.dataset.finalPaid;

                if (paidId) {

                    event.preventDefault();

                    event.stopImmediatePropagation();

                    const invoice =
                        ensureInvoices().find(
                            function (item) {
                                return String(item.id) ===
                                    String(paidId);
                            }
                        );

                    if (invoice) {

                        invoice.status =
                            "Paid";

                        invoice.paidAt =
                            new Date().toISOString();

                        saveData();

                        renderFinalInvoicePage();

                        if (
                            typeof showToast ===
                            "function"
                        ) {
                            showToast(
                                "Invoice marked as paid."
                            );
                        }

                    }

                    return;

                }


                const deleteId =
                    button.dataset.finalDelete;

                if (deleteId) {

                    event.preventDefault();

                    event.stopImmediatePropagation();

                    const invoice =
                        ensureInvoices().find(
                            function (item) {
                                return String(item.id) ===
                                    String(deleteId);
                            }
                        );

                    if (!invoice) return;


                    if (
                        !confirm(
                            "Delete invoice " +
                            invoice.invoiceNumber +
                            "?"
                        )
                    ) {
                        return;
                    }


                    appData.invoices =
                        ensureInvoices().filter(
                            function (item) {
                                return String(item.id) !==
                                    String(deleteId);
                            }
                        );


                    saveData();

                    renderFinalInvoicePage();


                    if (
                        typeof showToast ===
                        "function"
                    ) {
                        showToast(
                            "Invoice deleted."
                        );
                    }

                }

            };

    }


    /* =====================================================
       PREVIEW
       ===================================================== */

    function showInvoicePreview(
        invoice,
        receiptMode
    ) {

        const modal =
            document.createElement("div");

        modal.style.cssText = `
            position:fixed;
            inset:0;
            z-index:99999;
            background:rgba(0,0,0,.55);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
        `;


        modal.innerHTML = `

            <div
                style="
                    background:#fff;
                    width:100%;
                    max-width:720px;
                    max-height:90vh;
                    overflow:auto;
                    border-radius:18px;
                    padding:28px;
                "
            >

                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        gap:20px;
                        border-bottom:1px solid #edf0f3;
                        padding-bottom:18px;
                        margin-bottom:22px;
                    "
                >

                    <div>

                        <div
                            style="
                                font-size:22px;
                                font-weight:800;
                            "
                        >
                            ${escapeText(
                                appData.business?.name ||
                                "Your Business"
                            )}
                        </div>

                        <div
                            style="
                                color:#0396FF;
                                font-size:10px;
                                font-weight:800;
                                letter-spacing:1px;
                                margin-top:5px;
                            "
                        >
                            ${receiptMode ? "RECEIPT" : "INVOICE"}
                        </div>

                    </div>


                    <div style="text-align:right;">

                        <strong>
                            ${escapeText(
                                invoice.invoiceNumber
                            )}
                        </strong>

                        <div
                            style="
                                color:#777;
                                font-size:11px;
                                margin-top:5px;
                            "
                        >
                            ${dateText(invoice.date)}
                        </div>

                    </div>

                </div>


                <div style="margin-bottom:22px;">

                    <small
                        style="
                            display:block;
                            color:#7b8490;
                            font-size:9px;
                            font-weight:800;
                            letter-spacing:1px;
                            margin-bottom:6px;
                        "
                    >
                        BILL TO
                    </small>

                    <strong>
                        ${escapeText(invoice.customer)}
                    </strong>

                    ${
                        invoice.customerPhone
                            ? `
                                <div
                                    style="
                                        color:#777;
                                        font-size:11px;
                                        margin-top:4px;
                                    "
                                >
                                    ${escapeText(
                                        invoice.customerPhone
                                    )}
                                </div>
                            `
                            : ""
                    }

                </div>


                <div
                    style="
                        border:1px solid #e7ebf0;
                        border-radius:12px;
                        overflow:hidden;
                    "
                >

                    <div
                        style="
                            display:grid;
                            grid-template-columns:2fr .7fr 1fr 1fr;
                            gap:10px;
                            padding:12px;
                            background:#f8fafc;
                            font-size:9px;
                            font-weight:800;
                        "
                    >

                        <span>ITEM</span>
                        <span>QTY</span>
                        <span>PRICE</span>
                        <span>TOTAL</span>

                    </div>


                    <div
                        style="
                            display:grid;
                            grid-template-columns:2fr .7fr 1fr 1fr;
                            gap:10px;
                            padding:15px 12px;
                            font-size:12px;
                        "
                    >

                        <span>
                            ${escapeText(invoice.item)}
                        </span>

                        <span>
                            ${invoice.quantity}
                        </span>

                        <span>
                            ${money(invoice.unitPrice)}
                        </span>

                        <strong>
                            ${money(invoice.total)}
                        </strong>

                    </div>

                </div>


                <div
                    style="
                        text-align:right;
                        margin-top:22px;
                        font-size:22px;
                        font-weight:800;
                    "
                >
                    ${money(invoice.total)}
                </div>


                ${
                    invoice.notes
                        ? `
                            <div
                                style="
                                    margin-top:20px;
                                    padding:14px;
                                    background:#f8fafc;
                                    border-radius:10px;
                                    font-size:12px;
                                    color:#666;
                                "
                            >
                                ${escapeText(invoice.notes)}
                            </div>
                        `
                        : ""
                }


                <button
                    type="button"
                    class="primary-btn"
                    id="finalPreviewClose"
                    style="
                        width:100%;
                        margin-top:22px;
                    "
                >
                    Close
                </button>

            </div>

        `;


        document.body.appendChild(modal);


        modal
            .querySelector("#finalPreviewClose")
            ?.addEventListener(
                "click",
                function () {
                    modal.remove();
                }
            );

    }


    /* =====================================================
       PRINT
       ===================================================== */

    function printFinalInvoice(
        invoice,
        receiptMode
    ) {

        const popup =
            window.open(
                "",
                "_blank",
                "width=900,height=750"
            );


        if (!popup) {

            alert(
                "Please allow pop-ups to print."
            );

            return;

        }


        popup.document.write(`

            <!DOCTYPE html>

            <html>

            <head>

                <title>
                    ${escapeText(
                        receiptMode
                            ? "Receipt"
                            : "Invoice"
                    )}
                    ${escapeText(
                        invoice.invoiceNumber
                    )}
                </title>

                <style>

                    body {
                        font-family:Arial, sans-serif;
                        padding:40px;
                        color:#111;
                    }

                    .top {
                        display:flex;
                        justify-content:space-between;
                        border-bottom:2px solid #111;
                        padding-bottom:20px;
                        margin-bottom:25px;
                    }

                    table {
                        width:100%;
                        border-collapse:collapse;
                        margin-top:25px;
                    }

                    th,
                    td {
                        padding:12px;
                        border-bottom:1px solid #ddd;
                        text-align:left;
                    }

                    .total {
                        margin-top:25px;
                        text-align:right;
                        font-size:22px;
                        font-weight:800;
                    }

                </style>

            </head>

            <body>

                <div class="top">

                    <div>

                        <h2>
                            ${escapeText(
                                appData.business?.name ||
                                "Your Business"
                            )}
                        </h2>

                    </div>

                    <div>

                        <strong>
                            ${receiptMode
                                ? "RECEIPT"
                                : "INVOICE"}
                        </strong>

                        <br>

                        ${escapeText(
                            invoice.invoiceNumber
                        )}

                    </div>

                </div>


                <strong>
                    Bill to:
                </strong>

                <div>
                    ${escapeText(invoice.customer)}
                </div>


                <table>

                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th>Total</th>
                    </tr>

                    <tr>
                        <td>
                            ${escapeText(invoice.item)}
                        </td>

                        <td>
                            ${invoice.quantity}
                        </td>

                        <td>
                            ${money(invoice.unitPrice)}
                        </td>

                        <td>
                            ${money(invoice.total)}
                        </td>
                    </tr>

                </table>


                <div class="total">
                    Total: ${money(invoice.total)}
                </div>

                <p style="margin-top:40px;text-align:center;color:#777;">
                    ${
                        receiptMode
                            ? "Thank you for your payment."
                            : "Thank you for doing business with us."
                    }
                </p>


                <script>
                    window.onload = function () {
                        window.print();
                    };
                <\/script>

            </body>

            </html>

        `);


        popup.document.close();

    }


    /* =====================================================
       TAKE CONTROL OF NEW INVOICE BUTTON
       ===================================================== */

    function connectNewInvoiceButton() {

        const button =
            document.getElementById(
                "bizpilotAddInvoiceBtn"
            );

        if (!button) return;


        button.onclick =
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                createInvoiceModal();

            };

    }


    /* =====================================================
       START
       ===================================================== */

    function startFinalInvoiceOverride() {

        connectNewInvoiceButton();

        renderFinalInvoicePage();

    }


    startFinalInvoiceOverride();


    setTimeout(
        startFinalInvoiceOverride,
        500
    );


    setTimeout(
        startFinalInvoiceOverride,
        1500
    );


    setTimeout(
        startFinalInvoiceOverride,
        3000
    );


    window.bizPilotFinalInvoice =
        {
            create: createInvoiceModal,
            render: renderFinalInvoicePage
        };


    console.log(
        "BizPilot final invoice override loaded."
    );

})();
/* =========================================================
   BIZPILOT — REAL MODAL CLOSE / ESCAPE BUTTON
   ========================================================= */

(function () {

    function addRealInvoiceCloseButton() {

        const overlay =
            document.getElementById("modalOverlay");

        const content =
            document.getElementById("modalContent");

        if (!overlay || !content) return;

        // Only add the button when the modal is actually open
        if (!overlay.classList.contains("show")) return;

        // Don't create it twice
        if (document.getElementById("bizPilotRealCloseButton")) {
            return;
        }

        const button =
            document.createElement("button");

        button.id =
            "bizPilotRealCloseButton";

        button.type =
            "button";

        button.innerHTML = "×";

        button.setAttribute(
            "aria-label",
            "Close"
        );

        button.style.cssText = `
            position:absolute;
            top:16px;
            right:16px;
            width:40px;
            height:40px;
            border:none;
            border-radius:50%;
            background:#f1f3f5;
            color:#111111;
            font-size:26px;
            font-weight:400;
            line-height:40px;
            text-align:center;
            padding:0;
            cursor:pointer;
            z-index:999999;
            display:flex;
            align-items:center;
            justify-content:center;
            box-shadow:0 3px 12px rgba(0,0,0,0.08);
        `;

        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                if (typeof closeModal === "function") {
                    closeModal();
                } else {
                    overlay.classList.remove("show");
                }

            }
        );

        /*
         * The actual modal content needs relative positioning
         * so the X stays inside the invoice window.
         */
        if (
            getComputedStyle(content).position ===
            "static"
        ) {
            content.style.position = "relative";
        }

        content.appendChild(button);
    }


    /*
     * Watch for the invoice modal opening.
     * Your existing openModal() changes the modal content,
     * so MutationObserver is the safest way to attach the X.
     */

    const observer =
        new MutationObserver(function () {

            setTimeout(
                addRealInvoiceCloseButton,
                20
            );

        });


    const modalContent =
        document.getElementById("modalContent");

    if (modalContent) {

        observer.observe(
            modalContent,
            {
                childList:true,
                subtree:true
            }
        );

    }


    /*
     * Also watch the overlay itself.
     */

    const modalOverlay =
        document.getElementById("modalOverlay");

    if (modalOverlay) {

        observer.observe(
            modalOverlay,
            {
                attributes:true,
                attributeFilter:["class"]
            }
        );

    }


    /*
     * Keyboard ESCAPE
     */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" ||
                event.key === "Esc"
            ) {

                const overlay =
                    document.getElementById(
                        "modalOverlay"
                    );

                if (
                    overlay &&
                    overlay.classList.contains("show")
                ) {

                    if (
                        typeof closeModal ===
                        "function"
                    ) {

                        closeModal();

                    } else {

                        overlay.classList.remove(
                            "show"
                        );

                    }

                }

            }

        }
    );


    /*
     * Run once immediately.
     */

    setTimeout(
        addRealInvoiceCloseButton,
        300
    );

})();
/* =========================================================
   BIZPILOT — INVOICE BUTTON FINAL CONNECTION
   Opens ONE invoice window only
   ========================================================= */

(function () {

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "#bizpilotAddInvoiceBtn"
                );

            if (!button) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            if (
                typeof window.openInvoiceModal ===
                "function"
            ) {

                window.openInvoiceModal();

            } else {

                console.error(
                    "BizPilot: openInvoiceModal() is not available."
                );

                alert(
                    "Invoice system could not be loaded. Please refresh the page."
                );

            }

        },
        true
    );

})();
/* =========================================================
   BIZPILOT — KEEP ONLY ONE INVOICE CLOSE BUTTON
   ========================================================= */

(function () {

    function cleanInvoiceCloseButtons() {

        /* Remove the older duplicate button */
        const oldButton =
            document.getElementById(
                "bizPilotInvoiceEscape"
            );

        if (oldButton) {
            oldButton.remove();
        }

    }

    cleanInvoiceCloseButtons();

    const observer =
        new MutationObserver(function () {
            cleanInvoiceCloseButtons();
        });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
/* =========================================================
   BIZPILOT — SAVE INVOICE AS PDF BUTTON
   ADD THIS AT THE VERY BOTTOM OF app.js
   ========================================================= */

(function () {

    "use strict";

    function addSavePDFButton() {

        const printButton =
            document.getElementById("invoicePreviewPrint");

        const closeButton =
            document.getElementById("invoicePreviewClose");

        /* Invoice preview is not open yet */
        if (!printButton || !closeButton) {
            return;
        }

        /* Prevent duplicate Save PDF buttons */
        if (document.getElementById("bizpilotSaveInvoicePDF")) {
            return;
        }

        /* Create Save PDF button */
        const saveButton =
            document.createElement("button");

        saveButton.type = "button";

        saveButton.id =
            "bizpilotSaveInvoicePDF";

        saveButton.className =
            "secondary-btn";

        saveButton.innerHTML =
            "↓ Save PDF";

        saveButton.title =
            "Save this invoice as a PDF";

        /* -------------------------------------------------
           SAVE PDF ACTION
           ------------------------------------------------- */

        saveButton.addEventListener(
            "click",
            function () {

                /*
                 * Your existing Print Invoice button already
                 * creates the professional invoice document.
                 *
                 * We reuse it instead of creating another
                 * invoice system.
                 */

                if (printButton) {

                    printButton.click();

                }

            }
        );

        /* -------------------------------------------------
           INSERT BUTTON
           ------------------------------------------------- */

        printButton.parentNode.insertBefore(
            saveButton,
            printButton
        );

        /* -------------------------------------------------
           MAKE THE ACTION BAR PREMIUM
           ------------------------------------------------- */

        const actionBar =
            printButton.parentNode;

        if (actionBar) {

            actionBar.style.display =
                "grid";

            actionBar.style.gridTemplateColumns =
                "repeat(3, minmax(0, 1fr))";

            actionBar.style.gap =
                "10px";

            actionBar.style.width =
                "100%";

        }

        /* -------------------------------------------------
           SAVE BUTTON STYLE
           ------------------------------------------------- */

        saveButton.style.background =
            "#111111";

        saveButton.style.color =
            "#ffffff";

        saveButton.style.border =
            "1px solid #111111";

        saveButton.style.fontWeight =
            "800";

        saveButton.style.borderRadius =
            "11px";

        saveButton.style.minHeight =
            "44px";

        saveButton.style.cursor =
            "pointer";

        saveButton.style.transition =
            "all .18s ease";

        saveButton.addEventListener(
            "mouseenter",
            function () {

                saveButton.style.background =
                    "#0396FF";

                saveButton.style.borderColor =
                    "#0396FF";

                saveButton.style.transform =
                    "translateY(-1px)";

            }
        );

        saveButton.addEventListener(
            "mouseleave",
            function () {

                saveButton.style.background =
                    "#111111";

                saveButton.style.borderColor =
                    "#111111";

                saveButton.style.transform =
                    "translateY(0)";

            }
        );

    }


    /* -----------------------------------------------------
       WATCH FOR INVOICE PREVIEW
       ----------------------------------------------------- */

    const invoiceObserver =
        new MutationObserver(function () {

            addSavePDFButton();

        });


    invoiceObserver.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    /* -----------------------------------------------------
       ALSO CHECK WHEN APP LOADS
       ----------------------------------------------------- */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            addSavePDFButton
        );

    } else {

        addSavePDFButton();

    }

})();
/* =========================================================
   BIZPILOT — PREMIUM INVOICE SUMMARY
   APP.JS VERSION
   ========================================================= */

(function () {

    "use strict";

    function premiumInvoiceSummary() {

        const invoicesPage = document.getElementById("invoices");

        if (!invoicesPage) return;

        const labels = [
            "TOTAL INVOICES",
            "TOTAL VALUE",
            "PAID",
            "PENDING"
        ];

        const labelElements = [];

        /* Find the actual generated labels */
        labels.forEach(function (label) {

            const elements = invoicesPage.querySelectorAll("*");

            for (let i = 0; i < elements.length; i++) {

                const text =
                    elements[i].textContent
                        .trim()
                        .replace(/\s+/g, " ")
                        .toUpperCase();

                if (text === label) {

                    labelElements.push({
                        label: label,
                        element: elements[i]
                    });

                    break;
                }
            }

        });

        if (labelElements.length !== 4) return;

        /* Find the four actual cards */
        const cards = labelElements.map(function (item) {

            return item.element.closest("div");

        });

        if (cards.some(function (card) {
            return !card;
        })) {
            return;
        }

        /* Find the common summary container */
        const summary =
            cards[0].parentElement;

        if (!summary) return;

        /* =====================================================
           SUMMARY CONTAINER
           ===================================================== */

        summary.style.display = "grid";
        summary.style.gridTemplateColumns =
            "repeat(4, minmax(0, 1fr))";

        summary.style.gap = "12px";
        summary.style.width = "100%";
        summary.style.boxSizing = "border-box";
        summary.style.marginTop = "18px";
        summary.style.marginBottom = "22px";

        /* =====================================================
           CARD DESIGN
           ===================================================== */

        cards.forEach(function (card, index) {

            if (!card) return;

            card.style.position = "relative";
            card.style.boxSizing = "border-box";
            card.style.width = "100%";
            card.style.minWidth = "0";
            card.style.minHeight = "108px";

            card.style.padding =
                "20px 18px 18px";

            card.style.background =
                "#ffffff";

            card.style.border =
                "1px solid #e7ebf0";

            card.style.borderRadius =
                "16px";

            card.style.boxShadow =
                "0 8px 24px rgba(17,17,17,0.055)";

            card.style.overflow =
                "hidden";

            card.style.transition =
                "transform .2s ease, box-shadow .2s ease, border-color .2s ease";

            /* Premium blue top line */
            card.style.borderTop =
                "3px solid #0396FF";

            /* =================================================
               LABEL
               ================================================= */

            const label =
                card.querySelector("small") ||
                labelElements[index].element;

            if (label) {

                label.style.display = "block";

                label.style.margin =
                    "0 0 10px 0";

                label.style.padding = "0";

                label.style.color =
                    "#7b8490";

                label.style.fontSize =
                    "9px";

                label.style.fontWeight =
                    "800";

                label.style.letterSpacing =
                    "1.2px";

                label.style.lineHeight =
                    "1.25";

                label.style.textTransform =
                    "uppercase";
            }

            /* =================================================
               VALUE
               ================================================= */

            const strong =
                card.querySelector("strong");

            if (strong) {

                strong.style.display =
                    "block";

                strong.style.margin =
                    "0";

                strong.style.padding =
                    "0";

                strong.style.fontSize =
                    "25px";

                strong.style.fontWeight =
                    "900";

                strong.style.lineHeight =
                    "1.05";

                strong.style.letterSpacing =
                    "-0.8px";

                strong.style.fontVariantNumeric =
                    "tabular-nums";

                strong.style.whiteSpace =
                    "normal";

                /* Default premium blue */
                strong.style.color =
                    "#0396FF";
            }

            /* =================================================
               DIFFERENT COLORS
               ================================================= */

            if (index === 0 && strong) {
                strong.style.color =
                    "#111111";
            }

            if (index === 1 && strong) {
                strong.style.color =
                    "#0396FF";
            }

            if (index === 2 && strong) {
                strong.style.color =
                    "#16a36a";
            }

            if (index === 3 && strong) {
                strong.style.color =
                    "#e58a00";
            }

            /* =================================================
               HOVER
               ================================================= */

            card.onmouseenter = function () {

                card.style.transform =
                    "translateY(-3px)";

                card.style.boxShadow =
                    "0 14px 30px rgba(17,17,17,0.09)";

                card.style.borderColor =
                    "#d9e1e9";
            };

            card.onmouseleave = function () {

                card.style.transform =
                    "translateY(0)";

                card.style.boxShadow =
                    "0 8px 24px rgba(17,17,17,0.055)";

                card.style.borderColor =
                    "#e7ebf0";
            };

        });

        /* =====================================================
           MOBILE
           ===================================================== */

        if (window.innerWidth <= 700) {

            summary.style.gridTemplateColumns =
                "repeat(2, minmax(0, 1fr))";

            summary.style.gap =
                "9px";

            cards.forEach(function (card) {

                card.style.minHeight =
                    "92px";

                card.style.padding =
                    "16px 14px 15px";

                const strong =
                    card.querySelector("strong");

                if (strong) {
                    strong.style.fontSize =
                        "20px";
                }

                const label =
                    card.querySelector("small") ||
                    card.querySelector("span");

                if (label) {
                    label.style.fontSize =
                        "8px";

                    label.style.letterSpacing =
                        ".8px";
                }

            });
        }

        /* =====================================================
           SMALL PHONES
           ===================================================== */

        if (window.innerWidth <= 420) {

            summary.style.gap =
                "8px";

            cards.forEach(function (card) {

                card.style.minHeight =
                    "84px";

                card.style.padding =
                    "14px 12px";

                const strong =
                    card.querySelector("strong");

                if (strong) {
                    strong.style.fontSize =
                        "18px";
                }

            });
        }

    }


    /* =========================================================
       RUN AFTER INVOICE PAGE IS RENDERED
       ========================================================= */

    function runPremiumInvoiceSummary() {

        setTimeout(function () {
            premiumInvoiceSummary();
        }, 100);

    }


    /* Initial run */
    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            runPremiumInvoiceSummary
        );

    } else {

        runPremiumInvoiceSummary();

    }


    /* Watch for the invoice page being refreshed */
    const observer =
        new MutationObserver(function () {

            runPremiumInvoiceSummary();

        });


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    /* Reapply when screen changes */
    window.addEventListener(
        "resize",
        premiumInvoiceSummary
    );


    /* Make it available if needed */
    window.premiumInvoiceSummary =
        premiumInvoiceSummary;

})();
/* =========================================================
   BIZPILOT — REGISTER SERVICE WORKER
   ========================================================= */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", function () {

        navigator.serviceWorker
            .register("./sw.js")
            .then(function (registration) {

                console.log(
                    "BizPilot service worker registered:",
                    registration.scope
                );

            })
            .catch(function (error) {

                console.error(
                    "BizPilot service worker registration failed:",
                    error
                );

            });

    });

}
/* =========================================================
   BIZPILOT v3.0 — LIVE GREETING & DATE
   ========================================================= */

(function () {

    function updateLiveGreeting() {

        const now = new Date();
        const hour = now.getHours();

        let greeting = "Good morning";
        let icon = "🌅";

        if (hour >= 12 && hour < 17) {
            greeting = "Good afternoon";
            icon = "☀️";
        } 
        else if (hour >= 17 && hour < 21) {
            greeting = "Good evening";
            icon = "🌆";
        } 
        else if (hour >= 21 || hour < 5) {
            greeting = "Good night";
            icon = "🌙";
        }

        const day = now.toLocaleDateString("en-KE", {
            weekday: "long"
        });

        const date = now.toLocaleDateString("en-KE", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });

        /*
         * Try several common greeting elements
         * without changing your existing layout.
         */

        const greetingElements = [
            document.getElementById("greeting"),
            document.getElementById("welcomeGreeting"),
            document.getElementById("dashboardGreeting")
        ];

        let greetingElement = null;

        for (let i = 0; i < greetingElements.length; i++) {
            if (greetingElements[i]) {
                greetingElement = greetingElements[i];
                break;
            }
        }

        if (greetingElement) {
            greetingElement.textContent =
                greeting + ", " +
                (window.currentUserName || "there");
        }

        /*
         * Find an existing greeting heading if the
         * dashboard does not use a specific ID.
         */

        if (!greetingElement) {

            const headings =
                document.querySelectorAll(
                    "#dashboard h1, #dashboard h2, #home h1, #home h2"
                );

            headings.forEach(function (heading) {

                const text =
                    heading.textContent
                        .trim()
                        .toLowerCase();

                if (
                    text.includes("good morning") ||
                    text.includes("good afternoon") ||
                    text.includes("good evening") ||
                    text.includes("good night")
                ) {

                    heading.textContent =
                        greeting + ", " +
                        (window.currentUserName || "there");

                }

            });

        }

        /*
         * Update a date element if one already exists.
         */

        const dateElements = [
            document.getElementById("currentDate"),
            document.getElementById("dashboardDate"),
            document.getElementById("todayDate")
        ];

        let dateElement = null;

        for (let i = 0; i < dateElements.length; i++) {
            if (dateElements[i]) {
                dateElement = dateElements[i];
                break;
            }
        }

        if (dateElement) {
            dateElement.textContent =
                day + ", " + date;
        }

        /*
         * Save the current greeting globally so
         * other BizPilot features can use it.
         */

        window.bizPilotGreeting = greeting;
        window.bizPilotToday = day + ", " + date;

    }

    updateLiveGreeting();

    /*
     * Check every minute so the greeting changes
     * automatically while the app is open.
     */

    setInterval(updateLiveGreeting, 60000);

})();
/* =========================================================
   BIZPILOT v3.0 — LIVE DASHBOARD DATE
   ========================================================= */

(function () {

    function updateBizPilotDate() {

        const now = new Date();

        const dayName = now.toLocaleDateString("en-KE", {
            weekday: "long"
        });

        const fullDate = now.toLocaleDateString("en-KE", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });

        const dateText = dayName + ", " + fullDate;

        const possibleDateElements = [
            document.getElementById("currentDate"),
            document.getElementById("dashboardDate"),
            document.getElementById("todayDate")
        ];

        possibleDateElements.forEach(function (element) {

            if (element) {
                element.textContent = dateText;
            }

        });

        window.bizPilotToday = dateText;

    }

    updateBizPilotDate();

    /* Refresh once every minute */
    setInterval(updateBizPilotDate, 60000);

})();