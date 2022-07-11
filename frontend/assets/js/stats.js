function createChartContainer(container, el) {

    const chart_node = document.createElement('div')

    chart_node.innerHTML = `<div id="${el}_chart"></div>`
//    chart_node.style.position = "relative"

    chart_node.classList.add("ui")
    chart_node.classList.add("segment")
    chart_node.classList.add("raised")
    chart_node.classList.add("gc-2-box")

    document.querySelector(container).appendChild(chart_node);
    return chart_node;
}

function buildOptions(series, annotation, chart_title) {
    const options = {
        series: Object.values(series),
        chart: {
            type: 'area',
            animations: {
              enabled: false
            }
        },
        dataLabels: {
            enabled: false
        },
        stroke: {curve: 'smooth'},
        tooltip: {
            x: { format: 'dd/MM/yy HH:mm'},
        },
        xaxis: { tickAmount: 6, type: "datetime"},
        annotations: { xaxis: annotation },
        title: {text: chart_title}
    };

    return options;
}


const toggleNotes = () => {
  const notes = document.getElementsByClassName('dygraph-annotation');
  console.log("notes", notes)
  for (let i = 0; i < notes.length; i++) {
    if (!notes[i].style.display || notes[i].style.display === "block") notes[i].style.display = "none";
    else notes[i].style.display = "block";
  }
}

const formatData = (totalContainers, currentContainer, X, Y) => {
  let arr = [X];
  for (let i = 0; i < totalContainers; i++) {
    if (i === currentContainer) arr.push(Y);
    else arr.push(NaN);
  }
  return arr;
}

const getDataAndLabels = (series) => {
  let containerX;
  let containerY;
  let data = [];
  let labels = ["Time"];

  for (let i = 0; i < series.length; i++) {
    labels.push(series[i].name);
    for (let j = 0; j < series[i].data.length; j++) {
      containerX = series[i].data[j].x;
      containerY = series[i].data[j].y;
      data.push(formatData(series.length, i, containerX, containerY));
    }
  }
  return { data, labels };
}

const createGraph = (element, data, labels, title,) => {
  return new Dygraph(element.querySelector("#"+title+"_chart"),
                        data,

                        );
}




























var cpu_load = [];
        var my_series = {}
        var project_data = {}

        const query_string = window.location.search;
        const url_params = (new URLSearchParams(query_string))

        var options = {
            series: [],
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
            tooltip: {
                x: {
                    format: 'dd/MM/yy HH:mm'
                },
            },
            title: {
              text: 'REPLACE',
            },
            xaxis: {
              tickAmount: 6,
              type: "datetime"
            },
            annotations: {
                xaxis: []
            }


        };

        if(!url_params.has('id')) {
            alert("Please supply id in URL")

        } else {
            var total_energy = null;
            var accumulate = 0;
            let annotations = [];
            try {
              if(document.location.host.indexOf('metrics.green-coding.org') === 0)
                api_url = "https://api.green-coding.org";
              else
                api_url = "http://api.green-coding.local:8000";


                fetch(api_url +'/v1/stats/single/'+url_params.get('id'))
                  .then(response => response.json())
                  .then(my_json => {
                      if(my_json.success != true) {
                          alert(my_json.err);
                          return;
                      }

                      console.log("my_json", my_json)
                      document.querySelector("#project-last-crawl").innerText = my_json.project.last_crawl;
                      document.querySelector("#project-name").innerText = my_json.project.name;
                      document.querySelector("#project-url").innerText = my_json.project.url;
                      document.querySelector("#project-cpu").innerText = my_json.project.cpu;
                      document.querySelector("#project-memtotal").innerText = my_json.project.memtotal;

                      my_json.data.forEach(el => {
                          if(my_series[el[2]] == undefined) {
                            my_series[el[2]] = {}
                          }

                        el[1] = el[1]/1000;

                        var value = null;
                        if(el[2] == 'cpu_cgroup' && accumulate == 1) {
                          cpu_load.push(el[3]);
                          value = el[3] / 100;
                        } else if(el[2] == 'energy_system_RAPL_MSR') {
                          if(accumulate === 1) total_energy += el[3]
                          value = el[3];
                        } else if(el[2] == 'memory_cgroup') {
                          value = el[3] / 1000000;
                        } else {
                            value = el[3];
                        }

                        if(my_series[el[2]][el[0]] == undefined) {
                            my_series[el[2]][el[0]] = {name: el[0], data: [{x: el[1], y: value}]}
                        } else {
                            my_series[el[2]][el[0]]['data'].push({x: el[1], y: value})
                        }

                        /*  Notes are coming from the API now, please rework
                        if(el[4] != null) {
                            annotations.push({
                              series: el[0],
                              x: el[1],
                              shortText: el[4][0] === " " ? el[4][1] : el[4][0], // first letter of the message; in case it's a space, then seccond letter
                              text: el[4],
                            })

                            replicateAnnotations("cpu");
                            replicateAnnotations("system-energy");
                            replicateAnnotations("mem");
                            replicateAnnotations("net_in");
                        }
                        */

                        /*
                        el[0] // container_id
                        el[1] // time
                        el[2] // metric name
                        el[3] // value
                        el[4] // note => Not anymore present
                        '*/
              })
                        console.log("annotations", annotations)


                        $(document).ready(() => {
                            charts = []

                            for ( el in my_series) {
                                const { "data": data, "labels": labels } = getDataAndLabels(Object.values(my_series[el]));
                                const element = createChartContainer("#chart-container", el)
                                options.series = Object.values(my_series[el])
                                charts.push(new ApexCharts(element, options))
                                // chart_cpu.setAnnotations(annotations); // please rework
                            }
                            charts.forEach((chart) => chart.render())

                        })



                        document.querySelector("#max-cpu-load").innerText = (Math.max.apply(null, cpu_load) / 100) + " %"
                        document.querySelector("#total-energy").innerText = (total_energy / 1000).toFixed(2) + " J"
                        document.querySelector("#total-co2").innerText = (total_energy / 1000 / 3600000 * 0.519 * 1000000).toFixed(2) + " ugCO2eq"
                        document.querySelector("#avg-cpu-load").innerText = ((cpu_load.reduce((a,b) => a + b, 0) / cpu_load.length) / 100).toFixed(2) + " %"

                        const total_CO2 = (total_energy / 1000 / 3600000 * 0.519 * 1000000);
                        // const total_CO2_in_kg = total_CO2 / 1000000000; // the real value, bring it back later on
                        const total_CO2_in_kg = total_CO2 * 10; // fake value only so that we see numbers greater than 0.00

                        document.querySelector("#trees").innerText = (total_CO2_in_kg / 0.06 / 1000).toFixed(2) + " trees";
                        document.querySelector("#miles-driven").innerText = (total_CO2_in_kg / 0.000403 / 1000).toFixed(2) + " miles driven";
                        document.querySelector("#gasoline").innerText = (total_CO2_in_kg / 0.008887 / 1000).toFixed(2) + " gallons";
                        document.querySelector("#smartphones-charged").innerText = (total_CO2_in_kg / 0.00000822 / 1000).toFixed(2) + " smartphones charged";
                        document.querySelector("#flights").innerText = (total_CO2_in_kg / 1000).toFixed(2) + " flights from Berlin to New York City";

                  })
              } catch(e) {
                  alert("Fetch failed: "+e)
              }
            }
