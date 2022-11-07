"use strict";

import {toggleAllButtons, clearDemoBox} from "./utils.js";
import * as CHARA from "../scripts/character.js";
import * as IO from "../scripts/io.js";
import * as EVENTS from "../scripts/events.js";
import * as UTILS from "../scripts/utils.js";
import * as MAP from "../scripts/map.js";
import * as KEYBINDINGS from "../scripts/keybindings.js";

var DEMOMAP = ".....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n..........!..........\n.....................\n..........C..........\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................";

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
    <div id="combat" class="popup hidden"></div>
    <div id="foodRepairBox"><div data-type="hp"><span style="font-weight:bold;">HP: </span><span data-value></span>/${GAME.PLAYER.statistics.hp}</div><div data-type="fuel"><span style="font-weight:bold;">Reactor Power: </span><span data-value></span></div><div data-type="repair"><span style="font-weight:bold;">Repair Bots: </span><span data-value></span></div></div><div id="mapBox" style="font-family:monospace;display:inline;letter-spacing:1em;"></div></div>`);

    // Popup box which shows all items collected
    let inventoryBox = document.getElementById("inventoryBox");
    // Combat box which will show up on Combat Events
    let combatBox = document.getElementById("combat");
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
            message = `Game Over: You have run out of ${message}!`;
            gameOver(message);
            return false;
        }
    }

    updateTravelResources();

    /**
     * Initializes the combatBox for the given combat
     * If combatBox needs to be displayed/unhidden, that should be done separately
     * @param {Combat} combat - the combat being initialized
     */
    function initializeCombatBox(combat){

        function buildStatBlock(chara){
            let charaString = IO.getStrings(GAME.STRINGS, chara);
            return `
<div class="character" data-combatant="${chara.roles.indexOf(CHARA.roles.PLAYER) >= 0 ? "player" : "enemy"}">
    <h1 title="${charaString.flavor}">${charaString.name}</h1>
    <table class="boldfirst"><tbody>
    <tr><td>HP</td><td><span data-hp>${chara.statistics.currentHP}</span>/${chara.statistics.hp}</td></tr>
    </tbody></table>
    <h3>Weapons</h3>
    <table data-loadout="weapons"><tbody>
    <tr><td data-slot0></td><td></td><td data-slot1></td></tr>
    <tr><td></td><td data-slot2></td><td></td></tr>
    <tr><td data-slot3></td><td></td><td data-slot4></td></tr>
    </tbody></table>
    <h3>Items</h3>
    <table data-loadout="items"><tbody>
    <tr><td data-slot0></td><td data-slot1></td><td data-slot2></td></tr>
    </table></tbody>
</div>`
        }

        // Clear combatBox
        while(combatBox.lastElementChild) combatBox.removeChild(combatBox.lastElementChild);
        // Insert Player Character
        combatBox.insertAdjacentHTML('beforeend', buildStatBlock(combat.player));
        // Insert Enemy Character
        combatBox.insertAdjacentHTML('beforeend', buildStatBlock(combat.enemy));

        let weaponstable = combatBox.querySelector(`div[data-combatant="player"] table[data-loadout="weapons"]`);
        for(let i = 0; i < CHARA.CHARAWEAPONLOADOUT; i++){
            let weapon = combat.player.weapons[i];
            // No weapon at loadout slot
            if(!weapon || typeof weapon == "undefined") continue;
            let weaponstring = IO.getStrings(GAME.STRINGS, weapon);
            weaponstable.querySelector(`td[data-slot${i}]`).insertAdjacentHTML('beforeend',`<button title="${weaponstring.flavor}">${weaponstring.name}</button>`);
        }
        let itemstable = combatBox.querySelector(`div[data-combatant="player"] table[data-loadout="items"]`);
        for(let i = 0; i < CHARA.CHARAITEMLOADOUT; i++){
            let item = combat.player.items[i];
            // No Items at loadout slot
            if(!item || typeof item == "undefined") continue;
            let itemstring = IO.getStrings(GAME.STRINGS, item);
            itemstable.querySelector(`td[data-slot${i}]`).insertAdjacentHTML('beforeend', `<button title="${itemstring.flavor}">${itemstring.name}</button>`);
        }
    }

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
    document.getElementById("demoBox").insertAdjacentHTML("beforeend",`<button id="quitMap", style="position:sticky;bottom:5px;">Quit Demo</button>`);
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
        // Combat is displayed, so only handle input for combat
        if(combatBox.classList.contains("shown")) return handleCombatKeyPress(key);
        // Inventory is displayed, so only handle input for Inventory
        if(inventoryBox.classList.contains("shown")) return handleInventoryKeyPress(key);

        console.log('moving')
        // Otherwise, we're on the map view, so handle map-only inputs
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
    function handleCombatKeyPress(key){
        
    }

    function handleInventoryKeyPress(key){
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
        // Give the Player +3 Repair Bots
        GAME.PLAYER.equipment.items[0].quantity+=3;
    }

    /**
     * Assigns a combat object to GAME and begins the screen transition
     * to the Combat Popup
     * @param {Combat} combat - The Combat object to load
     */
    function loadCombat(combat){
        // Register combat with GAME
        GAME.COMBAT = combat
        // Setup the Combat div
        initializeCombatBox(combat);

        // Add listeners
        GAME.COMBAT.addEventListener("endcombat", finishCombat);
        GAME.COMBAT.player.addEventListener("currentHPchange", combatUpdateHP);
        GAME.COMBAT.enemy.addEventListener("currentHPchange", combatUpdateHP);

        // Remove Hidden class
        combatBox.classList.remove("hidden");
        // Listen for the next animation to end
        combatBox.addEventListener("animationend", startCombat);
        // Add Shown class which will begin animating
        combatBox.classList.add("shown");
    }

    /**
     * Updates the displayed HP in response to HP change events
     * @param {Evenet} event - Character.currentHPchange event
     */
    function combatUpdateHP(event){
        // Figure out which character was hit
        let chara = event.character == GAME.COMBAT.player ? "player": "enemy";
        // Get box
        let box = combatBox.querySelector(`div[data-combatant="${chara}"]`);
        // Update hp
        box.querySelector("span[data-hp]").textContent = event.currentHP;
    }

    /**
     * Callback for the .popup.shown animation: removes the listener and starts the combatloop
     * @param {Event} event - The animationend event
     */
    function startCombat(event){
        // Stop listening for animations on Combat
        combatBox.removeEventListener("animationend", startCombat);
        // Start Combatloop
        GAME.COMBAT.combatLoop();
    }

    /**
     * Concludes combat and restores the UI to the Map view
     */
         function finishCombat(){
            // Player lost
            if(GAME.COMBAT.victor != GAME.COMBAT.player){
                // Just call gameOver
                return gameOver("Game Over! You were slain in combat!")
            }
            combatBox.classList.remove("shown");
            combatBox.classList.add("hidden");
        }

    /**
     * Triggers a "fight" against a Brigand
     */
    function portEvent(){
        // Get Combat event
        let event = EVENTS.buildCombatEncounter(GAME, 0, [{type: "resource", id: 2, qty: 10}]);
        // Initialize it
        let combat = event.initEncounter();
        // Use laodCombat to display it on the screen
        loadCombat(combat);
    }

    // Register callbacks
    document.addEventListener("keyup", handleKeyPress);
    GAME.MAP.addEventListener("move", reloadMap);

    GAME.PLAYER.addEventListener("itemschange", updateTravelResources);
    GAME.PLAYER.addEventListener("equipmentchange", updateTravelResources);
    GAME.MAP.addEventListener("entercolony", reloadResources);
    GAME.MAP.addEventListener("enterport", reloadResources);
    GAME.MAP.addEventListener("enterunexplored", portEvent);

    function gameOver(message){
        window.alert(message);
        finishDemo();
    }

    function finishDemo(){
        // Re-enable all buttons
        toggleAllButtons(false);

        // Disable interface
        document.getElementById("quitMap").disabled = true;
        document.removeEventListener("keyup", handleKeyPress);      
        document.querySelectorAll("#combat button").forEach(button=>button.disabled=true);

        // Remove listeners for Player
        GAME.PLAYER.removeAllListeners();
        // Cleanup Combat if it's there
        if(GAME.COMBAT){
            // Remove listeners
            GAME.COMBAT.removeAllListeners();
            GAME.COMBAT.player.removeAllListeners();
            GAME.COMBAT.enemy.removeAllListeners();
            // Set victor to make sure that combatloop ends
            GAME.COMBAT.victor = GAME.COMBAT.enemy;
        }
        // Make sure GAME.COMBAT is cleared
        GAME.COMBAT = null;
    }

    // Enable Map Movement
    GAME.MAP.mapLock = false;
    // Start Map moveLoop
    GAME.MAP.moveLoop();
}