"use strict";

import {toggleAllButtons, clearDemoBox} from "./utils.js";
import * as IO from "../scripts/io.js";
import * as UTILS from "../scripts/utils.js";
import * as MAP from "../scripts/map.js";
import * as KEYBINDINGS from "../scripts/keybindings.js";

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
    document.getElementById("demoBox").insertAdjacentHTML("beforeend",`<div id="mapDemo" style="position:relative;"><div id="inventoryBox" style="position:absolute; display:none;"></div><div id="mapBox" style="font-family:monospace;display:inline;letter-spacing:1em;"></div></div>`);
    let mapBox = document.getElementById("mapBox");
    let inventoryBox = document.getElementById("inventoryBox");

    /**
     * Reloads the map onto the page
     */
    function reloadMap(){
        mapBox.innerHTML = GAME.MAP.getMap().join("<br>");
    }

    // Populate the map
    reloadMap();

    function updateInventory(){
        
    }

    // Add the Quit button
    document.getElementById("demoBox").insertAdjacentHTML("beforeend","<button id=quitMap>Quit Demo</button>");
    // Attach the finishDemo callback
    document.getElementById("quitMap").onclick = finishDemo;

    function handleKeyPress(event){
        // Get String-Name of the key
        let key = event.key;
        // If the key is in KB.KEYDIRECTIONS 
        if(typeof KEYBINDINGS.KEYDIRECTIONS[key] !== "undefined"){
            // Get Direction Symbol from KB.KD
            let direction = KEYBINDINGS.KEYDIRECTIONS[key];
            // Sanity check: direction should never actually be falsy
            //Convert to MapAction and add to playerQueue
            if(direction) GAME.MAP.playerQueue.push(new MAP.MapAction(MAP.mapactions.MOVE, direction));
            return;
        }
        // If the key is in KB.INVENTORY
        if(typeof KEYBINDINGS.INVENTORY[key] !== "undefined"){
            // Toggle the inventory box
            if(inventoryBox.style.display === "none"){
                // Show box if it's not displayed
                inventoryBox.style.display = "block";
                updateInventory();
            }
            else{
                // Hide box if it is displayed
                inventoryBox.style.display = "none";
            }
        }


    }
    // Register callbacks
    document.addEventListener("keyup", handleKeyPress);
    GAME.MAP.addEventListener("move", reloadMap);

    function finishDemo(){
        // Re-enable all buttons
        toggleAllButtons(false);
        document.getElementById("quitMap").disabled = true;
    }

    // Enable Map Movement
    GAME.MAP.mapLock = false;
    // Start Map moveLoop
    GAME.MAP.moveLoop();
}