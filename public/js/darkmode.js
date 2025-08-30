// Dark mode toggle
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("dark-toggle").addEventListener("click", function() {
    document.body.classList.toggle("dark");
    localStorage.setItem("dark", document.body.classList.contains("dark"));
  });
  // On load, set mode
  if (localStorage.getItem("dark") === "true") {
    document.body.classList.add("dark");
  }
});
