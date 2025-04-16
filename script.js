let chartInstance = null;

// Default time range from today 01:00 AM to current time
function getDefaultDateRange() {
  const now = new Date();
  const start = new Date();
  start.setHours(1, 0, 0, 0);
  const format = (d) => d.toISOString().slice(0, 16);
  return { from: format(start), to: format(now) };
}

// Convert PM2.5 (µg/m³) to AQI
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
  return -1;
}

// AQI color
function getAQIColor(val) {
  if (val < 0 || val > 500 || isNaN(val)) return "transparent";
  if (val <= 50) return "#34e400";
  if (val <= 100) return "#fcff00";
  if (val <= 150) return "#f77e01";
  if (val <= 200) return "#f61802";
  if (val <= 300) return "#8f3f97";
  return "#7e0623";
}

// AQI health message
function getHealthMessage(val) {
  if (val <= 50)
    return "Good: Air quality is satisfactory, and air pollution poses little or no risk.";
  if (val <= 100)
    return "Moderate: Air quality is acceptable. However, there may be a risk for some people.";
  if (val <= 150)
    return "Unhealthy for Sensitive Groups: Members of sensitive groups may experience health effects. The general public is less likely to be affected.";
  if (val <= 200)
    return "Unhealthy: Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.";
  if (val <= 300)
    return "Very Unhealthy: Health alert: The risk of health effects is increased for everyone.";
  return "Hazardous: Health warning of emergency conditions: everyone is more likely to be affected.";
}

// Grouping logic
function groupData(data, groupBy) {
  const grouped = {};

  data.forEach((entry) => {
    const d = new Date(entry.datetime);
    let key;

    switch (groupBy) {
      case "minute":
        key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
        break;
      case "half-hour":
        key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${d.getHours()}:${
          d.getMinutes() < 30 ? "00" : "30"
        }`;
        break;
      case "hour":
        key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${d.getHours()}:00`;
        break;
      case "day":
        key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        break;
      case "week":
        key = `${d.getFullYear()}-W${getWeekNumber(d)}`;
        break;
      case "month":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        break;
      case "year":
        key = `${d.getFullYear()}`;
        break;
    }

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

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Main data fetcher
function fetchPollutionData() {
  const loc = document.getElementById("locationSelect").value;
  const chartType = document.getElementById("chartTypeSelect").value;
  const groupBy = document.getElementById("groupBySelect").value;

  const start =
    document.getElementById("startDate").value || getDefaultDateRange().from;
  const end =
    document.getElementById("endDate").value || getDefaultDateRange().to;

  const locText =
    document.getElementById("locationSelect").selectedOptions[0].text;

  // Original url to test locally
  // const url = `http://pollution.gov.np/gss/api/observation?series_id=${loc}&date_from=${start}:00&date_to=${end}:00`;

  // Use proxy
  const rawUrl = `https://pollution.gov.np/gss/api/observation?series_id=${loc}&date_from=${start}:00&date_to=${end}:00`;
  const url = `https://proxy-express.onrender.com/proxy?b64=${toBase64(rawUrl)}`

  const aqiAlert = document.getElementById("aqiAlert");
  document.getElementById("health_message").innerText = "Fetching data...";

  fetch(url)
    .then((res) => res.json())
    .then((json) => {
      let raw = json?.data || [];
      raw = raw.filter(
        (entry) => typeof entry.value === "number" && entry.value >= 0
      );
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

      const grouped = groupData(raw, groupBy);
      const labels = grouped.map((d) => d.hour);
      const data = grouped.map((d) => d.aqi);
      const colors = data.map(getAQIColor);
      const lastVal = grouped.at(-1)?.aqi;

      renderChart(labels, data, colors, chartType, grouped);

      document.getElementById("pageTitle").innerText =
        `Live Air Quality – ${locText}` +
        (lastVal >= 0 ? ` (AQI: ${lastVal})` : "");

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
      aqiAlert.style.backgroundColor = "red";
      aqiAlert.style.color = "white";
      renderEmptyChart();
    });
}

// Chart rendering
function renderChart(labels, data, colors, type, rawData) {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  const lastAQI = rawData.at(-1)?.aqi || 100;
  const defaultColor = getAQIColor(lastAQI);
  const isLineType = type === "line" || type === "area";
  const chartBaseType = type === "area" ? "line" : type;

  chartInstance = new Chart(ctx, {
    type: chartBaseType,
    data: {
      labels,
      datasets: [
        {
          label: "AQI",
          data: rawData.map((d) => d.aqi),
          backgroundColor: isLineType ? defaultColor + "33" : colors,
          borderColor: isLineType ? defaultColor : colors,
          borderWidth: 2,
          fill: type === "area",
          tension: 0.3,
          pointBackgroundColor: isLineType ? colors : undefined,
          yAxisID: "y",
        },
        {
          label: "PM2.5 (µg/m³)",
          data: rawData.map((d) => d.raw),
          backgroundColor: "rgba(100,100,100,0.1)",
          borderColor: "gray",
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          yAxisID: "y1",
          hidden: true, // default hidden
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: 20 } },
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales:
        type === "doughnut" || type === "polarArea"
          ? {}
          : {
              x: {
                ticks: {
                  maxRotation: 45,
                  minRotation: 30,
                  autoSkip: true,
                },
              },
              y: {
                beginAtZero: true,
                title: { display: true, text: "AQI" },
              },
              y1: {
                beginAtZero: true,
                position: "right",
                display: false,
                title: { display: true, text: "PM2.5 (µg/m³)" },
                grid: { drawOnChartArea: false },
              },
            },
      plugins: {
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            afterBody: function (items) {
              const idx = items[0].dataIndex;
              return [
                `Category: ${getHealthMessage(rawData[idx].aqi).split(":")[0]}`,
              ];
            },
          },
        },
        legend: {
          onClick: (e, legendItem, legend) => {
            const index = legendItem.datasetIndex;
            const ci = legend.chart;
            const meta = ci.getDatasetMeta(index);

            // Toggle y1 axis display PM2.5 dataset visibility
            meta.hidden = !meta.hidden;
            if (legendItem.text === "PM2.5 (µg/m³)") {
              const y1 = ci.options.scales.y1;
              y1.display = !meta.hidden;
            }

            ci.update();
          },
        },
      },
    },
  });
}

// Empty fallback chart
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

// Execute page load
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  const start = new Date();

  // Set start to today at 1:00 AM
  start.setHours(1, 0, 0, 0);

  // Use format: "YYYY-MM-DDTHH:MM"
  const toDatetimeLocal = (dt) => {
    const offset = dt.getTimezoneOffset();
    const local = new Date(dt.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };

  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");

  if (startInput && endInput) {
    startInput.value = toDatetimeLocal(start);
    endInput.value = toDatetimeLocal(now);
  }
  fetchPollutionData();
});
