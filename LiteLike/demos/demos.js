"use strict";

import { combatDemo } from "./combatdemo.js";
import { colonyDemo} from "./colonydemo.js";
import { mapDemo } from "./mapdemo.js";


var DEMOBUTTONS = {
    "startCombat": {text:"Start Combat Demo", target: combatDemo},
    "startColony": {text:"Start Colony Demo", target: colonyDemo},
    "startMap": {text: "Start Map Demo", target: mapDemo}
    };

export function setupDemos(game){
    let menu = game.UI.menu;
    menu.insertAdjacentHTML(`beforeend`,`<div id="demos" class="menu" style="display:none;"></div>`)

    let mainmenu = document.getElementById("mainmenu");
    mainmenu.insertAdjacentHTML(`beforeend`, `<button id="demobutton">Demos</button>`);
    document.getElementById("demobutton").onclick = ()=>game.UI.traverseMainMenu("demos");

    let demos = document.getElementById("demos");

    for(let [id,info] of Object.entries(DEMOBUTTONS)){
        demos.insertAdjacentHTML('beforeend',`<button id="${id}"">${info.text}</button>`);
        document.getElementById(id).onclick = info.target;
    }

    demos.insertAdjacentHTML(`beforeend`, `<button class="back">Main Menu</button>`);
    demos.querySelector("button.back").onclick = ()=>game.UI.traverseMainMenu("mainmenu");
}