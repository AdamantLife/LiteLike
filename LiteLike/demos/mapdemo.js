"use strict";

import {toggleAllButtons, clearDemoBox} from "./utils.js";
import * as EQUIP from "../scripts/items.js";
import * as ENCOUNTERS from "../scripts/encounters.js";

import * as MAP from "../scripts/map.js";
import * as KEYBINDINGS from "../scripts/keybindings.js";
import * as COMBATGUI from "../scripts/gui/combat.js";
import * as REWARDSGUI from "../scripts/gui/reward.js";
import * as ENCOUNTERSGUI from "../scripts/gui/encounters.js"

var DEMOMAP = ".....................\n.....................\n.....................\n.....................\n.....................\n.....................\n....$................\n.....................\n..........!..........\n.....................\n..........C..........\n.....................\n................&....\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................\n.....................";

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
        let callback = ()=>GAME.PLAYER.equipment.transport.topOff();

        // Create message encounter
        let message = new ENCOUNTERS.CallbackEncounter({message: "You arrive at port and retrieve a cache of supplies your allies had left for you.", callback})
        // Create reward encounter
        let reward = new ENCOUNTERS.RewardEncounter({rewards:[{type: "Item", id: 0, qty: 5}]});

        // Add the MessageEncounter to the GAME, getting back the current sequence
        let sequence = GAME.getOrAddEncounter(message);
        // add the reward to the sequence since we have it now
        sequence.addEncounter(reward);
        
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
        function dropResources(){
            // Establish which resource the player needs to use his weapons
            let keep = [];
            // Iterate over the weapons
            for(let weapon of GAME.PLAYER.weapons){
                // If it needs ammunition, note the ammunition
                if(weapon.weapontype.requiresAmmunition) keep.push(weapon.weapontype.ammunition);
            }

            // Iterate over the Player's resources
            for(let key of Object.keys(GAME.PLAYER.resources)){
                // If resourceID in keep, do nothing
                if(keep.indexOf(parseInt(key)) >= 0) continue;
                // Otherwise, remove the resouce
                delete GAME.PLAYER.resources[key];
            }
        };
        
        // Build encounter
        let encounter = new ENCOUNTERS.CallbackEncounter({
            message: "Upon arrival in The Colony, the dockworkers unload the resources you've gathered",
            callback: dropResources
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

        // Cycle to next event
        cycleEvent(ENCOUNTERS.encountertype.COMBAT)
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

        // Hide combatBox
        combatBox.classList.remove("shown");
        combatBox.classList.add("hidden");
    }

    /**
     * Updates travel resources, clears the eventbox and hides it
     */
    function cleanupEncounter(){
        // Make sure map is up-to-date
        updateTravelResources();

        // Clear out the eventBox
        let eventBox = ENCOUNTERSGUI.clearEvents();

        eventBox.classList.remove("shown");
        eventBox.classList.add("hidden");        
    }

    /**
     * Triggers a "fight" against a Brigand
     * @param {MapEvent} event - The enterunexplored Map event
     */
    function portEvent(event){
        // Get Combat EncounterSequence
        let encounterSequence = ENCOUNTERS.buildCombatEncounter(GAME, 0, [{type: "Resource", id: 2, qty: 10}], cycleEvent, {message: "While exploring a derelict port you are ambushed by a Space Brigand!", combatexit: finishCombat});
        // Initialize the encounter on the GAME
        // NOTE: There should be no other possible events that arise simultaneous
        //          to the enterunexplored event, so we are not calling GAME.getOrAddEncounter
        GAME.ENCOUNTER = encounterSequence

        // Initialize the Sequence
        cycleEvent();
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

        /**
         * The callback for each each encounter (instead of cycleEvent)
         * It generates a new Encounter and adds it to the EncounterSequence
         */
        function buildNextSegment(sequence){
            // We generate the dungeon based on the current floor
            // I think it's best to increment the difficulty every couple of floors
            let tier = floor % 2;

            let encounter
            // Floor 0 is always an introductory message
            if(floor == 0){
                let message;
                // NOTE: To reiterate the above DEVNOTE- all of these encounters would
                //          normally be randomly generated
                if(event.eventtype == MAP.Map.EVENTTYPES.enterstation){
                    message = "You happen upon a station and dock with it to see how its inhabitants are fairing.";
                }else{ // Map.enterdungeon
                    message = "You come across a planet.\nyour sensor indicate it possesses valuable resources so you decide to investigate.";
                }
                encounter= new ENCOUNTERS.MessageEncounter({message, onexit: ()=>buildNextSegment(sequence)})
            }

            // Add the new encounter
            sequence.addEncounter(encounter);
            // Increment the Sequence's index
            sequence.increment();
            // Update the GUI to load the encounter
            updateSequenceGUI();
        }

        // Start a new Seqeunce
        GAME.ENCOUNTER = new ENCOUNTERS.EncounterSequence();
        // Build the first Segement
        // buildNextSegment will recurse after this point
        buildNextSegment(GAME.ENCOUNTER);
    }

    /**
     * Initializes the next Encounter from GAME.ENCOUNTER (delegates to updateSequenceGUI)
     * NOTE: In most cases all we want to do between Encounters is increment the Sequence, but
     *          for the exceptions we updateSequenceGUI to be separate from Sequence.increment()
     */
    function cycleEvent(){
        // Increment the EncounterSequence
        GAME.ENCOUNTER.increment();
        // And then load the next encounter
        updateSequenceGUI();
    }

    /**
     * Populates the GUI for the current Encounter and removes unneeded Elements
     */
    function updateSequenceGUI(){
        // Establish any popups are currently visible so we know how to handle them
        let currentPopups = {
            combat: document.getElementById("combat").classList.contains("shown"),
            event: document.getElementById("events").classList.contains("shown")
        }
        
        // Get the current Encounter
        let event = GAME.ENCOUNTER.get();
        // No more encounters
        if(!event || typeof event == "undefined"){
            // clear the Sequence on GAME
            GAME.ENCOUNTER = null;
            
            // Combat is currently being show, so hide it
            if(currentPopups.combat) cleanupCombat();
            // A non-Combat encounter is bing shown, so hide it
            if(currentPopups.event) cleanupEncounter();
            // Exit
            return;
        }

        // Initialize the Encounter
        let result = event.initEncounter(GAME);

        let gui;
        // Load the appropriate gui with callback
        switch(event.type){
            case ENCOUNTERS.encountertype.COMBAT:
                gui = new COMBATGUI.CombatGui(result);
                gui.loadCombat();
                // If we have a non-combat popup, clear it
                if(currentPopups.event) cleanupEncounter();
                // We're returning here so we can auto-hide the Combat Popup
                // if it is up for all other encounter types
                return;

            case ENCOUNTERS.encountertype.MESSAGE:
                // Use loadMessage to display it on the screen
                ENCOUNTERSGUI.loadMessage(result);
                break;
            case ENCOUNTERS.encountertype.CALLBACK:
                // Use loadCallback to display it on the screen
                ENCOUNTERSGUI.loadCallback(result);
                break;
            case ENCOUNTERS.encountertype.REWARD:
                gui = new REWARDSGUI.RewardsGui(result);
                gui.loadRewardEvent();
                break;
        }
        // Any other type of encounter is Non-Combat, so hide the Combat div
        if(currentPopups.combat) cleanupCombat();
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

    // Entering a "Dungeon"
    GAME.MAP.addEventListener("enterdungeon", dungeonStationEvent);
    // Entering a Station
    GAME.MAP.addEventListener("enterstation", dungeonStationEvent);

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