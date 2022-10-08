"use strict";

import {toggleAllButtons, clearDemoBox} from "./utils.js";
import * as IO from "../scripts/io.js";
import * as UTILS from "../scripts/utils.js";
import * as MAP from "../scripts/map.js";

var DEMOMAP = ".....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n..........C..........\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................";

export function mapDemo(){
    // Disable all buttons to avoid shenanigans
    toggleAllButtons(true);
    clearDemoBox();

    // Player needs to be initialized for traveling the Map
    GAME.PLAYER = GAME.startingCharacter();

    // Initialize a new Map and set the Map maunally
    GAME.MAP = GAME.newMap()
    GAME.MAP.map = DEMOMAP.split("\n");


    // Setup the map area div and get a reference
    document.getElementById("demoBox").insertAdjacentHTML("beforeend",`<div id="mapBox" style="font-family:Courier New;"></div>`);
    let mapBox = document.getElementById("mapBox");

    /**
     * Reloads the map onto the page
     */
    function reloadMap(){
        mapBox.innerHTML = GAME.MAP.getMap().join("<br>");
    }

    // Populate the map
    reloadMap();

    // Add the Quit button
    document.getElementById("demoBox").insertAdjacentHTML("beforeend","<button id=quitMap>Quit Demo</button>");
    // Attach the finishDemo callback
    document.getElementById("quitMap").onclick = finishDemo;

    function finishDemo(){
        // Re-enable all buttons
        toggleAllButtons(false);
    }
}