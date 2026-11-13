
import { db, collection, getDocs } from "./firebase.js";

const galleryContainer = document.getElementById("publicGallery");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "";

  const date = value.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

async function loadGallery() {
  try {
    const snapshot = await getDocs(collection(db, "gallery"));

    const photos = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || 0;
        const dateB = b.createdAt?.toMillis?.() || 0;
        return dateB - dateA;
      });

    if (photos.length === 0) {
      galleryContainer.innerHTML =
        '<p class="gallery-status">Gallery photos will be shared here soon.</p>';
      return;
    }

    galleryContainer.innerHTML = photos.map(photo => `
      <article class="gallery-card">
        <img
          src="${escapeHTML(photo.imageUrl)}"
          alt="${escapeHTML(photo.title || "CAIT Women Wing Bundi event")}"
          loading="lazy"
        >
        <div class="gallery-card-content">
          <span class="gallery-card-date">
            ${escapeHTML(formatDate(photo.eventDate))}
          </span>
          <h3>${escapeHTML(photo.title || "Community Moments")}</h3>
          <p>${escapeHTML(photo.description || "")}</p>
        </div>
      </article>
    `).join("");

  } catch (error) {
    console.error("Gallery loading error:", error);

    galleryContainer.innerHTML =
      '<p class="gallery-status">Gallery load nahi ho paayi. Please try again later.</p>';
  }
}

loadGallery();
