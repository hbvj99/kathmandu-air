let chart_data = {
    animationEnabled: true,
    exportEnabled: true,
    exportFileName: "Phora Durbar Live AQI",
    animationDuration: 1400,
    zoomEnabled: true,
    zoomType: "xy",
    theme: "light1", //"light1", "dark1", "dark2"
    interactivityEnabled: true,
    // backgroundColor: "#F5DEB3",
    // dataPointMaxWidth: 50,
    // dataPointMinWidth: 20,
    // dataPointWidth: 70,

    toolTip: {
        content: "Date: {label}<br/>Data: {y}"
    },

    axisX: {
        // interval: 1,
        // titleFontSize: 21,
        // labelFormatter: label
    },
    axisY: {
        title: "AQI",
        valueFormatString: "#",
        // titleFontSize: 21,
        // includeZero: false,
        // titleFontColor: "red"
    },
    title: {
        text: "AQI",
    },

    subtitles: [{
        text: "Phora Durbar, Kathmandu"
    }],
    data: [{
        // lineColor: "red", //**Change the color here
        type: 'column',
        // color: "red",
        // indexLabel: "{y}",
        dataPoints: []
    }]

}

let phora_pm2 = 'https://dosairnowdata.org/dos/RSS/PhoraDurbarKathmandu/PhoraDurbarKathmandu-PM2.5.xml';
let emb_pm2 = 'https://dosairnowdata.org/dos/RSS/EmbassyKathmandu/EmbassyKathmandu-PM2.5.xml';

window.onload = function () {
    chartRenderer(phora_pm2,
        chart_data, 'column', 'AQI')
}


function getLocUrl(name) {
    if (name === 'Lazimpat Kathmandu') {
        url = phora_pm2
    } else if (name === 'US Embassy Kathmandu') {
        url = emb_pm2
    } else {
        url = phora_pm2
    }
    return url
}

function changeLocation(location_name) {

    chart_data.subtitles[0].text = location_name


    let charType = $("#chartType option:selected").val();
    let url = getLocUrl(location_name)

    let airProperties = $("#air_properties option:selected").val();


    chartRenderer(url, chart_data, charType, airProperties)
}

function changeType(type) {


    let location_name = $("#loc_nm option:selected").val();

    chart_data.subtitles[0].text = location_name

    let airProperties = $("#air_properties option:selected").val();

    let url = getLocUrl(location_name)
    chartRenderer(url, chart_data, type, airProperties)
}

function onchangeConc(Concdata) {
    let airProperties = $("#air_properties option:selected").val();

    let charType = $("#chartType option:selected").val();

    let location_nm = $("#loc_nm option:selected").val();


    chart_data.title.text = airProperties
    chart_data.axisY.title = airProperties
    let url = getLocUrl(location_nm)
    chartRenderer(url, chart_data, charType, airProperties)
}

function chartRenderer(url, chartData, chartType, airDataType) {
    let chart = new CanvasJS.Chart("chartContainer", chartData)
    let dataPoints = []
    let labels_ = []
    let now_cast_con = []
    let conc = []

    $.get(url, function (data) {
        $(data).find("item").each(function () {
            let $dataPoint = jQuery(this);

            let label = new Date($dataPoint.find("ReadingDateTime").text()).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                hour12: true,
                minute: 'numeric'
            });
            let y = $dataPoint.find(airDataType).text();
            dataPoints.push({label: label, y: parseFloat(y), color: aqiColor(parseInt(y))});
            labels_.push(label)

        });
        chartData.data[0].type = chartType
        chartData.data[0].dataPoints = dataPoints

        let health_aqi = dataPoints.slice(-1)
        let z = parseInt(health_aqi[0].y)

        let message = healthMessage(z)

        document.getElementById("health_message").innerHTML = message

        chart.render()
    });
}

function aqiColor(y) {
    if (y <= 0) {
        return "#fff"
    } else if (y >= 0 && y <= 50) {
        return "#34e400"
    } else if (y >= 51 && y <= 100) {
        return "#fcff00"
    } else if (y >= 101 && y <= 150) {
        return "#f77e01"
    } else if (y >= 151 && y <= 200) {
        return "#f61802"
    } else if (y >= 201 && y <= 300) {
        return "#8f3f97"
    } else if (y >= 301) {
        return "#7e0623"
    }
}

function healthMessage(y) {
    if (y <= 0) {
        return "<div class='text-uppercase'>Error!</div><br/>No data was received from the station";
    } else if (y >= 0 && y <= 50) {
        return "<div class='text-uppercase'>Good</div><br/>The AQI value is between 0 and 50. Air quality is satisfactory and poses little or no health risk.";
    } else if (y >= 51 && y <= 100) {
        return "<div class='text-uppercase'>Moderate</div><br/>The AQI is between 51 and 100. Air quality is acceptable; however, pollution in this range may pose a moderate health concern for a very small number of individuals. People who are unusually sensitive to ozone or particle pollution may experience respiratory symptoms.";
    } else if (y >= 101 && y <= 150) {
        return "<div class='text-uppercase'>Unhealthy for Sensitive Groups</div><br/>When AQI values are between 101 and 150, members of sensitive groups may experience health effects, but the general public is unlikely to be affected.<br><b>Ozone:</b> People with lung disease, children, older adults, and people who are active outdoors are considered sensitive and therefore at greater risk.<br><b>Particle pollution:</b> People with heart or lung disease, older adults, and children are considered sensitive and therefore at greater risk.";
    } else if (y >= 151 && y <= 200) {
        return "<div class='text-uppercase'>Unhealthy</div><br/>Everyone may begin to experience health effects when AQI values are between 151 and 200. Members of sensitive groups may experience more serious health effects.";
    } else if (y >= 201 && y <= 300) {
        return "<div class='text-uppercase'>Very Unhealthy</div><br/>AQI values between 201 and 300 trigger a health alert, meaning everyone may experience more serious health effects.";
    } else if (y >= 301) {
        return "<div class='text-uppercase'>Hazardous</div><br/><b>Health alert:</b> AQI values over 300 trigger health warnings of emergency conditions. The entire population is even more likely to be affected by serious health effects."
    }
}