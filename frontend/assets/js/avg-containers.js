import sheet from '/dist/semantic.min.css' assert { type: 'css' };

class AvgContainers extends HTMLElement {
    constructor(mydata) {
      // establish prototype chain
      super();

      // attaches shadow tree and returns shadow root reference
      // https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow
      const shadowRoot = this.attachShadow({ mode: 'open' });
      this.shadowRoot.adoptedStyleSheets = [sheet];
      // creating a container for the editable-list component
      const avgContainer = document.createElement('div');

      // creating the inner HTML of the editable list element
      avgContainer.innerHTML = `
            <div class="ui four cards stackable">
                <div class="card">
                    <div class="content">
                        <div class="header">AVG CPU Load (Estimate)</div>
                        <div class="description">
                            <h5 id="avg-cpu-load">%</h5>
                            <p>Over all containers. (See disclaimer)</p>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="content">
                        <div class="header">MAX CPU Load</div>
                        <div class="description">
                            <h5 id="max-cpu-load">&nbsp;</h5>
                            <p>Over all containers</p>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="content">
                        <div class="header">Total Energy</div>
                        <div class="description">
                            <h5 id="total-energy">&nbsp;</h5>
                            <p>For whole CPU Package. NOT per container.</p>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="content">
                        <div class="header">Total CO2</div>
                        <div class="description">
                            <h5 id="total-co2">&nbsp;</h5>
                            <p>For whole CPU Package. NOT per container.</p>
                        </div>
                    </div>
                </div>
            </div>
      `;



      // binding methods
      this.displayData = this.displayData.bind(this);


      // appending the container to the shadow DOM
      shadowRoot.appendChild(avgContainer);
    }



    displayData(total_energy, cpu_load) {
        console.log("Obj is: ")
        console.log(obj)
        // TODO: Insert into
        document.querySelector("#max-cpu-load").innerText = (Math.max.apply(null, cpu_load) / 100) + " %"
        document.querySelector("#total-energy").innerText = (total_energy / 1000).toFixed(2) + " J"
        document.querySelector("#total-co2").innerText = (total_energy / 1000 / 3600000 * 0.519 * 1000000).toFixed(2) + " ugCO2eq"
        document.querySelector("#avg-cpu-load").innerText = ((cpu_load.reduce((a,b) => a + b, 0) / cpu_load.length) / 100).toFixed(2) + " %"

    }


}


customElements.define('avg-containers', AvgContainers);


