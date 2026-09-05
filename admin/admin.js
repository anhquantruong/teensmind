async function guardAdminSession() {

  try {

    const response =
      await fetch("/api/admin/session", {
        credentials: "same-origin"
      });


    const data =
      await response.json();


    if (!data.authenticated) {

      window.location.href = "login.html";

    }


  } catch (error) {

    console.error(
      "Session check failed:",
      error
    );

    window.location.href = "login.html";

  }

}

guardAdminSession();


// Nếu 1 request tới /api/admin/* trả về 401 (phiên đã hết
// hạn), gọi hàm này để đá về trang đăng nhập ngay lập tức
function redirectIfUnauthorized(response) {

  if (response.status === 401) {

    window.location.href = "login.html";

    return true;

  }

  return false;

}


// =========================================================
// PAGE NAVIGATION
// =========================================================

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".admin-page");


function showPage(pageName) {

  pages.forEach(page => {

    page.classList.toggle(
      "active",
      page.id === pageName
    );

  });


  navItems.forEach(item => {

    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );

  });

}


navItems.forEach(item => {

  item.addEventListener(
    "click",
    () => {

      showPage(item.dataset.page);

    }
  );

});


document
  .querySelectorAll("[data-page-link]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(button.dataset.pageLink);

      }
    );

  });


// =========================================================
// CLINIC ELEMENTS
// =========================================================

const clinicTable =
  document.getElementById("clinicTable");

const clinicSearch =
  document.getElementById("clinicSearch");

const clinicTypeFilter =
  document.getElementById("clinicTypeFilter");

const clinicProvinceFilter =
  document.getElementById("clinicProvinceFilter");

const clinicWardFilter =
  document.getElementById("clinicWardFilter");

const clinicCount =
  document.getElementById("clinicCount");


let clinics = [];


// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}
// =========================================================
// ARTICLES (Bài viết) — editor kiểu Wikipedia dùng Quill.js
// Nội dung được lưu thành HTML (quill.root.innerHTML) trong
// cột "content" — nhờ vậy vị trí ảnh, canh lề, in đậm... được
// giữ nguyên khi hiển thị lại, vì bản thân HTML đã mã hoá
// đầy đủ layout, không cần suy luận thêm gì.
// =========================================================

const articleTable = document.getElementById("articleTable");
const articleSearch = document.getElementById("articleSearch");
const articleStatusFilter = document.getElementById("articleStatusFilter");
const articleModal = document.getElementById("articleModal");
const openAddArticle = document.getElementById("openAddArticle");
const closeArticleModal = document.getElementById("closeArticleModal");
const cancelArticle = document.getElementById("cancelArticle");
const articleForm = document.getElementById("articleForm");
const articleModalTitle = document.getElementById("articleModalTitle");

let articles = [];
let editingArticleId = null;
let quill = null;

function getQuillEditor() {
  if (!quill && document.getElementById("articleEditor")) {
    quill = new Quill("#articleEditor", {
      theme: "snow",
      modules: {
        toolbar: {
          container: [
            [{ header: [2, 3, false] }],
            ["bold", "italic", "underline"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ align: [] }],
            ["blockquote", "link", "image"],
            ["clean"]
          ],
          handlers: { image: insertImageByUrl }
        }
      }
    });
  }
  return quill;
}

// Chèn ảnh bằng URL (chưa có API upload file, nên dùng URL
// giống cách các nơi khác trong app đang làm — avatar_url,
// ggmaps_link, cover_image_url...)
function insertImageByUrl() {
  const url = prompt("Dán URL ảnh muốn chèn:");
  if (!url) return;
  const range = quill.getSelection(true);
  quill.insertEmbed(range.index, "image", url, "user");
  quill.setSelection(range.index + 1);
}

async function loadArticles() {
  try {
    const response = await fetch("/api/admin/articles", { credentials: "same-origin" });
    if (redirectIfUnauthorized(response)) return;
    if (!response.ok) throw new Error("Failed to load articles.");
    articles = await response.json();
    renderArticles();
  } catch (error) {
    console.error("Could not load articles:", error);
    if (articleTable) articleTable.innerHTML = `<tr><td colspan="4">Failed to load articles.</td></tr>`;
  }
}

function renderArticles() {
  if (!articleTable) return;

  const query = articleSearch?.value?.trim().toLowerCase() || "";
  const selectedStatus = articleStatusFilter?.value || "all";

  const filtered = articles.filter(a => {
    const text = [a.title, a.subtitle].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const matchesStatus = selectedStatus === "all" || a.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    articleTable.innerHTML = `<tr><td colspan="4">No articles found.</td></tr>`;
    return;
  }

  articleTable.innerHTML = filtered.map(a => `
    <tr>
      <td>
        <strong>${escapeHTML(a.title || "Untitled")}</strong>
        <span class="table-subtext">${escapeHTML(a.subtitle || "")}</span>
      </td>
      <td>
        <span class="status-pill ${a.status === "published" ? "published" : "draft"}">
          ${a.status === "published" ? "Đã đăng" : "Bản nháp"}
        </span>
      </td>
      <td>${escapeHTML(formatFeedbackDate(a.updated_at || a.created_at))}</td>
      <td>
        <button class="table-action edit-article" data-id="${a.id}" type="button">Edit</button>
        <button class="table-action danger delete-article" data-id="${a.id}" type="button">Delete</button>
      </td>
    </tr>
  `).join("");

  attachArticleActions();
}

function attachArticleActions() {
  document.querySelectorAll(".edit-article").forEach(btn => {
    btn.addEventListener("click", () => editArticle(btn.dataset.id));
  });
  document.querySelectorAll(".delete-article").forEach(btn => {
    btn.addEventListener("click", () => deleteArticle(btn.dataset.id));
  });
}

function openArticleModalUI() {
  if (!articleModal) return;
  getQuillEditor();
  articleModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeArticleModalUI() {
  if (!articleModal) return;
  articleModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  editingArticleId = null;
  articleForm?.reset();
  if (quill) quill.setContents([]);
  if (articleModalTitle) articleModalTitle.textContent = "Viết bài mới";
}

openAddArticle?.addEventListener("click", () => {
  editingArticleId = null;
  articleForm?.reset();
  getQuillEditor();
  if (quill) quill.setContents([]);
  if (articleModalTitle) articleModalTitle.textContent = "Viết bài mới";
  openArticleModalUI();
});

closeArticleModal?.addEventListener("click", closeArticleModalUI);
cancelArticle?.addEventListener("click", closeArticleModalUI);
document.getElementById("articleModalOverlay")?.addEventListener("click", closeArticleModalUI);

articleSearch?.addEventListener("input", renderArticles);
articleStatusFilter?.addEventListener("change", renderArticles);

function editArticle(id) {
  const article = articles.find(a => Number(a.id) === Number(id));
  if (!article) { alert("Article could not be found."); return; }

  editingArticleId = Number(id);
  getQuillEditor();

  articleForm.querySelector('[name="title"]').value = article.title || "";
  articleForm.querySelector('[name="subtitle"]').value = article.subtitle || "";
  articleForm.querySelector('[name="cover_image_url"]').value = article.cover_image_url || "";
  articleForm.querySelector('[name="status"]').value = article.status || "draft";

  // Nội dung lưu là HTML -> nạp lại vào Quill bằng clipboard API
  // để giữ đúng định dạng (đậm, ảnh, canh lề...) như lúc lưu.
  quill.setContents([]);
  quill.clipboard.dangerouslyPasteHTML(article.content || "");

  articleModalTitle.textContent = "Chỉnh sửa bài viết";
  openArticleModalUI();
}

articleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(articleForm);
  const data = Object.fromEntries(formData.entries());
  data.content = quill.root.innerHTML;

  const isEditing = editingArticleId !== null;
  const url = isEditing ? `/api/admin/articles/${editingArticleId}` : "/api/admin/articles";
  const method = isEditing ? "PUT" : "POST";

  const submitButton = articleForm.querySelector('button[type="submit"]');
  const originalText = submitButton?.textContent || "";

  try {
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = "Đang lưu..."; }

    const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (redirectIfUnauthorized(response)) return;

    let result = {};
    try { result = await response.json(); } catch { result = {}; }
    if (!response.ok) throw new Error(result.error || "Something went wrong.");

    alert(isEditing ? "Đã cập nhật bài viết." : "Đã thêm bài viết mới.");
    closeArticleModalUI();
    await loadArticles();

  } catch (error) {
    console.error("Article save error:", error);
    alert(error.message || "Failed to save article.");
  } finally {
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalText; }
  }
});

async function deleteArticle(id) {
  const article = articles.find(a => Number(a.id) === Number(id));
  if (!article) { alert("Article could not be found."); return; }

  const confirmed = confirm(`Xoá bài viết "${article.title}"?\n\nHành động này không thể hoàn tác.`);
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/admin/articles/${id}`, { method: "DELETE", credentials: "same-origin" });
    if (redirectIfUnauthorized(response)) return;

    let result = {};
    try { result = await response.json(); } catch { result = {}; }
    if (!response.ok) throw new Error(result.error || "Failed to delete article.");

    await loadArticles();
  } catch (error) {
    console.error("Delete article error:", error);
    alert(error.message || "Failed to delete article.");
  }
}
async function loadClinics() {

  try {

    const response =
      await fetch("/api/admin/clinics", {
        credentials: "same-origin"
      });


    if (redirectIfUnauthorized(response)) {

      return;

    }


    if (!response.ok) {

      throw new Error(
        "Failed to load clinics."
      );

    }


    clinics =
      await response.json();


    // Build type dropdown (still derived from clinic data)
    populateFilters();


    // Render table
    renderClinics();


    // Update total count
    if (clinicCount) {

      clinicCount.textContent =
        clinics.length;

    }


  } catch (error) {

    console.error(
      "Could not load clinics:",
      error
    );


    if (clinicTable) {

      clinicTable.innerHTML = `
        <tr>
          <td colspan="5">
            Failed to load clinics.
          </td>
        </tr>
      `;

    }

  }

}


// =========================================================
// VIETNAM PROVINCE / WARD API (provinces.open-api.vn v2)
// Cấu trúc hành chính mới sau sáp nhập 01/07/2025 (2 cấp:
// Tỉnh/Thành → Phường/Xã, không còn quận/huyện)
// =========================================================

const VN_PROVINCE_API =
  "https://provinces.open-api.vn/api/v2/?depth=2";

let vnProvinces = [];


async function loadVNProvinces() {

  try {

    const response =
      await fetch(VN_PROVINCE_API);


    if (!response.ok) {

      throw new Error(
        "Failed to load provinces."
      );

    }


    vnProvinces =
      await response.json();


    populateProvinceFilter();

    updateWardFilter();


    populateFormProvinceSelect();

    updateFormWardSelect();


  } catch (error) {

    console.error(
      "Could not load provinces/wards:",
      error
    );


    if (clinicProvinceFilter) {

      clinicProvinceFilter.innerHTML = `
        <option value="all">
          Không tải được danh sách tỉnh
        </option>
      `;

    }

  }

}


// =========================================================
// BUILD PROVINCE OPTIONS (từ API)
// =========================================================

function populateProvinceFilter() {

  if (!clinicProvinceFilter) {
    return;
  }


  const currentProvince =
    clinicProvinceFilter.value;


  clinicProvinceFilter.innerHTML = `
    <option value="all">
      Tất cả Tỉnh / Thành
    </option>
  `;


  vnProvinces

    .slice()

    .sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    .forEach(province => {

      const option =
        document.createElement("option");


      option.value = province.name;

      option.textContent = province.name;


      clinicProvinceFilter.appendChild(
        option
      );

    });


  const stillExists =
    [...clinicProvinceFilter.options].some(
      opt => opt.value === currentProvince
    );


  if (stillExists) {

    clinicProvinceFilter.value =
      currentProvince;

  }

}


// =========================================================
// UPDATE WARD FILTER (từ API, theo tỉnh đang chọn)
// =========================================================

function updateWardFilter() {

  if (!clinicWardFilter) {
    return;
  }


  const selectedProvinceName =
    clinicProvinceFilter?.value ||
    "all";


  const currentWard =
    clinicWardFilter.value;


  clinicWardFilter.innerHTML = `
    <option value="all">
      Tất cả Phường
    </option>
  `;


  if (selectedProvinceName === "all") {

    clinicWardFilter.disabled = true;

    return;

  }


  clinicWardFilter.disabled = false;


  const province =
    vnProvinces.find(
      item => item.name === selectedProvinceName
    );


  const wards =
    (province?.wards || [])

      .slice()

      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );


  wards.forEach(ward => {

    const option =
      document.createElement("option");


    option.value = ward.name;

    option.textContent = ward.name;


    clinicWardFilter.appendChild(
      option
    );

  });


  const stillExists =
    [...clinicWardFilter.options].some(
      opt => opt.value === currentWard
    );


  if (stillExists) {

    clinicWardFilter.value =
      currentWard;

  }

}


// =========================================================
// ADD/EDIT CLINIC FORM — PROVINCE / WARD SELECTS
// Cascading dropdowns fed by the same VN API cache
// =========================================================

const formProvinceSelect =
  document.getElementById("formProvince");

const formWardSelect =
  document.getElementById("formWard");


function populateFormProvinceSelect() {

  if (!formProvinceSelect) {
    return;
  }


  const currentProvince =
    formProvinceSelect.value;


  formProvinceSelect.innerHTML = `
    <option value="">
      Select province
    </option>
  `;


  vnProvinces

    .slice()

    .sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    .forEach(province => {

      const option =
        document.createElement("option");


      option.value = province.name;

      option.textContent = province.name;


      formProvinceSelect.appendChild(
        option
      );

    });


  const stillExists =
    [...formProvinceSelect.options].some(
      opt => opt.value === currentProvince
    );


  if (stillExists) {

    formProvinceSelect.value =
      currentProvince;

  }

}


function updateFormWardSelect() {

  if (!formWardSelect) {
    return;
  }


  const selectedProvinceName =
    formProvinceSelect?.value || "";


  const currentWard =
    formWardSelect.value;


  formWardSelect.innerHTML = `
    <option value="">
      Select ward
    </option>
  `;


  if (!selectedProvinceName) {

    formWardSelect.disabled = true;

    return;

  }


  formWardSelect.disabled = false;


  const province =
    vnProvinces.find(
      item => item.name === selectedProvinceName
    );


  const wards =
    (province?.wards || [])

      .slice()

      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );


  wards.forEach(ward => {

    const option =
      document.createElement("option");


    option.value = ward.name;

    option.textContent = ward.name;


    formWardSelect.appendChild(
      option
    );

  });


  const stillExists =
    [...formWardSelect.options].some(
      opt => opt.value === currentWard
    );


  if (stillExists) {

    formWardSelect.value =
      currentWard;

  }

}


formProvinceSelect?.addEventListener(
  "change",
  () => {

    updateFormWardSelect();

  }
);


// =========================================================
// BUILD FILTER OPTIONS (Type only — Province/Ward come
// from the VN administrative API above)
// =========================================================

function populateFilters() {

  // =======================================================
  // TYPE
  // =======================================================

  const types = [
    ...new Set(

      clinics

        .map(clinic =>
          String(
            clinic.clinic_type || ""
          ).trim()
        )

        .filter(Boolean)

    )
  ].sort((a, b) =>
    a.localeCompare(b)
  );


  if (clinicTypeFilter) {

    const currentType =
      clinicTypeFilter.value;


    clinicTypeFilter.innerHTML = `
      <option value="all">
        All types
      </option>
    `;


    types.forEach(type => {

      const option =
        document.createElement("option");


      option.value = type;

      option.textContent = type;


      clinicTypeFilter.appendChild(
        option
      );

    });


    // Keep previous selection if it still exists
    if (
      types.includes(currentType)
    ) {

      clinicTypeFilter.value =
        currentType;

    }

  }

}


// =========================================================
// RENDER CLINICS
// =========================================================

function renderClinics() {

  if (!clinicTable) {
    return;
  }


  // =======================================================
  // CURRENT FILTER VALUES
  // =======================================================

  const query =
    clinicSearch?.value
      ?.trim()
      .toLowerCase() || "";


  const selectedType =
    clinicTypeFilter?.value ||
    "all";


  const selectedProvince =
    clinicProvinceFilter?.value ||
    "all";


  const selectedWard =
    clinicWardFilter?.value ||
    "all";


  // =======================================================
  // FILTER
  // =======================================================

  const filteredClinics =
    clinics.filter(clinic => {


      // -----------------------------------------------------
      // SEARCH
      // -----------------------------------------------------

      const searchableText = [

        clinic.clinic_name,

        clinic.clinic_type,

        clinic.address,

        clinic.old_address,

        clinic.ward,

        clinic.prov,

        clinic.phone,

        clinic.website,

        clinic.ggmaps_link,

        clinic.pricing,

        clinic.price,

        clinic.service,

        clinic.description,

        clinic.target_groups

      ]

        .filter(Boolean)

        .join(" ")

        .toLowerCase();


      const matchesSearch =
        !query ||
        searchableText.includes(query);


      // -----------------------------------------------------
      // TYPE
      // -----------------------------------------------------

      const matchesType =
        selectedType === "all" ||
        String(
          clinic.clinic_type || ""
        ).trim() === selectedType;


      // -----------------------------------------------------
      // PROVINCE
      // -----------------------------------------------------

      const matchesProvince =
        selectedProvince === "all" ||
        String(
          clinic.prov || ""
        ).trim() === selectedProvince;


      // -----------------------------------------------------
      // WARD
      // -----------------------------------------------------

      const matchesWard =
        selectedWard === "all" ||
        String(
          clinic.ward || ""
        ).trim() === selectedWard;


      return (
        matchesSearch &&
        matchesType &&
        matchesProvince &&
        matchesWard
      );

    });


  // =======================================================
  // NO RESULTS
  // =======================================================

  if (
    filteredClinics.length === 0
  ) {

    clinicTable.innerHTML = `
      <tr>
        <td colspan="5">
          No clinics found.
        </td>
      </tr>
    `;

    return;

  }


  // =======================================================
  // RENDER TABLE
  // =======================================================

  clinicTable.innerHTML =
    filteredClinics

      .map(clinic => {

        return `

          <tr>

            <td>

              <strong>
                ${escapeHTML(
                  clinic.clinic_name ||
                  "Unnamed clinic"
                )}
              </strong>

              <span class="table-subtext">
                ${escapeHTML(
                  clinic.description ||
                  ""
                )}
              </span>

            </td>


            <td>
              ${escapeHTML(
                clinic.clinic_type ||
                "—"
              )}
            </td>


            <td>
              ${escapeHTML(
                clinic.prov ||
                clinic.ward ||
                "—"
              )}
            </td>


            <td>
              ${escapeHTML(
                clinic.phone ||
                "—"
              )}
            </td>


            <td>

              <button
                class="table-action edit-clinic"
                data-id="${clinic.id}"
                type="button"
              >
                Edit
              </button>


              <button
                class="table-action danger delete-clinic"
                data-id="${clinic.id}"
                type="button"
              >
                Delete
              </button>

            </td>

          </tr>

        `;

      })

      .join("");


  attachClinicActions();

}


// =========================================================
// SEARCH
// =========================================================

clinicSearch?.addEventListener(
  "input",
  renderClinics
);


// =========================================================
// TYPE FILTER
// =========================================================

clinicTypeFilter?.addEventListener(
  "change",
  renderClinics
);


// =========================================================
// PROVINCE FILTER
// =========================================================

clinicProvinceFilter?.addEventListener(
  "change",
  () => {

    // Rebuild ward options from the VN API cache
    updateWardFilter();


    // Reset ward
    if (clinicWardFilter) {

      clinicWardFilter.value =
        "all";

    }


    renderClinics();

  }
);


// =========================================================
// WARD FILTER
// =========================================================

clinicWardFilter?.addEventListener(
  "change",
  renderClinics
);


// =========================================================
// MODAL ELEMENTS
// =========================================================

const clinicModal =
  document.getElementById(
    "clinicModal"
  );

const openAddClinic =
  document.getElementById(
    "openAddClinic"
  );

const closeClinicModal =
  document.getElementById(
    "closeClinicModal"
  );

const cancelClinic =
  document.getElementById(
    "cancelClinic"
  );

const clinicForm =
  document.getElementById(
    "clinicForm"
  );


let editingClinicId = null;


// =========================================================
// OPEN MODAL
// =========================================================

function openClinicModal() {

  if (!clinicModal) {
    return;
  }


  clinicModal.classList.remove(
    "hidden"
  );


  document.body.classList.add(
    "modal-open"
  );

}


// =========================================================
// CLOSE MODAL
// =========================================================

function closeModal() {

  if (!clinicModal) {
    return;
  }


  clinicModal.classList.add(
    "hidden"
  );


  document.body.classList.remove(
    "modal-open"
  );


  editingClinicId = null;


  if (clinicForm) {

    clinicForm.reset();

  }


  // Selects don't reset cleanly on their own — resync them
  updateFormWardSelect();


  const title =
    clinicModal.querySelector(
      ".modal-header h2"
    );


  if (title) {

    title.textContent =
      "Add clinic";

  }


  const submitButton =
    clinicForm?.querySelector(
      'button[type="submit"]'
    );


  if (submitButton) {

    submitButton.textContent =
      "Add clinic";

    submitButton.disabled =
      false;

  }

}


// =========================================================
// OPEN ADD CLINIC
// =========================================================

openAddClinic?.addEventListener(
  "click",
  () => {

    editingClinicId = null;


    if (clinicForm) {

      clinicForm.reset();

    }


    // Selects don't reset cleanly on their own — resync them
    updateFormWardSelect();


    const title =
      clinicModal?.querySelector(
        ".modal-header h2"
      );


    if (title) {

      title.textContent =
        "Add clinic";

    }


    const submitButton =
      clinicForm?.querySelector(
        'button[type="submit"]'
      );


    if (submitButton) {

      submitButton.textContent =
        "Add clinic";

    }


    openClinicModal();

  }
);


// =========================================================
// CLOSE BUTTONS
// =========================================================

closeClinicModal?.addEventListener(
  "click",
  closeModal
);


cancelClinic?.addEventListener(
  "click",
  closeModal
);


document
  .querySelector(".modal-overlay")
  ?.addEventListener(
    "click",
    closeModal
  );


// =========================================================
// GET FORM DATA
// =========================================================
//
// "service" là nhóm checkbox nhiều lựa chọn — nếu gom bằng
// Object.fromEntries(formData.entries()) như bình thường thì
// CHỈ giữ lại giá trị checkbox CUỐI CÙNG (bug), nên phải tự
// lấy toàn bộ checkbox đã tick rồi nối lại thành 1 chuỗi để
// khớp với cột "service" (TEXT) trong bảng clinics.
//
// "price_from" / "price_to" không phải cột thật trong DB —
// đây chỉ là 2 ô nhập liệu tạm trên form, cần gộp lại thành
// 1 chuỗi "A-B" để khớp với cột "price" (TEXT) trong DB.
// =========================================================

function getClinicFormData() {

  if (!clinicForm) {
    return {};
  }


  const formData =
    new FormData(
      clinicForm
    );


  const data =
    Object.fromEntries(
      formData.entries()
    );


  // ---- SERVICE (multi-select checkbox) ----

  const checkedServices =
    Array.from(
      clinicForm.querySelectorAll(
        'input[name="service"]:checked'
      )
    ).map(el => el.value);

  data.service =
    checkedServices.join(", ");


  // ---- PRICE RANGE (price_from + price_to -> "price") ----

  const priceFrom =
    (data.price_from || "").trim();

  const priceTo =
    (data.price_to || "").trim();

  delete data.price_from;
  delete data.price_to;

  if (priceFrom && priceTo) {

    data.price =
      `${priceFrom}-${priceTo}`;

  } else if (priceFrom) {

    data.price =
      `${priceFrom}-`;

  } else if (priceTo) {

    data.price =
      `-${priceTo}`;

  } else {

    data.price = "";

  }


  return data;

}


// =========================================================
// ADD / UPDATE CLINIC
// =========================================================

clinicForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const data =
      getClinicFormData();


    const isEditing =
      editingClinicId !== null;


    const url =
      isEditing
        ? `/api/admin/clinics/${editingClinicId}`
        : "/api/admin/clinics";


    const method =
      isEditing
        ? "PUT"
        : "POST";


    const submitButton =
      clinicForm.querySelector(
        'button[type="submit"]'
      );


    const originalText =
      submitButton?.textContent ||
      "";


    try {

      if (submitButton) {

        submitButton.disabled =
          true;


        submitButton.textContent =
          isEditing
            ? "Saving..."
            : "Adding...";

      }


      const response =
        await fetch(
          url,
          {
            method,

            credentials: "same-origin",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(data)
          }
        );


      if (redirectIfUnauthorized(response)) {

        return;

      }


      let result = {};


      try {

        result =
          await response.json();

      } catch {

        result = {};

      }


      if (!response.ok) {

        const details =
          Array.isArray(
            result.details
          )
            ? "\n\n" +
              result.details.join(
                "\n"
              )
            : "";


        throw new Error(
          (
            result.error ||
            "Something went wrong."
          ) +
          details
        );

      }


      alert(
        isEditing
          ? "Clinic updated successfully."
          : "Clinic added successfully."
      );


      closeModal();


      // Reload actual data from SQLite
      await loadClinics();


    } catch (error) {

      console.error(
        "Clinic save error:",
        error
      );


      alert(
        error.message ||
        "Failed to save clinic."
      );


    } finally {

      if (submitButton) {

        submitButton.disabled =
          false;


        submitButton.textContent =
          originalText;

      }

    }

  }
);


// =========================================================
// EDIT CLINIC
// =========================================================

function editClinic(id) {

  const clinic =
    clinics.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!clinic) {

    alert(
      "Clinic could not be found."
    );

    return;

  }


  editingClinicId =
    Number(id);

  const fields =
    clinicForm.querySelectorAll(
      "[name]"
    );


  fields.forEach(field => {

    if (
      field.type === "checkbox" ||
      field.type === "radio"
    ) {

      return;

    }


    const value =
      clinic[field.name];


    if (
      value !== undefined &&
      value !== null
    ) {

      field.value =
        String(value);

    } else {

      field.value = "";

    }

  });


  // ---- SERVICE checkboxes: tick đúng theo cột "service" ----

  const clinicServices =
    String(clinic.service || "")
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean);

  clinicForm
    .querySelectorAll(
      'input[name="service"]'
    )
    .forEach(checkbox => {

      checkbox.checked =
        clinicServices.includes(
          checkbox.value
        );

    });


  // ---- PRICE RANGE: tách cột "price" ("A-B") thành 2 ô ----

  const priceParts =
    String(clinic.price || "")
      .split("-");

  const priceFromInput =
    clinicForm.querySelector(
      'input[name="price_from"]'
    );

  const priceToInput =
    clinicForm.querySelector(
      'input[name="price_to"]'
    );

  if (priceFromInput) {

    priceFromInput.value =
      (priceParts[0] || "").trim();

  }

  if (priceToInput) {

    priceToInput.value =
      (priceParts[1] || "").trim();

  }


  // Province select is now set from the generic loop above —
  // rebuild the ward options for that province, then re-apply
  // the clinic's saved ward (the generic loop ran before the
  // matching ward options existed, so it couldn't select it).
  updateFormWardSelect();

  if (formWardSelect) {

    formWardSelect.value =
      clinic.ward || "";

  }


  const title =
    clinicModal?.querySelector(
      ".modal-header h2"
    );


  if (title) {

    title.textContent =
      "Edit clinic";

  }


  const submitButton =
    clinicForm?.querySelector(
      'button[type="submit"]'
    );


  if (submitButton) {

    submitButton.textContent =
      "Save changes";

  }


  openClinicModal();

}


// =========================================================
// DELETE CLINIC
// =========================================================

async function deleteClinic(id) {

  const clinic =
    clinics.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!clinic) {

    alert(
      "Clinic could not be found."
    );

    return;

  }


  const confirmed =
    confirm(
      `Delete "${clinic.clinic_name}"?\n\nThis action cannot be undone.`
    );


  if (!confirmed) {

    return;

  }


  try {

    const response =
      await fetch(
        `/api/admin/clinics/${id}`,
        {
          method: "DELETE",

          credentials: "same-origin"

        }
      );


    if (redirectIfUnauthorized(response)) {

      return;

    }


    let result = {};


    try {

      result =
        await response.json();

    } catch {

      result = {};

    }


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Failed to delete clinic."
      );

    }


    alert(
      "Clinic deleted successfully."
    );


    // Reload actual database data
    await loadClinics();


  } catch (error) {

    console.error(
      "Delete error:",
      error
    );


    alert(
      error.message ||
      "Failed to delete clinic."
    );

  }

}


// =========================================================
// EDIT / DELETE BUTTONS
// =========================================================

function attachClinicActions() {


  document
    .querySelectorAll(
      ".edit-clinic"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          editClinic(
            button.dataset.id
          );

        }
      );

    });


  document
    .querySelectorAll(
      ".delete-clinic"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteClinic(
            button.dataset.id
          );

        }
      );

    });

}


// =========================================================
// FEEDBACK ELEMENTS
// =========================================================

const feedbackTable =
  document.getElementById("feedbackTable");

const feedbackSearch =
  document.getElementById("feedbackSearch");

const feedbackStatusFilter =
  document.getElementById("feedbackStatusFilter");

const feedbackCount =
  document.getElementById("feedbackCount");


let feedbackList = [];


// =========================================================
// LOAD FEEDBACK
// =========================================================

async function loadFeedback() {

  try {

    const response =
      await fetch("/api/admin/feedback", {
        credentials: "same-origin"
      });


    if (redirectIfUnauthorized(response)) {

      return;

    }


    if (!response.ok) {

      throw new Error(
        "Failed to load feedback."
      );

    }


    feedbackList =
      await response.json();


    renderFeedback();


    if (feedbackCount) {

      feedbackCount.textContent =
        feedbackList.length;

    }


  } catch (error) {

    console.error(
      "Could not load feedback:",
      error
    );


    if (feedbackTable) {

      feedbackTable.innerHTML = `
        <tr>
          <td colspan="5">
            Failed to load feedback.
          </td>
        </tr>
      `;

    }

  }

}


// =========================================================
// FORMAT DATE (SQLite CURRENT_TIMESTAMP is UTC, "YYYY-MM-DD HH:MM:SS")
// =========================================================

function formatFeedbackDate(value) {

  if (!value) {
    return "—";
  }


  const isoLike =
    value.includes("T")
      ? value
      : value.replace(" ", "T") + "Z";


  const date =
    new Date(isoLike);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleString(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


// =========================================================
// IS READ HELPER
// (better-sqlite3 trả về 0/1 dạng số)
// =========================================================

function isFeedbackRead(item) {
  return item.is_read === true;
}


// =========================================================
// RENDER FEEDBACK
// KHÔNG hiện cột nội dung — nội dung chỉ hiện khi bấm "Xem".
// Dòng chưa đọc có nền đậm hơn dòng đã đọc.
// =========================================================

function renderFeedback() {

  if (!feedbackTable) {
    return;
  }


  const query =
    feedbackSearch?.value
      ?.trim()
      .toLowerCase() || "";


  const selectedStatus =
    feedbackStatusFilter?.value ||
    "all";


  const filteredFeedback =
    feedbackList.filter(item => {

      const searchableText = [

        item.name,

        item.email,

        item.category,

        item.message,

        item.page

      ]

        .filter(Boolean)

        .join(" ")

        .toLowerCase();


      const matchesSearch =
        !query ||
        searchableText.includes(query);


      const matchesStatus =
        selectedStatus === "all" ||
        String(
          item.status || ""
        ).trim() === selectedStatus;


      return (
        matchesSearch &&
        matchesStatus
      );

    });


  if (
    filteredFeedback.length === 0
  ) {

    feedbackTable.innerHTML = `
      <tr>
        <td colspan="5">
          No feedback found.
        </td>
      </tr>
    `;

    return;

  }


  feedbackTable.innerHTML =
    filteredFeedback

      .map(item => {

        const read =
          isFeedbackRead(item);


        const rowClass =
          read
            ? "feedback-row-read"
            : "feedback-row-unread";


        return `

          <tr class="${rowClass}">

            <td>

              <strong>
                ${!read ? '<span class="unread-dot" title="Chưa đọc"></span>' : ''}${escapeHTML(
                  item.name ||
                  "Ẩn danh"
                )}
              </strong>

              <span class="table-subtext">
                ${escapeHTML(
                  item.email ||
                  ""
                )}
              </span>

            </td>


            <td>
              ${escapeHTML(
                item.category ||
                "—"
              )}
            </td>


            <td>
              ${escapeHTML(
                formatFeedbackDate(
                  item.created_at
                )
              )}
            </td>


            <td>

              <select
                class="status-select"
                data-id="${item.id}"
              >

                <option
                  value="new"
                  ${item.status === "new" ? "selected" : ""}
                >
                  Mới
                </option>

                <option
                  value="reviewed"
                  ${item.status === "reviewed" ? "selected" : ""}
                >
                  Đã xem
                </option>

                <option
                  value="resolved"
                  ${item.status === "resolved" ? "selected" : ""}
                >
                  Đã xử lý
                </option>

              </select>

            </td>


            <td>

              <button
                class="table-action view-feedback"
                data-id="${item.id}"
                type="button"
              >
                Xem
              </button>


              <button
                class="table-action danger delete-feedback"
                data-id="${item.id}"
                type="button"
              >
                Delete
              </button>

            </td>

          </tr>

        `;

      })

      .join("");


  attachFeedbackActions();

}


// =========================================================
// SEARCH / STATUS FILTER
// =========================================================

feedbackSearch?.addEventListener(
  "input",
  renderFeedback
);


feedbackStatusFilter?.addEventListener(
  "change",
  renderFeedback
);


// =========================================================
// UPDATE FEEDBACK STATUS (chỉnh tay từ dropdown trong bảng)
// =========================================================

async function updateFeedbackStatus(id, status) {

  try {

    const response =
      await fetch(
        `/api/admin/feedback/${id}`,
        {
          method: "PATCH",

          credentials: "same-origin",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({ status })
        }
      );


    if (redirectIfUnauthorized(response)) {

      return;

    }


    if (!response.ok) {

      throw new Error(
        "Failed to update feedback status."
      );

    }


    await loadFeedback();


  } catch (error) {

    console.error(
      "Update feedback status error:",
      error
    );


    alert(
      error.message ||
      "Failed to update feedback status."
    );


    // Nếu lỗi, load lại để đồng bộ dropdown về trạng thái đúng
    await loadFeedback();

  }

}


// =========================================================
// DELETE FEEDBACK
// =========================================================

async function deleteFeedback(id) {

  const confirmed =
    confirm(
      "Delete this feedback?\n\nThis action cannot be undone."
    );


  if (!confirmed) {

    return;

  }


  try {

    const response =
      await fetch(
        `/api/admin/feedback/${id}`,
        {
          method: "DELETE",

          credentials: "same-origin"

        }
      );


    if (redirectIfUnauthorized(response)) {

      return;

    }


    let result = {};


    try {

      result =
        await response.json();

    } catch {

      result = {};

    }


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Failed to delete feedback."
      );

    }


    await loadFeedback();


  } catch (error) {

    console.error(
      "Delete feedback error:",
      error
    );


    alert(
      error.message ||
      "Failed to delete feedback."
    );

  }

}


// =========================================================
// FEEDBACK DETAIL MODAL
// Box trái: nội dung người dùng gửi. Box phải: soạn trả lời.
// Mở modal => tự động đánh dấu is_read = 1 (đổi màu dòng).
// Gửi trả lời => lưu reply_message + status = "resolved".
// =========================================================

const feedbackDetailModal =
  document.getElementById("feedbackDetailModal");

const closeFeedbackDetailBtn =
  document.getElementById("closeFeedbackDetail");

const feedbackDetailOverlay =
  document.getElementById("feedbackDetailOverlay");

const fbCancelReply =
  document.getElementById("fbCancelReply");

const fbSendReply =
  document.getElementById("fbSendReply");

const fbReplyText =
  document.getElementById("fbReplyText");

const fbDetailName =
  document.getElementById("fbDetailName");

const fbDetailEmail =
  document.getElementById("fbDetailEmail");

const fbDetailType =
  document.getElementById("fbDetailType");

const fbDetailDate =
  document.getElementById("fbDetailDate");

const fbDetailMessage =
  document.getElementById("fbDetailMessage");

const fbReplyHint =
  document.getElementById("fbReplyHint");


let currentFeedbackId = null;


function openFeedbackDetailModal() {

  if (!feedbackDetailModal) {
    return;
  }


  feedbackDetailModal.classList.remove(
    "hidden"
  );


  document.body.classList.add(
    "modal-open"
  );

}


function closeFeedbackDetailModal() {

  if (!feedbackDetailModal) {
    return;
  }


  feedbackDetailModal.classList.add(
    "hidden"
  );


  document.body.classList.remove(
    "modal-open"
  );


  currentFeedbackId = null;


  if (fbReplyText) {

    fbReplyText.value = "";

  }

}


async function openFeedbackDetail(id) {

  const item =
    feedbackList.find(
      f =>
        Number(f.id) ===
        Number(id)
    );


  if (!item) {

    alert(
      "Feedback could not be found."
    );

    return;

  }


  currentFeedbackId =
    Number(id);


  // Điền box trái
  if (fbDetailName) {

    fbDetailName.textContent =
      item.name || "Ẩn danh";

  }

  if (fbDetailEmail) {

    fbDetailEmail.textContent =
      item.email || "—";

  }

  if (fbDetailType) {

    fbDetailType.textContent =
      item.category || "—";

  }

  if (fbDetailDate) {

    fbDetailDate.textContent =
      formatFeedbackDate(
        item.created_at
      );

  }

  if (fbDetailMessage) {

    fbDetailMessage.textContent =
      item.message || "";

  }


  // Điền box phải — nếu đã trả lời trước đó, hiện lại nội
  // dung đã trả lời để admin có thể xem / sửa tiếp
  if (fbReplyText) {

    fbReplyText.value =
      item.reply_message || "";

  }

  if (fbReplyHint) {

    fbReplyHint.textContent =
      item.replied_at
        ? `Đã trả lời lúc ${formatFeedbackDate(item.replied_at)}. Nội dung này sẽ được lưu lại nội bộ — gửi email thật sẽ được kết nối ở bản sau.`
        : `Nội dung này sẽ được lưu lại nội bộ và feedback sẽ tự động chuyển sang "Đã xử lý". Gửi email thật sẽ được kết nối ở bản sau.`;

  }


  openFeedbackDetailModal();


  // Đánh dấu đã đọc (chỉ gọi API nếu đang chưa đọc, tránh
  // request thừa mỗi lần mở lại 1 feedback đã đọc rồi)
  if (!isFeedbackRead(item)) {

    try {

      const response =
        await fetch(
          `/api/admin/feedback/${id}/read`,
          {
            method: "POST",

            credentials: "same-origin"

          }
        );


      if (redirectIfUnauthorized(response)) {

        return;

      }


      if (response.ok) {

        await loadFeedback();

      }


    } catch (error) {

      console.error(
        "Mark feedback read error:",
        error
      );

    }

  }

}


closeFeedbackDetailBtn?.addEventListener(
  "click",
  closeFeedbackDetailModal
);


fbCancelReply?.addEventListener(
  "click",
  closeFeedbackDetailModal
);


feedbackDetailOverlay?.addEventListener(
  "click",
  closeFeedbackDetailModal
);


fbSendReply?.addEventListener(
  "click",
  async () => {

    if (!currentFeedbackId) {
      return;
    }


    const replyMessage =
      fbReplyText?.value
        ?.trim() || "";


    if (!replyMessage) {

      alert(
        "Vui lòng nhập nội dung trả lời."
      );

      return;

    }


    const originalText =
      fbSendReply.textContent;


    try {

      fbSendReply.disabled = true;

      fbSendReply.textContent =
        "Đang lưu...";


      const response =
        await fetch(
          `/api/admin/feedback/${currentFeedbackId}/reply`,
          {
            method: "POST",

            credentials: "same-origin",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                reply_message:
                  replyMessage
              })
          }
        );


      if (redirectIfUnauthorized(response)) {

        return;

      }


      let result = {};


      try {

        result =
          await response.json();

      } catch {

        result = {};

      }


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Failed to save reply."
        );

      }


      alert(
        "Đã lưu trả lời. Feedback đã được đánh dấu Đã xử lý."
      );


      closeFeedbackDetailModal();


      await loadFeedback();


    } catch (error) {

      console.error(
        "Send reply error:",
        error
      );


      alert(
        error.message ||
        "Failed to save reply."
      );


    } finally {

      fbSendReply.disabled = false;

      fbSendReply.textContent =
        originalText;

    }

  }
);


// =========================================================
// FEEDBACK ROW ACTIONS
// =========================================================

function attachFeedbackActions() {


  document
    .querySelectorAll(
      ".status-select"
    )
    .forEach(select => {

      select.addEventListener(
        "change",
        () => {

          updateFeedbackStatus(
            select.dataset.id,
            select.value
          );

        }
      );

    });


  document
    .querySelectorAll(
      ".view-feedback"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openFeedbackDetail(
            button.dataset.id
          );

        }
      );

    });


  document
    .querySelectorAll(
      ".delete-feedback"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteFeedback(
            button.dataset.id
          );

        }
      );

    });

}


// =========================================================
// LOGOUT
// =========================================================

document
  .getElementById(
    "logoutButton"
  )
  ?.addEventListener(
    "click",
    async () => {

      try {

        await fetch("/api/admin/logout", {
          method: "POST",
          credentials: "same-origin"
        });


      } catch (error) {

        console.error(
          "Logout request failed:",
          error
        );

      }


      // Dù request lỗi hay không cũng đưa về trang đăng nhập —
      // cookie hết hạn tự nhiên sau 8 tiếng nếu chẳng may lỗi mạng
      window.location.href = "login.html";

    }
  );


// =========================================================
// INITIALIZE
// =========================================================

loadClinics();
loadVNProvinces();
loadFeedback();