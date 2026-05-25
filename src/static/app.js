document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const authToggle = document.getElementById("auth-toggle");
  const authStatus = document.getElementById("auth-status");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLogin = document.getElementById("cancel-login");

  let auth = {
    authenticated: false,
    username: null,
  };

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    if (auth.authenticated) {
      authToggle.textContent = "👤 Logout";
      authStatus.textContent = `Teacher: ${auth.username}`;
      signupContainer.classList.remove("locked");
      signupForm.querySelectorAll("input, select, button").forEach((el) => {
        el.disabled = false;
      });
      return;
    }

    authToggle.textContent = "👤 Login";
    authStatus.textContent = "Student view";
    signupContainer.classList.add("locked");
    signupForm.querySelectorAll("input, select, button").forEach((el) => {
      el.disabled = true;
    });
  }

  async function syncAuthStatus() {
    try {
      const response = await fetch("/auth/me", {
        credentials: "same-origin",
      });
      auth = await response.json();
      updateAuthUI();
    } catch (error) {
      auth = { authenticated: false, username: null };
      updateAuthUI();
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        auth.authenticated
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!auth.authenticated) {
      showMessage("Teachers must log in before registering students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          credentials: "same-origin",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  authToggle.addEventListener("click", async () => {
    if (auth.authenticated) {
      try {
        const response = await fetch("/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error("Logout failed");
        }
        auth = { authenticated: false, username: null };
        updateAuthUI();
        fetchActivities();
        showMessage("Logged out", "info");
      } catch (error) {
        showMessage("Failed to log out. Please try again.", "error");
      }
      return;
    }

    loginModal.classList.remove("hidden");
  });

  cancelLogin.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      auth = {
        authenticated: true,
        username: result.username,
      };
      updateAuthUI();
      loginModal.classList.add("hidden");
      loginForm.reset();
      fetchActivities();
      showMessage("Teacher login successful", "success");
    } catch (error) {
      showMessage("Unable to log in. Please try again.", "error");
    }
  });

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
      loginForm.reset();
    }
  });

  // Initialize app
  syncAuthStatus().then(fetchActivities);
});
