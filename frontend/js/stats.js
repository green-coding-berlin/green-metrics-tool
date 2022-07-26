const getApexOptions = () => {
    return {
        series: null,
        chart: {
            type: 'area',
            animations: {
              enabled: false
            }
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth'
        },
        title: {
          text: '',
        },
        xaxis: {
          tickAmount: 6,
          type: "datetime"
        },
        annotations: {
            xaxis: []
        },
        tooltip: {
            enabled: true,
            shared: true,
            followCursor: true,
            x: {
              show: true,
              format: 'HH:mm:ss',
          },

        },
    };
}


const getEChartsOptions = () => {
    return {
        tooltip: {
            trigger: 'axis'
        },
        xAxis: {
           type: 'time',
           splitLine: {show: true}
        },

        yAxis: {
            type: 'value',
           splitLine: {show: true}
        },
        series: [],
        title: {text: null},
        animation: false,
        legend: {
            data: [],
            bottom: 0,
            // type: 'scroll' // maybe active this if legends gets too long
        },
        toolbox: {
            itemSize: 25,
            top: 55,
            feature: {
              dataZoom: {
                yAxisIndex: 'none'
              },
              restore: {}
            }
          },

    };
}

const fillProjectData = (project, key = null) => {

    for (item in project) {
        if (item == 'machine_specs') {
            fillProjectTab('#machine-specs', project[item])
        } else if(item == 'usage_scenario') {
            document.querySelector("#usage-scenario").insertAdjacentHTML('beforeend', `<tr><td><strong>${item}</strong></td><td><pre>${JSON.stringify(project?.[item], null, 2)}</pre></td>`)

        } else if(item == 'measurement_config') {
            fillProjectTab('#measurement-config', project[item])
        }  else {
            document.querySelector('#project-data').insertAdjacentHTML('beforeend', `<tr><td><strong>${item}</strong></td><td>${project?.[item]}</td></tr>`)
        }
    }
}

const fillProjectTab = (selector, data) => {
    for (item in data) {
        if(typeof data[item] == 'object')
            fillProjectTab(selector, data[item])
        else
            document.querySelector(selector).insertAdjacentHTML('beforeend', `<tr><td><strong>${item}</strong></td><td>${data?.[item]}</td></tr>`)

    }
}

const getMetrics = (stats_data, style='apex') => {
    const metrics = {cpu_load: [], mem_load: [], series: {}, total_energy: 0}

    let accumulate = 0;


    const t0 = performance.now();

    stats_data.data.forEach(el => {
        /* Spec for data
        el[0] // container_id
        el[1] // time -> in microseconds
        el[2] // metric name
        el[3] // value -> This value might need to be rescaled
        '*/
        accumulate = 0; // default

        if (el[1] > stats_data.project.start_measurement && el[1] < stats_data.project.end_measurement) {
            accumulate = 1;
        }

        let time_in_ms = el[1] / 1000; // divide microseconds timestamp to ms to be handled by charting lib
        let value = el[3]; // default

        if (el[2] == 'cpu_cgroup_container') { // value is
            value = el[3] / 100; // CPU comes as ratio, but since stored as integer is was multiplicated with 100
            if (accumulate === 1) metrics.cpu_load.push(value);
        } else if (el[2] == 'energy_RAPL_MSR_system') {
            value = el[3] / 1000; // value is in mJ
            if (accumulate === 1) metrics.total_energy += value;
        } else if (el[2] == 'memory_cgroup_container') {
            value = el[3] / 1000000; // make memory in MB since it comes in Bytes
            if (accumulate === 1) metrics.mem_load.push(value);
        }

        // Depending on the charting library the object has to be reformatted
        // First we check if structure is initialized
        if (metrics.series[el[2]] == undefined)  metrics.series[el[2]] = {};
        if (metrics.series[el[2]][el[0]] == undefined) {
            metrics.series[el[2]][el[0]] = { name: el[0], data: [] }
        }

        // now we handle the library specific formatting
        if(style=='apex') {
            metrics.series[el[2]][el[0]]['data'].push({ x: time_in_ms, y: value })
        } else if(style=='echarts') {
            metrics.series[el[2]][el[0]]['data'].push([time_in_ms, value])
        } else throw "Unknown chart style"
    })

    const t1 = performance.now();
    console.log(`getMetrics Took ${t1 - t0} milliseconds.`);
    return metrics;
}

const displayGraphs = (metrics, notes, style='apex') => {

    let counter = 0; // for automatically creating pair of <div>s
    const note_positions = [
      'insideStartTop',
      'insideEndBottom'
    ];
    const chart_instances = [];
    const t0 = performance.now();

    for ( metric_name in metrics) {

        const element = createChartContainer("#chart-container", metric_name, counter);

        if(style=='apex') {
            charts = [];
            let options = getApexOptions();
            options.title.text = metric_name;
            options.series = Object.values(metrics[metric_name]);
            (new ApexCharts(element, options)).render();
        } else if(style == 'echarts') {
            var options = getEChartsOptions();
            options.title.text = metric_name;
            for (container in metrics[metric_name]) {
                options.legend.data.push(container)
                options.series.push({
                    name: container,
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    areaStyle: {},
                    data: metrics[metric_name][container].data,
                    markLine: { data: [ {type: "average",label: {formatter: "AVG_ii:\n{c}"}}]}
                });
            }
            // now we add all notes to every chart
            options.legend.data.push('Notes')
            let notes_labels = [];
            let inner_counter = 0;
            notes.forEach(note => {
                notes_labels.push({xAxis: note[3]/1000, label: {formatter: note[2], position: note_positions[inner_counter%2]}})
                inner_counter++;
            })
            options.series.push({
                name: "Notes",
                type: 'line',
                smooth: true,
                symbol: 'none',
                areaStyle: {},
                data: [],
                markLine: { data: notes_labels}
            });
            const chart_instance = echarts.init(element);
            chart_instance.setOption(options);
            chart_instances.push(chart_instance);

        } else {
            throw "Unknown chart style";
        }
        counter++;

    }

    const t1 = performance.now();
    console.log(`DisplayGraphs took ${t1 - t0} milliseconds.`);

    window.onresize = function() { // set callback when ever the user changes the viewport
        chart_instances.forEach(chart_instance => {
            chart_instance.resize();
        })
    }
}


const createChartContainer = (container, el, counter) => {
    const chart_node = document.createElement("div")
    chart_node.classList.add("card");
    chart_node.classList.add('statistics-chart-card')
    chart_node.classList.add('ui')

    chart_node.innerHTML = `
    <div class="content">
        <div class="description">
            <div class="statistics-chart" id=${el}-chart></div>
        </div>
    </div>`
    document.querySelector(container).appendChild(chart_node)
    //document.querySelector(container).parentNode.insertBefore(chart_node, null);
    return chart_node.querySelector('.statistics-chart');
}

const createGraph = (element, data, labels, title) => {
  // console.log('labels', labels)
  return new Dygraph(element, data, {
      labels,
      fillGraph: true,
      rollPeriod: 10,
      showRoller: true,
      title,
      legend: "always",
      labelsSeparateLines: true,
      highlightSeriesOpts: { strokeWidth: 2 },
    // showLabelsOnHighlight: false,
    axes: {
        x: {
            axisLabelFormatter: Dygraph.dateAxisLabelFormatter,
            ticker: Dygraph.dateTicker,
        },
    },
    drawCallback: function (g) {
        const notes = document.getElementsByClassName('dygraph-annotation');
        for (let i = 0; i < notes.length; i++) {
            if (notes[i].style.top === "") notes[i].style.display = "none";
        }
    },
    annotationMouseOverHandler: function (ann, point, dg, event) {
        $(ann.div)
        .popup({
            title   : 'Note',
            content : ann.text,
            variation: 'mini',
            inline: true
        }).popup("show")
    },
    annotationMouseOutHandler: function (ann, point, dg, event) {
        $(ann.div)
        .popup("hide")
    },
});
};

const fillAvgContainers = (metrics) => {

    const total_energy_in_kW = (metrics.total_energy / 1000) / 3600;
    let total_CO2_in_kg = (total_energy_in_kW * 0.519) / 1000;


    let co2_display = { value: total_CO2_in_kg, unit: 'kg'};
    console.log(total_CO2_in_kg);
    if     (total_CO2_in_kg < 0.0000000001) co2_display = { value: total_CO2_in_kg*(10**12), unit: 'ng'};
    else if(total_CO2_in_kg < 0.0000001) co2_display = { value: total_CO2_in_kg*(10**9), unit: 'ug'};
    else if(total_CO2_in_kg < 0.0001) co2_display = { value: total_CO2_in_kg*(10**6), unit: 'mg'};
    else if(total_CO2_in_kg < 0.1) co2_display = { value: total_CO2_in_kg*(10**3), unit: 'g'};

    document.querySelector("#max-cpu-load").innerText = (Math.max.apply(null, metrics.cpu_load)) + " %"
    document.querySelector("#total-energy").innerText = (metrics.total_energy).toFixed(2) + " J"
    document.querySelector("#total-co2").innerHTML = `${(co2_display.value).toFixed(2)} <span style='text-transform: lowercase;'>${co2_display.unit}</span>`
    document.querySelector("#avg-cpu-load").innerText = ((metrics.cpu_load.reduce((a, b) => a + b, 0) / metrics.cpu_load.length)).toFixed(2) + " %"
    document.querySelector("#avg-mem-load").innerText = ((metrics.mem_load.reduce((a, b) => a + b, 0) / metrics.mem_load.length)).toFixed(2) + " MB"

    upscaled_CO2_in_kg = total_CO2_in_kg * 10000 * 30; // upscaled by 30 days for 10.000 requests (or runs) per day

    document.querySelector("#trees").innerText = (upscaled_CO2_in_kg / 0.06 / 1000).toFixed(2);
    document.querySelector("#miles-driven").innerText = (upscaled_CO2_in_kg / 0.000403 / 1000).toFixed(2);
    document.querySelector("#gasoline").innerText = (upscaled_CO2_in_kg / 0.008887 / 1000).toFixed(2);
    document.querySelector("#smartphones-charged").innerText = (upscaled_CO2_in_kg / 0.00000822 / 1000).toFixed(2);
    document.querySelector("#flights").innerText = (upscaled_CO2_in_kg / 1000).toFixed(2);
}


/* Chart starting code*/
$(document).ready( (e) => {
    (async () => {
        const query_string = window.location.search;
        const url_params = (new URLSearchParams(query_string))

        try {
            var notes_json = await makeAPICall('/v1/notes/' + url_params.get('id'))
            var stats_data = await makeAPICall('/v1/stats/single/' + url_params.get('id'))
        } catch (err) {
            showNotification('Could not get data from API', err);
            return;
        }
        $('.ui.secondary.menu .item').tab();

        const metrics = getMetrics(stats_data, 'echarts');
        fillProjectData(stats_data.project)
        displayGraphs(metrics.series, notes_json.data, 'echarts');
        fillAvgContainers(metrics);
        document.querySelector('#api-loader').remove();

        // after all instances have been placed the flexboxes might have rearranged. We need to trigger resize
        setTimeout(function(){console.log("Resize"); window.dispatchEvent(new Event('resize'))}, 500); // needed for the graphs to resize

    })();
});
