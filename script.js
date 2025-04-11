let chartInstance = null;

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date();
  start.setHours(1, 0, 0, 0);
  const format = (d) => d.toISOString().slice(0, 16);
  return { from: format(start), to: format(now) };
}

function getAQIColor(val) {
  if (val < 0 || val > 500 || isNaN(val)) return "transparent"; // No color for invalid value
  if (val <= 50) return "#34e400"; // Green
  if (val <= 100) return "#fcff00"; // Yellow
  if (val <= 150) return "#f77e01"; // Orange
  if (val <= 200) return "#f61802"; // Red
  if (val <= 300) return "#8f3f97"; // Purple
  return "#7e0623"; // Maroon
}

function getHealthMessage(val) {
  if (val <= 50)
    return "Good: Air quality is satisfactory, and air pollution poses little or no risk.";
  if (val <= 100)
    return "Moderate: Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.";
  if (val <= 150)
    return "Unhealthy for Sensitive Groups: Members of sensitive groups may experience health effects. The general public is less likely to be affected.";
  if (val <= 200)
    return "Unhealthy: Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.";
  if (val <= 300)
    return "Very Unhealthy: Health alert: The risk of health effects is increased for everyone.";
  return "Hazardous: Health warning of emergency conditions: everyone is more likely to be affected.";
}

function groupByHour(data) {
  const hourly = {};
  data.forEach((entry) => {
    const d = new Date(entry.datetime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
      2,
      "0"
    )}:00`;
    if (!hourly[key]) hourly[key] = [];
    hourly[key].push(parseFloat(entry.value));
  });
  return Object.entries(hourly).map(([hour, values]) => ({
    hour,
    avg: +(values.reduce((a, b) => a + b) / values.length).toFixed(1),
  }));
}

function fetchPollutionData() {
  const loc = document.getElementById("locationSelect").value;
  const chartType = document.getElementById("chartTypeSelect").value;
  const start =
    document.getElementById("startDate").value || getDefaultDateRange().from;
  const end =
    document.getElementById("endDate").value || getDefaultDateRange().to;
  const locText =
    document.getElementById("locationSelect").selectedOptions[0].text;
  document.getElementById(
    "pageTitle"
  ).innerText = `Live Air Quality (PM2.5) – ${locText}`;
  const url = `https://pollution.gov.np/gss/api/observation?series_id=${loc}&date_from=${start}:00&date_to=${end}:00`;

  document.getElementById("health_message").innerText = "Fetching data...";

  fetch(url)
    .then((res) => res.json())
    .then((json) => {
      let raw = json?.data || [];
      raw = raw.filter((entry) => entry.value !== -999);

      if (!raw.length) {
        document.getElementById("health_message").innerText =
          "No valid data received from station.";
        renderEmptyChart();
        return;
      }

      const hourly = groupByHour(raw);
      const labels = hourly.map((d) => d.hour);
      const data = hourly.map((d) => d.avg);
      const colors = data.map((val) => {
        return val >= 0 && val <= 500 ? getAQIColor(val) : "transparent";
      });

      renderChart(labels, data, colors, chartType);

      const lastVal = data.at(-1);

      // Update health message for latest hour data
      if (lastVal >= 0 && lastVal <= 500) {
        document.getElementById("health_message").innerText =
          getHealthMessage(lastVal);
      } else {
        document.getElementById("health_message").innerText =
          "No valid data available.";
      }
    })
    .catch(() => {
      document.getElementById("health_message").innerText =
        "Error loading data from station.";
      renderEmptyChart();
    });
}

function renderChart(labels, data, colors, type) {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  let chartData;
  let xScaleType = "category";

  {
    chartData = {
      labels,
      datasets: [
        {
          label: "PM2.5 (µg/m³)",
          data,
          backgroundColor: type === "line" ? "rgba(52, 164, 235, 0.2)" : colors,
          borderColor: type === "line" ? "#2a4365" : colors,
          borderWidth: 1,
          fill: type !== "bar" ? true : false,
          tension: 0.3,
        },
      ],
    };
  }

  chartInstance = new Chart(ctx, {
    type: type === "area" ? "line" : type,
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { bottom: 20 },
      },
      scales: {
        x: {
          type: xScaleType,
          time:
            xScaleType === "time"
              ? {
                  tooltipFormat: "MMM d, HH:mm",
                  unit: "hour",
                  displayFormats: {
                    hour: "MMM d, HH:mm",
                  },
                }
              : undefined,
          ticks: {
            maxRotation: 45,
            minRotation: 30,
            autoSkip: true,
            callback: function (value, index, ticks) {
              const label = this.getLabelForValue(value);
              const date = new Date(label);
              const month = date.toLocaleString("default", { month: "short" });
              const day = date.getDate().toString().padStart(2, "0");
              const hour = date.getHours().toString().padStart(2, "0");
              const minute = date.getMinutes().toString().padStart(2, "0");
              return `${month} ${day}, ${hour}:${minute}`;
            },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "µg/m³",
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterBody: function (tooltipItems) {
              const val = tooltipItems[0].parsed.y;
              return getHealthMessage(val).split(":")[0]; // Only show category
            },
          },
        },
      },
    },
  });
}

function renderEmptyChart() {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "PM2.5 (µg/m³)",
          data: [],
          backgroundColor: [],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function downloadChart() {
  const canvas = document.getElementById("pmChart");
  const link = document.createElement("a");
  link.download = "pm25_chart.jpg";

  const tempCanvas = document.createElement("canvas");
  const ctx = tempCanvas.getContext("2d");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  ctx.drawImage(canvas, 0, 0);

  link.href = tempCanvas.toDataURL("image/jpeg", 1.0);
  link.click();
}

document.addEventListener("DOMContentLoaded", () => {
  const { from, to } = getDefaultDateRange();
  document.getElementById("startDate").value = from;
  document.getElementById("endDate").value = to;
  fetchPollutionData();
});
