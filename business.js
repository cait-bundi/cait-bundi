
import {
  db,
  doc,
  getDoc,
  collection,
  getDocs
} from "./firebase.js";

const $ = id => document.getElementById(id);

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function cleanLocation(value) {
  const parts = String(value || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);

  return parts.filter(
    (part, index) =>
      parts.findIndex(
        other => other.toLowerCase() === part.toLowerCase()
      ) === index
  ).join(", ");
}

function getCategoryIcon(category) {
  const icons = {
    Fashion: "👗",
    Food: "🎂",
    Beauty: "✨",
    Education: "📚",
    Services: "💻",
    Handicrafts: "🧵",
    "Retail & Shopping": "🛍️",
    Other: "🏪"
  };

  return icons[category] || "🏪";
}

function buildLocation(data) {
  const address = String(data.address || "").trim();
  const city = String(data.city || "Bundi").trim();

  return cleanLocation(
    [address, city, "Rajasthan", "India"].join(", ")
  );
}

function addAction(container, label, href, type = "secondary") {
  const link = document.createElement("a");

  link.textContent = label;
  link.href = href;
  link.className =
    type === "call"
      ? "detail-primary-button"
      : type === "whatsapp"
        ? "detail-secondary-button whatsapp-action"
        : "detail-secondary-button";

  if (href.startsWith("https://")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  container.appendChild(link);
}

function cleanPhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function getCallNumber(value) {
  const raw = String(value || "").trim();
  const digits = cleanPhoneNumber(raw);

  if (digits.length < 10 || digits.length > 15) {
    return "";
  }

  return raw.startsWith("+") ? `+${digits}` : digits;
}

function getWhatsAppNumber(value) {
  const digits = cleanPhoneNumber(value);

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return "";
}

function renderBusinessPhotos(photos, businessName) {
  const gallery = $("businessPhotoGallery");

  if (!gallery) return;

  gallery.replaceChildren();

  const safePhotos = Array.isArray(photos)
    ? photos.filter(photo =>
        typeof photo === "string" &&
        photo.startsWith("https://res.cloudinary.com/sany2xgf/")
      ).slice(0, 2)
    : [];

  if (safePhotos.length === 0) {
    gallery.hidden = true;
    return;
  }

  safePhotos.forEach((photo, index) => {
    const image = document.createElement("img");

    image.src = photo;
    image.alt = `${businessName} - Photo ${index + 1}`;
    image.loading = "lazy";

    image.addEventListener("error", () => {
      image.remove();

      if (gallery.children.length === 0) {
        gallery.hidden = true;
      }
    });

    gallery.appendChild(image);
  });

  gallery.hidden = false;
}

function showNotFound() {
  const detail = $("businessDetail");
  const notFound = $("businessNotFound");

  if (detail) detail.hidden = true;
  if (notFound) notFound.hidden = false;

  document.title = "Business Unavailable | CAIT Women Wing Bundi";
}

function renderContactActions(actions, data, businessName) {
  actions.replaceChildren();

  const callAllowed =
    typeof data.callEnabled === "boolean"
      ? data.callEnabled
      : data.contactPublic === true;

  const callNumber = getCallNumber(data.businessContact);

  if (callAllowed && callNumber) {
    addAction(
      actions,
      "Call Business",
      `tel:${callNumber}`,
      "call"
    );
  }

  const whatsappNumber = getWhatsAppNumber(data.whatsappNumber);

  if (data.whatsappEnabled === true && whatsappNumber) {
    const message =
      `Namaste, mujhe ${businessName} ke baare mein jankari chahiye.`;

    const whatsappURL =
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    addAction(
      actions,
      "WhatsApp Business",
      whatsappURL,
      "whatsapp"
    );
  }

  addAction(
    actions,
    "Back to Directory",
    "index.html#directory"
  );
}

/* Format 24-hour time into 12-hour time */
function formatTime(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) return "";

  let hours = Number(match[1]);
  const minutes = match[2];

  const period = hours >= 12 ? "PM" : "AM";

  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${period}`;
}

/* Display simple daily opening hours and weekly holiday */
function renderOpeningHours(openingHours, weeklyHoliday) {
  const container = $("businessOpeningHours");

  if (!container) return;

  container.replaceChildren();

  const open = openingHours?.open || "";
  const close = openingHours?.close || "";

  const validOpen = formatTime(open);
  const validClose = formatTime(close);

  if (!validOpen || !validClose || open >= close) {
    const message = document.createElement("p");
    message.className = "hours-unavailable";
    message.textContent = "Opening hours have not been added yet.";

    container.appendChild(message);
    return;
  }

  const dailyRow = document.createElement("div");
  dailyRow.className = "opening-hour-row";

  const dailyLabel = document.createElement("span");
  dailyLabel.className = "opening-hour-day";
  dailyLabel.textContent = "Daily Timing";

  const dailyTime = document.createElement("span");
  dailyTime.className = "opening-hour-time";
  dailyTime.textContent = `${validOpen} – ${validClose}`;

  dailyRow.append(dailyLabel, dailyTime);
  container.appendChild(dailyRow);

  const holidayRow = document.createElement("div");
  holidayRow.className = "opening-hour-row";

  const holidayLabel = document.createElement("span");
  holidayLabel.className = "opening-hour-day";
  holidayLabel.textContent = "Weekly Holiday";

  const holidayValue = document.createElement("span");
  holidayValue.className = "opening-hour-time";
  holidayValue.textContent =
    weeklyHoliday || "No fixed weekly holiday";

  if (weeklyHoliday) {
    holidayValue.classList.add("closed-label");
  }

  holidayRow.append(holidayLabel, holidayValue);
  container.appendChild(holidayRow);
}

/* Safely accept only images uploaded to your Cloudinary account */
function getSafeProductPhotos(photos) {
  if (!Array.isArray(photos)) return [];

  return photos
    .filter(photo =>
      typeof photo === "string" &&
      photo.startsWith("https://res.cloudinary.com/sany2xgf/")
    )
    .slice(0, 5);
}

/* Display product images */
function renderProductImages(container, photos, productName) {
  if (!photos.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "public-product-no-image";
    placeholder.textContent = "🛍️";
    placeholder.setAttribute("aria-label", "No product photo");

    container.appendChild(placeholder);
    return;
  }

  photos.forEach((photo, index) => {
    const image = document.createElement("img");

    image.src = photo;
    image.alt = `${productName} - Photo ${index + 1}`;
    image.loading = "lazy";

    if (index === 0) {
      image.className = "public-product-image";
    } else {
      image.style.width = "58px";
      image.style.height = "58px";
      image.style.objectFit = "cover";
      image.style.borderRadius = "8px";
      image.style.margin = "8px 5px 0 0";
      image.style.border = "1px solid #e5e7eb";
    }

    image.addEventListener("error", () => {
      image.remove();

      if (container.querySelectorAll("img").length === 0) {
        container.replaceChildren();

        const placeholder = document.createElement("div");
        placeholder.className = "public-product-no-image";
        placeholder.textContent = "🛍️";

        container.appendChild(placeholder);
      }
    });

    container.appendChild(image);
  });
}

/* Create one product card */
function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "public-product-card";

  const productName = String(product.productName || "Product");

  const imageContainer = document.createElement("div");

  renderProductImages(
    imageContainer,
    getSafeProductPhotos(product.photos),
    productName
  );

  const content = document.createElement("div");
  content.className = "public-product-content";

  const heading = document.createElement("h3");
  heading.textContent = productName;

  const description = document.createElement("p");
  description.className = "public-product-description";
  description.textContent =
    String(product.description || "No description available.");

  content.append(heading, description);

  if (
    product.price !== undefined &&
    product.price !== null &&
    product.price !== "" &&
    Number.isFinite(Number(product.price)) &&
    Number(product.price) >= 0
  ) {
    const price = document.createElement("p");
    price.className = "public-product-price";
    price.textContent =
      `₹${Number(product.price).toLocaleString("en-IN")}`;

    content.appendChild(price);
  }

  const status = document.createElement("span");
  status.className = "public-product-status";

  if (product.isAvailable === true) {
    status.textContent = "Available";
  } else {
    status.textContent = "Currently unavailable";
    status.classList.add("unavailable");
  }

  content.appendChild(status);

  card.append(imageContainer, content);

  return card;
}

/* Load products from Firebase */
async function loadBusinessProducts(businessId) {
  const container = $("businessProducts");

  if (!container) return;

  container.replaceChildren();

  try {
    const productsRef = collection(
      db,
      "businessApplications",
      businessId,
      "products"
    );

    const productsSnapshot = await getDocs(productsRef);

    if (productsSnapshot.empty) {
      const message = document.createElement("p");
      message.className = "products-empty";
      message.textContent =
        "No products or services have been added yet.";

      container.appendChild(message);
      return;
    }

    let visibleProducts = 0;

    productsSnapshot.forEach(productDoc => {
      const product = productDoc.data();

      if (
        product.ownerUid &&
        typeof product.ownerUid !== "string"
      ) {
        return;
      }

      container.appendChild(createProductCard(product));
      visibleProducts++;
    });

    if (visibleProducts === 0) {
      const message = document.createElement("p");
      message.className = "products-empty";
      message.textContent =
        "No products or services have been added yet.";

      container.appendChild(message);
    }

  } catch (error) {
    console.error("Could not load business products:", error);

    const message = document.createElement("p");
    message.className = "products-empty";
    message.textContent =
      "Products could not be loaded right now. Please try again later.";

    container.appendChild(message);
  }
}

/* Load and display business details */
async function renderBusiness() {
  const params = new URLSearchParams(window.location.search);
  const businessId = params.get("id");

  if (!businessId) {
    showNotFound();
    return;
  }

  try {
    const businessRef = doc(db, "businessApplications", businessId);
    const businessSnap = await getDoc(businessRef);

    if (!businessSnap.exists()) {
      showNotFound();
      return;
    }

    const data = businessSnap.data();

    if (data.status !== "approved") {
      showNotFound();
      return;
    }

    const name = String(data.businessName || "Business");
    const category = String(data.category || "Other");

    const description =
      String(data.description || "").trim() ||
      "Business description not provided.";

    const location = buildLocation(data);

    setText("detailIcon", getCategoryIcon(category));
    setText("detailCategory", category);
    setText("detailName", name);
    setText("detailDescription", description);
    setText("detailLocation", location);
    setText("mapAddress", location);

    renderBusinessPhotos(data.businessPhotos, name);

    // Business owner
    const ownerRow = $("ownerRow");
    const ownerName = String(data.ownerName || "").trim();

    if (ownerRow && ownerName) {
      ownerRow.hidden = false;
      setText("detailOwner", ownerName);
    } else if (ownerRow) {
      ownerRow.hidden = true;
    }

    document.title = `${name} | CAIT Women Wing Bundi`;

    // Call and WhatsApp buttons
    const actions = $("detailActions");

    if (actions) {
      renderContactActions(actions, data, name);
    }

    // Opening hours and weekly holiday
    renderOpeningHours(
      data.openingHours,
      data.weeklyHoliday
    );

    // Products and services
    await loadBusinessProducts(businessSnap.id);

    // Google Maps
    const mapSearch = encodeURIComponent(location);

    const mapFrame = $("businessMap");
    const mapsLink = $("openGoogleMaps");

    if (mapFrame) {
      mapFrame.src =
        `https://maps.google.com/maps?q=${mapSearch}&output=embed`;
    }

    if (mapsLink) {
      mapsLink.href =
        `https://www.google.com/maps/search/?api=1&query=${mapSearch}`;
    }

  } catch (error) {
    console.error("Could not load business details:", error);
    showNotFound();
  }
}

renderBusiness();
