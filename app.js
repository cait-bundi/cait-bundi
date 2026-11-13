
import {
  db,
  collection,
  getDocs,
  query,
  where
} from "./firebase.js";

const $ = id => document.getElementById(id);

const categoryGrid = $("categoryGrid");
const businessGrid = $("businessGrid");
const searchResults = $("searchResults");
const searchInput = $("searchInput");
const categoryFilter = $("categoryFilter");
const resultsCount = $("resultsCount");

let businesses = [];
let categories = [];

const defaultCategories = [
  { name: "Fashion", label: "Fashion & Boutique", icon: "👗" },
  { name: "Food", label: "Food & Bakery", icon: "🎂" },
  { name: "Beauty", label: "Beauty & Wellness", icon: "✨" },
  { name: "Education", label: "Education", icon: "📚" },
  { name: "Services", label: "Professional Services", icon: "💻" },
  { name: "Handicrafts", label: "Handicrafts", icon: "🧵" },
  { name: "Retail & Shopping", label: "Retail & Shopping", icon: "🛍️" },
  { name: "Other", label: "Other", icon: "🏪" }
];

const categoryMap = {
  "Fashion & Boutique": "Fashion",
  "Food & Bakery": "Food",
  "Beauty & Wellness": "Beauty",
  "Professional Services": "Services",
  "Retail & Shopping": "Retail & Shopping"
};

function normalizeCategory(value) {
  const category = String(value || "Other").trim();
  return categoryMap[category] || category;
}

// Only admin-approved custom professions become public categories.
function getPublicCategory(data) {
  const customCategory = String(
    data.customCategory || ""
  ).trim();

  if (
    data.customCategoryApproved === true &&
    customCategory.length > 0
  ) {
    return customCategory;
  }

  return normalizeCategory(data.category);
}

function getCategoryIcon(category) {
  return categories.find(
    item => item.name.toLowerCase() === category.toLowerCase()
  )?.icon || "🏷️";
}

function getBusinessDetailURL(business) {
  const url = new URL("business.html", window.location.href);
  url.searchParams.set("id", business.id);
  return url.href;
}

function createVerifiedBadge(business) {
  if (
    business.status !== "approved" ||
    business.isVerified !== true
  ) {
    return null;
  }

  const badge = document.createElement("span");
  badge.className = "verified-badge";
  badge.textContent = "✓ Verified by CAIT";
  badge.setAttribute("aria-label", "Verified by CAIT");

  return badge;
}

// Build fixed and approved custom categories.
function buildCategories() {
  categories = [...defaultCategories];

  const existingNames = new Set(
    categories.map(item => item.name.toLowerCase())
  );

  businesses.forEach(business => {
    const name = String(business.category || "").trim();

    if (!name) return;

    const key = name.toLowerCase();

    if (existingNames.has(key)) return;

    existingNames.add(key);

    categories.push({
      name,
      label: name,
      icon: "🏷️",
      isCustom: true
    });
  });

  categories.sort((a, b) => {
    const aCustom = a.isCustom === true;
    const bCustom = b.isCustom === true;

    if (aCustom && !bCustom) return 1;
    if (!aCustom && bCustom) return -1;

    return 0;
  });
}

// Update the category dropdown without removing existing options.
function renderCategoryFilter() {
  if (!categoryFilter) return;

  const previousValue = categoryFilter.value;

  categoryFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "All";
  allOption.textContent = "All Categories";

  categoryFilter.appendChild(allOption);

  categories.forEach(category => {
    const option = document.createElement("option");

    option.value = category.name;
    option.textContent = category.label;

    categoryFilter.appendChild(option);
  });

  const optionExists = [...categoryFilter.options].some(
    option => option.value === previousValue
  );

  categoryFilter.value = optionExists ? previousValue : "All";
}

function createCategoryTile(category) {
  const link = document.createElement("a");

  link.className = "category-tile";
  link.href =
    `category.html?category=${encodeURIComponent(category.name)}`;

  const icon = document.createElement("span");
  icon.className = "category-tile-icon";
  icon.textContent = category.icon;

  const name = document.createElement("span");
  name.className = "category-tile-name";
  name.textContent = category.label;

  const count = businesses.filter(
    business =>
      business.category.toLowerCase() ===
      category.name.toLowerCase()
  ).length;

  const countText = document.createElement("span");
  countText.className = "category-tile-count";

  countText.textContent =
    `${count} ${count === 1 ? "business" : "businesses"}`;

  link.append(icon, name, countText);

  return link;
}

function renderCategories() {
  if (!categoryGrid) return;

  categoryGrid.replaceChildren();

  categories.forEach(category => {
    categoryGrid.appendChild(
      createCategoryTile(category)
    );
  });
}

function createBusinessTile(business) {
  const link = document.createElement("a");

  link.className = "business-tile";
  link.href = getBusinessDetailURL(business);

  const icon = document.createElement("span");
  icon.className = "business-tile-icon";
  icon.textContent = getCategoryIcon(business.category);

  const category = document.createElement("span");
  category.className = "business-tile-name";
  category.textContent = business.category;

  const name = document.createElement("span");
  name.className = "business-tile-business-name";
  name.textContent = business.name;

  link.append(icon, category, name);

  const badge = createVerifiedBadge(business);

  if (badge) {
    link.appendChild(badge);
  }

  return link;
}

function renderSearchResults() {
  if (!businessGrid || !searchResults) return;

  const search = searchInput?.value.trim().toLowerCase() || "";
  const selectedCategory = categoryFilter?.value || "All";

  const shouldSearch =
    search.length > 0 ||
    selectedCategory !== "All";

  searchResults.hidden = !shouldSearch;

  if (!shouldSearch) {
    if (resultsCount) {
      resultsCount.textContent =
        `${businesses.length} approved businesses`;
    }

    return;
  }

  const matches = businesses.filter(business => {

    const matchesCategory =
      selectedCategory === "All" ||
      business.category.toLowerCase() ===
      selectedCategory.toLowerCase();

    const searchableText = [
      business.name,
      business.category,
      business.customCategory,
      business.description,
      business.location,
      business.ownerName
    ].join(" ").toLowerCase();

    return (
      matchesCategory &&
      searchableText.includes(search)
    );
  });

  if (resultsCount) {
    resultsCount.textContent =
      `${matches.length} matching business` +
      `${matches.length === 1 ? "" : "es"}`;
  }

  businessGrid.replaceChildren();

  if (matches.length === 0) {
    const empty = document.createElement("div");

    empty.className = "directory-empty-state";
    empty.textContent = "No matching businesses found.";

    businessGrid.appendChild(empty);

    return;
  }

  matches.forEach(business => {
    businessGrid.appendChild(
      createBusinessTile(business)
    );
  });
}

// Load approved businesses from Firestore.
async function loadApprovedBusinesses() {
  if (resultsCount) {
    resultsCount.textContent = "Loading businesses...";
  }

  try {

    const approvedQuery = query(
      collection(db, "businessApplications"),
      where("status", "==", "approved")
    );

    const snapshot = await getDocs(approvedQuery);

    businesses = snapshot.docs.map(docSnap => {

      const data = docSnap.data();

      const category = getPublicCategory(data);

      const address = String(
        data.address || ""
      ).trim();

      const city = String(
        data.city || "Bundi"
      ).trim();

      return {
        id: docSnap.id,

        name: String(
          data.businessName || "Business"
        ),

        ownerName: String(
          data.ownerName || ""
        ),

        category,

        customCategory: String(
          data.customCategory || ""
        ),

        description: String(
          data.description || ""
        ),

        location: [
          address,
          city,
          "Rajasthan",
          "India"
        ].filter(Boolean).join(", "),

        status: data.status,

        isVerified: data.isVerified === true
      };
    });

    // Build categories from approved businesses.
    buildCategories();

    // Update category dropdown.
    renderCategoryFilter();

    // Render category tiles.
    renderCategories();

    // Render search results.
    renderSearchResults();

    console.log(
      "Approved businesses loaded:",
      businesses.length
    );

    console.log(
      "Public categories loaded:",
      categories.map(category => category.name)
    );

  } catch (error) {

    console.error(
      "Directory loading error:",
      error
    );

    if (resultsCount) {
      resultsCount.textContent =
        "Could not load businesses. Please refresh.";
    }

    if (categoryGrid) {
      categoryGrid.textContent =
        "Directory is temporarily unavailable.";
    }
  }
}

// Search button.
$("searchButton")?.addEventListener(
  "click",
  renderSearchResults
);

// Live search.
searchInput?.addEventListener(
  "input",
  renderSearchResults
);

// Category filter.
categoryFilter?.addEventListener(
  "change",
  renderSearchResults
);

// Enter key search.
searchInput?.addEventListener("keydown", event => {

  if (event.key === "Enter") {
    event.preventDefault();
    renderSearchResults();
  }
});

// Footer year.
const yearElement = $("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// Start directory.
loadApprovedBusinesses();
