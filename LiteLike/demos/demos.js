"use strict";

import { combatDemo } from "./combatdemo.js";
import { colonyDemo} from "./colonydemo.js";
import { mapDemo } from "./mapdemo.js";

var DEMOBUTTONS = {
    "startCombat": {text:"Start Combat Demo", target: combatDemo},
    "startMeeple": {text:"Start Meeple Demo", target: colonyDemo},
    "startMap": {text: "Start Map Demo", target: mapDemo}
    };

let menu = document.getElementById("menu");
for(let [id,info] of Object.entries(DEMOBUTTONS)){
    menu.insertAdjacentHTML('beforeend',`<button id="${id}"">${info.text}</button>`);
    document.getElementById(id).onclick = info.target;
}

menu.insertAdjacentHTML("afterend", `<div id="demoBox"></div>`);