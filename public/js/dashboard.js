// dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById('chartOrder')) {
    fetch("/api/dashboard-orders")
      .then(res => res.json())
      .then(data => {
        new Chart(document.getElementById('chartOrder').getContext('2d'), {
          type: 'bar',
          data: {
            labels: data.labels,
            datasets: [{
              label: 'Order',
              data: data.orders,
              backgroundColor: '#3b82f6'
            }]
          },
          options: { responsive: true }
        });
      })
      .catch(() => {/* fallback dummy */}
      );
  }
});
