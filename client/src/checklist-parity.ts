const openCategories = new Set<string>();
let checklistInitialized = false;

function categoryName(category: HTMLElement) {
  return category.querySelector("h3")?.childNodes[0]?.textContent?.trim() || "";
}

function refreshCategory(category: HTMLElement) {
  const heading = category.querySelector<HTMLHeadingElement>("h3");
  if (!heading) return;
  const name = categoryName(category);
  const rows = category.querySelectorAll(".check-row");
  const answered = category.querySelectorAll(".segmented .selected").length;
  let count = heading.querySelector<HTMLSpanElement>(".check-category-count");
  if (!count) { count = document.createElement("span"); count.className = "check-category-count"; heading.append(count); }
  count.textContent = `${answered}/${rows.length}`;
  category.classList.toggle("is-collapsed", !openCategories.has(name));
  heading.setAttribute("aria-expanded", String(openCategories.has(name)));
}

function prepareChecklist() {
  const categories = [...document.querySelectorAll<HTMLElement>(".full-wizard .check-category")];
  if (!categories.length) return;
  if (!checklistInitialized) { openCategories.add(categoryName(categories[0])); checklistInitialized = true; }
  categories.forEach((category) => {
    const heading = category.querySelector<HTMLHeadingElement>("h3");
    if (!heading || heading.dataset.checklistToggle) return refreshCategory(category);
    heading.dataset.checklistToggle = "true";
    heading.tabIndex = 0;
    heading.setAttribute("role", "button");
    const toggle = () => { const name = categoryName(category); openCategories.has(name) ? openCategories.delete(name) : openCategories.add(name); refreshCategory(category); };
    heading.addEventListener("click", toggle);
    heading.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); } });
    refreshCategory(category);
  });
}

if (typeof document !== "undefined") new MutationObserver(() => requestAnimationFrame(prepareChecklist)).observe(document.body, { childList: true, subtree: true });
