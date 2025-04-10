let chartInstance = null;

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date();
  start.setHours(1, 0, 0, 0);
  const format = d => d.toISOString().slice(0, 16);
  return { from: format(start), to: format(now) };
}

function getAQIColor(val) {
  if (val < 0 || val > 500 || isNaN(val)) return "transparent"; // Avoid assigning color for invalid values
  if (val <= 50) return "#34e400";
  if (val <= 100) return "#fcff00";
  if (val <= 150) return "#f77e01";
  if (val <= 200) return "#f61802";
  if (val <= 300) return "#8f3f97";
  return "#7e0623";
}

function getHealthMessage(val) {
  if (val <= 50) return "Good: Air quality is satisfactory.";
  if (val <= 100) return "Moderate: Acceptable for most.";
  if (val <= 150) return "Unhealthy for sensitive groups.";
  if (val <= 200) return "Unhealthy: General public may be affected.";
  if (val <= 300) return "Very Unhealthy: Health warnings issued.";
  return "Hazardous: Everyone should avoid outdoor activity.";
}

function groupByHour(data) {
  const hourly = {};
  data.forEach(entry => {
    const d = new Date(entry.datetime);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
    if (!hourly[key]) hourly[key] = [];
    hourly[key].push(parseFloat(entry.value));
  });
  return Object.entries(hourly).map(([hour, values]) => ({
    hour,
    avg: +(values.reduce((a, b) => a + b) / values.length).toFixed(1)
  }));
}

function fetchPollutionData() {
  const loc = document.getElementById("locationSelect").value;
  const chartType = document.getElementById("chartTypeSelect").value;
  const start = document.getElementById("startDate").value || getDefaultDateRange().from;
  const end = document.getElementById("endDate").value || getDefaultDateRange().to;
  const locText = document.getElementById("locationSelect").selectedOptions[0].text;
  document.getElementById("pageTitle").innerText = `Live Air Quality (PM2.5) – ${locText}`;
  const url = `https://pollution.gov.np/gss/api/observation?series_id=${loc}&date_from=${start}:00&date_to=${end}:00`;

  document.getElementById("health_message").innerText = "Fetching data...";

  fetch(url)
    .then(res => res.json())
    .then(json => {
      let raw = json?.data || [];
      raw = raw.filter(entry => entry.value !== -999);

      if (!raw.length) {
        document.getElementById("health_message").innerText = "No valid data received from station.";
        renderEmptyChart();
        return;
      }

      const hourly = groupByHour(raw);
      const labels = hourly.map(d => d.hour);
      const data = hourly.map(d => d.avg);
      const colors = data.map(val => {
        return (val >= 0 && val <= 500) ? getAQIColor(val) : "transparent";
      });

      renderChart(labels, data, colors, chartType);

      const lastVal = data.at(-1);

      // Update health message for latest hour data
      if (lastVal >= 0 && lastVal <= 500) {
        document.getElementById("health_message").innerText = getHealthMessage(lastVal);
      } else {
        document.getElementById("health_message").innerText = "No valid data available.";
      }
    })
    .catch(() => {
      document.getElementById("health_message").innerText = "Error loading data.";
      renderEmptyChart();
    });
}

function renderChart(labels, data, colors, type) {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        label: "PM2.5 (µg/m³)",
        data,
        backgroundColor: type === 'line' ? "rgba(52, 164, 235, 0.2)" : colors,
        borderColor: "#2a4365",
        borderWidth: 1,
        fill: type !== 'bar',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 20
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 30,
            autoSkip: true
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "µg/m³"
          }
        }
      }
    }
  });
}

function renderEmptyChart() {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: "PM2.5 (µg/m³)",
        data: [],
        backgroundColor: []
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function downloadChart() {
  const canvas = document.getElementById("pmChart");
  const link = document.createElement("a");
  link.download = "pm25_chart.jpg";
  link.href = canvas.toDataURL("image/jpeg", 1.0);
  link.click();
}

document.addEventListener("DOMContentLoaded", () => {
  const { from, to } = getDefaultDateRange();
  document.getElementById("startDate").value = from;
  document.getElementById("endDate").value = to;
  fetchPollutionData();
});
