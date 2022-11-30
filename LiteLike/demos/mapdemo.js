"use strict";

import {toggleAllButtons, clearDemoBox} from "./utils.js";
import * as EQUIP from "../scripts/items.js";
import * as ENCOUNTERS from "../scripts/encounters.js";

import * as MAP from "../scripts/map.js";
import * as KEYBINDINGS from "../scripts/keybindings.js";
import * as COMBATGUI from "../scripts/gui/combat.js";
import * as ENCOUNTERSGUI from "../scripts/gui/encounters.js"
import * as MAPENCOUNTERS from "./mapdemoencounters.js";

var DEMOMAP = ".....................\n.....................\n.....................\n.....................\n.....................\n.....................\n......$..............\n.....................\n..........!..........\n.....................\n..........C..........\n.....................\n................&....\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................";

export function mapDemo(){
    // Disable all buttons to avoid shenanigans
    toggleAllButtons(true);
    clearDemoBox();

    // Keeps a record of ports cleared
    let PORTSVISITED = [];

    // Player needs to be initialized for traveling the Map
    GAME.PLAYER = GAME.startingCharacter();
    // Give Player more Repair Bots to work with
    GAME.PLAYER.equipment.items[0].quantity = 10;
    // Give Player Laser Pistol
    GAME.PLAYER.equipment.weapons.push(new EQUIP.Weapon(GAME.ITEMS.weapons[2]))
    // Give Player Batteries for Laser Pistol
    GAME.PLAYER.equipment.resources[1] = new EQUIP.Resource(GAME.ITEMS.resources[1], 5);


    // Initialize a new Map and set the Map maunally
    // Null will produce a random seed
    // true will generate a new Fog of War Mask
    GAME.MAP = GAME.newMap(null, true);
    // Update the map's fog-of-war for the Player's vision 
    GAME.MAP.setVision(GAME.MAP.mask, GAME.MAP.playerLocation, GAME.PLAYER.statistics.vision);
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
        let replacements = [];
        // Replace each location (visited port) with an empty cell (".")
        for(let location of PORTSVISITED) replacements.push([location, "."]);
        // We have to wrap the text in Pre in order to preserve the whitespace
        mapBox.innerHTML = `<pre>${GAME.MAP.getMap({replacements}).join("<br>")}</pre>`;
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
     * @param {MapEvent} event - Either the enterport/colony Map Event
     */
    function collectFromCache(event){
        let cacheSequence = MAPENCOUNTERS.visitPort();

        // Add the MessageEncounter to the GAME
        // If this creates a new EncounterSequence, our listener below will
        // recieve that event and automatically cycle to initalize the Encounter
        GAME.getOrAddEncounter(cacheSequence);
    }

    /**
     * The player can only collect a resource cache from each Port once:
     * when he does we make a note of it here
     * @param {*} event 
     */
    function clearPort(event){
        // Record that the port has been visited
        // We are using destination because this is the *enter* event
        PORTSVISITED.push(event.destination);
    }

    /**
     * When the player enters the colony we unload all his resources
     */
    function visitColony(){
        let encounter = MAPENCOUNTERS.visitColony();
        // Add the Encounter to the GAME
        // If this creates a new EncounterSequence, our listener below will
        // recieve that event and automatically cycle to initalize the Encounter
        GAME.getOrAddEncounter(encounter);
    }

    /**
     * Triggers a "fight" against a Brigand
     * @param {MapEvent} event - The enterunexplored Map event
     */
    function portEvent(event){
        // Get Combat EncounterSequence
        let encounterSequence = MAPENCOUNTERS.getBanditEncounter();

        // Initialize the encounter on the GAME
        // This will trigger the encountersequenceadded event which we listen for below
        // When we get the event we'll automatically cycleEncounter to move to load the
        // first Encounter in the Sequence

        // NOTE: There should be no other possible events that arise simultaneous
        //          to the enterunexplored event, so we are not calling GAME.getOrAddEncounter
        GAME.setEncounter(encounterSequence);
    }

    /**
     * Triggers an EncounterSequence for the Dungeon or Station
     * Dungeons and Stations are both constructed the same way, they just have different
     * pools of encounters to choose from.
     * 
     * DEVNOTE- For the demo, we're going to use the same design pattern as the
     *          complete game for building a dungeon, but it will not be randomly generated
     * @param {MapEvent} event - The enterdungeon Map event
     */
    function dungeonStationEvent(event){
        // Keep reference to how many Non-Reward Encounters we've engaged in
        let floor = 0;
        // This is the max number of floors we'll do for this dungeon/Station
        // In the full game this will be set based on distance from The Colony
        // or by Map Completion (longer dungeons later in the game)
        let maxFloor = 5;

        // Recording the eventtype here so we don't have to dig for it each time
        let eventtype = event.eventtype == MAP.Map.EVENTTYPES.enterstation ? "station" : "dungeon";

        let builder;
        // Delegate to the individual floor builders
        if (eventtype == "station"){
            builder = MAPENCOUNTERS.buildStation;
        }
        // eventtype == "dungeon"
        else {
            builder = MAPENCOUNTERS.buildDungeon;
        }

        // Start an new DynamicSequence
        // Use the default of 5 maxFloor (undefined)
        GAME.ENCOUNTER = new ENCOUNTERS.DynamicSequence(GAME, undefined, builder)

        // Build the first Segement
        // buildNextSegment will recurse after this point
        GAME.ENCOUNTER.buildNextSegment();
    }

    /**
     * On PLAYER.currentHPchange and GAME.encounterend, check if player is ko'd and end demo if it is
     */
    function checkKO(event){
        // It doesn't matter what event it is, we're just checking if the player is ko'd
        if(GAME.PLAYER.isKOd()) gameOver("Game Over! You have run out of HP!");
    }

    // Register callbacks
    document.addEventListener("keyup", handleKeyPress);
    GAME.MAP.addEventListener("move", reloadMap);

    /** Updates the UI to show changes at the top of the Screen */
    // Potential change to RepairBots (Player.items[0])
    GAME.PLAYER.addEventListener("itemschange", updateTravelResources);
    // Potential change to Transport.ReactorPower
    GAME.PLAYER.addEventListener("equipmentchange", updateTravelResources);
    // A change to the Player's HP
    GAME.PLAYER.addEventListener("currentHPchange", updateTravelResources);
    // The map has changed (i.e.- A location has been cleared)
    // DEVNOTE- If a location is cleared because the Player cleared it,
    //      this won't do anything because the Player's Symbol will be
    //      obscuring the location
    GAME.MAP.addEventListener("mapchange", reloadMap);
    
    /** GUI<->Event Management Listeners */
    // A new EncounterSequence has been added, we will automatically load the first encounter in it
    GAME.addEventListener("encountersequenceadded", (event)=> GAME.cycleEncounter());
    /**  The current Encounter in the Game's current EncounterSequence has changed */
    // We automatically initialize all encounters when they are started
    GAME.addEventListener("encounterstart", (event)=>event.encounter.initialize());
    // Once the encounter is done being initialized, we can load it into the GUI
    GAME.addEventListener("encounterinitialized", (event)=>ENCOUNTERSGUI.updateSequenceGUI(event.encounter));
    // Need to update the UI when there is no Encounter to display
    GAME.addEventListener("encountersequenceremoved", (event)=>ENCOUNTERSGUI.updateSequenceGUI(null));
    // Some sequences automatically call cycleEncounter which defaults to autoRemove=false
    // In these cases, noencounter is raised. There is nothing in the demo that would use this functionality
    // so we're just going to manually clear the encounter
    GAME.addEventListener("noencounter", (event)=>GAME.clearEncounter());

    /** Specific Map Events */
    // The player dumps all his collected resources at The Colony
    GAME.MAP.addEventListener("entercolony", visitColony);
    // At ports and The Colony the player's fuel is topped off and he can collect repair bots
    GAME.MAP.addEventListener("entercolony", collectFromCache);
    GAME.MAP.addEventListener("enterport", collectFromCache);
    // After the player has collected from the Cache, clear the port so it can't be revisited
    GAME.MAP.addEventListener("enterport", clearPort);
    // UnexploredPorts convert to ports when they are exited
    // NOTE- Currently the only way to exit an unexplored port is to defeat the enemy which should
    //  also be the prerequisite for converting it; if it's possible to flee combat in the future,
    //  then this should be removed and another method should be used
    GAME.MAP.addEventListener("leaveunexplored", (event)=>GAME.MAP.clearStructureAtLocation());

    // Unexplored ports spawn a Combat Event
    GAME.MAP.addEventListener("enterunexplored", portEvent);

    // Entering a "Dungeon"
    GAME.MAP.addEventListener("enterdungeon", dungeonStationEvent);
    // Entering a Station
    GAME.MAP.addEventListener("enterstation", dungeonStationEvent);

    /** Others */
    // Checks for Player KO
    GAME.PLAYER.addEventListener("currentHPchange", checkKO);
    // In combat, the Player uses a CombatCharacter class to represent itself
    // and therefore changes to its HP are not reflected, so we need to check
    // if he died after each encounter ends
    GAME.addEventListener("encounterend", checkKO);

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

        // Remove all listeners for Game
        GAME.removeAllListeners();
        // Remove listeners for Player
        GAME.PLAYER.removeAllListeners();
        // Cleanup Combat if it's there
        let encounter = GAME.ENCOUNTER ? GAME.ENCOUNTER.get() : null;
        // encounter.instance will be null if the Encounter has not been initialized
        if(encounter && encounter.instance && encounter.constructor.name == "CombatEncounter"){
            let combat = encounter.instance;
            // Remove listeners
            combat.removeAllListeners();
            combat.player.removeAllListeners();
            combat.enemy.removeAllListeners();
            // Set victor to make sure that combatloop ends
            combat.victor = combat.enemy;
        }
    }

    // Enable Map Movement
    GAME.MAP.mapLock = false;
    // Start Map moveLoop
    GAME.MAP.moveLoop();
}