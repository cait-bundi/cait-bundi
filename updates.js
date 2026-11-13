
import {
  db,
  collection,
  getDocs,
  query,
  where
} from "./firebase.js";

const updatesList = document.getElementById("updatesList");
const updatesCount = document.getElementById("updatesCount");

function showMessage(title, message) {
  updatesList.replaceChildren();

  const container = document.createElement("div");
  container.className = "updates-state";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = message;

  container.append(heading, paragraph);
  updatesList.appendChild(container);
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "Community Announcement";
  }

  // Admin form date format: YYYY-MM-DD
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function getCreatedTime(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value.seconds) {
    return value.seconds * 1000;
  }

  return 0;
}

function createUpdateCard(update) {
  const card = document.createElement("article");
  card.className = "update-card";

  if (
    typeof update.imageUrl === "string" &&
    update.imageUrl.trim() &&
    /^https:\/\//i.test(update.imageUrl.trim())
  ) {
    const image = document.createElement("img");

    image.className = "update-image";
    image.src = update.imageUrl.trim();
    image.alt = update.title || "Community update photograph";
    image.loading = "lazy";

    card.appendChild(image);
  }

  const content = document.createElement("div");
  content.className = "update-content";

  const date = document.createElement("span");
  date.className = "update-date";
  date.textContent = formatDate(update.eventDate);

  const title = document.createElement("h2");
  title.className = "update-title";
  title.textContent = update.title || "Community Update";

  const description = document.createElement("p");
  description.className = "update-description";
  description.textContent = update.description || "";

  content.append(date, title, description);
  card.appendChild(content);

  return card;
}

async function loadUpdates() {
  updatesCount.textContent = "Loading updates...";

  updatesList.replaceChildren();

  try {
    const updatesQuery = query(
      collection(db, "communityUpdates"),
      where("isPublished", "==", true)
    );

    const snapshot = await getDocs(updatesQuery);

    if (snapshot.empty) {
      updatesCount.textContent = "0 updates";

      showMessage(
        "No updates yet",
        "There are currently no published announcements. Please check again later."
      );

      return;
    }

    const updates = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    // Show newest announcements first.
    updates.sort((a, b) => {
      return getCreatedTime(b.createdAt) -
             getCreatedTime(a.createdAt);
    });

    updatesCount.textContent =
      `${updates.length} ${updates.length === 1 ? "update" : "updates"} published`;

    const fragment = document.createDocumentFragment();

    updates.forEach(update => {
      fragment.appendChild(createUpdateCard(update));
    });

    updatesList.appendChild(fragment);

  } catch (error) {
    console.error("Could not load community updates:", error);

    updatesCount.textContent = "Unable to load updates";

    showMessage(
      "Something went wrong",
      "Community updates could not be loaded. Please check your internet connection and try again."
    );

    const retryButton = document.createElement("button");
    retryButton.className = "retry-button";
    retryButton.type = "button";
    retryButton.textContent = "Try Again";

    retryButton.addEventListener("click", loadUpdates);

    updatesList.lastElementChild.appendChild(retryButton);
  }
}

loadUpdates();
