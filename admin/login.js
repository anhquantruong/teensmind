const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginButton = document.getElementById("loginButton");


function showError(message) {

  loginError.textContent = message;

  loginError.classList.remove("hidden");

}


function hideError() {

  loginError.classList.add("hidden");

  loginError.textContent = "";

}


loginForm.addEventListener("submit", async (event) => {

  event.preventDefault();

  hideError();


  const username =
    document.getElementById("loginUsername").value.trim();

  const password =
    document.getElementById("loginPassword").value;


  loginButton.disabled = true;

  loginButton.textContent = "Đang đăng nhập...";


  try {

    const response = await fetch("/api/admin/login", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      credentials: "same-origin",

      body: JSON.stringify({ username, password })

    });


    let result = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }


    if (!response.ok) {

      throw new Error(
        result.error || "Đăng nhập thất bại."
      );

    }

    window.location.href = "index.html";


  } catch (error) {

    showError(error.message || "Đăng nhập thất bại. Đề nghị kiểm tra lại username và password");

    loginButton.disabled = false;

    loginButton.textContent = "Đăng nhập";

  }

});