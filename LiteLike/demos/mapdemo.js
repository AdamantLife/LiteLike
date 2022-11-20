"use strict";

import {toggleAllButtons, clearDemoBox} from "./utils.js";
import * as EQUIP from "../scripts/items.js";
import * as ENCOUNTERS from "../scripts/encounters.js";

import * as MAP from "../scripts/map.js";
import * as KEYBINDINGS from "../scripts/keybindings.js";
import * as COMBATGUI from "../scripts/gui/combat.js";
import * as REWARDGUI from "../scripts/gui/reward.js";
import * as ENCOUNTERSGUI from "../scripts/gui/encounters.js"

var DEMOMAP = ".....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n..........!..........\n.....................\n..........C..........\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................";

export function mapDemo(){
    // Disable all buttons to avoid shenanigans
    toggleAllButtons(true);
    clearDemoBox();

    // Player needs to be initialized for traveling the Map
    GAME.PLAYER = GAME.startingCharacter();
    // Give Player more Repair Bots to work with
    GAME.PLAYER.equipment.items[0].quantity = 10;
    // Give Player Laser Pistol
    GAME.PLAYER.equipment.weapons.push(new EQUIP.Weapon(GAME.ITEMS.weapons[2]))
    // Give Player Batteries for Laser Pistol
    GAME.PLAYER.equipment.resources[1] = new EQUIP.Resource(GAME.ITEMS.resources[1], 5);


    // Initialize a new Map and set the Map maunally
    GAME.MAP = GAME.newMap()
    GAME.MAP.map = DEMOMAP.split("\n");


    // Setup the map area div and get a reference
    document.getElementById("demoBox").insertAdjacentHTML("beforeend",`<div id="mapDemo" style="position:relative;">
    <div id="events" class="popup hidden"></div>
    <div id="combat" class="popup hidden"></div>
    <div id="foodRepairBox"><div data-type="hp"><span style="font-weight:bold;">HP: </span><span data-value></span>/${GAME.PLAYER.statistics.hp}</div><div data-type="fuel"><span style="font-weight:bold;">Reactor Power: </span><span data-value></span></div><div data-type="repair"><span style="font-weight:bold;">Repair Bots: </span><span data-value></span></div></div><div id="mapBox" style="font-family:monospace;display:inline;letter-spacing:1em;"></div></div>`);

    // Popup box which shows all items collected
    let eventBox = document.getElementById("events");
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
     * Reloads the map onto the page
     */
    function reloadMap(){
        mapBox.innerHTML = GAME.MAP.getMap().join("<br>");
    }

    // Populate the map
    reloadMap();

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
        if(combatBox.classList.contains("shown")) return COMBATGUI.handleCombatKeyPress(event);
        // Event is displayed, so only handle input for Events
        if(eventBox.classList.contains("shown")) return handleEventKeyPress(key);

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
    }

    function handleEventKeyPress(key){
    }

    /**
     * When the player enters the colony or a port, we refill his
     * reactorPower and give him a reward screen with 5 repair bots
     * 
     */
    function collectFromCache(){
        // Top Of (max out) the transport's reactorPower
        GAME.PLAYER.equipment.transport.topOff();

        // Create reward
        let reward = ENCOUNTERS.parseReward(GAME, {type: "Item", id: 0, qty: 5});
        // Create message encounter
        let message = new ENCOUNTERS.MessageEncounter([reward,], {message: "You arrive at port and retrieve a cache of supplies your allies had left for you."})

        // Add the Encounter to the GAME
        let sequence = GAME.getOrAddEncounter(message);
        
        // If this is a new EncounterSequence, use cycle event to initialize it
        if (sequence.index == -1) cycleEvent();
    }

    /**
     * When the player enters the colony we unload all his resources
     */
    function visitColony(){
        // To be lazy, we're just going to overwrite resources
        // DEVNOTE: in actual gameplay, resources would be transferred
        // to The Colony, but that is outside the scope of this demo
        let callback = ()=> GAME.PLAYER.equipment.resources = {};
        
        // Build encounter
        let encounter = new ENCOUNTERS.CallbackEncounter([], {
            message: "Upon arrival in The Colony, the dockworkers unload the resources you've gathered",
            callback
    });
        // Add the Encounter to the GAME
        let sequence = GAME.getOrAddEncounter(encounter);
        
        // If this is a new EncounterSequence, use cycle event to initialize it
        if (sequence.index == -1) cycleEvent();
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

        // Show rewards
        REWARDGUI.loadRewardEvent(cleanupCombat)   ;
    }

    /**
     * Removes all evnet listeners for combat and hides the combat box
     */
    function cleanupCombat(){

        // Clear all listeners
        GAME.COMBAT.removeAllListeners();
        GAME.COMBAT.player.removeAllListeners();
        GAME.COMBAT.enemy.removeAllListeners();
        // Clear combat from Game
        GAME.COMBAT = null;

        // Hide combatBox and eventBox(rewards)
        combatBox.classList.remove("shown");
        combatBox.classList.add("hidden");

        // Cleanup the eventBox
        // This will also cycle the event
        cleanupEncounter();
    }

    /**
     * Updates travel resources, clears the eventbox and hides it
     */
    function cleanupEncounter(){
        // Make sure map is up-to-date
        updateTravelResources();

        // Clear out the eventBox
        let eventBox = ENCOUNTERSGUI.clearEvents();

        // Queue up the next event
        let result = cycleEvent();
        // If no more Encounters, hide eventBox
        if(!result){
            eventBox.classList.remove("shown");
            eventBox.classList.add("hidden");
        }

        
    }

    /**
     * Triggers a "fight" against a Brigand
     * @param {MapEvent} event - The enterunexplored Map event
     */
    function portEvent(event){
        // Get Combat event
        let message = new ENCOUNTERS.MessageEncounter([], {message: "While exploring a derelict port you are ambushed by a Space Brigand!"})
        let encounter = ENCOUNTERS.buildCombatEncounter(GAME, 0, [{type: "Resource", id: 2, qty: 10}]);
        // Initialize the encounter on the GAME
        // NOTE: There should be no other possible events that arise simultaneous
        //          to the enterunexplored event, so we are not calling GAME.getOrAddEncounter
        GAME.ENCOUNTER = new ENCOUNTERS.EncounterSequence([message, encounter]);
        // Initialize the encounter
        cycleEvent();
    }

    /**
     * Initializes the next Encounter from GAME.ENCOUNTER
     */
    function cycleEvent(){
        // Get the next Encounter from the Game's current EncounterSequence
        let event = GAME.ENCOUNTER.increment();
        // No more encounters, so clear the Sequence and exit
        if(!event || typeof event == "undefined"){
            GAME.ENCOUNTER = null;
            // Return false so whatever called this knows
            // that we are not loading another event
            return false;
        }

        // Initialize the Encounter
        let result = event.initEncounter();

        // Load the appropriate gui with callback
        switch(event.type){
            case ENCOUNTERS.encountertype.COMBAT:
                // Use loadCombat to display it on the screen
                COMBATGUI.loadCombat(result, finishCombat);
                // Since combat is being loaded, we do not need
                // the event box, so let the caller know
                return false;

            case ENCOUNTERS.encountertype.MESSAGE:
                // Use loadMessage to display it on the screen
                ENCOUNTERSGUI.loadMessage(result, (event)=>{
                    // Don't show rewards if event doesn't have them
                    if(!event.reward.length) return cleanupEncounter();
                    // Otherwise, load the Reward
                    REWARDGUI.loadRewardEvent(cleanupEncounter)
                });
                break;
            case ENCOUNTERS.encountertype.CALLBACK:
                // Use loadCallback to display it on the screen
                ENCOUNTERSGUI.loadCallback(result, (event)=>{
                    // Don't show rewards if event doesn't have them
                    if(!event.reward.length) return cleanupEncounter();
                    // Otherwise, load the Reward
                    REWARDGUI.loadRewardEvent(cleanupEncounter)
                });
                break;
        }
        // The next event is happening inside the eventBox, so return True
        return true;
    }

    // Register callbacks
    document.addEventListener("keyup", handleKeyPress);
    GAME.MAP.addEventListener("move", reloadMap);

    GAME.PLAYER.addEventListener("itemschange", updateTravelResources);
    GAME.PLAYER.addEventListener("equipmentchange", updateTravelResources);

    // The player dumps all his collected resources at The Colony
    GAME.MAP.addEventListener("entercolony", visitColony);
    // At ports and The Colony the player's fuel is topped off and he can collect repair bots
    GAME.MAP.addEventListener("entercolony", collectFromCache);
    GAME.MAP.addEventListener("enterport", collectFromCache);

    // Unexplored ports spawn a Combat Event
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