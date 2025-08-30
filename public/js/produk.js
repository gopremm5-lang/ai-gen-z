document.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.querySelector(".dropzone");
  if (dropzone) {
    dropzone.addEventListener("dragover", e => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", e => {
      dropzone.classList.remove("dragover");
    });
    dropzone.addEventListener("drop", e => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const fileInput = document.getElementById("produk-img-input");
      fileInput.files = e.dataTransfer.files;
      dropzone.querySelector("span").innerText = e.dataTransfer.files[0]?.name || "Upload gambar produk";
    });
    document.getElementById("produk-img-input").addEventListener("change", function() {
      dropzone.querySelector("span").innerText = this.files[0]?.name || "Upload gambar produk";
    });
  }
});
