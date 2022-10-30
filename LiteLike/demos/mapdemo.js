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
    // Give Player more Repair Bots to work with
    GAME.PLAYER.equipment.items[0].quantity = 10;

    // Initialize a new Map and set the Map maunally
    GAME.MAP = GAME.newMap()
    GAME.MAP.map = DEMOMAP.split("\n");


    // Setup the map area div and get a reference
    document.getElementById("demoBox").insertAdjacentHTML("beforeend",`<div id="mapDemo" style="position:relative;"><div id="inventoryBox" style="position:absolute; display:none;"></div>
    <div id="foodRepairBox"><div data-type="hp"><span style="font-weight:bold;">HP: </span><span data-value></span>/${GAME.PLAYER.statistics.hp}</div><div data-type="fuel"><span style="font-weight:bold;">Reactor Power: </span><span data-value></span></div><div data-type="repair"><span style="font-weight:bold;">Repair Bots: </span><span data-value></span></div></div><div id="mapBox" style="font-family:monospace;display:inline;letter-spacing:1em;"></div></div>`);
    // Popup box which shows all items collected
    let inventoryBox = document.getElementById("inventoryBox");
    // Display travel resources (food and repairbots)
    let foodRepairBox = document.getElementById("foodRepairBox");
    // Displays the Map
    let mapBox = document.getElementById("mapBox");
    
    /**
     * Updates the travel resources after they have changed
     */
    function updateTravelResources(){
        // Player is out of Repair Bots
        // We're checking this before we update currentHP
        if(GAME.PLAYER.equipment.items[0].quantity < 0){
            // Player takes damage
            GAME.PLAYER.statistics.currentHP -= 1;
        }
        foodRepairBox.querySelector(`div[data-type="hp"]>span[data-value]`).textContent = GAME.PLAYER.statistics.currentHP;
        // Get the fuel div, and find its span child with data-value
        // Set the text for that span to the current reactorPower of the Player's transport
        foodRepairBox.querySelector(`div[data-type="fuel"]>span[data-value]`).textContent = GAME.PLAYER.equipment.transport.reactorPower;
        // Same pattern as above, but setting Player's RepairBot value
        foodRepairBox.querySelector(`div[data-type="repair"]>span[data-value]`).textContent = Math.ceil(GAME.PLAYER.equipment.items[0].quantity);
        
        // Game Over states: Player out of HP or Transport out of reactorPower
        if(GAME.PLAYER.statistics.currentHP <= 0 || GAME.PLAYER.equipment.transport.reactorPower <= 0){
            let message = [];
            if(GAME.PLAYER.statistics.currentHP <= 0) message.push("HP");
            if(GAME.PLAYER.equipment.transport.reactorPower <= 0) message.push("Reactor Power");
            message = message.join(" and ");
            window.alert(`Game Over: You have run out of ${message}!`);
            finishDemo();
            return false;
        }
    }

    updateTravelResources();

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

    /**
     * Handles keyboard input
     * @param {KeyboardEvent} event - The keyboard event
     * @returns null
     */
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

    /**
     * When the player enters the colony or a port, we refill his
     * reactorPower and give him +5 repairBots.
     * 
     * We do not heal him.
     */
    function reloadResources(){
        // Top Of (max out) the transport's reactorPower
        GAME.PLAYER.equipment.transport.topOff();
        // Give the Player +5 Repair Bots
        GAME.PLAYER.equipment.items[0].quantity+=5;
    }

    // Register callbacks
    document.addEventListener("keyup", handleKeyPress);
    GAME.MAP.addEventListener("move", reloadMap);
    GAME.PLAYER.addEventListener("itemschange", updateTravelResources);
    GAME.PLAYER.addEventListener("equipmentchange", updateTravelResources);
    GAME.MAP.addEventListener("entercolony", reloadResources);
    GAME.MAP.addEventListener("enterport", reloadResources);

    function finishDemo(){
        // Re-enable all buttons
        toggleAllButtons(false);

        // Disable interface
        document.getElementById("quitMap").disabled = true;
        document.removeEventListener("keyup", handleKeyPress);

        GAME.PLAYER.removeAllListeners();
    }

    // Enable Map Movement
    GAME.MAP.mapLock = false;
    // Start Map moveLoop
    GAME.MAP.moveLoop();
}