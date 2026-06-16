const body = document.body;
const themeButton = document.querySelector(".theme-toggle");
const themeLabel = document.querySelector(".theme-label");
const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const rememberInput = document.querySelector("#remember");
const togglePassword = document.querySelector("#togglePassword");
const statusText = document.querySelector("#status");
const emailMessage = document.querySelector("#emailMessage");
const passwordMessage = document.querySelector("#passwordMessage");
const demoButtons = document.querySelectorAll(".demo-account");

const savedTheme = localStorage.getItem("ims-theme");
const savedEmail = localStorage.getItem("ims-email");

if (savedTheme === "dark") {
  body.classList.add("dark");
}

if (savedEmail) {
  emailInput.value = savedEmail;
  rememberInput.checked = true;
}

updateThemeLabel();
checkExistingSession();

themeButton.addEventListener("click", () => {
  body.classList.toggle("dark");
  localStorage.setItem("ims-theme", body.classList.contains("dark") ? "dark" : "light");
  updateThemeLabel();
});

togglePassword.addEventListener("click", () => {
  const shouldShow = passwordInput.type === "password";
  passwordInput.type = shouldShow ? "text" : "password";
  togglePassword.textContent = shouldShow ? "Hide" : "Show";
  togglePassword.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
  passwordInput.focus();
});

demoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    emailInput.value = button.dataset.email;
    passwordInput.value = button.dataset.password;
    rememberInput.checked = true;
    validateEmail(false);
    validatePassword(false);
    showStatus(`${button.querySelector("span").textContent} demo account ready.`, "success");
  });
});

emailInput.addEventListener("input", () => {
  clearStatus();
  validateEmail(false);
});

passwordInput.addEventListener("input", () => {
  clearStatus();
  validatePassword(false);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const emailOk = validateEmail(true);
  const passwordOk = validatePassword(true);

  if (!emailOk || !passwordOk) {
    showStatus("ກະລຸນາກວດຂໍ້ມູນ login ໃຫ້ຄົບ.", "error");
    return;
  }

  const submitButton = loginForm.querySelector(".submit-btn");
  submitButton.classList.add("loading");
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Logging in...";
  clearStatus();

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Login failed");
    }

    if (rememberInput.checked) {
      localStorage.setItem("ims-email", emailInput.value.trim());
    } else {
      localStorage.removeItem("ims-email");
    }

    showStatus(`ຍິນດີຕ້ອນຮັບ ${payload.user.name}.`, "success");
    window.location.href = "dashboard.html";
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    submitButton.classList.remove("loading");
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Login to dashboard";
  }
});

async function checkExistingSession() {
  try {
    const response = await fetch("/api/auth/me");
    if (response.ok && new URLSearchParams(window.location.search).get("logout") !== "1") {
      window.location.href = "dashboard.html";
    }
  } catch {
    // Static file previews cannot reach the API; the form still works when served by node.
  }
}

function updateThemeLabel() {
  themeLabel.textContent = body.classList.contains("dark") ? "Light" : "Dark";
}

function validateEmail(showMessage) {
  const email = emailInput.value.trim();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const wrap = emailInput.closest(".input-wrap");

  if (!email) {
    emailMessage.textContent = showMessage ? "ກະລຸນາປ້ອນ email." : "";
    emailMessage.className = showMessage ? "field-message error" : "field-message";
    wrap.classList.toggle("invalid", showMessage);
    return false;
  }

  if (!isValid) {
    emailMessage.textContent = "Email format is not valid.";
    emailMessage.className = "field-message error";
    wrap.classList.add("invalid");
    return false;
  }

  emailMessage.textContent = "Email looks good.";
  emailMessage.className = "field-message good";
  wrap.classList.remove("invalid");
  return true;
}

function validatePassword(showMessage) {
  const password = passwordInput.value;
  const wrap = passwordInput.closest(".input-wrap");

  if (!password) {
    passwordMessage.textContent = showMessage ? "ກະລຸນາປ້ອນ password." : "";
    passwordMessage.className = showMessage ? "field-message error" : "field-message";
    wrap.classList.toggle("invalid", showMessage);
    return false;
  }

  if (password.length < 8) {
    passwordMessage.textContent = "Password must be at least 8 characters.";
    passwordMessage.className = "field-message error";
    wrap.classList.add("invalid");
    return false;
  }

  passwordMessage.textContent = "Password ready.";
  passwordMessage.className = "field-message good";
  wrap.classList.remove("invalid");
  return true;
}

function showStatus(message, type) {
  statusText.textContent = message;
  statusText.className = `status ${type}`;
}

function clearStatus() {
  statusText.textContent = "";
  statusText.className = "status";
}
