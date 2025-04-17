let chartInstance = null;

// Default time range from today 01:00 AM to now
function getDefaultDateRange() {
  const now = new Date();
  const start = new Date();
  start.setHours(1, 0, 0, 0);
  const format = (d) => d.toISOString().slice(0, 16);
  return { from: format(start), to: format(now) };
}

// PM2.5 to AQI conversion
// References from https://www.airnow.gov/aqi/aqi-basics/
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

// AQI color & health message
// Reference from https://www.airnow.gov/aqi/aqi-basics/
function getAQIColor(val) {
  if (val <= 50) return "#34e400";
  if (val <= 100) return "#fcff00";
  if (val <= 150) return "#f77e01";
  if (val <= 200) return "#f61802";
  if (val <= 300) return "#8f3f97";
  if (val <= 500) return "#7e0623";
  return "transparent";
}

function getHealthMessage(val) {
  if (val <= 50)
    return "Good: Air quality is satisfactory, and air pollution poses little or no risk.";
  if (val <= 100)
    return "Moderate: Air quality is acceptable. However, there may be a risk for some people.";
  if (val <= 150)
    return "Unhealthy for Sensitive Groups: Members of sensitive groups may experience health effects.";
  if (val <= 200)
    return "Unhealthy: Some members of the general public may experience health effects.";
  if (val <= 300)
    return "Very Unhealthy: Health alert: The risk of health effects is increased for everyone.";
  return "Hazardous: Health warning of emergency conditions: everyone is more likely to be affected.";
}

// Helpers for grouping
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function formatKey(date, groupBy) {
  const yy = date.getFullYear(),
    mm = String(date.getMonth() + 1).padStart(2, "0"),
    dd = String(date.getDate()).padStart(2, "0"),
    hh = String(date.getHours()).padStart(2, "0"),
    mi = String(date.getMinutes()).padStart(2, "0");
  switch (groupBy) {
    case "minute":
      return `${yy}-${mm}-${dd} ${hh}:${mi}`;
    case "half-hour":
      return `${yy}-${mm}-${dd} ${hh}:${mi < 30 ? "00" : "30"}`;
    case "hour":
      return `${yy}-${mm}-${dd} ${hh}:00`;
    case "day":
      return `${yy}-${mm}-${dd}`;
    case "week":
      return `${yy}-W${String(getWeekNumber(date)).padStart(2, "0")}`;
    case "month":
      return `${yy}-${mm}`;
    case "year":
      return `${yy}`;
  }
}

function groupData(data, groupBy) {
  const buckets = {};
  data.forEach((e) => {
    const dt = new Date(e.datetime),
      key = formatKey(dt, groupBy),
      raw = parseFloat(e.value);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push({ raw, aqi: pm25ToAQI(raw) });
  });
  return Object.entries(buckets)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([time, vals]) => {
      const avgRaw = vals.reduce((s, v) => s + v.raw, 0) / vals.length,
        avgAQI = vals.reduce((s, v) => s + v.aqi, 0) / vals.length;
      return { time, raw: +avgRaw.toFixed(1), aqi: +avgAQI.toFixed(0) };
    });
}

// Fetch and render
function fetchPollutionData() {
  const loc       = document.getElementById("locationSelect").value;
  const chartType = document.getElementById("chartTypeSelect").value;
  const groupBy   = document.getElementById("groupBySelect").value;
  const start     = document.getElementById("startDate").value || getDefaultDateRange().from;
  const end       = document.getElementById("endDate").value   || getDefaultDateRange().to;
  const locText   = document.getElementById("locationSelect").selectedOptions[0].text;
  const alertEl   = document.getElementById("aqiAlert");

  // use for locally/test
  const rawUrl = `https://pollution.gov.np/gss/api/observation?series_id=${loc}&date_from=${start}:00&date_to=${end}:00`;

  // fallback
  const proxyUrl = `https://proxy.vijaypathak.com.np/proxy/${encodeURIComponent(btoa(rawUrl))}`;

  const tryFetch = (url) => 
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Network error");
        return r.json();
      });

  // First try direct HTTPS
  tryFetch(rawUrl)
    .catch(() => {
      console.warn("HTTPS request failed. Falling back to proxy.");
      return tryFetch(proxyUrl); // fallback
    })
    .then((json) => {
      const raw = (json.data || [])
        .filter((e) => typeof e.value === "number" && e.value >= 0);
      if (!raw.length) throw new Error("no-data");

      const grouped = groupData(raw, groupBy);
      renderChart(grouped, chartType);

      const lastAQI = grouped.at(-1).aqi;
      document.getElementById("pageTitle").innerText =
        `Live Air Quality – ${locText} (AQI: ${lastAQI})`;
      document.getElementById("health_message").innerText = getHealthMessage(lastAQI);
      alertEl.style.backgroundColor = getAQIColor(lastAQI);
      alertEl.style.color = lastAQI > 100 ? "white" : "black";
    })
    .catch((err) => {
      document.getElementById("health_message").innerText =
        err.message === "no-data"
          ? "No valid data received from station."
          : "Error loading data.";
      renderEmptyChart();
    });
}


// Chart renderer with tooltips
function renderChart(rawData, type) {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  const labels = rawData.map((d) => d.time),
    aqiData = rawData.map((d) => d.aqi),
    pmData = rawData.map((d) => d.raw),
    colors = aqiData.map(getAQIColor);

  const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  grad.addColorStop(0, colors.at(-1) + "33");
  grad.addColorStop(1, colors.at(-1) + "00");

  const aqiDS = {
    label: "AQI",
    data: aqiData,
    borderColor: type === "area" ? colors.at(-1) : colors,
    backgroundColor: type === "area" ? grad : colors,
    fill: type === "area",
    tension: 0.3,
    pointRadius: type === "" ? 0 : 3,
    pointBackgroundColor: colors,
    borderWidth: 1,
    yAxisID: "y",
  };
  const pmDS = {
    label: "PM2.5 (µg/m³)",
    data: pmData,
    borderColor: "gray",
    backgroundColor: "rgba(100,100,100,0.5)",
    tension: 0.3,
    pointRadius: 0,
    fill: false,
    yAxisID: "y1",
    hidden: true,
  };

  chartInstance = new Chart(ctx, {
    type: type === "area" ? "line" : type,
    data: { labels, datasets: [aqiDS, pmDS] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: 30 } },
      interaction: { mode: "index", intersect: false },
      scales:
        type === "doughnut" || type === "polarArea"
          ? {}
          : {
              x: {
                offset: true,
                ticks: { autoSkip: true, maxRotation: 45, padding: 10 },
              },
              y: { beginAtZero: true, title: { display: true, text: "AQI" } },
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
          callbacks: {
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              const category = getHealthMessage(rawData[idx].aqi).split(":")[0];
              return [`Category: ${category}`];
            },
          },
        },
        legend: {
          onClick: (e, item) => {
            const ds = chartInstance.data.datasets[item.datasetIndex];
            ds.hidden = !ds.hidden;
            if (ds.yAxisID === "y1") {
              chartInstance.options.scales.y1.display = !ds.hidden;
            }
            chartInstance.update();
          },
        },
      },
    },
  });
}

// Empty chart fallback
function renderEmptyChart() {
  const ctx = document.getElementById("pmChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "",
    data: {
      labels: [],
      datasets: [{ label: "AQI", data: [], backgroundColor: [] }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

// Download chart as JPEG
function downloadChart() {
  const canvas = document.getElementById("pmChart"),
    link = document.createElement("a"),
    tmp = document.createElement("canvas");
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  tmp.getContext("2d").drawImage(canvas, 0, 0);
  link.download = "aqi_chart.jpg";
  link.href = tmp.toDataURL("image/jpeg", 1.0);
  link.click();
}

//On page load
document.addEventListener("DOMContentLoaded", () => {
  const now = new Date(),
    start = new Date();
  start.setHours(1, 0, 0, 0);
  const toLocal = (d) => {
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  };
  document.getElementById("startDate").value = toLocal(start);
  document.getElementById("endDate").value = toLocal(now);
  fetchPollutionData();
});
