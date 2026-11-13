
import {
  auth,
  db,
  doc,
  getDoc,
  updateDoc,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  serverTimestamp
} from "./firebase.js";

const ADMIN_UID = "Ea8Ehp5zWveSB9S1mMjsaA0sYtv1";

const CLOUDINARY_CLOUD_NAME = "sany2xgf";
const CLOUDINARY_UPLOAD_PRESET = "cait_business_photos";

const $ = id => document.getElementById(id);

const loadingCard = $("loadingCard");
const loadingMessage = $("loadingMessage");
const profileCard = $("profileCard");
const profileForm = $("profileForm");
const formMessage = $("formMessage");
const saveButton = $("saveButton");
const logoutButton = $("logoutButton");

const productForm = $("productForm");
const productMessage = $("productMessage");
const productList = $("productList");
const productSaveButton = $("productSaveButton");
const cancelProductEdit = $("cancelProductEdit");
const productPhotoInput = $("productPhotos");
const productPhotoPreview = $("productPhotoPreview");

let applicationId = "";
let originalApplication = null;
let saving = false;
let loadingProfile = false;
let isDirty = false;
let lastSavedValues = null;
let productBusy = false;
let editingProductPhotos = [];

const fields = [
  "businessName",
  "category",
  "address",
  "city",
  "description",
  "businessContact",
  "callEnabled",
  "whatsappNumber",
  "whatsappEnabled"
];

const categoryAliases = {
  "Fashion & Boutique": "Fashion",
  "Food & Bakery": "Food",
  "Beauty & Wellness": "Beauty",
  "Professional Services": "Services"
};

/* OPENING HOURS */

function getOpeningHours() {
  return {
    open: $("openingTime").value,
    close: $("closingTime").value
  };
}

function fillOpeningHours(data = {}) {
  const hours = data.openingHours || {};

  $("openingTime").value = hours.open || "";
  $("closingTime").value = hours.close || "";

  $("weeklyHoliday").value = data.weeklyHoliday || "";
}

function getFormValues() {
  const callEnabled = $("callEnabled").checked;

  return {
    businessName: $("businessName").value.trim(),
    category: $("category").value,
    address: $("address").value.trim(),
    city: $("city").value.trim(),
    description: $("description").value.trim(),
    businessContact: $("businessContact").value.trim(),
    callEnabled,
    whatsappNumber: $("whatsappNumber").value.trim(),
    whatsappEnabled: $("whatsappEnabled").checked,
    contactPublic: callEnabled,
    openingHours: getOpeningHours(),
    weeklyHoliday: $("weeklyHoliday").value
  };
}

/* MESSAGES */

function showMessage(message, type = "info") {
  formMessage.textContent = message;
  formMessage.dataset.type = type;
  formMessage.hidden = false;
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.hidden = true;
  delete formMessage.dataset.type;
}

function showProductMessage(message, type = "info") {
  productMessage.textContent = message;
  productMessage.dataset.type = type;
  productMessage.hidden = false;
}

function clearProductMessage() {
  productMessage.textContent = "";
  productMessage.hidden = true;
  delete productMessage.dataset.type;
}

function showError(message) {
  loadingMessage.textContent = message;
  loadingCard.hidden = false;
  profileCard.hidden = true;
}

function setSavingState(value) {
  saving = value;
  saveButton.disabled = value;
  logoutButton.disabled = value;
  saveButton.textContent = value ? "Saving..." : "Save Changes";
}

/* UNSAVED CHANGES */

function valuesMatch(a, b) {
  if (!a || !b) return false;

  return fields.every(key => a[key] === b[key]) &&
    JSON.stringify(a.openingHours) === JSON.stringify(b.openingHours) &&
    a.weeklyHoliday === b.weeklyHoliday;
}

function updateDirtyState() {
  if (!lastSavedValues) return;

  isDirty = !valuesMatch(getFormValues(), lastSavedValues);

  if (isDirty) {
    showMessage(
      "Aapke kuch changes abhi save nahi hue hain.",
      "info"
    );
  } else {
    clearMessage();
  }
}

/* FILL PROFILE */

function fillForm(data) {
  $("businessHeading").textContent =
    data.businessName || "Your Business";

  $("businessName").value = data.businessName || "";

  const storedCategory = data.category || "Other";
  const normalizedCategory =
    categoryAliases[storedCategory] || storedCategory;

  const categorySelect = $("category");

  const supportedCategory = Array.from(categorySelect.options)
    .some(option => option.value === normalizedCategory);

  categorySelect.value = supportedCategory
    ? normalizedCategory
    : "Other";

  $("address").value = data.address || "";
  $("city").value = data.city || "Bundi";
  $("description").value = data.description || "";
  $("businessContact").value = data.businessContact || "";

  $("callEnabled").checked =
    typeof data.callEnabled === "boolean"
      ? data.callEnabled
      : data.contactPublic === true;

  $("whatsappNumber").value = data.whatsappNumber || "";
  $("whatsappEnabled").checked = data.whatsappEnabled === true;

  fillOpeningHours(data);

  $("statusText").textContent = "● Approved listing";

  lastSavedValues = getFormValues();
  isDirty = false;
  clearMessage();
}

/* ERROR HANDLING */

function describeError(error) {
  const code = error?.code || "";

  if (code.includes("permission-denied")) {
    return "Firebase ne save karne ki permission nahi di. Firestore Rules check karein.";
  }

  if (code.includes("unauthenticated")) {
    return "Aapka login expire ho gaya hai. Dobara login karein.";
  }

  if (
    code.includes("network-request-failed") ||
    code.includes("unavailable")
  ) {
    return "Network issue hai. Internet check karke dobara try karein.";
  }

  if (code.includes("not-found")) {
    return "Business record nahi mila. Admin se application ID verify karwayein.";
  }

  console.error("Detailed Firebase error:", error);

  return "Changes save nahi hue. Internet, login aur Firestore Rules check karke dobara try karein.";
}

function validPhone(phone) {
  return /^[0-9+\-()\s]{7,20}$/.test(phone);
}

function validateOpeningHours(hours) {
  const hasOpen = Boolean(hours.open);
  const hasClose = Boolean(hours.close);

  if (hasOpen !== hasClose) {
    return "Opening aur Closing dono time bharna zaroori hai.";
  }

  if (hasOpen && hours.open >= hours.close) {
    return "Closing time, Opening time ke baad hona chahiye.";
  }

  return "";
}

/* LOAD MEMBER PROFILE */

async function loadProfile(user) {
  if (loadingProfile) return;

  loadingProfile = true;

  try {
    if (user.uid === ADMIN_UID) {
      showError(
        "Ye admin account hai. Owner dashboard ke liye member account se login karein."
      );
      return;
    }

    loadingMessage.textContent = "Loading your member profile...";

    const memberRef = doc(db, "members", user.uid);
    const memberSnapshot = await getDoc(memberRef);

    if (!memberSnapshot.exists()) {
      showError(
        "Member profile nahi mila. Pehle business registration complete karein ya admin se contact karein."
      );
      return;
    }

    const member = memberSnapshot.data();
    applicationId = member.applicationId || "";

    if (!applicationId) {
      showError(
        "Application ID nahi mila. Admin se member profile verify karwayein."
      );
      return;
    }

    loadingMessage.textContent =
      "Loading your approved business listing...";

    const applicationRef = doc(
      db,
      "businessApplications",
      applicationId
    );

    const applicationSnapshot = await getDoc(applicationRef);

    if (!applicationSnapshot.exists()) {
      showError("Business application nahi mili. Admin se contact karein.");
      return;
    }

    const application = applicationSnapshot.data();

    if (application.ownerUid !== user.uid) {
      showError(
        "Access denied: ye business profile aapke account ki nahi hai."
      );
      return;
    }

    if (application.status !== "approved") {
      showError(
        "Aapki listing abhi approved nahi hai. Approval ke baad editing available hogi."
      );
      return;
    }

    originalApplication = application;
    fillForm(application);

    loadingCard.hidden = true;
    profileCard.hidden = false;

    await loadProducts();

  } catch (error) {
    console.error("Profile loading error:", error);
    showError(describeError(error));
  } finally {
    loadingProfile = false;
  }
}

/* PROFILE FORM EVENTS */

profileForm.addEventListener("input", updateDirtyState);
profileForm.addEventListener("change", updateDirtyState);

profileForm.addEventListener("submit", async event => {
  event.preventDefault();

  const user = auth.currentUser;

  if (!user || !applicationId || !originalApplication || saving) {
    showMessage(
      "Profile ready nahi hai. Page refresh karke dobara login karein.",
      "error"
    );
    return;
  }

  if (
    user.uid === ADMIN_UID ||
    originalApplication.ownerUid !== user.uid
  ) {
    showMessage(
      "Is account ko is business ko edit karne ki permission nahi hai.",
      "error"
    );
    return;
  }

  if (originalApplication.status !== "approved") {
    showMessage(
      "Sirf approved listing edit ki ja sakti hai.",
      "error"
    );
    return;
  }

  if (!profileForm.reportValidity()) return;

  const values = getFormValues();

  if (
    !values.businessName ||
    !values.category ||
    !values.address ||
    !values.city
  ) {
    showMessage(
      "Business name, category, address aur city bharna zaroori hai.",
      "error"
    );
    return;
  }

  if (
    values.businessContact &&
    !validPhone(values.businessContact)
  ) {
    showMessage("Call number ka format check karein.", "error");
    return;
  }

  if (
    values.whatsappNumber &&
    !validPhone(values.whatsappNumber)
  ) {
    showMessage("WhatsApp number ka format check karein.", "error");
    return;
  }

  if (values.callEnabled && !values.businessContact) {
    showMessage(
      "Call button enable karne ke liye Call Number bharna zaroori hai.",
      "error"
    );
    return;
  }

  if (values.whatsappEnabled && !values.whatsappNumber) {
    showMessage(
      "WhatsApp button enable karne ke liye WhatsApp Number bharna zaroori hai.",
      "error"
    );
    return;
  }

  const hoursError = validateOpeningHours(values.openingHours);

  if (hoursError) {
    showMessage(hoursError, "error");
    return;
  }

  setSavingState(true);
  showMessage("Changes save ho rahe hain...", "info");

  try {
    const applicationRef = doc(
      db,
      "businessApplications",
      applicationId
    );

    await updateDoc(applicationRef, {
      businessName: values.businessName,
      category: values.category,
      address: values.address,
      city: values.city,
      description: values.description,
      businessContact: values.businessContact,
      callEnabled: values.callEnabled,
      contactPublic: values.callEnabled,
      whatsappNumber: values.whatsappNumber,
      whatsappEnabled: values.whatsappEnabled,
      openingHours: values.openingHours,
      weeklyHoliday: values.weeklyHoliday
    });

    originalApplication = {
      ...originalApplication,
      ...values
    };

    fillForm(originalApplication);

    showMessage(
      "Changes successfully save ho gaye.",
      "success"
    );

  } catch (error) {
    console.error("Profile update error:", error);
    showMessage(describeError(error), "error");
  } finally {
    setSavingState(false);
  }
});

/* CLOUDINARY PHOTO UPLOAD */

async function uploadProductPhoto(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Sirf image files upload kar sakte hain.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Har product photo 5 MB se chhoti honi chahiye.");
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "cait-business-photos");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const result = await response.json();

  if (!response.ok || !result.secure_url) {
    console.error("Cloudinary upload error:", result);
    throw new Error(
      result.error?.message || "Photo upload nahi ho payi."
    );
  }

  return result.secure_url;
}

function showSelectedPhotoPreview(files) {
  productPhotoPreview.replaceChildren();

  Array.from(files).forEach(file => {
    const image = document.createElement("img");

    image.alt = "Selected product photo";
    image.src = URL.createObjectURL(file);

    image.onload = () => URL.revokeObjectURL(image.src);

    productPhotoPreview.appendChild(image);
  });
}

productPhotoInput.addEventListener("change", () => {
  const files = productPhotoInput.files;

  if (files.length > 5) {
    showProductMessage(
      "Maximum 5 photos select kar sakte hain.",
      "error"
    );

    productPhotoInput.value = "";
    productPhotoPreview.replaceChildren();
    return;
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      showProductMessage("Sirf image files select karein.", "error");
      productPhotoInput.value = "";
      productPhotoPreview.replaceChildren();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showProductMessage(
        "Har photo 5 MB se chhoti honi chahiye.",
        "error"
      );

      productPhotoInput.value = "";
      productPhotoPreview.replaceChildren();
      return;
    }
  }

  clearProductMessage();
  showSelectedPhotoPreview(files);
});

/* PRODUCT COLLECTION */

function getProductsCollection() {
  return collection(
    db,
    "businessApplications",
    applicationId,
    "products"
  );
}

/* LOAD PRODUCTS */

async function loadProducts() {
  if (!applicationId) return;

  productList.replaceChildren();

  const loading = document.createElement("div");
  loading.className = "product-empty";
  loading.textContent = "Loading products...";

  productList.appendChild(loading);

  try {
    const snapshot = await getDocs(getProductsCollection());

    productList.replaceChildren();

    if (snapshot.empty) {
      const empty = document.createElement("div");
      empty.className = "product-empty";
      empty.textContent = "Abhi koi product add nahi kiya gaya hai.";

      productList.appendChild(empty);
      return;
    }

    snapshot.forEach(productDoc => {
      const product = productDoc.data();
      const id = productDoc.id;

      const card = document.createElement("article");
      card.className = "product-item";

      const image = document.createElement("img");
      image.alt = product.productName || "Product";

      if (Array.isArray(product.photos) && product.photos.length) {
        image.src = product.photos[0];
      } else {
        image.alt = "No product photo";
      }

      const content = document.createElement("div");
      content.className = "product-item-content";

      const name = document.createElement("h4");
      name.textContent = product.productName || "Unnamed product";

      const price = document.createElement("p");
      price.className = "product-price";

      price.textContent =
        typeof product.price === "number"
          ? `₹${product.price}`
          : "Price not provided";

      const availability = document.createElement("p");
      availability.className = "member-muted";
      availability.textContent =
        product.isAvailable === false ? "Unavailable" : "Available";

      const actions = document.createElement("div");
      actions.className = "product-item-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";

      editButton.addEventListener("click", () => {
        editProduct(id, product);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.className = "delete-product";

      deleteButton.addEventListener("click", () => {
        removeProduct(id, product.productName);
      });

      actions.append(editButton, deleteButton);
      content.append(name, price, availability, actions);
      card.append(image, content);

      productList.appendChild(card);
    });

  } catch (error) {
    console.error("Product loading error:", error);

    const message = document.createElement("div");
    message.className = "product-empty";
    message.textContent =
      "Products load nahi ho paye. Firestore Rules aur internet check karein.";

    productList.replaceChildren(message);
  }
}

/* RESET PRODUCT FORM */

function resetProductForm() {
  productForm.reset();

  $("productId").value = "";
  productPhotoPreview.replaceChildren();

  editingProductPhotos = [];

  productSaveButton.textContent = "Add Product";
  cancelProductEdit.hidden = true;

  clearProductMessage();
}

/* EDIT PRODUCT */

function editProduct(id, product) {
  $("productId").value = id;
  $("productName").value = product.productName || "";

  $("productPrice").value =
    typeof product.price === "number" ? product.price : "";

  $("productDescription").value = product.description || "";

  $("productAvailability").value =
    product.isAvailable === false ? "false" : "true";

  productPhotoInput.value = "";

  editingProductPhotos = Array.isArray(product.photos)
    ? product.photos
    : [];

  productPhotoPreview.replaceChildren();

  editingProductPhotos.forEach(url => {
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Current product photo";

    productPhotoPreview.appendChild(image);
  });

  productSaveButton.textContent = "Update Product";
  cancelProductEdit.hidden = false;

  clearProductMessage();

  productForm.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

cancelProductEdit.addEventListener("click", resetProductForm);

/* ADD / UPDATE PRODUCT */

productForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (productBusy) return;

  const user = auth.currentUser;

  if (
    !user ||
    !applicationId ||
    !originalApplication ||
    user.uid === ADMIN_UID ||
    originalApplication.ownerUid !== user.uid ||
    originalApplication.status !== "approved"
  ) {
    showProductMessage(
      "Aapko products manage karne ki permission nahi hai.",
      "error"
    );
    return;
  }

  if (!productForm.reportValidity()) return;

  const productId = $("productId").value;
  const productName = $("productName").value.trim();
  const description = $("productDescription").value.trim();
  const priceText = $("productPrice").value.trim();

  const isAvailable =
    $("productAvailability").value === "true";

  const selectedFiles = Array.from(productPhotoInput.files);

  if (!productName || productName.length > 100) {
    showProductMessage(
      "Product name 1 se 100 characters ka hona chahiye.",
      "error"
    );
    return;
  }

  if (description.length > 500) {
    showProductMessage(
      "Description maximum 500 characters ka ho sakta hai.",
      "error"
    );
    return;
  }

  let price;

  if (priceText !== "") {
    price = Number(priceText);

    if (!Number.isFinite(price) || price < 0) {
      showProductMessage(
        "Product price valid aur zero ya usse zyada hona chahiye.",
        "error"
      );
      return;
    }
  }

  if (selectedFiles.length > 5) {
    showProductMessage(
      "Maximum 5 photos select kar sakte hain.",
      "error"
    );
    return;
  }

  if (!productId && selectedFiles.length === 0) {
    showProductMessage(
      "Naya product add karne ke liye kam se kam 1 photo zaroori hai.",
      "error"
    );
    return;
  }

  if (
    selectedFiles.length === 0 &&
    editingProductPhotos.length === 0
  ) {
    showProductMessage(
      "Product ke liye kam se kam 1 photo zaroori hai.",
      "error"
    );
    return;
  }

  productBusy = true;
  productSaveButton.disabled = true;
  productSaveButton.textContent = "Please wait...";

  try {
    let photos = editingProductPhotos;

    if (selectedFiles.length > 0) {
      showProductMessage(
        "Product photos upload ho rahi hain...",
        "info"
      );

      photos = [];

      for (let index = 0; index < selectedFiles.length; index++) {
        showProductMessage(
          `Photo ${index + 1} of ${selectedFiles.length} upload ho rahi hai...`,
          "info"
        );

        const url = await uploadProductPhoto(selectedFiles[index]);
        photos.push(url);
      }
    }

    if (photos.length < 1 || photos.length > 5) {
      throw new Error("Product ke liye 1 se 5 photos zaroori hain.");
    }

    const productData = {
      ownerUid: user.uid,
      productName,
      description,
      photos,
      isAvailable,
      updatedAt: serverTimestamp()
    };

    if (price !== undefined) {
      productData.price = price;
    }

    if (productId) {
      const productRef = doc(
        db,
        "businessApplications",
        applicationId,
        "products",
        productId
      );

      await updateDoc(productRef, productData);

      showProductMessage(
        "Product successfully update ho gaya!",
        "success"
      );

    } else {
      productData.createdAt = serverTimestamp();

      await addDoc(getProductsCollection(), productData);

      showProductMessage(
        "Naya product successfully add ho gaya!",
        "success"
      );
    }

    resetProductForm();
    await loadProducts();

  } catch (error) {
    console.error("Product save error:", error);

    showProductMessage(
      error.message || describeError(error),
      "error"
    );

  } finally {
    productBusy = false;
    productSaveButton.disabled = false;

    productSaveButton.textContent =
      $("productId").value ? "Update Product" : "Add Product";
  }
});

/* DELETE PRODUCT */

async function removeProduct(id, name) {
  if (productBusy) return;

  const confirmed = window.confirm(
    `"${name || "Ye product"}" delete karna chahte hain?`
  );

  if (!confirmed) return;

  const user = auth.currentUser;

  if (
    !user ||
    !originalApplication ||
    user.uid !== originalApplication.ownerUid ||
    originalApplication.status !== "approved"
  ) {
    showProductMessage(
      "Aapko product delete karne ki permission nahi hai.",
      "error"
    );
    return;
  }

  productBusy = true;
  productSaveButton.disabled = true;

  try {
    const productRef = doc(
      db,
      "businessApplications",
      applicationId,
      "products",
      id
    );

    await deleteDoc(productRef);

    showProductMessage(
      "Product successfully delete ho gaya.",
      "success"
    );

    await loadProducts();

  } catch (error) {
    console.error("Product delete error:", error);
    showProductMessage(describeError(error), "error");

  } finally {
    productBusy = false;
    productSaveButton.disabled = false;
  }
}

/* LOGOUT */

logoutButton.addEventListener("click", async () => {
  if (saving || productBusy) return;

  if (
    isDirty &&
    !window.confirm(
      "Aapke kuch changes save nahi hue hain. Kya aap phir bhi logout karna chahte hain?"
    )
  ) {
    return;
  }

  logoutButton.disabled = true;

  try {
    await signOut(auth);
    window.location.href = "login.html";

  } catch (error) {
    console.error("Logout error:", error);

    logoutButton.disabled = false;

    showMessage(
      "Logout nahi ho paya. Dobara try karein.",
      "error"
    );
  }
});

window.addEventListener("beforeunload", event => {
  if (isDirty && !saving) {
    event.preventDefault();
    event.returnValue = "";
  }
});

/* AUTH CHECK */

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  loadProfile(user);
});
