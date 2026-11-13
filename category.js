
import {
  db,
  collection,
  getDocs,
  query,
  where
} from "./firebase.js";

const $ = id => document.getElementById(id);

const categories = {
  Fashion: { label: "Fashion & Boutique", icon: "👗" },
  Food: { label: "Food & Bakery", icon: "🎂" },
  Beauty: { label: "Beauty & Wellness", icon: "✨" },
  Education: { label: "Education", icon: "📚" },
  Services: { label: "Professional Services", icon: "💻" },
  Handicrafts: { label: "Handicrafts", icon: "🧵" },
  "Retail & Shopping": { label: "Retail & Shopping", icon: "🛍️" },
  Other: { label: "Other", icon: "🏪" }
};

const categoryMap = {
  "Fashion & Boutique": "Fashion",
  "Food & Bakery": "Food",
  "Beauty & Wellness": "Beauty",
  "Professional Services": "Services"
};

function normalizeCategory(value) {
  const category = String(value || "Other").trim();
  return categoryMap[category] || category;
}

function sameCategory(a, b) {
  return String(a || "").trim().toLowerCase() ===
    String(b || "").trim().toLowerCase();
}

function getBusinessCategory(data) {
  if (
    data.customCategoryApproved === true &&
    typeof data.customCategory === "string" &&
    data.customCategory.trim()
  ) {
    return data.customCategory.trim();
  }

  return normalizeCategory(data.category);
}

function getBusinessPhoto(photos) {
  if (!Array.isArray(photos)) return "";

  return photos.find(photo =>
    typeof photo === "string" &&
    photo.startsWith("https://res.cloudinary.com/sany2xgf/")
  ) || "";
}

function createBusinessCard(business, icon) {
  const link = document.createElement("a");
  link.className = "category-business-card";

  const url = new URL("business.html", window.location.href);
  url.searchParams.set("id", business.id);
  link.href = url.href;

  const media = document.createElement("div");
  media.className = "category-business-media";

  if (business.photo) {
    const image = document.createElement("img");

    image.className = "category-business-photo";
    image.src = business.photo;
    image.alt = `${business.name} business photo`;
    image.loading = "lazy";

    image.addEventListener("error", () => {
      const placeholder = document.createElement("div");
      placeholder.className = "category-business-placeholder";
      placeholder.textContent = icon;
      media.replaceChildren(placeholder);
    });

    media.appendChild(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "category-business-placeholder";
    placeholder.textContent = icon;
    media.appendChild(placeholder);
  }

  const name = document.createElement("h3");
  name.textContent = business.name;

  const description = document.createElement("p");
  description.textContent =
    business.description || "Business details available.";

  const location = document.createElement("p");
  location.textContent = business.location;

  link.append(media, name, description, location);

  return link;
}

async function loadCategoryBusinesses() {
  const params = new URLSearchParams(window.location.search);
  const requestedCategory = (params.get("category") || "").trim();

  const grid = $("categoryBusinessGrid");

  if (!requestedCategory) {
    $("categoryTitle").textContent = "Category not found";
    grid.textContent =
      "Please return to the homepage and select a valid category.";
    return;
  }

  const normalizedRequested = normalizeCategory(requestedCategory);

  const categoryInfo = categories[normalizedRequested] || {
    label: requestedCategory,
    icon: "🏷️"
  };

  $("categoryTitle").textContent =
    `${categoryInfo.icon} ${categoryInfo.label}`;

  document.title =
    `${categoryInfo.label} | CAIT Women Wing Bundi`;

  try {
    const approvedQuery = query(
      collection(db, "businessApplications"),
      where("status", "==", "approved")
    );

    const snapshot = await getDocs(approvedQuery);

    const businesses = snapshot.docs
      .map(docSnap => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          name: String(data.businessName || "Business"),
          category: getBusinessCategory(data),
          description: String(data.description || ""),
          location: [
            String(data.address || "").trim(),
            String(data.city || "Bundi").trim(),
            "Rajasthan"
          ].filter(Boolean).join(", "),
          photo: getBusinessPhoto(data.businessPhotos),
          isVerified: data.isVerified === true
        };
      })
      .filter(business =>
        sameCategory(business.category, normalizedRequested)
      );

    $("categoryCount").textContent =
      `${businesses.length} approved business${businesses.length === 1 ? "" : "es"}`;

    grid.replaceChildren();

    if (businesses.length === 0) {
      const empty = document.createElement("div");
      empty.className = "category-empty";
      empty.textContent =
        "No approved businesses in this category yet. Please check again later.";

      grid.appendChild(empty);
      return;
    }

    businesses.forEach(business => {
      grid.appendChild(
        createBusinessCard(business, categoryInfo.icon)
      );
    });

  } catch (error) {
    console.error("Category loading error:", error);

    grid.textContent =
      "Businesses could not be loaded. Please refresh the page.";
  }
}

loadCategoryBusinesses();
