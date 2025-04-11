let chartInstance = null;

// Default time range from today 01:00 AM to current time
function getDefaultDateRange() {
  const now = new Date();
  const start = new Date();
  start.setHours(1, 0, 0, 0);
  const format = (d) => d.toISOString().slice(0, 16);
  return { from: format(start), to: format(now) };
}

// Convert PM2.5 (µg/m³) to AQI using US EPA breakpoint scale
// https://www.airnow.gov/aqi/aqi-basics/
function pm25ToAQI(pm) {
  const breakpoints = [
    { cLow: 0.0, cHigh: 12.0, aqiLow: 0, aqiHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, aqiLow: 51, aqiHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, aqiLow: 101, aqiHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, aqiLow: 151, aqiHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, aqiLow: 201, aqiHigh: 300 },
    { cLow: 250.5, cHigh: 350.4, aqiLow: 301, aqiHigh: 400 },
    { cLow: 350.5, cHigh: 500.4, aqiLow: 401, aqiHigh: 500 },
  ];

  for (const bp of breakpoints) {
    if (pm >= bp.cLow && pm <= bp.cHigh) {
      return Math.round(
        ((bp.aqiHigh - bp.aqiLow) / (bp.cHigh - bp.cLow)) * (pm - bp.cLow) +
          bp.aqiLow
      );
    }
  }

  return -1; // Invalid PM2.5
}

// Get background color based on AQI level
function getAQIColor(val) {
  if (val < 0 || val > 500 || isNaN(val)) return "transparent";
  if (val <= 50) return "#34e400"; // Good
  if (val <= 100) return "#fcff00"; // Moderate
  if (val <= 150) return "#f77e01"; // Sensitive
  if (val <= 200) return "#f61802"; // Unhealthy
  if (val <= 300) return "#8f3f97"; // Very unhealthy
  return "#7e0623"; // Hazardous
}

// Get health message text based on AQI level
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

// Group data to 30minute intervals and average PM2.5 and AQI
function groupByHalfHour(data) {
  const grouped = {};
  data.forEach((entry) => {
    const d = new Date(entry.datetime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(
      2,
      "0"
    )}:${d.getMinutes() < 30 ? "00" : "30"}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      raw: parseFloat(entry.value),
      aqi: pm25ToAQI(parseFloat(entry.value)),
    });
  });

  return Object.entries(grouped).map(([time, values]) => {
    const avgRaw = values.reduce((sum, v) => sum + v.raw, 0) / values.length;
    const avgAQI = values.reduce((sum, v) => sum + v.aqi, 0) / values.length;
    return {
      hour: time,
      raw: +avgRaw.toFixed(1),
      aqi: +avgAQI.toFixed(0),
    };
  });
}

// Fetch air pollution data and render chart
function fetchPollutionData() {
  const loc = document.getElementById("locationSelect").value;
  const chartType = document.getElementById("chartTypeSelect").value;
  const start =
    document.getElementById("startDate").value || getDefaultDateRange().from;
  const end =
    document.getElementById("endDate").value || getDefaultDateRange().to;
  const locText =
    document.getElementById("locationSelect").selectedOptions[0].text;
  const url = `https://pollution.gov.np/gss/api/observation?series_id=${loc}&date_from=${start}:00&date_to=${end}:00`;

  const aqiAlert = document.getElementById("aqiAlert");
  document.getElementById("health_message").innerText = "Fetching data...";

  fetch(url)
    .then((res) => res.json())
    .then((json) => {
      let raw = json?.data || [];
      raw = raw.filter((entry) => entry.value !== -999);

      if (!raw.length) {
        document.getElementById("health_message").innerText =
          "No valid data received from station.";
        document.getElementById(
          "pageTitle"
        ).innerText = `Live Air Quality – ${locText}`;
        aqiAlert.style.backgroundColor = "red";
        aqiAlert.style.color = "white";
        renderEmptyChart();
        return;
      }

      const halfHourly = groupByHalfHour(raw);
      const labels = halfHourly.map((d) => d.hour);
      const data = halfHourly.map((d) => d.aqi);
      const colors = data.map(getAQIColor);
      const lastVal = halfHourly.at(-1)?.aqi;

      // Update chart
      renderChart(labels, data, colors, chartType, halfHourly);

      // Update title
      document.getElementById("pageTitle").innerText =
        `Live Air Quality – ${locText}` +
        (lastVal >= 0 ? ` (AQI: ${lastVal})` : "");

      // Update message, background
      if (lastVal >= 0 && lastVal <= 500) {
        document.getElementById("health_message").innerText =
          getHealthMessage(lastVal);
        aqiAlert.style.backgroundColor = getAQIColor(lastVal);
        aqiAlert.style.color = lastVal > 100 ? "white" : "black";
      } else {
        document.getElementById("health_message").innerText =
          "No valid data available.";
        aqiAlert.style.backgroundColor = "red";
        aqiAlert.style.color = "white";
      }
    })
    .catch(() => {
      document.getElementById("health_message").innerText =
        "Error loading data from station.";
      document.getElementById(
        "pageTitle"
      ).innerText = `Live Air Quality – ${locText}`;
      aqiAlert.style.backgroundColor = "red";
      aqiAlert.style.color = "white";
      renderEmptyChart();
    });
}

// Render chart
function renderChart(labels, data, colors, type, rawData) {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: type === "area" ? "line" : type,
    data: {
      labels,
      datasets: [
        {
          label: "AQI",
          data,
          backgroundColor: type === "line" ? "rgba(52, 164, 235, 0.2)" : colors,
          borderColor: type === "line" ? "#2a4365" : colors,
          borderWidth: 1,
          fill: type !== "bar",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: 20 } },
      scales: {
        x: {
          ticks: {
            callback: function (value) {
              const label = this.getLabelForValue(value);
              const date = new Date(label);
              return `${date.getHours().toString().padStart(2, "0")}:${date
                .getMinutes()
                .toString()
                .padStart(2, "0")}`;
            },
          },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "AQI" },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function () {
              return "";
            },
            afterBody: function (items) {
              const idx = items[0].dataIndex;
              return [
                `PM2.5: ${rawData[idx].raw} µg/m³`,
                `AQI: ${rawData[idx].aqi}`,
                `Category: ${getHealthMessage(rawData[idx].aqi).split(":")[0]}`,
              ];
            },
          },
        },
      },
    },
  });
}

// Render empty chart if no data, error
function renderEmptyChart() {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [{ label: "AQI", data: [], backgroundColor: [] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// Download chart
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
