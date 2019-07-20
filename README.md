# kathmandu-air

A small project on the use of open data to create effective air pollution awareness among the community. View how the air quality is changing, health effect it offers using chart visualization provided by CanvasJS. You can save the render information in images or PDF document. 

![Screenshot from 2019-06-08 19-46-42](https://user-images.githubusercontent.com/43197293/59148262-31c69900-8a26-11e9-81fe-94386833d6a2.png)

Live demo is available at https://vijaypathak.com.np/kathmandu-air/

## How it works?
- Fetch open-source data available at <a href="https://www.epa.gov/outdoor-air-quality-data" target="_blank">EPA</a>
- Render in charts using <a href="https://canvasjs.com/" target="_blank">CanvasJS</a>
- Display health messages based on current air
- Visualize AQI, PM2.5 using AQI color code


## Atmospheric particulates data available

- <a href="https://en.wikipedia.org/wiki/Air_quality_index" target="_blank">AQI</a>
- <a href="https://en.wikipedia.org/wiki/NowCast_(air_quality_index)" target="_blank">PM2.5 NowCast Concentration</a>
- PM2.5 Raw Concentration

## Requirements
```
- CanvasJS 2.0
- JQuery 3
```

## How to run the project?
```
Execute index.html
```

## Add your location data
- Visit <a href="https://airnow.gov/" target="_blank">EPA AirNow</a> and collect air data feeds
- Visit <a href="https://github.com/hbvj99/kathmandu-air/blob/master/js/live_visualize.js">js</a> and store the feed url in variable
- Render location data



## Contributions
Made in collobation with <a href="https://github.com/ankitch" target="_blank">@ankitch</a>

You can modify the content, optimize the code as you may like. You can credit me by mentioning this repository or contributors if you wish. Pull requests are welcomed.

SUPPORT :heart: OPEN-SOURCE!


## References
Refer <a href="https://airnow.gov/index.cfm?action=aqibasics.aqi" target="_blank">Clean Air Act Overview</a>, to learn about the AQI color coding and health messages for different particulates.

## License

[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](https://github.com/hbvj99/kathmandu-air/blob/master/LICENSE)
